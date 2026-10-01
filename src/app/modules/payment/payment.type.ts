import type { z } from "zod";
import { PaymentValidation } from "./payment.validation";

export type RecordPaymentPayload = z.infer<typeof PaymentValidation.recordPayment>;
export type CancelPaymentPayload = z.infer<typeof PaymentValidation.cancelPayment>;
export type ListPaymentsQuery = z.infer<typeof PaymentValidation.listPaymentsQuery>;