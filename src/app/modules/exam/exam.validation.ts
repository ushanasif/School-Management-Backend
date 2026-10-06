import { z } from "zod";
import { ExamType } from "../../../../generated/prisma/enums";
import { idSchema } from "../../shared/financeSchemas";
import { dateOnlySchema, timeSchema } from "../../shared/scheduleSchemas";

const optionalId = z.string().trim().min(1).optional();
const hasMaxTwoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

const nameEn = z.string({ error: "English name is required!" }).trim().min(1, "English name is required!").max(100);
const nameBn = z.string({ error: "Bangla name is required!" }).trim().min(1, "Bangla name is required!").max(100);

const marks = (label: string) =>
  z
    .number({ error: `${label} is required!` })
    .positive(`${label} must be more than 0`)
    .max(1000)
    .refine(hasMaxTwoDecimals, `${label} can have at most 2 decimal places`);

const uniqueIds = (ids: string[]) => new Set(ids).size === ids.length;

// ------------------------------------------------------------------- exams

const createExam = z
  .strictObject({
    // defaults to the current academic year
    academicYearId: optionalId,
    nameEn,
    nameBn,
    type: z.enum(ExamType),
    // true = every class ("select all"); false = only the classes in classIds
    allClasses: z.boolean().default(true),
    classIds: z.array(idSchema("Class")).max(100).default([]).refine(uniqueIds, "A class is listed twice"),
    // the attendance period shown on the result sheet; left out = year start to the last exam day
    attendanceFrom: dateOnlySchema.optional(),
    attendanceTo: dateOnlySchema.optional(),
  })
  .refine((d) => (d.allClasses ? d.classIds.length === 0 : d.classIds.length > 0), {
    message: "Choose all classes, or list the classes",
    path: ["classIds"],
  })
  .refine((d) => (d.attendanceFrom === undefined) === (d.attendanceTo === undefined), {
    message: "Give both attendance dates, or neither",
    path: ["attendanceTo"],
  })
  .refine((d) => !d.attendanceFrom || !d.attendanceTo || d.attendanceTo >= d.attendanceFrom, {
    message: "The attendance end date cannot be before its start date",
    path: ["attendanceTo"],
  });

