import { z } from "zod";
import { idSchema, moneyOrZeroSchema, moneySchema, monthSchema, yearSchema } from "../../shared/financeSchemas";


const listFeesQuery = z.object({
  academicYearId: z.string().trim().min(1).optional(),
  classId: z.string().trim().min(1).optional(),
  studentId: z.string().trim().min(1).optional(),
  feeTypeId: z.string().trim().min(1).optional(),
  status: z.enum(["UNPAID", "PARTIAL", "PAID", "WAIVED"]).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  // due=true: unpaid/partial fees whose month has started (one-time fees count as due)
  due: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const studentIdParams = z.object({ studentId: idSchema("Student id") });
const studentFeeIdParams = z.object({ studentFeeId: idSchema("Student fee id") });

const createCustomFee = z
  .object({
    studentId: idSchema("Student"),
    academicYearId: idSchema("Academic year"),
    feeTypeId: idSchema("Fee type"),
    amount: moneySchema,
    month: monthSchema.optional(),
    year: yearSchema.optional(),
    dueDate: z.coerce.date().optional(),
    description: z.string().trim().max(200).optional(),
  })
  .refine((d) => (d.month === undefined) === (d.year === undefined), {
    message: "month and year must be provided together",
    path: ["month"],
  });

const applyDiscount = z.object({
  discountAmount: moneyOrZeroSchema,
  discountReason: z.string().trim().max(300).optional(),
});

const monthDiscount = z.object({
  fromMonth: monthSchema,
  toMonth: monthSchema,
  discountAmount: moneyOrZeroSchema,
});

const bulkDiscount = z
  .object({
    studentId: idSchema("Student"),
    feeTypeId: idSchema("Fee type"),
    academicYearId: idSchema("Academic year"),
    // one flat amount on every row, OR different amounts per month range
    discountAmount: moneyOrZeroSchema.optional(),
    discounts: z.array(monthDiscount).min(1).max(12).optional(),
    discountReason: z.string().trim().max(300).optional(),
  })
  .refine((d) => (d.discountAmount !== undefined) !== (d.discounts !== undefined), {
    message: "Provide either discountAmount or discounts, not both",
    path: ["discountAmount"],
  });

export const StudentFeeValidation = {
  listFeesQuery,
  studentIdParams,
  studentFeeIdParams,
  createCustomFee,
  applyDiscount,
  bulkDiscount,
};