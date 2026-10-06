import httpStatus from "http-status";
import type { Prisma } from "../../../../generated/prisma/client";
import type { Religion } from "../../../../generated/prisma/enums";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { isUniqueViolation } from "../../utils/prismaError";
import type {
  AssignSubjectsPayload,
  ListClassSubjectsQuery,
  SetMarksPayload,
  UpdateClassSubjectPayload,
} from "./classSubject.type";

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

const subjectBrief = {
  id: true,
  nameEn: true,
  nameBn: true,
  code: true,
  religion: true,
  schoolId: true,
  parent: { select: { id: true, nameEn: true, nameBn: true, code: true } },
} satisfies Prisma.SubjectSelect;

const classSubjectInclude = {
  class: { select: { id: true, name: true, numericLevel: true } },
  group: { select: { id: true, nameEn: true, nameBn: true } },
  subject: { select: subjectBrief },
  parts: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, fullMarks: true, passMarks: true } },
  gradingScale: { select: { id: true, name: true } },
} satisfies Prisma.ClassSubjectInclude;

// ------------------------------------------------------------------- helpers

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

const findClassSubject = async (schoolId: string, classSubjectId: string) => {
  const row = await prisma.classSubject.findFirst({
    where: { id: classSubjectId, schoolId },
    include: classSubjectInclude,
  });
  if (!row) throw new AppError("Class subject not found", httpStatus.NOT_FOUND);
  return row;
};

type Row = {
  subjectId: string;
  groupId: string | null;
  subject: { nameEn: string; parentId: string | null; religion: Religion | null };
};

/*
 * The rules for the full list of a class in one year (what is there plus what is added):
 *  - a subject appears once for the whole class, or once per group, never both
 *  - a class gets either a subject or its papers, never both (results would count twice)
 *  - a class has at most one subject per religion, and it is for the whole class
 */
