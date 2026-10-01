
CREATE UNIQUE INDEX "StudentFee_one_time_unique"
  ON "StudentFee" ("studentId", "feeStructureId")
  WHERE "month" IS NULL AND "feeStructureId" IS NOT NULL;

ALTER TABLE "StudentFee"
  ADD CONSTRAINT "StudentFee_amounts_valid"
  CHECK (
    "amount" >= 0
    AND "discountAmount" >= 0
    AND "discountAmount" <= "amount"
    AND "paidAmount" >= 0
    AND "paidAmount" <= "amount" - "discountAmount"
  );

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "PaymentAllocation"
  ADD CONSTRAINT "PaymentAllocation_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "FundTransaction"
  ADD CONSTRAINT "FundTransaction_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "FeeStructureMonth"
  ADD CONSTRAINT "FeeStructureMonth_month_range" CHECK ("month" BETWEEN 1 AND 12);