import { z } from "zod";
import { AbsentRule, ResultSystem } from "../../../../generated/prisma/enums";
import { idSchema } from "../../shared/financeSchemas";

const hasMaxTwoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

const decimal = (label: string, min: number, max: number) =>
  z
    .number({ error: `${label} is required!` })
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} cannot be more than ${max}`)
    .refine(hasMaxTwoDecimals, `${label} can have at most 2 decimal places`);

const grade = z.string({ error: "Grade is required!" }).trim().min(1, "Grade is required!").max(10);

const markBand = z.strictObject({
  // the band runs from here up to the next band's start
  minPercent: decimal("Start %", 0, 100),
  grade,
  point: decimal("Grade point", 0, 10),
});

const gpaBand = z.strictObject({
  minGpa: decimal("Start GPA", 0, 10),
  grade,
});

const unique = <T>(items: T[], key: (i: T) => unknown) => new Set(items.map(key)).size === items.length;

// one body for create and update (an update replaces the bands)
const scaleBody = z
  .strictObject({
    name: z.string({ error: "Name is required!" }).trim().min(1, "Name is required!").max(50),
    description: z.string().trim().max(300).optional(),
    maxGpa: decimal("Maximum GPA", 1, 10),
    failGrade: z.string().trim().min(1).max(10).default("F"),
    failIfAnyCompulsoryFails: z.boolean().default(true),
    optionalBonusEnabled: z.boolean().default(true),
    optionalBonusThreshold: decimal("Bonus threshold", 0, 10).default(2),
    markBands: z.array(markBand).min(2, "Add at least two bands").max(20),
    gpaBands: z.array(gpaBand).min(2, "Add at least two bands").max(20),
  })
  .refine((d) => d.markBands.some((b) => b.minPercent === 0), {
    message: "One marks band must start at 0%",
    path: ["markBands"],
  })
  .refine((d) => unique(d.markBands, (b) => b.minPercent) && unique(d.markBands, (b) => b.grade), {
    message: "Each marks band needs its own start % and its own grade",
    path: ["markBands"],
  })
  .refine(
    (d) => {
      // a higher % never gives fewer points
      const sorted = [...d.markBands].sort((a, b) => a.minPercent - b.minPercent);
      return sorted.every((b, i) => i === 0 || b.point >= sorted[i - 1].point);
    },
    { message: "A higher marks band cannot have fewer points than a lower one", path: ["markBands"] },
  )
  .refine((d) => d.markBands.every((b) => b.point <= d.maxGpa), {
    message: "A grade point cannot be more than the maximum GPA",
    path: ["markBands"],
  })
  .refine((d) => d.gpaBands.some((b) => b.minGpa === 0), {
    message: "One GPA band must start at 0",
    path: ["gpaBands"],
  })
  .refine((d) => unique(d.gpaBands, (b) => b.minGpa) && unique(d.gpaBands, (b) => b.grade), {
    message: "Each GPA band needs its own start and its own grade",
    path: ["gpaBands"],
  })
  .refine((d) => d.gpaBands.every((b) => b.minGpa <= d.maxGpa), {
    message: "A GPA band cannot start above the maximum GPA",
    path: ["gpaBands"],
  })
  .refine((d) => d.optionalBonusThreshold <= d.maxGpa, {
    message: "The bonus threshold cannot be more than the maximum GPA",
    path: ["optionalBonusThreshold"],
  });

const scaleIdParams = z.object({ scaleId: idSchema("Grading scale id") });

const copyScale = z.strictObject({
  name: z.string({ error: "Name is required!" }).trim().min(1, "Name is required!").max(50),
});

// ------------------------------------------------------- class result settings

const classSettingsQuery = z.object({
  // defaults to the current academic year
  academicYearId: z.string().trim().min(1).optional(),
});

const setClassSetting = z
  .strictObject({
    // defaults to the current academic year
    academicYearId: z.string().trim().min(1).optional(),
    classId: idSchema("Class"),
    resultSystem: z.enum(ResultSystem),
    // required for GRADED, left out for MARKS_ONLY
    gradingScaleId: z.string().trim().min(1).optional(),
    combinePapers: z.boolean().default(true),
    absentRule: z.enum(AbsentRule).default("FAIL"),
  })
  .refine((d) => d.resultSystem !== "GRADED" || d.gradingScaleId !== undefined, {
    message: "Choose a grading scale for a graded result",
    path: ["gradingScaleId"],
  })
  .refine((d) => d.resultSystem !== "MARKS_ONLY" || d.gradingScaleId === undefined, {
    message: "A marks-only result has no grading scale",
    path: ["gradingScaleId"],
  });

export const GradingValidation = {
  scaleBody,
  scaleIdParams,
  copyScale,
  classSettingsQuery,
  setClassSetting,
};

export type ScalePayload = z.infer<typeof scaleBody>;
export type CopyScalePayload = z.infer<typeof copyScale>;
export type ClassSettingsQuery = z.infer<typeof classSettingsQuery>;
export type SetClassSettingPayload = z.infer<typeof setClassSetting>;
