import { z } from "zod";
import { idSchema } from "../../shared/financeSchemas";

const hasMaxTwoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
const markValue = z
  .number({ error: "Marks must be a number" })
  .min(0, "Marks cannot be negative")
  .max(1000)
  .refine(hasMaxTwoDecimals, "Marks can have at most 2 decimal places");

/*
 * One mark. Absent: nothing else. A subject with parts: the marks of every part
 * ({"Written": 45, "MCQ": 22.5}); without parts: the total.
 */
const markFields = {
  isAbsent: z.boolean().default(false),
  total: markValue.optional(),
  parts: z.record(z.string(), markValue).optional(),
};

type MarkShape = { isAbsent: boolean; total?: number; parts?: Record<string, number> };

/* The rules every mark entry follows: absent = no marks; otherwise the total or the parts. */
const markRules = (e: MarkShape, ctx: z.RefinementCtx) => {
  if (e.isAbsent && (e.total !== undefined || e.parts !== undefined)) {
    ctx.addIssue({ code: "custom", message: "An absent student has no marks", path: ["isAbsent"] });
  }
  if (!e.isAbsent && (e.total === undefined) === (e.parts === undefined)) {
    ctx.addIssue({ code: "custom", message: "Give the total, or the marks of each part", path: ["total"] });
  }
};

const unique = (keys: string[]) => new Set(keys).size === keys.length;

// --------------------------------------------- one subject, one section (teachers)

const sheetQuery = z.object({
  examSubjectId: idSchema("Exam subject"),
  sectionId: idSchema("Section"),
});

const saveSheet = z.strictObject({
  examSubjectId: idSchema("Exam subject"),
  sectionId: idSchema("Section"),
  marks: z
    .array(z.strictObject({ enrollmentId: idSchema("Student enrollment"), ...markFields }).superRefine(markRules))
    .min(1, "Enter at least one student's marks")
    .max(300)
    .refine((es) => unique(es.map((e) => e.enrollmentId)), "A student is listed twice"),
});

// ------------------------------------------- every subject, one section (admins)

const gridQuery = z.object({
  examId: idSchema("Exam"),
  classId: idSchema("Class"),
  sectionId: idSchema("Section"),
});

/* Any cells of the section grid: student x subject. All saved, or none. */
const saveGrid = z.strictObject({
  examId: idSchema("Exam"),
  classId: idSchema("Class"),
  sectionId: idSchema("Section"),
  marks: z
    .array(
      z
        .strictObject({
          enrollmentId: idSchema("Student enrollment"),
          examSubjectId: idSchema("Exam subject"),
          ...markFields,
        })
        .superRefine(markRules),
    )
    .min(1, "Enter at least one mark")
    .max(5000)
    .refine((es) => unique(es.map((e) => `${e.enrollmentId}:${e.examSubjectId}`)), "The same student and subject is listed twice"),
});

// -------------------------------------------------- one student, every subject

const studentQuery = z.object({
  examId: idSchema("Exam"),
  enrollmentId: idSchema("Student enrollment"),
});

const saveStudent = z.strictObject({
  examId: idSchema("Exam"),
  enrollmentId: idSchema("Student enrollment"),
  marks: z
    .array(z.strictObject({ examSubjectId: idSchema("Exam subject"), ...markFields }).superRefine(markRules))
    .min(1, "Enter at least one subject's marks")
    .max(60)
    .refine((es) => unique(es.map((e) => e.examSubjectId)), "A subject is listed twice"),
});

// ---------------------------------------------------------------------- other

const progressQuery = z.object({
  examId: idSchema("Exam"),
  classId: idSchema("Class"),
});

const mineQuery = z.object({
  examId: z.string().trim().min(1).optional(),
});

export const ExamMarksValidation = {
  sheetQuery,
  saveSheet,
  gridQuery,
  saveGrid,
  studentQuery,
  saveStudent,
  progressQuery,
  mineQuery,
};

export type MarkEntry = MarkShape;
export type SheetQuery = z.infer<typeof sheetQuery>;
export type SaveSheetPayload = z.infer<typeof saveSheet>;
export type GridQuery = z.infer<typeof gridQuery>;
export type SaveGridPayload = z.infer<typeof saveGrid>;
export type StudentQuery = z.infer<typeof studentQuery>;
export type SaveStudentPayload = z.infer<typeof saveStudent>;
export type ProgressQuery = z.infer<typeof progressQuery>;
export type MineQuery = z.infer<typeof mineQuery>;
