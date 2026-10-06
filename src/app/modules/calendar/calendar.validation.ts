import { z } from "zod";
import { CalendarEntryKind, HolidayType } from "../../../../generated/prisma/enums";
import { idSchema } from "../../shared/financeSchemas";
import { dateOnlySchema } from "../../shared/scheduleSchemas";

const DAY_MS = 86_400_000;

const nameEn = z.string({ error: "English name is required!" }).trim().min(1, "English name is required!").max(100);
const nameBn = z.string({ error: "Bangla name is required!" }).trim().min(1, "Bangla name is required!").max(100);
const description = z.string().trim().max(500);

const datesInOrder = (d: { fromDate: Date; toDate: Date }) => d.toDate >= d.fromDate;
const datesOrderMessage = { message: "The end date cannot be before the start date", path: ["toDate"] };

// ------------------------------------------------------------ weekly holidays

const setWeeklyRule = z.strictObject({
  effectiveFrom: dateOnlySchema,
  // 0 = Sunday ... 5 = Friday, 6 = Saturday; an empty list means no weekly holiday
  weekdays: z
    .array(z.number().int().min(0, "Weekdays are 0 (Sunday) to 6 (Saturday)").max(6, "Weekdays are 0 (Sunday) to 6 (Saturday)"))
    .max(6, "At least one day of the week must be a school day")
    .refine((d) => new Set(d).size === d.length, "A weekday is listed twice"),
});

const ruleIdParams = z.object({ ruleId: idSchema("Rule id") });

// ----------------------------------------------------------- national holidays

const nationalHolidayBody = z
  .strictObject({
    nameEn,
    nameBn,
    description: description.optional(),
    fromDate: dateOnlySchema,
    toDate: dateOnlySchema,
  })
  .refine(datesInOrder, datesOrderMessage)
  .refine((d) => d.toDate.getTime() - d.fromDate.getTime() <= 60 * DAY_MS, {
    message: "A national holiday cannot be longer than 60 days",
    path: ["toDate"],
  });

const nationalHolidayIdParams = z.object({ nationalHolidayId: idSchema("National holiday id") });

const nationalHolidaysQuery = z.object({
  // calendar year, e.g. 2027; defaults to this year
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

// --------------------------------------------------------------- school entries

// one body for create and update (an update replaces everything)
const entryBody = z
  .strictObject({
    academicYearId: idSchema("Academic year"),
    kind: z.enum(CalendarEntryKind),
    // required for holidays, left out for working days
    type: z.enum(HolidayType).optional(),
    nameEn,
    nameBn,
    description: description.optional(),
    // one day: fromDate = toDate
    fromDate: dateOnlySchema,
    toDate: dateOnlySchema,
    // true = every class ("select all"); false = only the classes in classIds
    allClasses: z.boolean().default(true),
    classIds: z
      .array(idSchema("Class"))
      .max(100)
      .default([])
      .refine((ids) => new Set(ids).size === ids.length, "A class is listed twice"),
    // holidays only: false = teachers still work that day (exam duty, office work)
    teachersOff: z.boolean().default(true),
  })
  .refine(datesInOrder, datesOrderMessage)
  .refine((d) => d.toDate.getTime() - d.fromDate.getTime() <= 120 * DAY_MS, {
    message: "An entry cannot be longer than 120 days",
    path: ["toDate"],
  })
  .refine((d) => d.kind !== "HOLIDAY" || d.type !== undefined, {
    message: "Choose the holiday type (public, school or vacation)",
    path: ["type"],
  })
  .refine((d) => d.kind !== "WORKING_DAY" || d.type === undefined, {
    message: "A working day has no holiday type",
    path: ["type"],
  })
  .refine((d) => (d.allClasses ? d.classIds.length === 0 : d.classIds.length > 0), {
    message: "Choose all classes, or list the classes",
    path: ["classIds"],
  });

const entryIdParams = z.object({ entryId: idSchema("Calendar entry id") });

const entriesQuery = z.object({
  academicYearId: z.string().trim().min(1).optional(),
  kind: z.enum(CalendarEntryKind).optional(),
  // only entries that touch this period
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

// ------------------------------------------------------------- calendar view

const calendarQuery = z
  .object({
    // defaults to the current month
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    // with a class: whether its students have school each day
    classId: z.string().trim().min(1).optional(),
  })
  .refine((d) => (d.from === undefined) === (d.to === undefined), {
    message: "Give both from and to, or neither",
  })
  .refine((d) => !d.from || !d.to || (d.to >= d.from && d.to.getTime() - d.from.getTime() <= 366 * DAY_MS), {
    message: "The period must be at most one year, with to after from",
    path: ["to"],
  });

export const CalendarValidation = {
  setWeeklyRule,
  ruleIdParams,
  nationalHolidayBody,
  nationalHolidayIdParams,
  nationalHolidaysQuery,
  entryBody,
  entryIdParams,
  entriesQuery,
  calendarQuery,
};

export type SetWeeklyRulePayload = z.infer<typeof setWeeklyRule>;
export type NationalHolidayPayload = z.infer<typeof nationalHolidayBody>;
export type NationalHolidaysQuery = z.infer<typeof nationalHolidaysQuery>;
export type EntryPayload = z.infer<typeof entryBody>;
export type EntriesQuery = z.infer<typeof entriesQuery>;
export type CalendarQuery = z.infer<typeof calendarQuery>;
