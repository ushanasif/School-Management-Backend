import { prisma } from "../../../lib/prisma";

// jobs/cleanupRefreshTokens.ts
export async function cleanupExpiredRefreshTokens() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30); // keep revoked/expired rows for 30 days, then purge

  await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
    },
  });
}