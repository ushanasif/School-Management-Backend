import httpStatus from "http-status";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { authConfig } from "../../config/auth.config";
import { AppError } from "../../errorHandler/AppError";
import { RefreshTokenUtils } from "../../utils/refreshToken";

type Db = Pick<Prisma.TransactionClient, "refreshToken">;

export type SessionKind = "PLATFORM" | "SCHOOL";
export type ClientMeta = { userAgent?: string; ipAddress?: string };

/*
 * Two tabs refreshing at the same moment is normal, not theft. The loser gets
 * this; the client retries once and picks up the cookie the winner just set.
 * The controller must NOT clear cookies for this error.
 */
export class RefreshRetryError extends AppError {
  constructor() {
    super("Session was just refreshed, please retry", httpStatus.CONFLICT);
  }
}

const unauthorized = (message: string) => new AppError(message, httpStatus.UNAUTHORIZED);
const hash = RefreshTokenUtils.hashRefreshToken;

// sliding window, but never past the absolute session cap
const expiryFor = (sessionStartedAt: Date, now: Date) =>
  new Date(
    Math.min(
      now.getTime() + authConfig.refreshTtlMs,
      sessionStartedAt.getTime() + authConfig.sessionMaxMs,
    ),
  );

/** Starts a brand new session (fresh family). Used at login and after a password change. */
const issueSession = async (
  db: Db,
  input: { userId: string; sessionType: SessionKind; schoolId?: string | null; meta?: ClientMeta },
) => {
  const now = new Date();
  const rawToken = RefreshTokenUtils.generateRefreshToken();
  const expiresAt = expiryFor(now, now);

  await db.refreshToken.create({
    data: {
      userId: input.userId,
      sessionType: input.sessionType,
      schoolId: input.schoolId ?? null,
      tokenHash: hash(rawToken),
      familyId: RefreshTokenUtils.generateFamilyId(),
      sessionStartedAt: now,
      expiresAt,
      userAgent: input.meta?.userAgent,
      ipAddress: input.meta?.ipAddress,
    },
  });

  return { refreshToken: rawToken, expiresAt };
};

const revokeFamily = (familyId: string) =>
  prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

/*
 * Step 1 of a refresh: find and validate the token. Changes nothing except
 * revoking the family when a stale token is replayed (theft signal).
 * The caller then checks the user / school state and only then calls rotate().
 */
const inspect = async (
  rawToken: string,
  expected: { sessionType: SessionKind; schoolId?: string },
) => {
  const now = new Date();
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(rawToken) } });

  if (!stored) throw unauthorized("Invalid refresh token!");

  if (stored.revokedAt) {
    if (now.getTime() - stored.revokedAt.getTime() <= authConfig.refreshReuseGraceMs) {
      throw new RefreshRetryError();
    }
    await revokeFamily(stored.familyId);
    throw unauthorized("Session compromised — please log in again.");
  }

  // a platform token must not work for a school, and school A's must not work for school B
  const wrongBinding =
    stored.sessionType !== expected.sessionType ||
    (expected.sessionType === "SCHOOL" && stored.schoolId !== expected.schoolId);
  if (wrongBinding) throw unauthorized("Invalid refresh token!");

  if (stored.expiresAt <= now) throw unauthorized("Refresh token has expired!");

  if (stored.sessionStartedAt.getTime() + authConfig.sessionMaxMs <= now.getTime()) {
    await revokeFamily(stored.familyId);
    throw unauthorized("Your session has expired — please log in again.");
  }

  return stored;
};

type StoredToken = Awaited<ReturnType<typeof inspect>>;

/** Step 2: atomically retire the old token and create its successor in the same family. */
const rotate = async (stored: StoredToken, meta?: ClientMeta) => {
  const now = new Date();
  const rawToken = RefreshTokenUtils.generateRefreshToken();
  const expiresAt = expiryFor(stored.sessionStartedAt, now);

  const rotated = await prisma.$transaction(async (tx) => {
    // only the request that flips this row continues; a parallel one gets count 0
    const revoked = await tx.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    if (revoked.count !== 1) return false;

    await tx.refreshToken.create({
      data: {
        userId: stored.userId,
        sessionType: stored.sessionType,
        schoolId: stored.schoolId,
        tokenHash: hash(rawToken),
        familyId: stored.familyId,
        sessionStartedAt: stored.sessionStartedAt,
        expiresAt,
        userAgent: meta?.userAgent ?? stored.userAgent,
        ipAddress: meta?.ipAddress ?? stored.ipAddress,
      },
    });
    return true;
  });

  if (!rotated) throw new RefreshRetryError();

  return { refreshToken: rawToken, expiresAt };
};

/** Logout: ends the whole session (every token of its family), even if an old token is presented. */
const endSession = async (rawToken: string) => {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash(rawToken) },
    select: { familyId: true },
  });
  if (stored) await prisma.refreshToken.deleteMany({ where: { familyId: stored.familyId } });
};

/** Logout everywhere. Also invalidates access tokens issued before now. */
const revokeAllUserTokens = async (userId: string) => {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { tokensValidAfter: new Date() } }),
  ]);
};

/** Housekeeping. Schedule it (daily) once you add Redis / a job runner. */
const purgeExpired = async () => {
  const now = new Date();
  const revokedCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const result = await prisma.refreshToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: revokedCutoff } }] },
  });
  return result.count;
};

export const RefreshTokenService = {
  issueSession,
  inspect,
  rotate,
  revokeFamily,
  endSession,
  revokeAllUserTokens,
  purgeExpired,
};