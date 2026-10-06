import httpStatus from "http-status";
import type { z } from "zod";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { WORKING_STATUSES } from "../teacher/teacher.service";
import { SubjectTeacherValidation } from "./subjectTeacher.validation";

export type SetSubjectTeachersPayload = z.infer<typeof SubjectTeacherValidation.setSubjectTeachers>;
export type ListSubjectTeachersQuery = z.infer<typeof SubjectTeacherValidation.listQuery>;

const subjectTeacherInclude = {
  section: {
    select: { id: true, name: true, isDefault: true, class: { select: { id: true, name: true, numericLevel: true } } },
  },
  classSubject: {
    select: {
      id: true,
      type: true,
      sortOrder: true,
      group: { select: { id: true, nameEn: true, nameBn: true } },
      subject: { select: { id: true, nameEn: true, nameBn: true, code: true } },
    },
  },
  teacher: {
    select: {
      id: true,
      designation: true,
      status: true,
      membership: { select: { user: { select: { id: true, fullname: true, phone: true } } } },
    },
  },
} satisfies Prisma.SubjectTeacherInclude;

/*
 * Sets who teaches a class subject in a section: the list given replaces the old one, so
 * a teacher change in the middle of the year is just a new list. The section and the class
 * subject must belong to the same class, and only working teachers can be chosen.
 */
const setSubjectTeachers = async (schoolId: string, data: SetSubjectTeachersPayload) => {
  const [section, classSubject] = await Promise.all([
    prisma.section.findFirst({ where: { id: data.sectionId, schoolId }, select: { id: true, classId: true } }),
    prisma.classSubject.findFirst({
      where: { id: data.classSubjectId, schoolId },
      select: { id: true, classId: true, academicYearId: true },
    }),
  ]);
  if (!section) throw new AppError("Section not found", httpStatus.NOT_FOUND);
  if (!classSubject) throw new AppError("Class subject not found", httpStatus.NOT_FOUND);
  if (section.classId !== classSubject.classId) {
    throw new AppError("This subject is not taught in this section's class", httpStatus.BAD_REQUEST);
  }

  if (data.teacherIds.length > 0) {
    const teachers = await prisma.teacherProfile.count({
      where: { id: { in: data.teacherIds }, schoolId, status: { in: WORKING_STATUSES } },
    });
    if (teachers !== data.teacherIds.length) {
      throw new AppError("One or more teachers were not found, or have left the school", httpStatus.BAD_REQUEST);
    }
  }

  const where = { sectionId: data.sectionId, classSubjectId: data.classSubjectId };

  return prisma.$transaction(async (tx) => {
    await tx.subjectTeacher.deleteMany({ where });
    await tx.subjectTeacher.createMany({
      data: data.teacherIds.map((teacherId) => ({
        schoolId,
        academicYearId: classSubject.academicYearId,
        sectionId: data.sectionId,
        classSubjectId: data.classSubjectId,
        teacherId,
      })),
    });
    return tx.subjectTeacher.findMany({ where, include: subjectTeacherInclude, orderBy: { createdAt: "asc" } });
  });
};

/* Who teaches what in a year: for a class, a section, or one teacher. */
const getSubjectTeachers = async (schoolId: string, query: ListSubjectTeachersQuery) => {
  const year = query.academicYearId
    ? await prisma.academicYear.findFirst({ where: { id: query.academicYearId, schoolId }, select: { id: true, name: true } })
    : await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true, name: true } });
  if (!year) {
    throw query.academicYearId
      ? new AppError("Academic year not found for this school", httpStatus.NOT_FOUND)
      : new AppError("No current academic year is set. Choose an academic year", httpStatus.BAD_REQUEST);
  }

  const items = await prisma.subjectTeacher.findMany({
    where: {
      schoolId,
      academicYearId: year.id,
      ...(query.classId ? { section: { classId: query.classId } } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
    },
    orderBy: [
      { section: { class: { numericLevel: "asc" } } },
      { section: { name: "asc" } },
      { classSubject: { sortOrder: "asc" } },
      { createdAt: "asc" },
    ],
    include: subjectTeacherInclude,
  });

  return { academicYear: year, items };
};

export const SubjectTeacherService = {
  setSubjectTeachers,
  getSubjectTeachers,
};
