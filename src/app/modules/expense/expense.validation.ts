import { z } from "zod";
import { idSchema, moneySchema } from "../../shared/financeSchemas";

const notFuture = (d: Date) => d.getTime() <= Date.now() + 60_000;

const createExpense = z.object({
  fundId: idSchema("Fund"),
  amount: moneySchema,
  // free text such as "Electricity"; extra spaces are collapsed
  category: z
    .string({ error: "Category is required!" })
    .trim()
    .min(2)
    .max(100)
    .transform((v) => v.replace(/\s+/g, " ")),
  description: z.string().trim().max(500).optional(),
  transactionDate: z.coerce
    .date({ error: "Valid date is required" })
    .refine(notFuture, "Date cannot be in the future")
    .optional(),
});

const voidExpense = z.object({
  reason: z.string({ error: "Void reason is required!" }).trim().min(3).max(300),
});

const expenseIdParams = z.object({ expenseId: idSchema("Expense id") });

const listExpensesQuery = z
  .object({
    fundId: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    includeVoided: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((d) => !d.from || !d.to || d.from <= d.to, {
    message: "'from' must be earlier than 'to'",
    path: ["to"],
  });

export const ExpenseValidation = {
  createExpense,
  voidExpense,
  expenseIdParams,
  listExpensesQuery,
};