import { z } from "zod";
import { AttendanceStatus } from "../../../../generated/prisma/enums";
import { idSchema } from "../../shared/financeSchemas";
import { dateOnlySchema } from "../../shared/scheduleSchemas";

const DAY_MS = 86_400_000;
const optionalId = z.string().trim().min(1).optional();
const note = z.string().trim().max(200);

const studentRecord = z.strictObject({
  studentId: idSchema("Student"),
  status: z.enum(AttendanceStatus),
  note: note.optional(),
});

const teacherRecord = z.strictObject({
  teacherId: idSchema("Teacher"),
  status: z.enum(AttendanceStatus),
  note: note.optional(),
});

// --------------------------------------------------------------- students

const studentSheetQuery = z.object({
  sectionId: idSchema("Section"),
  // defaults to today
  date: dateOnlySchema.optional(),
});

/*
 * Saves a section's roll call. Students left out keep what they have, or are PRESENT
 * when this is the first save of the day: list only the absent / late / on leave ones.
 */
const saveStudentSheet = z.strictObject({
  sectionId: idSchema("Section"),
  date: dateOnlySchema,
  records: z
    .array(studentRecord)
    .max(300)
    .default([])
    .refine((rs) => new Set(rs.map((r) => r.studentId)).size === rs.length, "A student is listed twice"),
});

const dayQuery = z.object({
  // defaults to today
  date: dateOnlySchema.optional(),
  classId: optionalId,
});

const rangeQuery = z
  .object({
    from: dateOnlySchema,
    to: dateOnlySchema,
  })
  .refine((d) => d.to >= d.from && d.to.getTime() - d.from.getTime() <= 366 * DAY_MS, {
    message: "The period must be at most one year, with to after from",
    path: ["to"],
  });

const studentIdParams = z.object({ studentId: idSchema("Student id") });
const sectionIdParams = z.object({ sectionId: idSchema("Section id") });

const registerQuery = z.object({
  // "2027-03"
  month: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use the month format YYYY-MM"),
});

// --------------------------------------------------------------- teachers

const teacherSheetQuery = z.object({
  // defaults to today
  date: dateOnlySchema.optional(),
});

const saveTeacherSheet = z.strictObject({
  date: dateOnlySchema,
  records: z
    .array(teacherRecord)
    .max(300)
    .default([])
    .refine((rs) => new Set(rs.map((r) => r.teacherId)).size === rs.length, "A teacher is listed twice"),
});

const teacherIdParams = z.object({ teacherId: idSchema("Teacher id") });

export const AttendanceValidation = {
  studentSheetQuery,
  saveStudentSheet,
  dayQuery,
  rangeQuery,
  studentIdParams,
  sectionIdParams,
  registerQuery,
  teacherSheetQuery,
  saveTeacherSheet,
  teacherIdParams,
};

export type StudentSheetQuery = z.infer<typeof studentSheetQuery>;
export type SaveStudentSheetPayload = z.infer<typeof saveStudentSheet>;
export type DayQuery = z.infer<typeof dayQuery>;
export type RangeQuery = z.infer<typeof rangeQuery>;
export type RegisterQuery = z.infer<typeof registerQuery>;
export type TeacherSheetQuery = z.infer<typeof teacherSheetQuery>;
export type SaveTeacherSheetPayload = z.infer<typeof saveTeacherSheet>;
