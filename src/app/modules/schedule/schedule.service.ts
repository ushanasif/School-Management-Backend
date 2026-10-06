import httpStatus from "http-status";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { dayKey } from "../../shared/scheduleSchemas";
import { dayStatus, loadCalendar } from "../calendar/calendar.resolver";
import type { HoursQuery, ListOverridesQuery, OverridePayload } from "./schedule.type";

type Db = Prisma.TransactionClient;

const overrideInclude = {
  academicYear: { select: { id: true, name: true } },
  rules: {
    include: {
      class: { select: { id: true, name: true, numericLevel: true } },
      section: { select: { id: true, name: true, isDefault: true } },
    },
  },
} satisfies Prisma.ScheduleOverrideInclude;

// ------------------------------------------------------------------- helpers

const findOverride = async (schoolId: string, overrideId: string) => {
  const override = await prisma.scheduleOverride.findFirst({
    where: { id: overrideId, schoolId },
    include: overrideInclude,
  });
  if (!override) throw new AppError("Schedule override not found", httpStatus.NOT_FOUND);
  return override;
};

/* The academic year must belong to the school and contain the whole date range. */
const assertWithinYear = async (schoolId: string, data: OverridePayload) => {
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
};

/*
 * Checks every class and section belongs to this school, and gives a section rule the
 * class of its section, so the hours can be matched by class without another lookup.
 */
const normalizeRules = async (schoolId: string, rules: OverridePayload["rules"]) => {
  const classIds = [...new Set(rules.flatMap((r) => (r.classId ? [r.classId] : [])))];
  const sectionIds = [...new Set(rules.flatMap((r) => (r.sectionId ? [r.sectionId] : [])))];

  const [classes, sections] = await Promise.all([
    prisma.schoolClass.findMany({ where: { id: { in: classIds }, schoolId }, select: { id: true } }),
    prisma.section.findMany({ where: { id: { in: sectionIds }, schoolId }, select: { id: true, classId: true } }),
  ]);
  if (classes.length !== classIds.length) {
    throw new AppError("One or more classes were not found for this school", httpStatus.NOT_FOUND);
  }
  if (sections.length !== sectionIds.length) {
    throw new AppError("One or more sections were not found for this school", httpStatus.NOT_FOUND);
  }
  const classOfSection = new Map(sections.map((s) => [s.id, s.classId]));

  return rules.map((r) => {
    if (r.sectionId) {
      const classId = classOfSection.get(r.sectionId)!;
      if (r.classId && r.classId !== classId) {
        throw new AppError("A section in the rules does not belong to the class given with it", httpStatus.BAD_REQUEST);
      }
      return { classId, sectionId: r.sectionId, startTime: r.startTime, endTime: r.endTime };
    }
    return { classId: r.classId ?? null, sectionId: null, startTime: r.startTime, endTime: r.endTime };
  });
};

// ----------------------------------------------------------------- resolving

export type SectionHours = {
  startTime: string | null;
  endTime: string | null;
  source: { type: "REGULAR" } | { type: "OVERRIDE"; overrideId: string; name: string };
};

/*
 * The class hours each section has on one date. Among the overrides covering the date,
 * the one with the shortest date range wins (an exam day beats Ramadan), then the newest.
 * Inside it, a section rule beats a class rule, which beats a school-wide rule. With no
 * matching override, the section's normal hours for the year apply (null if never set).
 *
 * Attendance should call this when it is taken and keep a copy of the result, so later
 * changes to the hours never rewrite history.
 */
