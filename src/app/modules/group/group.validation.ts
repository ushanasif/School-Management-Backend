import { z } from "zod";
import { idSchema } from "../../shared/financeSchemas";

// both names are required: a school can work in Bangla or in English
const nameEn = z
  .string({ error: "English name is required!" })
  .trim()
  .min(1, "English name is required!")
  .max(50, "English name cannot exceed 50 characters");

const nameBn = z
  .string({ error: "Bangla name is required!" })
  .trim()
  .min(1, "Bangla name is required!")
  .max(50, "Bangla name cannot exceed 50 characters");

const createGroup = z.strictObject({ nameEn, nameBn });

const updateGroup = z
  .strictObject({ nameEn: nameEn.optional(), nameBn: nameBn.optional() })
  .refine((d) => d.nameEn !== undefined || d.nameBn !== undefined, {
    message: "Provide a name to change",
  });

const groupIdParams = z.object({ groupId: idSchema("Group id") });

const groupQuery = z.object({
  // student and subject counts are for this year; defaults to the current year
  academicYearId: z.string().trim().min(1).optional(),
});

export const GroupValidation = {
  createGroup,
  updateGroup,
  groupIdParams,
  groupQuery,
};
