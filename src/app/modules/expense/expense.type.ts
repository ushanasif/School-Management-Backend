import type { z } from "zod";
import { ExpenseValidation } from "./expense.validation";

export type CreateExpensePayload = z.infer<typeof ExpenseValidation.createExpense>;
export type VoidExpensePayload = z.infer<typeof ExpenseValidation.voidExpense>;
export type ListExpensesQuery = z.infer<typeof ExpenseValidation.listExpensesQuery>;