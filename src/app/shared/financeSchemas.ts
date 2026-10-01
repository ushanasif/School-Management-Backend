import { z } from "zod";

const hasMaxTwoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

/** Money that must be greater than zero (fee amounts, payments). */
export const moneySchema = z
  .number({ error: "Amount is required!" })
  .positive("Amount must be greater than zero")
  .max(9_999_999, "Amount is too large")
  .refine(hasMaxTwoDecimals, "Amount can have at most 2 decimal places");

/** Money that may be zero (discounts; 0 removes a discount). */
export const moneyOrZeroSchema = z
  .number({ error: "Amount is required!" })
  .min(0, "Amount cannot be negative")
  .max(9_999_999, "Amount is too large")
  .refine(hasMaxTwoDecimals, "Amount can have at most 2 decimal places");

export const monthSchema = z
  .number({ error: "Month is required!" })
  .int("Month must be a whole number")
  .min(1, "Month must be between 1 and 12")
  .max(12, "Month must be between 1 and 12");

export const yearSchema = z.number().int().min(2000).max(2100);

export const idSchema = (label: string) =>
  z.string({ error: `${label} is required!` }).trim().min(1, `${label} is required!`);