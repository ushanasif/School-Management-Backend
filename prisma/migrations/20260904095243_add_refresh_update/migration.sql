/*
  Warnings:

  - You are about to drop the column `familyId` on the `RefreshToken` table. All the data in the column will be lost.
  - You are about to drop the column `revokedAt` on the `RefreshToken` table. All the data in the column will be lost.
  - You are about to drop the column `usedAt` on the `RefreshToken` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "RefreshToken_familyId_idx";

-- AlterTable
ALTER TABLE "RefreshToken" DROP COLUMN "familyId",
DROP COLUMN "revokedAt",
DROP COLUMN "usedAt";
