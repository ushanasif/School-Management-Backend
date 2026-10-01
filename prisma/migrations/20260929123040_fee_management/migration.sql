/*
  Warnings:

  - The values [PARTIALLY_PAID] on the enum `FeeStatus` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `updatedAt` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Made the column `method` on table `Payment` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `originalAmount` to the `StudentFee` table without a default value. This is not possible if the table is not empty.
  - Made the column `classId` on table `StudentFee` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Month" AS ENUM ('JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MOBILE_BANKING');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESS', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FundTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "FeeFrequency" ADD VALUE 'CUSTOM';

-- AlterEnum
BEGIN;
CREATE TYPE "FeeStatus_new" AS ENUM ('DUE', 'PARTIAL', 'PAID', 'UNPAID', 'WAIVED');
ALTER TABLE "public"."StudentFee" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StudentFee" ALTER COLUMN "status" TYPE "FeeStatus_new" USING ("status"::text::"FeeStatus_new");
ALTER TYPE "FeeStatus" RENAME TO "FeeStatus_old";
ALTER TYPE "FeeStatus_new" RENAME TO "FeeStatus";
DROP TYPE "public"."FeeStatus_old";
ALTER TABLE "StudentFee" ALTER COLUMN "status" SET DEFAULT 'UNPAID';
COMMIT;

-- DropForeignKey
ALTER TABLE "PaymentAllocation" DROP CONSTRAINT "PaymentAllocation_studentFeeId_fkey";

-- DropForeignKey
ALTER TABLE "StudentFee" DROP CONSTRAINT "StudentFee_classId_fkey";

-- AlterTable
ALTER TABLE "FeeStructure" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "FeeType" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "method" SET NOT NULL;

-- AlterTable
ALTER TABLE "StudentFee" ADD COLUMN     "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "discountedAt" TIMESTAMP(3),
ADD COLUMN     "discountedBy" TEXT,
ADD COLUMN     "originalAmount" DECIMAL(12,2) NOT NULL,
ALTER COLUMN "classId" SET NOT NULL;

-- CreateTable
CREATE TABLE "FeeStructureMonth" (
    "id" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "FeeStructureMonth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeeStructureMonth_feeStructureId_idx" ON "FeeStructureMonth"("feeStructureId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructureMonth_feeStructureId_month_key" ON "FeeStructureMonth"("feeStructureId", "month");

-- AddForeignKey
ALTER TABLE "FeeStructureMonth" ADD CONSTRAINT "FeeStructureMonth_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFee" ADD CONSTRAINT "StudentFee_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "StudentFee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
