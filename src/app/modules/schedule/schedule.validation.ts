import { z } from "zod";
import { idSchema } from "../../shared/financeSchemas";
import { dateOnlySchema, timeSchema } from "../../shared/scheduleSchemas";

const optionalId = z.string().trim().min(1).optional();

/* No class or section = the whole school; classId = every section of that class; sectionId = one section. */
const rule = z
  .strictObject({
    classId: optionalId,
    sectionId: optionalId,
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .refine((r) => r.endTime > r.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

const targetKey = (r: { classId?: string; sectionId?: string }) =>
  r.sectionId ? `section:${r.sectionId}` : r.classId ? `class:${r.classId}` : "school";

// one body for create and for update (an update replaces the name, the dates and all rules)
const overrideBody = z
  .strictObject({
    academicYearId: idSchema("Academic year"),
    name: z.string({ error: "Name is required!" }).trim().min(1, "Name is required!").max(100),
    // for a single day (exam day, sports day) fromDate and toDate are the same
    fromDate: dateOnlySchema,
    toDate: dateOnlySchema,
    rules: z.array(rule).min(1, "Add at least one rule").max(300, "Too many rules"),
  })
  .refine((d) => d.toDate >= d.fromDate, {
    message: "The end date cannot be before the start date",
    path: ["toDate"],
  })
  .refine((d) => new Set(d.rules.map(targetKey)).size === d.rules.length, {
    message: "Each class or section (or the whole school) can appear only once",
    path: ["rules"],
  });

const overrideIdParams = z.object({ overrideId: idSchema("Schedule override id") });

const listOverridesQuery = z.object({
  academicYearId: optionalId,
  // only overrides that touch this period
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

const hoursQuery = z.object({
  date: dateOnlySchema,
  classId: optionalId,
  sectionId: optionalId,
});

export const ScheduleValidation = {
  overrideBody,
  overrideIdParams,
  listOverridesQuery,
  hoursQuery,
};
