import httpStatus from "http-status";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { isUniqueViolation } from "../../utils/prismaError";
import type { ClassSettingsQuery, CopyScalePayload, ScalePayload, SetClassSettingPayload } from "./grading.validation";

const DUPLICATE_MESSAGE = "A grading scale with this name already exists";

const scaleInclude = {
  // highest first, as a grading table is read
  markBands: { orderBy: { minPercent: "desc" }, select: { minPercent: true, grade: true, point: true } },
  gpaBands: { orderBy: { minGpa: "desc" }, select: { minGpa: true, grade: true } },
  _count: { select: { classSettings: true, classSubjects: true } },
} satisfies Prisma.GradingScaleInclude;

const scaleBrief = { id: true, name: true, maxGpa: true, isLocked: true } satisfies Prisma.GradingScaleSelect;

// ------------------------------------------------------------------- helpers

const findScale = async (schoolId: string, scaleId: string) => {
  const scale = await prisma.gradingScale.findFirst({ where: { id: scaleId, schoolId }, include: scaleInclude });
  if (!scale) throw new AppError("Grading scale not found", httpStatus.NOT_FOUND);
  return scale;
};

const assertNameFree = async (schoolId: string, name: string, excludeId?: string) => {
  const clash = await prisma.gradingScale.findFirst({
    where: { schoolId, name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new AppError(DUPLICATE_MESSAGE, httpStatus.CONFLICT);
};

/* The given year, or the current one when none is given. */
const resolveYear = async (schoolId: string, academicYearId?: string) => {
  const year = academicYearId
    ? await prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId }, select: { id: true, name: true } })
    : await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true, name: true } });
  if (!year) {
    throw academicYearId
      ? new AppError("Academic year not found for this school", httpStatus.NOT_FOUND)
      : new AppError("No current academic year is set. Choose an academic year", httpStatus.BAD_REQUEST);
  }
  return year;
};

const scaleData = (data: ScalePayload) => ({
  name: data.name,
  description: data.description ?? null,
  maxGpa: data.maxGpa,
  failGrade: data.failGrade,
  failIfAnyCompulsoryFails: data.failIfAnyCompulsoryFails,
  optionalBonusEnabled: data.optionalBonusEnabled,
  optionalBonusThreshold: data.optionalBonusThreshold,
  markBands: { create: data.markBands },
  gpaBands: { create: data.gpaBands },
});

// ------------------------------------------------------------- grading scales

const createScale = async (schoolId: string, data: ScalePayload) => {
  await assertNameFree(schoolId, data.name);
  try {
    return await prisma.gradingScale.create({ data: { schoolId, ...scaleData(data) }, include: scaleInclude });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(DUPLICATE_MESSAGE, httpStatus.CONFLICT);
    throw e;
  }
};

const getScales = (schoolId: string) =>
  prisma.gradingScale.findMany({ where: { schoolId }, orderBy: { name: "asc" }, include: scaleInclude });

const getScaleById = (schoolId: string, scaleId: string) => findScale(schoolId, scaleId);

/* Replaces the whole scale, bands included. A locked scale (used by a published result) cannot change. */
const updateScale = async (schoolId: string, scaleId: string, data: ScalePayload) => {
  const scale = await findScale(schoolId, scaleId);
  if (scale.isLocked) {
    throw new AppError(
      "This scale is used by a published result and cannot change. Make a copy and edit the copy",
      httpStatus.CONFLICT,
    );
  }
  if (data.name !== scale.name) await assertNameFree(schoolId, data.name, scaleId);

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.gradeMarkBand.deleteMany({ where: { scaleId } });
      await tx.gradeGpaBand.deleteMany({ where: { scaleId } });
      return tx.gradingScale.update({ where: { id: scaleId }, data: scaleData(data), include: scaleInclude });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(DUPLICATE_MESSAGE, httpStatus.CONFLICT);
    throw e;
  }
};

/* A new, unlocked scale with the same rules and bands: how a locked scale is changed. */
const copyScale = async (schoolId: string, scaleId: string, data: CopyScalePayload) => {
  const scale = await findScale(schoolId, scaleId);
  await assertNameFree(schoolId, data.name);

  try {
    return await prisma.gradingScale.create({
      data: {
        schoolId,
        name: data.name,
        description: scale.description,
        maxGpa: scale.maxGpa,
        failGrade: scale.failGrade,
        failIfAnyCompulsoryFails: scale.failIfAnyCompulsoryFails,
        optionalBonusEnabled: scale.optionalBonusEnabled,
        optionalBonusThreshold: scale.optionalBonusThreshold,
        markBands: { create: scale.markBands },
        gpaBands: { create: scale.gpaBands },
      },
      include: scaleInclude,
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(DUPLICATE_MESSAGE, httpStatus.CONFLICT);
    throw e;
  }
};

/* Only a scale nobody uses (no class, no subject, no published result) can be deleted. */
const deleteScale = async (schoolId: string, scaleId: string) => {
  const scale = await findScale(schoolId, scaleId);
  if (scale.isLocked) throw new AppError("This scale is used by a published result", httpStatus.CONFLICT);
  if (scale._count.classSettings > 0 || scale._count.classSubjects > 0) {
    throw new AppError("This scale is used by classes or subjects. Change them first", httpStatus.CONFLICT);
  }
  await prisma.gradingScale.delete({ where: { id: scaleId } });
};

// ------------------------------------------------------ class result settings

/* Every class with its result setting for a year (null = not set yet). */
const getClassSettings = async (schoolId: string, query: ClassSettingsQuery) => {
  const year = await resolveYear(schoolId, query.academicYearId);

  const [classes, settings] = await Promise.all([
    prisma.schoolClass.findMany({
      where: { schoolId },
      orderBy: { numericLevel: "asc" },
      select: { id: true, name: true, numericLevel: true },
    }),
    prisma.classResultSetting.findMany({
      where: { schoolId, academicYearId: year.id },
      include: { gradingScale: { select: scaleBrief } },
    }),
  ]);
  const settingOf = new Map(settings.map((s) => [s.classId, s]));

  return {
    academicYear: year,
    items: classes.map((schoolClass) => ({ class: schoolClass, setting: settingOf.get(schoolClass.id) ?? null })),
  };
};

const setClassSetting = async (schoolId: string, data: SetClassSettingPayload) => {
  const year = await resolveYear(schoolId, data.academicYearId);

  const schoolClass = await prisma.schoolClass.findFirst({ where: { id: data.classId, schoolId }, select: { id: true } });
  if (!schoolClass) throw new AppError("Class not found for this school", httpStatus.NOT_FOUND);

  if (data.gradingScaleId) {
    const scale = await prisma.gradingScale.findFirst({ where: { id: data.gradingScaleId, schoolId }, select: { id: true } });
    if (!scale) throw new AppError("Grading scale not found", httpStatus.NOT_FOUND);
  }

  const values = {
    resultSystem: data.resultSystem,
    gradingScaleId: data.gradingScaleId ?? null,
    combinePapers: data.combinePapers,
    absentRule: data.absentRule,
  };

  return prisma.classResultSetting.upsert({
    where: { academicYearId_classId: { academicYearId: year.id, classId: data.classId } },
    create: { schoolId, academicYearId: year.id, classId: data.classId, ...values },
    update: values,
    include: { gradingScale: { select: scaleBrief } },
  });
};

export const GradingService = {
  createScale,
  getScales,
  getScaleById,
  updateScale,
  copyScale,
  deleteScale,
  getClassSettings,
  setClassSetting,
};
