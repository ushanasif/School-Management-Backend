import { z } from "zod";
import { FinalComponentMethod } from "../../../../generated/prisma/enums";
import { idSchema } from "../../shared/financeSchemas";
import { dateOnlySchema } from "../../shared/scheduleSchemas";

const hasMaxTwoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
const nameEn = z.string({ error: "English name is required!" }).trim().min(1, "English name is required!").max(100);
const nameBn = z.string({ error: "Bangla name is required!" }).trim().min(1, "Bangla name is required!").max(100);

const component = z
  .strictObject({
    nameEn,
    nameBn,
    // the components' weights add up to 100
    weight: z
      .number({ error: "Weight is required!" })
      .positive("Weight must be more than 0")
      .max(100)
      .refine(hasMaxTwoDecimals, "Weight can have at most 2 decimal places"),
    method: z.enum(FinalComponentMethod).default("AVERAGE"),
    // BEST only: how many of the best exams count ("best 2 of 3 class tests")
    bestCount: z.number().int().min(1).optional(),
    examIds: z
      .array(idSchema("Exam"))
      .min(1, "Add at least one exam")
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length, "An exam is listed twice"),
  })
  .refine((c) => c.method !== "BEST" || c.bestCount !== undefined, {
    message: "Say how many of the best exams count",
    path: ["bestCount"],
  })
  .refine((c) => c.method !== "AVERAGE" || c.bestCount === undefined, {
    message: "An average uses all its exams: leave out bestCount",
    path: ["bestCount"],
  })
  .refine((c) => c.bestCount === undefined || c.bestCount <= c.examIds.length, {
    message: "The best count cannot be more than the number of exams",
    path: ["bestCount"],
  });

/* What a formula is made of: the same for create and update (an update replaces it all). */
const formulaFields = {
  nameEn,
  nameBn,
  // the attendance period on the final result sheet; left out = year start to the last exam day
  attendanceFrom: dateOnlySchema.optional(),
  attendanceTo: dateOnlySchema.optional(),
  components: z.array(component).min(1, "Add at least one component").max(10),
};

type FormulaShape = {
  attendanceFrom?: Date;
  attendanceTo?: Date;
  components: { weight: number; examIds: string[] }[];
};

const formulaRules = (d: FormulaShape, ctx: z.RefinementCtx) => {
  const total = d.components.reduce((s, c) => s + c.weight, 0);
  if (Math.abs(total - 100) > 1e-6) {
    ctx.addIssue({ code: "custom", message: `The weights add up to ${total}, they must add up to 100`, path: ["components"] });
  }
  const examIds = d.components.flatMap((c) => c.examIds);
  if (new Set(examIds).size !== examIds.length) {
    ctx.addIssue({ code: "custom", message: "An exam can be in only one component", path: ["components"] });
  }
  if ((d.attendanceFrom === undefined) !== (d.attendanceTo === undefined)) {
    ctx.addIssue({ code: "custom", message: "Give both attendance dates, or neither", path: ["attendanceTo"] });
  }
  if (d.attendanceFrom && d.attendanceTo && d.attendanceTo < d.attendanceFrom) {
    ctx.addIssue({ code: "custom", message: "The attendance end date cannot be before its start date", path: ["attendanceTo"] });
  }
};

const createFormula = z
  .strictObject({
    // defaults to the current academic year
    academicYearId: z.string().trim().min(1).optional(),
    classId: idSchema("Class"),
    ...formulaFields,
  })
  .superRefine(formulaRules);

// the class and year stay as they are
const updateFormula = z.strictObject(formulaFields).superRefine(formulaRules);

const formulaIdParams = z.object({ formulaId: idSchema("Final result formula id") });

const listQuery = z.object({
  // defaults to the current academic year
  academicYearId: z.string().trim().min(1).optional(),
  classId: z.string().trim().min(1).optional(),
});

const tabulationQuery = z.object({
  sectionId: z.string().trim().min(1).optional(),
  sort: z.enum(["roll", "merit"]).default("roll"),
});

const marksheetQuery = z.object({
  enrollmentId: idSchema("Student enrollment"),
});

export const FinalResultValidation = {
  createFormula,
  updateFormula,
  formulaIdParams,
  listQuery,
  tabulationQuery,
  marksheetQuery,
};

export type CreateFormulaPayload = z.infer<typeof createFormula>;
export type UpdateFormulaPayload = z.infer<typeof updateFormula>;
export type FinalListQuery = z.infer<typeof listQuery>;
export type FinalTabulationQuery = z.infer<typeof tabulationQuery>;
export type FinalMarksheetQuery = z.infer<typeof marksheetQuery>;
