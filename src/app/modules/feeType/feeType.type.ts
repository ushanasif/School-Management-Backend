import type { z } from "zod";
import { FeeTypeValidation } from "./feeType.validation";

export type CreateFeeTypePayload = z.infer<typeof FeeTypeValidation.createFeeType>;
export type UpdateFeeTypePayload = z.infer<typeof FeeTypeValidation.updateFeeType>;
export type ListFeeTypesQuery = z.infer<typeof FeeTypeValidation.listFeeTypesQuery>;