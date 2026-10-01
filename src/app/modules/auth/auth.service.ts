import httpStatus from "http-status";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { authConfig } from "../../config/auth.config";
import { AppError } from "../../errorHandler/AppError";
import { JwtUtils } from "../../utils/jwt";
import { PasswordUtils } from "../../utils/password";
import type { ChangePasswordPayload, PlatformLoginPayload, SchoolLoginPayload } from "./auth.type";
import { RefreshTokenService, type ClientMeta } from "./refreshToken.service";

type AuthContext = NonNullable<Express.Request["auth"]>;

const signPlatformToken = (userId: string) =>
  JwtUtils.generateToken(
    { userId, sessionType: "PLATFORM", tokenType: "ACCESS" },
    authConfig.accessSecret,
    authConfig.accessTtlSeconds,
  );

const signSchoolToken = (userId: string, schoolId: string) =>
  JwtUtils.generateToken(
    { userId, sessionType: "SCHOOL", schoolId, tokenType: "ACCESS" },
    authConfig.accessSecret,
    authConfig.accessTtlSeconds,
  );

const publicUser = (user: {
  id: string;
  fullname: string;
  email: string | null;
  phone: string | null;
  mustChangePassword: boolean;
}) => ({
  id: user.id,
  fullname: user.fullname,
  email: user.email,
  phone: user.phone,
  mustChangePassword: user.mustChangePassword,
});

/*
 * Same message and same timing for "no such user" and "wrong password".
 * The inactive check comes after the password, so it can't be used to probe accounts.
 */
const authenticateUser = async (where: Prisma.UserWhereUniqueInput, password: string) => {
  const user = await prisma.user.findUnique({ where });

  const passwordOk = user
    ? await PasswordUtils.comparePassword(password, user.password)
    : await PasswordUtils.dummyCompare(password);

  if (!user || !passwordOk) {
    throw new AppError("Invalid credentials!", httpStatus.UNAUTHORIZED);
  }
  if (!user.isActive) {
    throw new AppError("Your account is inactive!", httpStatus.FORBIDDEN);
  }
  return user;
};

const isPlatformAdmin = async (userId: string) => {
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      membershipId: null,
      role: { name: "APP_ADMIN", scope: "PLATFORM", schoolId: null },
    },
    select: { id: true },
  });
  return role !== null;
};

const rejectAndRevoke = async (familyId: string, message: string, status: number): Promise<never> => {
  await RefreshTokenService.revokeFamily(familyId);
  throw new AppError(message, status);
};

// ------------------------------------------------------------------ platform

const platformLogin = async (payload: PlatformLoginPayload, meta: ClientMeta) => {
  const user = await authenticateUser({ email: payload.email }, payload.password);

  if (!(await isPlatformAdmin(user.id))) {
    throw new AppError("You are not authorized as a platform administrator!", httpStatus.FORBIDDEN);
  }

  const session = await RefreshTokenService.issueSession(prisma, {
    userId: user.id,
    sessionType: "PLATFORM",
    meta,
  });

  return {
    accessToken: signPlatformToken(user.id),
    refreshToken: session.refreshToken,
    refreshExpiresAt: session.expiresAt,
    user: publicUser(user),
  };
};

const refreshPlatformAccessToken = async (rawRefreshToken: string, meta: ClientMeta) => {
  const stored = await RefreshTokenService.inspect(rawRefreshToken, { sessionType: "PLATFORM" });

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) {
    return rejectAndRevoke(stored.familyId, "User not found!", httpStatus.UNAUTHORIZED);
  }
  if (!user.isActive) {
    return rejectAndRevoke(stored.familyId, "Your account is inactive!", httpStatus.FORBIDDEN);
  }
  if (!(await isPlatformAdmin(user.id))) {
    return rejectAndRevoke(
      stored.familyId,
      "You are no longer authorized as a platform administrator!",
      httpStatus.FORBIDDEN,
    );
  }

  const session = await RefreshTokenService.rotate(stored, meta);

  return {
    accessToken: signPlatformToken(user.id),
    refreshToken: session.refreshToken,
    refreshExpiresAt: session.expiresAt,
    user: publicUser(user),
  };
};

