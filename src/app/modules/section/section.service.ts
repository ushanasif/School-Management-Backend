import httpStatus from "http-status";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { isForeignKeyViolation, isUniqueViolation } from "../../utils/prismaError";
import type {
  CreateSectionPayload,
  ListSectionsQuery,
  SectionQuery,
  SetYearConfigPayload,
  UpdateSectionPayload,
  YearConfigQuery,
} from "./section.type";

type Db = Prisma.TransactionClient;

const DUPLICATE_MESSAGE = "A section with this name already exists for this class";

const sectionInclude = {
  class: { select: { id: true, name: true, numericLevel: true } },
} satisfies Prisma.SectionInclude;

const yearConfigSelect = {
  id: true,
  academicYearId: true,
  capacity: true,
  startTime: true,
  endTime: true,
  classTeacherMembershipId: true,
  classTeacherMembership: {
    select: { id: true, user: { select: { id: true, fullname: true, phone: true, email: true } } },
  },
} satisfies Prisma.SectionYearConfigSelect;

// ------------------------------------------------------------------- helpers

const findClass = async (schoolId: string, classId: string) => {
  const found = await prisma.schoolClass.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!found) throw new AppError("Class not found for this school", httpStatus.NOT_FOUND);
};

const findSection = async (schoolId: string, sectionId: string) => {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, schoolId },
    include: sectionInclude,
  });
  if (!section) throw new AppError("Section not found", httpStatus.NOT_FOUND);
  return section;
};

