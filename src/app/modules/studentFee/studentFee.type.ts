import type { z } from "zod";
import { StudentFeeValidation } from "./studentFee.validation";

export type ListFeesQuery = z.infer<typeof StudentFeeValidation.listFeesQuery>;
export type CreateCustomFeePayload = z.infer<typeof StudentFeeValidation.createCustomFee>;
export type ApplyDiscountPayload = z.infer<typeof StudentFeeValidation.applyDiscount>;
export type BulkDiscountPayload = z.infer<typeof StudentFeeValidation.bulkDiscount>;