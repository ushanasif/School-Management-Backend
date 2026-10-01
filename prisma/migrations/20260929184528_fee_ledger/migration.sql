-- CreateEnum
-- (dropped first because a previous failed run may already have created it)
DROP TYPE IF EXISTS "FundTransactionSource";
CREATE TYPE "FundTransactionSource" AS ENUM ('PAYMENT', 'PAYMENT_REVERSAL', 'MANUAL_DEPOSIT', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT');

-- AlterEnum: FeeFrequency (FeeType uses it, so swap the type in place)
CREATE TYPE "FeeFrequency_new" AS ENUM ('ONE_TIME', 'MONTHLY');
ALTER TABLE "FeeType" ALTER COLUMN "frequency" TYPE "FeeFrequency_new" USING ("frequency"::text::"FeeFrequency_new");
ALTER TYPE "FeeFrequency" RENAME TO "FeeFrequency_old";
ALTER TYPE "FeeFrequency_new" RENAME TO "FeeFrequency";
DROP TYPE "public"."FeeFrequency_old";

-- FundTransactionType: no table used it before, so drop and recreate
DROP TYPE "FundTransactionType";
CREATE TYPE "FundTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT');

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_studentId_fkey";

-- DropForeignKey
ALTER TABLE "StudentFee" DROP CONSTRAINT "StudentFee_academicYearId_fkey";

-- DropForeignKey
ALTER TABLE "StudentFee" DROP CONSTRAINT "StudentFee_classId_fkey";

-- DropForeignKey
ALTER TABLE "StudentFee" DROP CONSTRAINT "StudentFee_studentId_fkey";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'SUCCESS',
DROP COLUMN "method",
ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'CASH';

-- AlterTable
ALTER TABLE "StudentFee" DROP COLUMN "originalAmount",
ALTER COLUMN "classId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SchoolSequence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SchoolSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundTransaction" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "type" "FundTransactionType" NOT NULL,
    "source" "FundTransactionSource" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "category" TEXT,
    "paymentAllocationId" TEXT,
    "transferId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolSequence_schoolId_idx" ON "SchoolSequence"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSequence_schoolId_key_key" ON "SchoolSequence"("schoolId", "key");

-- CreateIndex
CREATE INDEX "FundTransaction_schoolId_transactionDate_idx" ON "FundTransaction"("schoolId", "transactionDate");

-- CreateIndex
CREATE INDEX "FundTransaction_fundId_transactionDate_idx" ON "FundTransaction"("fundId", "transactionDate");

-- CreateIndex
CREATE INDEX "FundTransaction_paymentAllocationId_idx" ON "FundTransaction"("paymentAllocationId");

-- CreateIndex
CREATE INDEX "FundTransaction_transferId_idx" ON "FundTransaction"("transferId");

-- CreateIndex
CREATE INDEX "Payment_schoolId_status_paidAt_idx" ON "Payment"("schoolId", "status", "paidAt");

-- CreateIndex
CREATE INDEX "StudentFee_schoolId_academicYearId_classId_status_idx" ON "StudentFee"("schoolId", "academicYearId", "classId", "status");

-- AddForeignKey
ALTER TABLE "StudentFee" ADD CONSTRAINT "StudentFee_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFee" ADD CONSTRAINT "StudentFee_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFee" ADD CONSTRAINT "StudentFee_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSequence" ADD CONSTRAINT "SchoolSequence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundTransaction" ADD CONSTRAINT "FundTransaction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundTransaction" ADD CONSTRAINT "FundTransaction_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundTransaction" ADD CONSTRAINT "FundTransaction_paymentAllocationId_fkey" FOREIGN KEY ("paymentAllocationId") REFERENCES "PaymentAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;