const assertConsistent = (rows: Row[], groupNames: Map<string, string>) => {
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.subjectId}:${r.groupId ?? ""}`;
    if (seen.has(key)) {
      const forWhom = r.groupId ? ` for the ${groupNames.get(r.groupId) ?? "same"} group` : "";
      throw new AppError(`${r.subject.nameEn} is already assigned to this class${forWhom}`, httpStatus.CONFLICT);
    }
    seen.add(key);
  }

  const bySubject = new Map<string, Row[]>();
  for (const r of rows) bySubject.set(r.subjectId, [...(bySubject.get(r.subjectId) ?? []), r]);

  for (const list of bySubject.values()) {
    if (list.some((r) => r.groupId === null) && list.some((r) => r.groupId !== null)) {
      throw new AppError(
        `${list[0].subject.nameEn} cannot be both for the whole class and for a group`,
        httpStatus.CONFLICT,
      );
    }
  }

  for (const r of rows) {
    const parentId = r.subject.parentId;
    const parent = parentId ? bySubject.get(parentId)?.[0] : undefined;
    if (parent) {
      throw new AppError(
        `Assign either ${parent.subject.nameEn} or its papers (like ${r.subject.nameEn}), not both`,
        httpStatus.CONFLICT,
      );
    }
  }

  const byReligion = new Map<Religion, Row>();
  for (const r of rows) {
    const religion = r.subject.religion;
    if (!religion) continue;
    if (r.groupId !== null) {
      throw new AppError(`${r.subject.nameEn} is a religion subject and must be for the whole class`, httpStatus.BAD_REQUEST);
    }
    const other = byReligion.get(religion);
    if (other && other.subjectId !== r.subjectId) {
      throw new AppError(
        `This class already has ${other.subject.nameEn} for the same religion, so ${r.subject.nameEn} cannot be added`,
        httpStatus.CONFLICT,
      );
    }
    byReligion.set(religion, r);
  }
};

// -------------------------------------------------------------------- assign

/* Adds subjects to a class for a year, all or nothing. */
const assignSubjects = async (schoolId: string, data: AssignSubjectsPayload) => {
  const year = await resolveYear(schoolId, data.academicYearId);

  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: data.classId, schoolId },
    select: { id: true },
  });
  if (!schoolClass) throw new AppError("Class not found for this school", httpStatus.NOT_FOUND);

  const subjectIds = [...new Set(data.items.map((i) => i.subjectId))];
  const groupIds = [...new Set(data.items.flatMap((i) => (i.groupId ? [i.groupId] : [])))];

  const [subjects, groups] = await Promise.all([
    // the shared NCTB list or this school's own
    prisma.subject.findMany({
      where: { id: { in: subjectIds }, OR: [{ schoolId: null }, { schoolId }] },
      select: { id: true, nameEn: true, parentId: true, religion: true },
    }),
    prisma.group.findMany({ where: { schoolId }, select: { id: true, nameEn: true } }),
  ]);
  if (subjects.length !== subjectIds.length) {
    throw new AppError("One or more subjects were not found", httpStatus.NOT_FOUND);
  }
  const groupNames = new Map(groups.map((g) => [g.id, g.nameEn]));
  if (groupIds.some((id) => !groupNames.has(id))) {
    throw new AppError("One or more groups were not found for this school", httpStatus.NOT_FOUND);
  }
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.classSubject.findMany({
        where: { academicYearId: year.id, classId: data.classId },
        select: { subjectId: true, groupId: true, sortOrder: true, subject: { select: { nameEn: true, parentId: true, religion: true } } },
      });

      const added = data.items.map((i) => ({
        subjectId: i.subjectId,
        groupId: i.groupId ?? null,
        subject: {
          nameEn: subjectById.get(i.subjectId)!.nameEn,
          parentId: subjectById.get(i.subjectId)!.parentId,
          religion: subjectById.get(i.subjectId)!.religion,
        },
      }));
      assertConsistent([...existing, ...added], groupNames);

      // without a sort order, new subjects go after the ones already there, in the given order
      let next = existing.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1;

      await tx.classSubject.createMany({
        data: data.items.map((i) => ({
          schoolId,
          academicYearId: year.id,
          classId: data.classId,
          subjectId: i.subjectId,
          groupId: i.groupId ?? null,
          type: i.type,
          sortOrder: i.sortOrder ?? next++,
        })),
      });

      const items = await tx.classSubject.findMany({
        where: { academicYearId: year.id, classId: data.classId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: classSubjectInclude,
      });
      return { academicYear: year, items };
    }, TX_OPTIONS);
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new AppError("One of these subjects is already assigned to this class", httpStatus.CONFLICT);
    }
    throw e;
  }
};

// ------------------------------------------------------------------- reading

/* The subjects of one class (or every class) in a year, in their order. */
const getClassSubjects = async (schoolId: string, query: ListClassSubjectsQuery) => {
  const year = await resolveYear(schoolId, query.academicYearId);

  const items = await prisma.classSubject.findMany({
    where: {
      schoolId,
      academicYearId: year.id,
      ...(query.classId ? { classId: query.classId } : {}),
      // a group's view: its own subjects plus the whole-class ones
      ...(query.groupId ? { OR: [{ groupId: query.groupId }, { groupId: null }] } : {}),
    },
    orderBy: [{ class: { numericLevel: "asc" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: classSubjectInclude,
  });

  return { academicYear: year, items };
};

// -------------------------------------------------------------------- update

const updateClassSubject = async (schoolId: string, classSubjectId: string, data: UpdateClassSubjectPayload) => {
  await findClassSubject(schoolId, classSubjectId);

  return prisma.classSubject.update({
    where: { id: classSubjectId },
    data: {
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
    include: classSubjectInclude,
  });
};

// -------------------------------------------------------------------- remove

const removeClassSubject = async (schoolId: string, classSubjectId: string) => {
  await findClassSubject(schoolId, classSubjectId);

  const [examined, chosen] = await Promise.all([
    prisma.examSubject.count({ where: { classSubjectId } }),
    prisma.studentOptionalSubject.count({ where: { classSubjectId } }),
  ]);
  if (examined > 0) {
    throw new AppError("This subject is in an exam routine and cannot be removed", httpStatus.CONFLICT);
  }
  if (chosen > 0) {
    throw new AppError(
      `${chosen} student(s) chose this as their optional subject. Change their choice first`,
      httpStatus.CONFLICT,
    );
  }

  await prisma.classSubject.delete({ where: { id: classSubjectId } });
};

// --------------------------------------------------------------- marks setup

/*
 * The default full marks, pass marks and parts of a class subject (each exam copies them
 * and may change them), and optionally its own grading scale. Replaces the whole setup.
 */
const setMarks = async (schoolId: string, classSubjectId: string, data: SetMarksPayload) => {
  await findClassSubject(schoolId, classSubjectId);

  if (data.gradingScaleId) {
    const scale = await prisma.gradingScale.findFirst({ where: { id: data.gradingScaleId, schoolId }, select: { id: true } });
    if (!scale) throw new AppError("Grading scale not found", httpStatus.NOT_FOUND);
  }

  return prisma.$transaction(async (tx) => {
    await tx.classSubjectPart.deleteMany({ where: { classSubjectId } });
    return tx.classSubject.update({
      where: { id: classSubjectId },
      data: {
        fullMarks: data.fullMarks,
        passMarks: data.passMarks,
        ...(data.gradingScaleId !== undefined ? { gradingScaleId: data.gradingScaleId } : {}),
        parts: { create: data.parts.map((p, i) => ({ ...p, sortOrder: i })) },
      },
      include: classSubjectInclude,
    });
  });
};

export const ClassSubjectService = {
  setMarks,
  assignSubjects,
  getClassSubjects,
  updateClassSubject,
  removeClassSubject,
};
