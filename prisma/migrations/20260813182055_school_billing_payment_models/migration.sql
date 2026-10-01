/*
  Warnings:

  - You are about to drop the column `code` on the `School` table. All the data in the column will be lost.
  - You are about to drop the column `billingPeriodEnd` on the `SchoolPayment` table. All the data in the column will be lost.
  - You are about to drop the column `billingPeriodStart` on the `SchoolPayment` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `SchoolPayment` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `SchoolPayment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[paymentCode]` on the table `SchoolPayment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `paidForMonth` to the `SchoolPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paidForYear` to the `SchoolPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentCode` to the `SchoolPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentDate` to the `SchoolPayment` table without a default value. This is not possible if the table is not empty.
  - Made the column `receivedByUserId` on table `SchoolPayment` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('PLATFORM', 'SCHOOL');

-- DropIndex
DROP INDEX "School_code_key";

-- DropIndex
DROP INDEX "SchoolPayment_paidAt_idx";

-- DropIndex
DROP INDEX "SchoolPayment_schoolId_billingPeriodStart_billingPeriodEnd_key";

-- AlterTable
ALTER TABLE "School" DROP COLUMN "code";

-- AlterTable
ALTER TABLE "SchoolBilling" ADD COLUMN     "activationDate" TIMESTAMP(3),
ADD COLUMN     "paidForMonth" INTEGER,
ADD COLUMN     "paidForYear" INTEGER;

-- AlterTable
ALTER TABLE "SchoolPayment" DROP COLUMN "billingPeriodEnd",
DROP COLUMN "billingPeriodStart",
DROP COLUMN "currency",
DROP COLUMN "paidAt",
ADD COLUMN     "paidForMonth" INTEGER NOT NULL,
ADD COLUMN     "paidForYear" INTEGER NOT NULL,
ADD COLUMN     "paymentCode" TEXT NOT NULL,
ADD COLUMN     "paymentDate" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "receivedByUserId" SET NOT NULL;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "schoolId" TEXT,
    "roleId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "scope" "RoleScope" NOT NULL,
    "schoolId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userCode_key" ON "User"("userCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "User_schoolId_phone_key" ON "User"("schoolId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_schoolId_email_key" ON "User"("schoolId", "email");

-- CreateIndex
CREATE INDEX "Role_schoolId_idx" ON "Role"("schoolId");

-- CreateIndex
CREATE INDEX "Role_scope_idx" ON "Role"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "Role_scope_schoolId_name_key" ON "Role"("scope", "schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Permission_module_idx" ON "Permission"("module");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPayment_paymentCode_key" ON "SchoolPayment"("paymentCode");

-- CreateIndex
CREATE INDEX "SchoolPayment_paymentDate_idx" ON "SchoolPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "SchoolPayment_paidForYear_paidForMonth_idx" ON "SchoolPayment"("paidForYear", "paidForMonth");

-- AddForeignKey
ALTER TABLE "SchoolPayment" ADD CONSTRAINT "SchoolPayment_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
