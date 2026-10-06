import httpStatus from "http-status";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { dayKey, todayInBangladesh } from "../../shared/scheduleSchemas";
import { dayStatus, eachDay, loadCalendar, weeklyHolidaysOn } from "./calendar.resolver";
import type {
  CalendarQuery,
  EntriesQuery,
  EntryPayload,
  NationalHolidayPayload,
  NationalHolidaysQuery,
  SetWeeklyRulePayload,
} from "./calendar.validation";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const entryInclude = {
  academicYear: { select: { id: true, name: true } },
  classes: { select: { class: { select: { id: true, name: true, numericLevel: true } } } },
} satisfies Prisma.CalendarEntryInclude;

// ============================================================ weekly holidays

/* Every rule, oldest first, and the weekly days off in force today. */
const getWeeklyRules = async (schoolId: string) => {
  const rules = await prisma.weeklyHolidayRule.findMany({
    where: { schoolId },
    orderBy: { effectiveFrom: "asc" },
  });

  const today = todayInBangladesh();
  const current = [...rules].reverse().find((r) => r.effectiveFrom.getTime() <= today.getTime()) ?? null;

  return {
    rules,
    current: current
      ? { ...current, weekdayNames: current.weekdays.map((d) => WEEKDAY_NAMES[d]) }
      : null,
  };
};

/*
 * Sets the weekly days off from a date on. A rule that has already started is history and
 * cannot be changed: to change the weekly holiday, add a rule from a later date. A rule
 * that has not started yet can be replaced.
 */
const setWeeklyRule = async (schoolId: string, userId: string, data: SetWeeklyRulePayload) => {
  const weekdays = [...data.weekdays].sort((a, b) => a - b);

  const existing = await prisma.weeklyHolidayRule.findUnique({
    where: { schoolId_effectiveFrom: { schoolId, effectiveFrom: data.effectiveFrom } },
  });

  if (existing) {
    if (existing.effectiveFrom.getTime() <= todayInBangladesh().getTime()) {
      throw new AppError(
        "A rule from this date is already in effect. Add a new rule from a later date instead",
        httpStatus.CONFLICT,
      );
    }
    return prisma.weeklyHolidayRule.update({ where: { id: existing.id }, data: { weekdays } });
  }

  return prisma.weeklyHolidayRule.create({
    data: { schoolId, effectiveFrom: data.effectiveFrom, weekdays, createdBy: userId },
  });
};

/* Only a rule that has not started yet can be deleted. */
const deleteWeeklyRule = async (schoolId: string, ruleId: string) => {
  const rule = await prisma.weeklyHolidayRule.findFirst({ where: { id: ruleId, schoolId } });
  if (!rule) throw new AppError("Weekly holiday rule not found", httpStatus.NOT_FOUND);
  if (rule.effectiveFrom.getTime() <= todayInBangladesh().getTime()) {
    throw new AppError("This rule is already in effect and is kept as history", httpStatus.CONFLICT);
  }
  await prisma.weeklyHolidayRule.delete({ where: { id: ruleId } });
};

// ===================================================== national holidays (platform)

const yearRange = (year?: number) => {
  const y = year ?? Number(dayKey(todayInBangladesh()).slice(0, 4));
  return { from: new Date(`${y}-01-01T00:00:00Z`), to: new Date(`${y}-12-31T00:00:00Z`) };
};

const createNationalHoliday = (data: NationalHolidayPayload) =>
  prisma.nationalHoliday.create({ data: { ...data, description: data.description ?? null } });

const getNationalHolidaysForPlatform = (query: NationalHolidaysQuery) => {
  const { from, to } = yearRange(query.year);
  return prisma.nationalHoliday.findMany({
    where: { fromDate: { lte: to }, toDate: { gte: from } },
    orderBy: { fromDate: "asc" },
    include: { _count: { select: { exclusions: true } } }, // how many schools switched it off
  });
};

const findNationalHoliday = async (nationalHolidayId: string) => {
  const holiday = await prisma.nationalHoliday.findUnique({ where: { id: nationalHolidayId } });
  if (!holiday) throw new AppError("National holiday not found", httpStatus.NOT_FOUND);
  return holiday;
};

