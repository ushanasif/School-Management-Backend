import type { PrismaClient } from "../../generated/prisma/client";
import { PasswordUtils } from "../../src/app/utils/password";

export async function seedPlatformAdmin(prisma: PrismaClient) {
  console.log("Seeding platform admin...");

  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const fullname = process.env.PLATFORM_ADMIN_NAME?.trim() || "Platform Admin";

  if (!email || !password) {
    console.log("  - skipped (set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD)");
    return;
  }
  if (password.length < 8) throw new Error("PLATFORM_ADMIN_PASSWORD must be at least 8 characters");

  // findFirst + create, because Prisma can't upsert on a compound unique with a NULL schoolId
  let role = await prisma.role.findFirst({
    where: { scope: "PLATFORM", schoolId: null, name: "APP_ADMIN" },
  });
  if (!role) {
    role = await prisma.role.create({
      data: {
        scope: "PLATFORM",
        schoolId: null,
        name: "APP_ADMIN",
        description: "Full access to the platform",
        isSystem: true,
      },
    });
  }

  // an existing account keeps its password; rerunning the seed never resets it
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { fullname, email, password: await PasswordUtils.hashPassword(password) },
    });
  }

  const assigned = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: role.id, membershipId: null },
  });
  if (!assigned) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id, membershipId: null },
    });
  }

  console.log(`  ✓ ${email} is APP_ADMIN`);
}