import { z } from "zod";
import { idSchema } from "../../shared/financeSchemas";


const createFeeType = z.object({
  name: z.string({ error: "Fee type name is required!" }).trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  frequency: z.enum(["ONE_TIME", "MONTHLY"], {
    error: "Frequency must be ONE_TIME or MONTHLY",
  }),
  fundId: idSchema("Fund"),
});

// strictObject: sending `frequency` here is rejected. It is locked after creation
// because fee structures and student fees are built on it.
const updateFeeType = z
  .strictObject({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    fundId: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Provide at least one field to update",
  });

const feeTypeIdParams = z.object({ feeTypeId: idSchema("Fee type id") });

const listFeeTypesQuery = z.object({
  includeInactive: z.enum(["true", "false"]).optional(),
  frequency: z.enum(["ONE_TIME", "MONTHLY"]).optional(),
});

export const FeeTypeValidation = {
  createFeeType,
  updateFeeType,
  feeTypeIdParams,
  listFeeTypesQuery,
};