/* "A" and "a" are the same name. The unique index is case-sensitive, so check here too. */
const assertNameFree = async (
  db: Db,
  schoolId: string,
  classId: string,
  name: string,
  excludeSectionId?: string,
) => {
  const clash = await db.section.findFirst({
    where: {
      schoolId,
      classId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeSectionId ? { id: { not: excludeSectionId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new AppError(DUPLICATE_MESSAGE, httpStatus.CONFLICT);
};

/*
 * The automatic "Default" section of a class is only there until the school adds real
 * sections. Once a real one arrives, an unused default is removed. A default that already
 * has students stays: rename it to make it an ordinary section.
 */
const removeUnusedDefaults = async (db: Db, schoolId: string, classId: string) => {
  const result = await db.section.deleteMany({
    where: { schoolId, classId, isDefault: true, enrollments: { none: {} } },
  });
  return result.count;
};

/* The given year, or the current one when none is given. null when the school has no current year. */
const resolveYear = async (schoolId: string, academicYearId?: string) => {
  const year = academicYearId
    ? await prisma.academicYear.findFirst({
        where: { id: academicYearId, schoolId },
        select: { id: true, name: true },
      })
    : await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true, name: true },
      });

  if (academicYearId && !year) {
    throw new AppError("Academic year not found for this school", httpStatus.NOT_FOUND);
  }
  return year;
};

const requireYear = async (schoolId: string, academicYearId: string) => {
  const year = await resolveYear(schoolId, academicYearId);
  return year!;
};

/* Teacher, capacity, class hours and active student count of the given sections in one year. */
const loadYearData = async (academicYearId: string, sectionIds: string[]) => {
  const [configs, counts] = await Promise.all([
    prisma.sectionYearConfig.findMany({
      where: { academicYearId, sectionId: { in: sectionIds } },
      select: { sectionId: true, ...yearConfigSelect },
    }),
    prisma.enrollment.groupBy({
      by: ["sectionId"],
      where: { academicYearId, sectionId: { in: sectionIds }, status: "ACTIVE" },
      _count: { _all: true },
    }),
  ]);

  const configBySection = new Map(configs.map(({ sectionId, ...config }) => [sectionId, config]));
  const countBySection = new Map(counts.map((c) => [c.sectionId, c._count._all]));

  return (sectionId: string) => {
    const config = configBySection.get(sectionId) ?? null;
    const activeStudents = countBySection.get(sectionId) ?? 0;
    return {
      config,
      activeStudents,
      // capacity is only a warning: it never blocks an admission
      isOverCapacity: config?.capacity != null && activeStudents > config.capacity,
    };
  };
};

// -------------------------------------------------------------------- create

const createSection = async (schoolId: string, data: CreateSectionPayload) => {
  const { classId, name } = data;
  await findClass(schoolId, classId);

  try {
    const { section, removedDefaults } = await prisma.$transaction(async (tx) => {
      // the default section (if unused) makes way for the real ones, even if the names match
      const removedDefaults = await removeUnusedDefaults(tx, schoolId, classId);
      await assertNameFree(tx, schoolId, classId, name);

      const section = await tx.section.create({
        data: { schoolId, classId, name },
        include: sectionInclude,
      });
      return { section, removedDefaults };
    });

    return { ...section, replacedDefaultSection: removedDefaults > 0 };
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(DUPLICATE_MESSAGE, httpStatus.CONFLICT);
    throw e;
  }
};

// ------------------------------------------------------------------- reading

const getSections = async (schoolId: string, query: ListSectionsQuery) => {
  const year = await resolveYear(schoolId, query.academicYearId);

  const sections = await prisma.section.findMany({
    where: { schoolId, ...(query.classId ? { classId: query.classId } : {}) },
    orderBy: [{ class: { numericLevel: "asc" } }, { name: "asc" }],
    include: sectionInclude,
  });

  const yearData = year ? await loadYearData(year.id, sections.map((s) => s.id)) : null;

  return {
    academicYear: year,
    items: sections.map((section) => ({
      ...section,
      yearInfo: yearData ? yearData(section.id) : null,
    })),
  };
};

const getSectionById = async (schoolId: string, sectionId: string, query: SectionQuery) => {
  const [section, year] = await Promise.all([
    findSection(schoolId, sectionId),
    resolveYear(schoolId, query.academicYearId),
  ]);

  const yearData = year ? await loadYearData(year.id, [section.id]) : null;

  return { ...section, academicYear: year, yearInfo: yearData ? yearData(section.id) : null };
};

// -------------------------------------------------------------------- update

/* Rename only. A section never moves to another class: enrollments store both. */
const updateSection = async (schoolId: string, sectionId: string, data: UpdateSectionPayload) => {
  const section = await findSection(schoolId, sectionId);
  if (data.name === section.name) return section;

  try {
    return await prisma.$transaction(async (tx) => {
      await assertNameFree(tx, schoolId, section.classId, data.name, sectionId);

      return tx.section.update({
        where: { id: sectionId },
        // a renamed default is an ordinary section from now on
        data: { name: data.name, isDefault: false },
        include: sectionInclude,
      });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(DUPLICATE_MESSAGE, httpStatus.CONFLICT);
    throw e;
  }
};

// -------------------------------------------------------------------- delete

/* Hard delete, allowed only while no student has ever been enrolled in the section. */
const deleteSection = async (schoolId: string, sectionId: string) => {
  await findSection(schoolId, sectionId);

  const enrollments = await prisma.enrollment.count({ where: { sectionId } });
  if (enrollments > 0) {
    throw new AppError(
      `This section has ${enrollments} enrollment record(s) and cannot be deleted`,
      httpStatus.CONFLICT,
    );
  }

  try {
    // its year configs (teacher, capacity, class hours) go with it
    await prisma.section.delete({ where: { id: sectionId } });
  } catch (e) {
    // a student was enrolled between the check and the delete
    if (isForeignKeyViolation(e)) {
      throw new AppError("This section is in use and cannot be deleted", httpStatus.CONFLICT);
    }
    throw e;
  }
};

// --------------------------------------------------------------- year config

/*
 * Sets the class teacher, capacity and/or class hours of a section for one academic year.
 * Can be called at any time, so the teacher or the hours can change in the middle of a
 * year. A missing field is left alone; null clears it. Past attendance is not affected:
 * it keeps its own copy of the hours in force on its day.
 */
const setYearConfig = async (schoolId: string, sectionId: string, data: SetYearConfigPayload) => {
  const { academicYearId, classTeacherMembershipId, capacity, startTime, endTime } = data;

  await findSection(schoolId, sectionId);
  const year = await requireYear(schoolId, academicYearId);

  if (classTeacherMembershipId) {
    // only a teacher who still works here (on leave included) and can log in
    const teacher = await prisma.teacherProfile.findFirst({
      where: {
        schoolId,
        membershipId: classTeacherMembershipId,
        status: { in: ["ACTIVE", "ON_LEAVE"] },
        membership: { status: "ACTIVE" },
      },
      select: { id: true },
    });
    if (!teacher) {
      throw new AppError("The selected class teacher is not a working teacher of this school", httpStatus.BAD_REQUEST);
    }
  }

  // the hours are checked as they will be after saving, so one of them can be changed alone
  if (startTime !== undefined || endTime !== undefined) {
    const saved = await prisma.sectionYearConfig.findUnique({
      where: { sectionId_academicYearId: { sectionId, academicYearId } },
      select: { startTime: true, endTime: true },
    });
    const start = startTime !== undefined ? startTime : (saved?.startTime ?? null);
    const end = endTime !== undefined ? endTime : (saved?.endTime ?? null);

    if ((start === null) !== (end === null)) {
      throw new AppError("Set both the start and the end time, or clear both", httpStatus.BAD_REQUEST);
    }
    if (start !== null && end !== null && end <= start) {
      throw new AppError("End time must be after start time", httpStatus.BAD_REQUEST);
    }
  }

  const config = await prisma.sectionYearConfig.upsert({
    where: { sectionId_academicYearId: { sectionId, academicYearId } },
    create: {
      sectionId,
      academicYearId,
      classTeacherMembershipId: classTeacherMembershipId ?? null,
      capacity: capacity ?? null,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
    },
    update: {
      ...(classTeacherMembershipId !== undefined ? { classTeacherMembershipId } : {}),
      ...(capacity !== undefined ? { capacity } : {}),
      ...(startTime !== undefined ? { startTime } : {}),
      ...(endTime !== undefined ? { endTime } : {}),
    },
    select: yearConfigSelect,
  });

  const activeStudents = await prisma.enrollment.count({
    where: { academicYearId, sectionId, status: "ACTIVE" },
  });

  const warnings: string[] = [];
  if (config.capacity != null && activeStudents > config.capacity) {
    warnings.push(
      `This section already has ${activeStudents} active students, more than the capacity of ${config.capacity}`,
    );
  }

  return { academicYear: year, config, activeStudents, warnings };
};

const getYearConfig = async (schoolId: string, sectionId: string, query: YearConfigQuery) => {
  await findSection(schoolId, sectionId);
  const year = await requireYear(schoolId, query.academicYearId);

  const yearData = await loadYearData(year.id, [sectionId]);
  // config is null when nothing has been set for this year yet
  return { academicYear: year, ...yearData(sectionId) };
};

export const SectionService = {
  createSection,
  getSections,
  getSectionById,
  updateSection,
  deleteSection,
  setYearConfig,
  getYearConfig,
};
