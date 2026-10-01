import type { z } from "zod";
import { FeeStructureValidation } from "./feeStructure.validation";


export type CreateFeeStructurePayload = z.infer<typeof FeeStructureValidation.createFeeStructure>;
export type ListFeeStructuresQuery = z.infer<typeof FeeStructureValidation.listFeeStructuresQuery>;