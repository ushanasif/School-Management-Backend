import type { Prisma } from "../../../../generated/prisma/client";
import type { HolidayType } from "../../../../generated/prisma/enums";

/*
 * Decides whether a date is a school day: for the students of a class, or for teachers.
 * Load the calendar once for a period (loadCalendar), then ask about each day (dayStatus).
 *
 * For a class, the first match decides:
 *   1. a school holiday covering the class
 *   2. a make-up working day covering the class
 *   3. a national holiday the school has not switched off
 *   4. the weekly holiday rule in force that day
 *   5. otherwise a school day
 * For teachers, a school holiday counts only when it covers all classes and teachersOff is
 * set, and any make-up working day is a working day.
 */

type Db = Prisma.TransactionClient;

export type DayReason = "SCHOOL_DAY" | "WORKING_DAY" | "HOLIDAY" | "NATIONAL_HOLIDAY" | "WEEKLY_HOLIDAY";

export type DayStatus = {
  isSchoolDay: boolean;
  reason: DayReason;
  // the holiday or working day behind it (null for an ordinary day or a weekly holiday)
  source: { id: string; nameEn: string; nameBn: string; type: HolidayType | null } | null;
};

export type Calendar = Awaited<ReturnType<typeof loadCalendar>>;

/* Everything that can affect the days from `from` to `to` (inclusive). */
export const loadCalendar = async (db: Db, schoolId: string, from: Date, to: Date) => {
  const [rules, nationals, entries] = await Promise.all([
    db.weeklyHolidayRule.findMany({
      where: { schoolId, effectiveFrom: { lte: to } },
      orderBy: { effectiveFrom: "asc" },
      select: { effectiveFrom: true, weekdays: true },
    }),
    db.nationalHoliday.findMany({
      where: {
        fromDate: { lte: to },
        toDate: { gte: from },
        // switched off by this school
        exclusions: { none: { schoolId } },
      },
      select: { id: true, nameEn: true, nameBn: true, fromDate: true, toDate: true },
    }),
    db.calendarEntry.findMany({
      where: { schoolId, fromDate: { lte: to }, toDate: { gte: from } },
      select: {
        id: true,
        kind: true,
        type: true,
        nameEn: true,
        nameBn: true,
        fromDate: true,
        toDate: true,
        allClasses: true,
        teachersOff: true,
        classes: { select: { classId: true } },
      },
    }),
  ]);

  const span = (e: { fromDate: Date; toDate: Date }) => e.toDate.getTime() - e.fromDate.getTime();
  return {
    rules,
    // the shortest first: Eid inside the summer vacation is shown as Eid
    nationals: nationals.sort((a, b) => span(a) - span(b)),
    entries: entries
      .map((e) => ({ ...e, classIds: new Set(e.classes.map((c) => c.classId)) }))
      .sort((a, b) => span(a) - span(b)),
  };
};

const covers = (e: { fromDate: Date; toDate: Date }, day: Date) =>
  e.fromDate.getTime() <= day.getTime() && day.getTime() <= e.toDate.getTime();

/* The weekly days off in force on a day (the latest rule that has started). */
export const weeklyHolidaysOn = (calendar: Calendar, day: Date) => {
  let weekdays: number[] = [];
  for (const rule of calendar.rules) {
    if (rule.effectiveFrom.getTime() <= day.getTime()) weekdays = rule.weekdays;
    else break;
  }
  return weekdays;
};

/*
 * `day` is a calendar date at midnight UTC (as dateOnlySchema gives). Pass a classId for
 * a class's students, or "TEACHERS".
 */
export const dayStatus = (calendar: Calendar, day: Date, who: { classId: string } | "TEACHERS"): DayStatus => {
  const forTeachers = who === "TEACHERS";
  const applies = (e: Calendar["entries"][number]) =>
    covers(e, day) && (forTeachers ? true : e.allClasses || e.classIds.has(who.classId));

  const holiday = calendar.entries.find(
    (e) => e.kind === "HOLIDAY" && applies(e) && (!forTeachers || (e.allClasses && e.teachersOff)),
  );
  if (holiday) return off("HOLIDAY", holiday);

  const workingDay = calendar.entries.find((e) => e.kind === "WORKING_DAY" && applies(e));
  if (workingDay) return { isSchoolDay: true, reason: "WORKING_DAY", source: sourceOf(workingDay) };

  const national = calendar.nationals.find((n) => covers(n, day));
  if (national) return off("NATIONAL_HOLIDAY", { ...national, type: "PUBLIC" });

  // getUTCDay of a midnight-UTC date is that calendar day's weekday (0 = Sunday)
  if (weeklyHolidaysOn(calendar, day).includes(day.getUTCDay())) {
    return { isSchoolDay: false, reason: "WEEKLY_HOLIDAY", source: null };
  }
  return { isSchoolDay: true, reason: "SCHOOL_DAY", source: null };
};

type Source = { id: string; nameEn: string; nameBn: string; type: HolidayType | null };

const sourceOf = (s: Source) => ({ id: s.id, nameEn: s.nameEn, nameBn: s.nameBn, type: s.type });

const off = (reason: DayReason, s: Source): DayStatus => ({ isSchoolDay: false, reason, source: sourceOf(s) });

/* Every calendar date from `from` to `to`, inclusive (midnight UTC). */
export const eachDay = (from: Date, to: Date) => {
  const days: Date[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) days.push(new Date(t));
  return days;
};