// missing = leave as it is; null attendance dates = back to the default period
const updateExam = z
  .strictObject({
    nameEn: nameEn.optional(),
    nameBn: nameBn.optional(),
    attendanceFrom: dateOnlySchema.nullable().optional(),
    attendanceTo: dateOnlySchema.nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field to update" })
  .refine((d) => (d.attendanceFrom === undefined) === (d.attendanceTo === undefined), {
    message: "Change both attendance dates together",
    path: ["attendanceTo"],
  })
  .refine((d) => (d.attendanceFrom === null) === (d.attendanceTo === null), {
    message: "Clear both attendance dates together",
    path: ["attendanceTo"],
  })
  .refine((d) => !d.attendanceFrom || !d.attendanceTo || d.attendanceTo >= d.attendanceFrom, {
    message: "The attendance end date cannot be before its start date",
    path: ["attendanceTo"],
  });

const addClasses = z.strictObject({
  classIds: z.array(idSchema("Class")).min(1).max(100).refine(uniqueIds, "A class is listed twice"),
});

const examIdParams = z.object({ examId: idSchema("Exam id") });
const examClassParams = z.object({ examId: idSchema("Exam id"), classId: idSchema("Class id") });

const listExamsQuery = z.object({
  // defaults to the current academic year
  academicYearId: optionalId,
});

// ------------------------------------------------------------------ routine

const part = z
  .strictObject({
    name: z.string({ error: "Part name is required!" }).trim().min(1, "Part name is required!").max(30),
    fullMarks: marks("Part full marks"),
    passMarks: marks("Part pass marks"),
  })
  .refine((p) => p.passMarks <= p.fullMarks, { message: "Pass marks cannot be more than full marks", path: ["passMarks"] });

/*
 * One subject of the routine. Its marks are copied from the class subject's marks setup
 * unless given here (a monthly test out of 25); when given, give full and pass marks.
 */
const routineSubject = z
  .strictObject({
    classSubjectId: idSchema("Class subject"),
    // MULTIPLE exams only: each subject's own day
    date: dateOnlySchema.optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    fullMarks: marks("Full marks").optional(),
    passMarks: marks("Pass marks").optional(),
    parts: z
      .array(part)
      .max(5)
      .optional()
      .refine((ps) => !ps || new Set(ps.map((p) => p.name.toLowerCase())).size === ps.length, "Each part needs its own name"),
  })
  .refine((s) => (s.startTime === undefined) === (s.endTime === undefined), {
    message: "Give both start and end time, or neither",
    path: ["endTime"],
  })
  .refine((s) => !s.startTime || !s.endTime || s.endTime > s.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  })
  .refine((s) => (s.fullMarks === undefined) === (s.passMarks === undefined), {
    message: "Give both full and pass marks, or neither (to use the subject's marks setup)",
    path: ["passMarks"],
  })
  .refine((s) => s.parts === undefined || s.fullMarks !== undefined, {
    message: "Parts need the full and pass marks too",
    path: ["parts"],
  })
  .refine((s) => s.fullMarks === undefined || s.passMarks === undefined || s.passMarks <= s.fullMarks, {
    message: "Pass marks cannot be more than full marks",
    path: ["passMarks"],
  })
  .refine((s) => !s.parts || s.parts.length !== 1, { message: "Use no parts, or at least two", path: ["parts"] })
  .refine(
    (s) =>
      !s.parts ||
      s.parts.length === 0 ||
      Math.abs(s.parts.reduce((sum, p) => sum + p.fullMarks, 0) - (s.fullMarks ?? 0)) < 1e-6,
    { message: "The parts' full marks must add up to the full marks", path: ["parts"] },
  );

/* A class's whole routine for the exam; it replaces what was there. */
const setRoutine = z.strictObject({
  // SINGLE exams only: the one exam day
  date: dateOnlySchema.optional(),
  subjects: z
    .array(routineSubject)
    .min(1, "Add at least one subject")
    .max(40)
    .refine((ss) => uniqueIds(ss.map((s) => s.classSubjectId)), "A subject is listed twice"),
});

const setStatus = z.strictObject({
  // publishing the result is a separate step
  status: z.enum(["ROUTINE", "MARKS_ENTRY"]),
});

// --------------------------------------------------------- optional subjects

const optionalQuery = z.object({
  // defaults to the current academic year
  academicYearId: optionalId,
  classId: idSchema("Class"),
  sectionId: optionalId,
});

const setOptionalChoices = z.strictObject({
  choices: z
    .array(
      z.strictObject({
        enrollmentId: idSchema("Enrollment"),
        // null removes the choice
        classSubjectId: idSchema("Class subject").nullable(),
      }),
    )
    .min(1)
    .max(300)
    .refine((cs) => uniqueIds(cs.map((c) => c.enrollmentId)), "A student is listed twice"),
});

export const ExamValidation = {
  createExam,
  updateExam,
  addClasses,
  examIdParams,
  examClassParams,
  listExamsQuery,
  setRoutine,
  setStatus,
  optionalQuery,
  setOptionalChoices,
};

export type CreateExamPayload = z.infer<typeof createExam>;
export type UpdateExamPayload = z.infer<typeof updateExam>;
export type AddClassesPayload = z.infer<typeof addClasses>;
export type ListExamsQuery = z.infer<typeof listExamsQuery>;
export type SetRoutinePayload = z.infer<typeof setRoutine>;
export type SetStatusPayload = z.infer<typeof setStatus>;
export type OptionalQuery = z.infer<typeof optionalQuery>;
export type SetOptionalChoicesPayload = z.infer<typeof setOptionalChoices>;
