/*
  Warnings:

  - Added the required column `sessionStartedAt` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sessionType` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.

*/

DELETE FROM "RefreshToken";
-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('PLATFORM', 'SCHOOL');

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_userId_fkey";

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "sessionStartedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "sessionType" "SessionType" NOT NULL,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tokensValidAfter" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- NULLs are distinct in unique indexes, so platform roles need partial indexes
CREATE UNIQUE INDEX "Role_platform_name_key" ON "Role" ("name") WHERE "schoolId" IS NULL;
CREATE UNIQUE INDEX "UserRole_platform_key" ON "UserRole" ("userId", "roleId") WHERE "membershipId" IS NULL;