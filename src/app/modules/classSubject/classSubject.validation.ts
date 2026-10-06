import { z } from "zod";
import { SubjectType } from "../../../../generated/prisma/enums";
import { idSchema } from "../../shared/financeSchemas";

const optionalId = z.string().trim().min(1).optional();
const sortOrder = z.number().int().min(0).max(1000);

const item = z.strictObject({
  subjectId: idSchema("Subject"),
  // left out = the whole class; set = only students of that group (Science...)
  groupId: optionalId,
  type: z.enum(SubjectType).default("COMPULSORY"),
  // left out = after the subjects already in the class
  sortOrder: sortOrder.optional(),
});

const assignSubjects = z.strictObject({
  // defaults to the current academic year
  academicYearId: optionalId,
  classId: idSchema("Class"),
  items: z
    .array(item)
    .min(1, "Add at least one subject")
    .max(60, "Too many subjects at once")
    .refine(
      (items) => new Set(items.map((i) => `${i.subjectId}:${i.groupId ?? ""}`)).size === items.length,
      "The same subject (for the same group) is listed twice",
    ),
});

const listQuery = z.object({
  // defaults to the current academic year
  academicYearId: optionalId,
  classId: optionalId,
  groupId: optionalId,
});

const classSubjectIdParams = z.object({ classSubjectId: idSchema("Class subject id") });

// a different subject or group is a remove + assign
const updateClassSubject = z
  .strictObject({
    type: z.enum(SubjectType).optional(),
    sortOrder: sortOrder.optional(),
  })
  .refine((d) => d.type !== undefined || d.sortOrder !== undefined, {
    message: "Provide a type or a sort order",
  });

const hasMaxTwoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
const marks = (label: string) =>
  z
    .number({ error: `${label} is required!` })
    .positive(`${label} must be more than 0`)
    .max(1000)
    .refine(hasMaxTwoDecimals, `${label} can have at most 2 decimal places`);

const part = z
  .strictObject({
    name: z.string({ error: "Part name is required!" }).trim().min(1, "Part name is required!").max(30),
    fullMarks: marks("Part full marks"),
    passMarks: marks("Part pass marks"),
  })
  .refine((p) => p.passMarks <= p.fullMarks, { message: "Pass marks cannot be more than full marks", path: ["passMarks"] });

/*
 * The default marks of a class subject for every exam of the year. Parts are optional
 * (Written 70 + MCQ 30); when given, they must add up to the full marks. The whole setup
 * is replaced each time.
 */
const setMarks = z
  .strictObject({
    fullMarks: marks("Full marks"),
    passMarks: marks("Pass marks"),
    parts: z
      .array(part)
      .max(5)
      .default([])
      .refine((ps) => new Set(ps.map((p) => p.name.toLowerCase())).size === ps.length, "Each part needs its own name"),
    // this subject's own grading scale; null or left out = the class's scale
    gradingScaleId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => d.passMarks <= d.fullMarks, { message: "Pass marks cannot be more than full marks", path: ["passMarks"] })
  .refine((d) => d.parts.length !== 1, { message: "Use no parts, or at least two", path: ["parts"] })
  .refine(
    (d) => d.parts.length === 0 || Math.abs(d.parts.reduce((sum, p) => sum + p.fullMarks, 0) - d.fullMarks) < 1e-6,
    { message: "The parts' full marks must add up to the subject's full marks", path: ["parts"] },
  );

export const ClassSubjectValidation = {
  setMarks,
  assignSubjects,
  listQuery,
  classSubjectIdParams,
  updateClassSubject,
};
