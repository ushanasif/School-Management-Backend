import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { CreateAcademicYearPayload } from "./academicYear.type";
import httpStatus from 'http-status'
import type { Prisma } from "../../../../generated/prisma/client";

const createAcademicYear = async (
  schoolId: string,
  payload: CreateAcademicYearPayload
) => {
  const { name, startDate, endDate, isCurrent = false } = payload;

  return prisma.$transaction(async (tx) => {
    // 1. Check duplicate academic year
    const existingAcademicYear = await tx.academicYear.findUnique({
      where: {
        schoolId_name: {
          schoolId,
          name,
        },
      },
    });

    if (existingAcademicYear) {
      throw new AppError(
        `Academic year "${name}" already exists`,
        httpStatus.CONFLICT
      );
    }

    // 2. If this year should become current,
    //    remove current status from existing year
    if (isCurrent) {
      await tx.academicYear.updateMany({
        where: {
          schoolId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });
    }

    // 3. Create academic year
    const academicYear = await tx.academicYear.create({
      data: {
        schoolId,
        name,
        startDate,
        endDate,
        isCurrent,
      },
    });

    const previousYear = await tx.academicYear.findFirst({
      where: { schoolId, id: { not: academicYear.id }, startDate: { lt: academicYear.startDate } },
      orderBy: { startDate: "desc" },
      select: { id: true },
    });

    const carriedOverSections = previousYear
      ? await carryOverSectionConfigs(tx, schoolId, previousYear.id, academicYear.id)
      : 0;
    const carriedOverSubjects = previousYear
      ? await carryOverClassSubjects(tx, schoolId, previousYear.id, academicYear.id)
      : 0;
    // after the subjects: the new year's class subjects must exist first
    const carriedOverSubjectTeachers = previousYear
      ? await carryOverSubjectTeachers(tx, schoolId, previousYear.id, academicYear.id)
      : 0;

    const carriedOverResultSettings = previousYear
      ? await carryOverResultSettings(tx, schoolId, previousYear.id, academicYear.id)
      : 0;

    return {
      ...academicYear,
      carriedOverSections,
      carriedOverSubjects,
      carriedOverSubjectTeachers,
      carriedOverResultSettings,
    };
  });
};

const WORKING_TEACHER = { status: { in: ["ACTIVE" as const, "ON_LEAVE" as const] } };

/*
 * A new year starts with the subject teachers of the year before, matched to the new
 * year's copy of each class subject. Teachers who have left are not carried.
 */
const carryOverSubjectTeachers = async (
  tx: Prisma.TransactionClient,
  schoolId: string,
  previousYearId: string,
  newYearId: string,
) => {
  const [previous, newSubjects] = await Promise.all([
    tx.subjectTeacher.findMany({
      where: { schoolId, academicYearId: previousYearId, teacher: WORKING_TEACHER },
      select: {
        sectionId: true,
        teacherId: true,
        classSubject: { select: { classId: true, subjectId: true, groupId: true } },
      },
    }),
    tx.classSubject.findMany({
      where: { schoolId, academicYearId: newYearId },
      select: { id: true, classId: true, subjectId: true, groupId: true },
    }),
  ]);
  if (previous.length === 0) return 0;

  const key = (s: { classId: string; subjectId: string; groupId: string | null }) =>
    `${s.classId}:${s.subjectId}:${s.groupId ?? ""}`;
  const newIdByKey = new Map(newSubjects.map((s) => [key(s), s.id]));

  const data = previous.flatMap((p) => {
    const classSubjectId = newIdByKey.get(key(p.classSubject));
    return classSubjectId
      ? [{ schoolId, academicYearId: newYearId, sectionId: p.sectionId, classSubjectId, teacherId: p.teacherId }]
      : [];
  });

  const result = await tx.subjectTeacher.createMany({ data, skipDuplicates: true });
  return result.count;
};

/*
 * A new year starts with the subject list each class had in the year before it, with
 * each subject's marks setup (full / pass marks, parts, grading scale).
 */
const carryOverClassSubjects = async (
  tx: Prisma.TransactionClient,
  schoolId: string,
  previousYearId: string,
  newYearId: string,
) => {
  const previous = await tx.classSubject.findMany({
    where: { schoolId, academicYearId: previousYearId },
    select: {
      classId: true,
      subjectId: true,
      groupId: true,
      type: true,
      sortOrder: true,
      fullMarks: true,
      passMarks: true,
      gradingScaleId: true,
      parts: { select: { name: true, fullMarks: true, passMarks: true, sortOrder: true } },
    },
  });
  if (previous.length === 0) return 0;

  const result = await tx.classSubject.createMany({
    data: previous.map(({ parts, ...s }) => ({ ...s, schoolId, academicYearId: newYearId })),
    skipDuplicates: true,
  });

  // the parts hang off the new rows, matched by class, subject and group
  const withParts = previous.filter((s) => s.parts.length > 0);
  if (withParts.length > 0) {
    const created = await tx.classSubject.findMany({
      where: { schoolId, academicYearId: newYearId },
      select: { id: true, classId: true, subjectId: true, groupId: true },
    });
    const key = (s: { classId: string; subjectId: string; groupId: string | null }) =>
      `${s.classId}:${s.subjectId}:${s.groupId ?? ""}`;
    const newIdByKey = new Map(created.map((s) => [key(s), s.id]));

    await tx.classSubjectPart.createMany({
      data: withParts.flatMap((s) => {
        const classSubjectId = newIdByKey.get(key(s));
        return classSubjectId ? s.parts.map((p) => ({ ...p, classSubjectId })) : [];
      }),
      skipDuplicates: true,
    });
  }
  return result.count;
};

/* A new year starts with each class's result settings (system, scale, papers, absent rule). */
const carryOverResultSettings = async (
  tx: Prisma.TransactionClient,
  schoolId: string,
  previousYearId: string,
  newYearId: string,
) => {
  const previous = await tx.classResultSetting.findMany({
    where: { schoolId, academicYearId: previousYearId },
    select: { classId: true, resultSystem: true, gradingScaleId: true, combinePapers: true, absentRule: true },
  });
  const result = await tx.classResultSetting.createMany({
    data: previous.map((s) => ({ ...s, schoolId, academicYearId: newYearId })),
    skipDuplicates: true,
  });
  return result.count;
};

/*
 * A new year starts with the class teacher, capacity and class hours each section had
 * in the year before it. A class teacher who has left is not carried; the rest still is.
 * All of it can be changed afterwards.
 */
const carryOverSectionConfigs = async (
  tx: Prisma.TransactionClient,
  schoolId: string,
  previousYearId: string,
  newYearId: string,
) => {
  const previous = await tx.sectionYearConfig.findMany({
    where: { academicYearId: previousYearId, section: { schoolId } },
    select: { sectionId: true, capacity: true, startTime: true, endTime: true, classTeacherMembershipId: true },
  });
  if (previous.length === 0) return 0;

  const activeTeachers = await tx.teacherProfile.findMany({
    where: {
      schoolId,
      ...WORKING_TEACHER,
      membership: { status: "ACTIVE" },
      membershipId: { in: previous.flatMap((c) => (c.classTeacherMembershipId ? [c.classTeacherMembershipId] : [])) },
    },
    select: { membershipId: true },
  });
  const activeTeacherIds = new Set(activeTeachers.map((t) => t.membershipId));

  const result = await tx.sectionYearConfig.createMany({
    data: previous.map((c) => ({
      sectionId: c.sectionId,
      academicYearId: newYearId,
      capacity: c.capacity,
      startTime: c.startTime,
      endTime: c.endTime,
      classTeacherMembershipId:
        c.classTeacherMembershipId && activeTeacherIds.has(c.classTeacherMembershipId)
          ? c.classTeacherMembershipId
          : null,
    })),
    skipDuplicates: true,
  });
  return result.count;
};

export const AcademicYearService = {
  createAcademicYear,
};