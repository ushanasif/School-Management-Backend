import { z } from "zod";

const createAcademicYear = z
  .object({
    name: z
      .string({error: 'Academic year name is required!'})
      .trim()
      .min(1, "Academic year name is required")
      .max(50, "Academic year name cannot exceed 50 characters"),

    startDate: z.coerce.date({
      error: "Valid start date is required",
    }),

    endDate: z.coerce.date({
      error: "Valid end date is required", 
    }),

    isCurrent: z.boolean().optional().default(false),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export const AcademicYearValidation = {
  createAcademicYear,
};