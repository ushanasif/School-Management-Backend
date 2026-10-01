/*
  Warnings:

  - A unique constraint covering the columns `[reversesId]` on the table `FundTransaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "FundTransaction" ADD COLUMN     "reversesId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FundTransaction_reversesId_key" ON "FundTransaction"("reversesId");

-- AddForeignKey
ALTER TABLE "FundTransaction" ADD CONSTRAINT "FundTransaction_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "FundTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- The same mobile-banking transaction id can't be used for two successful payments.
-- A cancelled payment frees its reference.
CREATE UNIQUE INDEX "Payment_transactionRef_unique"
  ON "Payment" ("schoolId", "transactionRef")
  WHERE "transactionRef" IS NOT NULL AND "status" = 'SUCCESS';