// -------------------------------------------------------------------- school

const schoolLogin = async (
  payload: SchoolLoginPayload & { subdomain: string },
  meta: ClientMeta,
) => {
  const school = await prisma.school.findUnique({ where: { subdomain: payload.subdomain } });
  if (!school) throw new AppError("School not found!", httpStatus.NOT_FOUND);
  if (school.status !== "ACTIVE") {
    throw new AppError("This school is not active!", httpStatus.FORBIDDEN);
  }

  // the identifier was normalised by the validation schema: lowercase email or +8801XXXXXXXXX
  const usedEmail = payload.identifier.includes("@");
  const user = await authenticateUser(
    usedEmail ? { email: payload.identifier } : { phone: payload.identifier },
    payload.password,
  );

  const membership = await prisma.schoolMembership.findFirst({
    where: { userId: user.id, schoolId: school.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!membership) {
    throw new AppError("You are not a member of this school!", httpStatus.FORBIDDEN);
  }

  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.id, membershipId: membership.id },
    select: { role: { select: { id: true, name: true, isSystem: true } } },
  });
  const isSuperAdmin = userRoles.some(
    (ur) => ur.role.name === "SCHOOL_SUPER_ADMIN" && ur.role.isSystem,
  );

  // The password is already verified, so specific messages are safe here.
  // The school super admin uses the school's email; everyone else uses a mobile number.
  if (isSuperAdmin && !usedEmail) {
    throw new AppError("School super admins must log in with their email address!", httpStatus.FORBIDDEN);
  }
  if (!isSuperAdmin && usedEmail) {
    throw new AppError("Please log in with your mobile number!", httpStatus.FORBIDDEN);
  }

  const session = await RefreshTokenService.issueSession(prisma, {
    userId: user.id,
    sessionType: "SCHOOL",
    schoolId: school.id,
    meta,
  });

  return {
    accessToken: signSchoolToken(user.id, school.id),
    refreshToken: session.refreshToken,
    refreshExpiresAt: session.expiresAt,
    user: publicUser(user),
    school: { id: school.id, nameEn: school.nameEn, nameBn: school.nameBn, subdomain: school.subdomain },
    roles: userRoles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
  };
};

