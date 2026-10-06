import { z } from "zod";
import { Gender, Religion, StudentStatus } from "../../../../generated/prisma/enums";
import { idSchema } from "../../shared/financeSchemas";
import { bdPhoneSchema, emailSchema } from "../../utils/identity";

// forms send "" for blank fields: treat that as "not provided" (or null on update)
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const name = (label: string) =>
  z.string({ error: `${label} is required!` }).trim().min(2, `${label} is required!`).max(150);

const dob = z.coerce.date().refine((d) => d.getTime() < Date.now(), "Date of birth must be in the past");
const url = z.string().trim().url("Enter a valid URL").max(500);
const admissionNo = z.string().trim().min(1).max(30);

// optional on create ("" and missing both mean not provided)
const opt = <T extends z.ZodType>(schema: T) => z.preprocess(blank, schema.optional());
// clearable on update (null or "" clears the field, missing leaves it alone)
const clearable = <T extends z.ZodType>(schema: T) => z.preprocess(blankToNull, schema.nullable().optional());

const text = (max: number) => z.string().trim().max(max);

const enrollmentInput = z.object({
  // defaults to the school's current academic year
  academicYearId: opt(z.string().trim().min(1)),
  classId: idSchema("Class"),
  sectionId: idSchema("Section"),
  groupId: opt(z.string().trim().min(1)),
  rollNumber: opt(
    z.string().trim().regex(/^[A-Za-z0-9-]{1,10}$/, "Roll number: letters, digits and dashes only (max 10)"),
  ),
});

const createStudent = z.object({
  // leave out to have one generated, e.g. 20270001
  admissionNo: opt(admissionNo),
  nameEn: name("English name"),
  nameBn: name("Bangla name"),
  gender: z.enum(Gender, { error: "Gender is required!" }),
  fatherName: name("Father's name"),
  motherName: name("Mother's name"),
  dob: opt(dob),
  // the family's login number; the account is created from it
  phone: opt(bdPhoneSchema),
  email: opt(emailSchema),
  whatsApp: opt(text(20)),
  presentAddress: opt(text(300)),
  permanentAddress: opt(text(300)),
  photo: opt(url),
  // required: it decides which religion subject the student takes
  religion: z.enum(Religion, { error: "Religion is required!" }),
  guardianName: opt(text(150)),
  guardianPhone: opt(bdPhoneSchema),
  enrollment: enrollmentInput,
});

// strictObject: unknown fields are rejected. Class/section/roll changes belong to
// the enrollment step, so sending `enrollment` here is an error.
const updateStudent = z
  .strictObject({
    admissionNo: admissionNo.optional(),
    nameEn: name("English name").optional(),
    nameBn: name("Bangla name").optional(),
    gender: z.enum(Gender).optional(),
    fatherName: name("Father's name").optional(),
    motherName: name("Mother's name").optional(),
    status: z.enum(StudentStatus).optional(),
    dob: clearable(dob),
    phone: clearable(bdPhoneSchema),
    email: clearable(emailSchema),
    whatsApp: clearable(text(20)),
    presentAddress: clearable(text(300)),
    permanentAddress: clearable(text(300)),
    photo: clearable(url),
    // can be changed but not cleared
    religion: z.enum(Religion).optional(),
    guardianName: clearable(text(150)),
    guardianPhone: clearable(bdPhoneSchema),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field to update" });

const studentIdParams = z.object({ studentId: idSchema("Student id") });

const listStudentsQuery = z.object({
  search: z.string().trim().min(1).optional(),
  status: z.enum(StudentStatus).optional(),
  religion: z.enum(Religion).optional(),
  // class/section/group filters use this year, or the current year when omitted
  academicYearId: z.string().trim().min(1).optional(),
  classId: z.string().trim().min(1).optional(),
  sectionId: z.string().trim().min(1).optional(),
  groupId: z.string().trim().min(1).optional(),
  hasAccount: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(["admissionNo", "nameEn", "createdAt"]).default("admissionNo"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const StudentValidation = {
  createStudent,
  updateStudent,
  studentIdParams,
  listStudentsQuery,
};