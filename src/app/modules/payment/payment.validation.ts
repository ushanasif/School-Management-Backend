import { z } from "zod";
import { PaymentMethod, PaymentStatus } from "../../../../generated/prisma/enums";
import { idSchema, moneySchema } from "../../shared/financeSchemas";

const notFuture = (d: Date) => d.getTime() <= Date.now() + 60_000;

const allocation = z.object({
  studentFeeId: idSchema("Fee"),
  // omitted = pay the full remaining amount of this fee
  amount: moneySchema.optional(),
});

const recordPayment = z
  .object({
    studentId: idSchema("Student"),
    method: z.enum(PaymentMethod).default("CASH"),
    transactionRef: z.string().trim().min(3).max(100).optional(),
    paidAt: z.coerce
      .date({ error: "Valid payment date is required" })
      .refine(notFuture, "Payment date cannot be in the future")
      .optional(),
    allocations: z
      .array(allocation)
      .min(1, "Select at least one fee to pay")
      .max(60, "A payment can cover at most 60 fees"),
  })
  .refine((d) => d.method !== "MOBILE_BANKING" || !!d.transactionRef, {
    message: "Transaction reference is required for mobile banking",
    path: ["transactionRef"],
  })
  .refine(
    (d) => new Set(d.allocations.map((a) => a.studentFeeId)).size === d.allocations.length,
    { message: "Each fee can appear only once per payment", path: ["allocations"] },
  );

const cancelPayment = z.object({
  reason: z.string({ error: "Cancel reason is required!" }).trim().min(3).max(300),
});

const paymentIdParams = z.object({ paymentId: idSchema("Payment id") });
const studentIdParams = z.object({ studentId: idSchema("Student id") });

const payableQuery = z.object({
  academicYearId: z.string().trim().min(1).optional(),
});

const listPaymentsQuery = z
  .object({
    studentId: z.string().trim().min(1).optional(),
    status: z.enum(PaymentStatus).optional(),
    method: z.enum(PaymentMethod).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((d) => !d.from || !d.to || d.from <= d.to, {
    message: "'from' must be earlier than 'to'",
    path: ["to"],
  });

export const PaymentValidation = {
  recordPayment,
  cancelPayment,
  paymentIdParams,
  studentIdParams,
  payableQuery,
  listPaymentsQuery,
};