import httpStatus from "http-status";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import type { OptionalQuery, SetOptionalChoicesPayload } from "./exam.validation";

/*
 * Students' optional (4th) subject. It applies wherever a class has OPTIONAL subjects
 * (classes 9-12 in practice); each student picks one of those open to their group.
 */

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

/* A whole-class optional subject is open to everyone; a group one only to that group. */
const openTo = (option: { groupId: string | null }, groupId: string | null) =>
  option.groupId === null || option.groupId === groupId;

/* The class's optional subjects, and each active student with their choice and what they may choose. */
const getChoices = async (schoolId: string, query: OptionalQuery) => {
  const year = await resolveYear(schoolId, query.academicYearId);
  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: query.classId, schoolId },
    select: { id: true, name: true },
  });
  if (!schoolClass) throw new AppError("Class not found for this school", httpStatus.NOT_FOUND);

  const [options, enrollments] = await Promise.all([
    prisma.classSubject.findMany({
      where: { schoolId, classId: query.classId, academicYearId: year.id, type: "OPTIONAL" },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        groupId: true,
        group: { select: { id: true, nameEn: true, nameBn: true } },
        subject: { select: { id: true, nameEn: true, nameBn: true, code: true } },
      },
    }),
    prisma.enrollment.findMany({
      where: {
        academicYearId: year.id,
        classId: query.classId,
        status: "ACTIVE",
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      },
      select: {
        id: true,
        rollNumber: true,
        groupId: true,
        section: { select: { id: true, name: true, isDefault: true } },
        group: { select: { id: true, nameEn: true, nameBn: true } },
        student: { select: { id: true, nameEn: true, nameBn: true, admissionNo: true } },
        optionalSubject: { select: { classSubjectId: true } },
      },
    }),
  ]);

  const students = enrollments
    .map((e) => ({
      enrollmentId: e.id,
      student: e.student,
      section: e.section,
      group: e.group,
      rollNumber: e.rollNumber,
      choice: e.optionalSubject?.classSubjectId ?? null,
      available: options.filter((o) => openTo(o, e.groupId)).map((o) => o.id),
    }))
    .sort(
      (a, b) =>
        a.section.name.localeCompare(b.section.name) ||
        (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "", undefined, { numeric: true }),
    );

  return {
    academicYear: year,
    class: schoolClass,
    options,
    hasOptionalSubjects: options.length > 0,
    // students who could choose but have not: flagged before results are published
    missingChoices: students.filter((s) => s.choice === null && s.available.length > 0).length,
    students,
  };
};

/* Sets (or with null, removes) students' optional subject. All or nothing. */
const setChoices = async (schoolId: string, userId: string, data: SetOptionalChoicesPayload) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: data.choices.map((c) => c.enrollmentId) }, student: { schoolId } },
    select: { id: true, classId: true, academicYearId: true, groupId: true },
  });
  if (enrollments.length !== data.choices.length) {
    throw new AppError("One or more students were not found", httpStatus.NOT_FOUND);
  }
  const enrollmentOf = new Map(enrollments.map((e) => [e.id, e]));

  const chosenIds = [...new Set(data.choices.flatMap((c) => (c.classSubjectId ? [c.classSubjectId] : [])))];
  const options = await prisma.classSubject.findMany({
    where: { id: { in: chosenIds }, schoolId },
    select: { id: true, classId: true, academicYearId: true, groupId: true, type: true, subject: { select: { nameEn: true } } },
  });
  const optionOf = new Map(options.map((o) => [o.id, o]));

  for (const choice of data.choices) {
    if (!choice.classSubjectId) continue;
    const enrollment = enrollmentOf.get(choice.enrollmentId)!;
    const option = optionOf.get(choice.classSubjectId);
    if (!option || option.type !== "OPTIONAL") {
      throw new AppError("Only an optional subject of the class can be chosen", httpStatus.BAD_REQUEST);
    }
    if (option.classId !== enrollment.classId || option.academicYearId !== enrollment.academicYearId) {
      throw new AppError(`${option.subject.nameEn} is not an optional subject of the student's class`, httpStatus.BAD_REQUEST);
    }
    if (!openTo(option, enrollment.groupId)) {
      throw new AppError(`${option.subject.nameEn} is not open to the student's group`, httpStatus.BAD_REQUEST);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const choice of data.choices) {
      if (choice.classSubjectId) {
        await tx.studentOptionalSubject.upsert({
          where: { enrollmentId: choice.enrollmentId },
          create: { enrollmentId: choice.enrollmentId, classSubjectId: choice.classSubjectId, chosenBy: userId },
          update: { classSubjectId: choice.classSubjectId, chosenBy: userId },
        });
      } else {
        await tx.studentOptionalSubject.deleteMany({ where: { enrollmentId: choice.enrollmentId } });
      }
    }
  });

  return { saved: data.choices.length };
};

export const OptionalSubjectService = {
  getChoices,
  setChoices,
};