const refreshSchoolAccessToken = async (
  rawRefreshToken: string,
  subdomain: string,
  meta: ClientMeta,
) => {
  const school = await prisma.school.findUnique({ where: { subdomain } });
  if (!school) throw new AppError("School not found!", httpStatus.NOT_FOUND);
  if (school.status !== "ACTIVE") {
    throw new AppError("This school is not active!", httpStatus.FORBIDDEN);
  }

  const stored = await RefreshTokenService.inspect(rawRefreshToken, {
    sessionType: "SCHOOL",
    schoolId: school.id,
  });

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) {
    return rejectAndRevoke(stored.familyId, "User not found!", httpStatus.UNAUTHORIZED);
  }
  if (!user.isActive) {
    return rejectAndRevoke(stored.familyId, "Your account is inactive!", httpStatus.FORBIDDEN);
  }

  const membership = await prisma.schoolMembership.findFirst({
    where: { userId: user.id, schoolId: school.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!membership) {
    return rejectAndRevoke(
      stored.familyId,
      "You are no longer authorized for this school!",
      httpStatus.FORBIDDEN,
    );
  }

  const session = await RefreshTokenService.rotate(stored, meta);

  return {
    accessToken: signSchoolToken(user.id, school.id),
    refreshToken: session.refreshToken,
    refreshExpiresAt: session.expiresAt,
    user: publicUser(user),
    school: { id: school.id, nameEn: school.nameEn, nameBn: school.nameBn, subdomain: school.subdomain },
  };
};

// ------------------------------------------------------------------- session

const logout = async (rawRefreshToken?: string) => {
  if (rawRefreshToken) await RefreshTokenService.endSession(rawRefreshToken);
};

const logoutAllSessions = async (userId: string) => {
  await RefreshTokenService.revokeAllUserTokens(userId);
};

/* Everything the frontend needs after load: user, school, roles, permissions, modules. */
const getMe = async (auth: AuthContext) => {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, fullname: true, email: true, phone: true, mustChangePassword: true },
  });
  if (!user) throw new AppError("User not found!", httpStatus.UNAUTHORIZED);

  if (auth.sessionType === "PLATFORM") {
    return { sessionType: "PLATFORM" as const, user };
  }

  const schoolId = auth.schoolId!;
  const membershipId = auth.membershipId!;

  const [school, userRoles, enabledModules] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        nameEn: true,
        nameBn: true,
        subdomain: true,
        language: true,
        logo: true,
        favicon: true,
      },
    }),
    prisma.userRole.findMany({
      where: { userId: auth.userId, membershipId },
      select: {
        role: {
          select: {
            id: true,
            name: true,
            isSystem: true,
            permissions: {
              select: { permission: { select: { code: true, isActive: true, moduleId: true } } },
            },
          },
        },
      },
    }),
    prisma.schoolModule.findMany({
      where: { schoolId, isEnabled: true, module: { isActive: true } },
      select: { moduleId: true, module: { select: { code: true } } },
    }),
  ]);

  const enabledModuleIds = new Set(enabledModules.map((m) => m.moduleId));
  const isSuperAdmin = userRoles.some(
    (ur) => ur.role.name === "SCHOOL_SUPER_ADMIN" && ur.role.isSystem,
  );

  let permissions: string[];
  if (isSuperAdmin) {
    const all = await prisma.permission.findMany({
      where: { isActive: true, moduleId: { in: [...enabledModuleIds] } },
      select: { code: true },
    });
    permissions = all.map((p) => p.code);
  } else {
    const codes = new Set<string>();
    for (const { role } of userRoles) {
      for (const { permission } of role.permissions) {
        if (permission.isActive && enabledModuleIds.has(permission.moduleId)) {
          codes.add(permission.code);
        }
      }
    }
    permissions = [...codes];
  }

  return {
    sessionType: "SCHOOL" as const,
    user,
    school,
    roles: userRoles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
    isSuperAdmin,
    permissions: permissions.sort(),
    modules: enabledModules.map((m) => m.module.code).sort(),
  };
};

/*
 * Changes the password, ends every other session (and every access token issued
 * so far), and starts a fresh session for this device so the user stays logged in.
 * Also clears the "must change password" flag set on generated passwords.
 */
const changePassword = async (
  auth: AuthContext,
  payload: ChangePasswordPayload,
  meta: ClientMeta,
) => {
  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) throw new AppError("User not found!", httpStatus.UNAUTHORIZED);

  // 400, not 401: a 401 would make the client try to refresh and loop
  const currentOk = await PasswordUtils.comparePassword(payload.currentPassword, user.password);
  if (!currentOk) throw new AppError("Current password is incorrect!", httpStatus.BAD_REQUEST);

  if (payload.currentPassword === payload.newPassword) {
    throw new AppError("New password must be different from the current one", httpStatus.BAD_REQUEST);
  }

  const passwordHash = await PasswordUtils.hashPassword(payload.newPassword);

  const session = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { password: passwordHash, mustChangePassword: false, tokensValidAfter: new Date() },
    });
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });

    return RefreshTokenService.issueSession(tx, {
      userId: user.id,
      sessionType: auth.sessionType,
      schoolId: auth.schoolId,
      meta,
    });
  });

  const accessToken =
    auth.sessionType === "PLATFORM"
      ? signPlatformToken(user.id)
      : signSchoolToken(user.id, auth.schoolId!);

  return { accessToken, refreshToken: session.refreshToken, refreshExpiresAt: session.expiresAt };
};

export const AuthService = {
  platformLogin,
  refreshPlatformAccessToken,
  schoolLogin,
  refreshSchoolAccessToken,
  logout,
  logoutAllSessions,
  getMe,
  changePassword,
};