/* Moving a date (Eid after the moon sighting) reaches every school at once. */
const updateNationalHoliday = async (nationalHolidayId: string, data: NationalHolidayPayload) => {
  await findNationalHoliday(nationalHolidayId);
  return prisma.nationalHoliday.update({
    where: { id: nationalHolidayId },
    data: { ...data, description: data.description ?? null },
  });
};

const deleteNationalHoliday = async (nationalHolidayId: string) => {
  await findNationalHoliday(nationalHolidayId);
  // the schools' switch-offs go with it
  await prisma.nationalHoliday.delete({ where: { id: nationalHolidayId } });
};

// ======================================================= national holidays (school)

/* The national holidays of a year, each marked whether this school has switched it off. */
const getNationalHolidaysForSchool = async (schoolId: string, query: NationalHolidaysQuery) => {
  const { from, to } = yearRange(query.year);
  const holidays = await prisma.nationalHoliday.findMany({
    where: { fromDate: { lte: to }, toDate: { gte: from } },
    orderBy: { fromDate: "asc" },
    include: { exclusions: { where: { schoolId }, select: { id: true } } },
  });

  return holidays.map(({ exclusions, ...holiday }) => ({ ...holiday, isOff: exclusions.length === 0 }));
};

/* The school stays open on this national holiday. */
const excludeNationalHoliday = async (schoolId: string, userId: string, nationalHolidayId: string) => {
  await findNationalHoliday(nationalHolidayId);
  await prisma.nationalHolidayExclusion.upsert({
    where: { schoolId_nationalHolidayId: { schoolId, nationalHolidayId } },
    update: {},
    create: { schoolId, nationalHolidayId, createdBy: userId },
  });
};

/* Undo: the national holiday is a day off for this school again. */
const restoreNationalHoliday = async (schoolId: string, nationalHolidayId: string) => {
  await findNationalHoliday(nationalHolidayId);
  await prisma.nationalHolidayExclusion.deleteMany({ where: { schoolId, nationalHolidayId } });
};

// ============================================================== school entries

/* The year must belong to the school and contain the dates; the classes must be the school's. */
const assertEntryValid = async (schoolId: string, data: EntryPayload) => {
  const year = await prisma.academicYear.findFirst({
    where: { id: data.academicYearId, schoolId },
    select: { startDate: true, endDate: true },
  });
  if (!year) throw new AppError("Academic year not found for this school", httpStatus.NOT_FOUND);
  if (dayKey(data.fromDate) < dayKey(year.startDate) || dayKey(data.toDate) > dayKey(year.endDate)) {
    throw new AppError(
      `The dates must be inside the academic year (${dayKey(year.startDate)} to ${dayKey(year.endDate)})`,
      httpStatus.BAD_REQUEST,
    );
  }

  if (!data.allClasses) {
    const found = await prisma.schoolClass.count({ where: { id: { in: data.classIds }, schoolId } });
    if (found !== data.classIds.length) {
      throw new AppError("One or more classes were not found for this school", httpStatus.NOT_FOUND);
    }
  }
};

const entryData = (data: EntryPayload) => ({
  academicYearId: data.academicYearId,
  kind: data.kind,
  type: data.type ?? null,
  nameEn: data.nameEn,
  nameBn: data.nameBn,
  description: data.description ?? null,
  fromDate: data.fromDate,
  toDate: data.toDate,
  allClasses: data.allClasses,
  // only meaningful for holidays; a working day is a working day for teachers too
  teachersOff: data.kind === "HOLIDAY" ? data.teachersOff : false,
  classes: { create: data.allClasses ? [] : data.classIds.map((classId) => ({ classId })) },
});

const findEntry = async (schoolId: string, entryId: string) => {
  const entry = await prisma.calendarEntry.findFirst({ where: { id: entryId, schoolId }, include: entryInclude });
  if (!entry) throw new AppError("Calendar entry not found", httpStatus.NOT_FOUND);
  return entry;
};

const createEntry = async (schoolId: string, userId: string, data: EntryPayload) => {
  await assertEntryValid(schoolId, data);
  return prisma.calendarEntry.create({
    data: { schoolId, createdBy: userId, ...entryData(data) },
    include: entryInclude,
  });
};

