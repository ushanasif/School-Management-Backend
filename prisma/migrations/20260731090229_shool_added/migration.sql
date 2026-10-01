/*
  Warnings:

  - You are about to drop the column `name` on the `School` table. All the data in the column will be lost.
  - You are about to drop the `SchoolSetting` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[code]` on the table `School` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[subdomain]` on the table `School` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `School` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name_en` to the `School` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subdomain` to the `School` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `School` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'BN');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BKASH', 'NAGAD', 'ROCKET', 'BANK');

-- AlterTable
ALTER TABLE "School" DROP COLUMN "name",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "favicon" TEXT,
ADD COLUMN     "language" "Language" NOT NULL DEFAULT 'BN',
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "name_bn" TEXT,
ADD COLUMN     "name_en" TEXT NOT NULL,
ADD COLUMN     "status" "SchoolStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "subdomain" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "website" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL;

-- DropTable
DROP TABLE "SchoolSetting";

-- CreateTable
CREATE TABLE "SchoolBilling" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "monthlyFee" DECIMAL(10,2) NOT NULL,
    "nextDueDate" TIMESTAMP(3),
    "lastPaidDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolBilling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolPayment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "transactionNo" TEXT,
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "receivedByUserId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolBilling_schoolId_key" ON "SchoolBilling"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolPayment_schoolId_idx" ON "SchoolPayment"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolPayment_paidAt_idx" ON "SchoolPayment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPayment_schoolId_billingPeriodStart_billingPeriodEnd_key" ON "SchoolPayment"("schoolId", "billingPeriodStart", "billingPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- CreateIndex
CREATE UNIQUE INDEX "School_subdomain_key" ON "School"("subdomain");

-- CreateIndex
CREATE INDEX "School_subdomain_idx" ON "School"("subdomain");

-- CreateIndex
CREATE INDEX "School_status_idx" ON "School"("status");

-- AddForeignKey
ALTER TABLE "SchoolBilling" ADD CONSTRAINT "SchoolBilling_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPayment" ADD CONSTRAINT "SchoolPayment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