export const resolveSectionHours = async (
  db: Db,
  schoolId: string,
  academicYearId: string,
  date: Date,
  sections: { id: string; classId: string }[],
): Promise<Map<string, SectionHours>> => {
  const sectionIds = sections.map((s) => s.id);
  const classIds = [...new Set(sections.map((s) => s.classId))];

  const [configs, overrides] = await Promise.all([
    db.sectionYearConfig.findMany({
      where: { academicYearId, sectionId: { in: sectionIds } },
      select: { sectionId: true, startTime: true, endTime: true },
    }),
    db.scheduleOverride.findMany({
      where: { schoolId, academicYearId, fromDate: { lte: date }, toDate: { gte: date } },
      select: {
        id: true,
        name: true,
        fromDate: true,
        toDate: true,
        createdAt: true,
        rules: {
          where: {
            OR: [
              { classId: null, sectionId: null },
              { classId: { in: classIds }, sectionId: null },
              { sectionId: { in: sectionIds } },
            ],
          },
          select: { classId: true, sectionId: true, startTime: true, endTime: true },
        },
      },
    }),
  ]);

  const span = (o: { fromDate: Date; toDate: Date }) => o.toDate.getTime() - o.fromDate.getTime();
  const ordered = overrides.sort(
    (a, b) => span(a) - span(b) || b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const configBySection = new Map(configs.map((c) => [c.sectionId, c]));

  const result = new Map<string, SectionHours>();
  for (const section of sections) {
    let hours: SectionHours | null = null;

    for (const o of ordered) {
      const rule =
        o.rules.find((r) => r.sectionId === section.id) ??
        o.rules.find((r) => r.sectionId === null && r.classId === section.classId) ??
        o.rules.find((r) => r.sectionId === null && r.classId === null);
      if (rule) {
        hours = {
          startTime: rule.startTime,
          endTime: rule.endTime,
          source: { type: "OVERRIDE", overrideId: o.id, name: o.name },
        };
        break;
      }
    }

    const config = configBySection.get(section.id);
    result.set(
      section.id,
      hours ?? {
        startTime: config?.startTime ?? null,
        endTime: config?.endTime ?? null,
        source: { type: "REGULAR" },
      },
    );
  }
  return result;
};

// ------------------------------------------------------------------ overrides

const createOverride = async (schoolId: string, userId: string, data: OverridePayload) => {
  await assertWithinYear(schoolId, data);
  const rules = await normalizeRules(schoolId, data.rules);

  return prisma.scheduleOverride.create({
    data: {
      schoolId,
      academicYearId: data.academicYearId,
      name: data.name,
      fromDate: data.fromDate,
      toDate: data.toDate,
      createdBy: userId,
      rules: { create: rules },
    },
    include: overrideInclude,
  });
};

const getOverrides = async (schoolId: string, query: ListOverridesQuery) => {
  return prisma.scheduleOverride.findMany({
    where: {
      schoolId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      // overlapping the asked period
      ...(query.from ? { toDate: { gte: query.from } } : {}),
      ...(query.to ? { fromDate: { lte: query.to } } : {}),
    },
    orderBy: [{ fromDate: "desc" }, { createdAt: "desc" }],
    include: overrideInclude,
  });
};

const getOverrideById = (schoolId: string, overrideId: string) => findOverride(schoolId, overrideId);

/* Replaces the name, the dates and all rules. Past attendance keeps its own copy of the hours. */
const updateOverride = async (schoolId: string, overrideId: string, data: OverridePayload) => {
  await findOverride(schoolId, overrideId);
  await assertWithinYear(schoolId, data);
  const rules = await normalizeRules(schoolId, data.rules);

  return prisma.$transaction(async (tx) => {
    await tx.scheduleOverrideRule.deleteMany({ where: { overrideId } });
    return tx.scheduleOverride.update({
      where: { id: overrideId },
      data: {
        academicYearId: data.academicYearId,
        name: data.name,
        fromDate: data.fromDate,
        toDate: data.toDate,
        rules: { create: rules },
      },
      include: overrideInclude,
    });
  });
};

const deleteOverride = async (schoolId: string, overrideId: string) => {
  await findOverride(schoolId, overrideId);
  // its rules go with it
  await prisma.scheduleOverride.delete({ where: { id: overrideId } });
};

// ---------------------------------------------------------------- day view

/* The class hours of every section (or one class / one section) on a date, and where they come from. */
const getHours = async (schoolId: string, query: HoursQuery) => {
  const year = await prisma.academicYear.findFirst({
    where: { schoolId, startDate: { lte: query.date }, endDate: { gte: query.date } },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true },
  });
  if (!year) {
    throw new AppError("No academic year covers this date", httpStatus.NOT_FOUND);
  }

  const sections = await prisma.section.findMany({
    where: {
      schoolId,
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { id: query.sectionId } : {}),
    },
    orderBy: [{ class: { numericLevel: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isDefault: true,
      classId: true,
      class: { select: { id: true, name: true } },
    },
  });

  const [hours, calendar] = await Promise.all([
    resolveSectionHours(prisma, schoolId, year.id, query.date, sections),
    loadCalendar(prisma, schoolId, query.date, query.date),
  ]);

  return {
    date: dayKey(query.date),
    academicYear: year,
    items: sections.map(({ classId, ...section }) => {
      const day = dayStatus(calendar, query.date, { classId });
      const sectionHours = hours.get(section.id)!;
      // no class hours on a day off: the day says why (weekly, national or school holiday)
      return day.isSchoolDay
        ? { ...section, ...sectionHours, day }
        : { ...section, ...sectionHours, startTime: null, endTime: null, day };
    }),
  };
};

export const ScheduleService = {
  createOverride,
  getOverrides,
  getOverrideById,
  updateOverride,
  deleteOverride,
  getHours,
};