const getEntries = (schoolId: string, query: EntriesQuery) =>
  prisma.calendarEntry.findMany({
    where: {
      schoolId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      // overlapping the asked period
      ...(query.from ? { toDate: { gte: query.from } } : {}),
      ...(query.to ? { fromDate: { lte: query.to } } : {}),
    },
    orderBy: [{ fromDate: "asc" }, { createdAt: "asc" }],
    include: entryInclude,
  });

const getEntryById = (schoolId: string, entryId: string) => findEntry(schoolId, entryId);

/* Replaces the whole entry, its classes included. */
const updateEntry = async (schoolId: string, entryId: string, data: EntryPayload) => {
  await findEntry(schoolId, entryId);
  await assertEntryValid(schoolId, data);

  return prisma.$transaction(async (tx) => {
    await tx.calendarEntryClass.deleteMany({ where: { entryId } });
    return tx.calendarEntry.update({ where: { id: entryId }, data: entryData(data), include: entryInclude });
  });
};

const deleteEntry = async (schoolId: string, entryId: string) => {
  await findEntry(schoolId, entryId);
  await prisma.calendarEntry.delete({ where: { id: entryId } });
};

// =============================================================== calendar view

/*
 * Every day of a period (default: this month): whether teachers work, whether the given
 * class has school, and the holidays and working days that touch the day.
 */
const getCalendar = async (schoolId: string, query: CalendarQuery) => {
  let from = query.from;
  let to = query.to;
  if (!from || !to) {
    const [y, m] = dayKey(todayInBangladesh()).split("-").map(Number);
    from = new Date(Date.UTC(y, m - 1, 1));
    to = new Date(Date.UTC(y, m, 0)); // last day of the month
  }

  if (query.classId) {
    const found = await prisma.schoolClass.findFirst({ where: { id: query.classId, schoolId }, select: { id: true } });
    if (!found) throw new AppError("Class not found for this school", httpStatus.NOT_FOUND);
  }

  const calendar = await loadCalendar(prisma, schoolId, from, to);

  const days = eachDay(from, to).map((day) => {
    const t = day.getTime();
    const touching = <E extends { fromDate: Date; toDate: Date }>(e: E) =>
      e.fromDate.getTime() <= t && t <= e.toDate.getTime();

    return {
      date: dayKey(day),
      weekday: WEEKDAY_NAMES[day.getUTCDay()],
      isWeeklyHoliday: weeklyHolidaysOn(calendar, day).includes(day.getUTCDay()),
      teachers: dayStatus(calendar, day, "TEACHERS"),
      students: query.classId ? dayStatus(calendar, day, { classId: query.classId }) : null,
      // everything on this day, with who it covers
      events: [
        ...calendar.nationals.filter(touching).map((n) => ({
          source: "NATIONAL" as const,
          id: n.id,
          nameEn: n.nameEn,
          nameBn: n.nameBn,
          kind: "HOLIDAY" as const,
          type: "PUBLIC" as const,
          allClasses: true,
          classIds: [] as string[],
          teachersOff: true,
        })),
        ...calendar.entries.filter(touching).map((e) => ({
          source: "SCHOOL" as const,
          id: e.id,
          nameEn: e.nameEn,
          nameBn: e.nameBn,
          kind: e.kind,
          type: e.type,
          allClasses: e.allClasses,
          classIds: [...e.classIds],
          teachersOff: e.teachersOff,
        })),
      ],
    };
  });

  return { from: dayKey(from), to: dayKey(to), classId: query.classId ?? null, days };
};

export const CalendarService = {
  getWeeklyRules,
  setWeeklyRule,
  deleteWeeklyRule,
  createNationalHoliday,
  getNationalHolidaysForPlatform,
  updateNationalHoliday,
  deleteNationalHoliday,
  getNationalHolidaysForSchool,
  excludeNationalHoliday,
  restoreNationalHoliday,
  createEntry,
  getEntries,
  getEntryById,
  updateEntry,
  deleteEntry,
  getCalendar,
};
