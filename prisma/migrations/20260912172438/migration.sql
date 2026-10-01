/*
  Warnings:

  - You are about to drop the column `schoolId` on the `UserRole` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,roleId,membershipId]` on the table `UserRole` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_schoolId_fkey";

-- DropIndex
DROP INDEX "UserRole_schoolId_idx";

-- DropIndex
DROP INDEX "UserRole_userId_roleId_schoolId_key";

-- DropIndex
DROP INDEX "UserRole_userId_schoolId_idx";

-- AlterTable
ALTER TABLE "UserRole" DROP COLUMN "schoolId",
ADD COLUMN     "membershipId" TEXT;

-- CreateIndex
CREATE INDEX "UserRole_membershipId_idx" ON "UserRole"("membershipId");

-- CreateIndex
CREATE INDEX "UserRole_userId_membershipId_idx" ON "UserRole"("userId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_membershipId_key" ON "UserRole"("userId", "roleId", "membershipId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "SchoolMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
