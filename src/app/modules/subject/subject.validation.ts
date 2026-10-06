import { z } from "zod";
import { Religion } from "../../../../generated/prisma/enums";
import { idSchema } from "../../shared/financeSchemas";

// both names are required: a school can work in Bangla or in English
const nameEn = z
  .string({ error: "English name is required!" })
  .trim()
  .min(1, "English name is required!")
  .max(100, "English name cannot exceed 100 characters");

const nameBn = z
  .string({ error: "Bangla name is required!" })
  .trim()
  .min(1, "Bangla name is required!")
  .max(100, "Bangla name cannot exceed 100 characters");

// NCTB code such as "101"
const code = z
  .string()
  .trim()
  .min(1)
  .max(20, "Code cannot exceed 20 characters")
  .regex(/^[A-Za-z0-9-]+$/, "Code: letters, digits and dashes only");

const createSubject = z
  .strictObject({
    nameEn,
    nameBn,
    code: code.optional(),
    // set for a paper: "Bangla 1st Paper" -> "Bangla"
    parentId: z.string().trim().min(1).optional(),
    // set for a religion subject: "Islam and Moral Education" -> ISLAM
    religion: z.enum(Religion).optional(),
  })
  .refine((d) => !(d.parentId && d.religion), {
    message: "A religion subject cannot be a paper",
    path: ["religion"],
  });

// missing = leave as it is, null = clear
const updateSubject = z
  .strictObject({
    nameEn: nameEn.optional(),
    nameBn: nameBn.optional(),
    code: code.nullable().optional(),
    parentId: z.string().trim().min(1).nullable().optional(),
    religion: z.enum(Religion).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field to update" })
  .refine((d) => !(d.parentId && d.religion), {
    message: "A religion subject cannot be a paper",
    path: ["religion"],
  });

const subjectIdParams = z.object({ subjectId: idSchema("Subject id") });

const listSubjectsQuery = z.object({
  search: z.string().trim().min(1).optional(),
  // PLATFORM = the shared NCTB list, SCHOOL = this school's own subjects
  source: z.enum(["PLATFORM", "SCHOOL"]).optional(),
});

export const SubjectValidation = {
  createSubject,
  updateSubject,
  subjectIdParams,
  listSubjectsQuery,
};
