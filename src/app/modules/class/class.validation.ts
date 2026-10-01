import { z } from "zod";

const createClass = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Class name is required")
      .max(50, "Class name cannot exceed 50 characters"),

    numericLevel: z.number().nonnegative({error: 'Numeric value cannot be negative number'})
  })
  

export const ClassValidation = {
  createClass,
};