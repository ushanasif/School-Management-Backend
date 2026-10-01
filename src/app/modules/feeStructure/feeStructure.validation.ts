import { z } from "zod";
import { idSchema, moneySchema, monthSchema } from "../../shared/financeSchemas";


const monthPeriod = z.object({
  fromMonth: monthSchema,
  toMonth: monthSchema,
  amount: moneySchema,
});

const createFeeStructure = z
  .object({
    academicYearId: idSchema("Academic year"),
    classId: idSchema("Class"),
    feeTypeId: idSchema("Fee type"),
    // ONE_TIME fee, or a MONTHLY fee that costs the same every month
    amount: moneySchema.optional(),
    // MONTHLY fee that changes over the year, e.g. Jan-Apr 700, May-Dec 800
    monthlySchedule: z.array(monthPeriod).max(12).optional(),
  })
  .refine((d) => d.amount !== undefined || (d.monthlySchedule?.length ?? 0) > 0, {
    message: "Either amount or monthlySchedule is required",
    path: ["amount"],
  })
  .refine((d) => !(d.amount !== undefined && (d.monthlySchedule?.length ?? 0) > 0), {
    message: "Provide either amount or monthlySchedule, not both",
    path: ["monthlySchedule"],
  });

const feeStructureIdParams = z.object({ feeStructureId: idSchema("Fee structure id") });

const listFeeStructuresQuery = z.object({
  academicYearId: z.string().trim().min(1).optional(),
  classId: z.string().trim().min(1).optional(),
});

export const FeeStructureValidation = {
  createFeeStructure,
  feeStructureIdParams,
  listFeeStructuresQuery,
};