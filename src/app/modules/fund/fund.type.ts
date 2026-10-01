import type { z } from "zod";
import { FundValidation } from "./fund.validation";

export type CreateFundPayload = z.infer<typeof FundValidation.createFund>;
export type UpdateFundPayload = z.infer<typeof FundValidation.updateFund>;
export type DepositPayload = z.infer<typeof FundValidation.deposit>;
export type TransferPayload = z.infer<typeof FundValidation.transfer>;
export type LedgerQuery = z.infer<typeof FundValidation.ledgerQuery>;