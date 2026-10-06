import httpStatus from "http-status";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { isForeignKeyViolation, isUniqueViolation } from "../../utils/prismaError";
import type { CreateGroupPayload, GroupQuery, UpdateGroupPayload } from "./group.type";

const DUPLICATE_MESSAGE = "A group with this name already exists";

// ------------------------------------------------------------------- helpers

const findGroup = async (schoolId: string, groupId: string) => {
  const group = await prisma.group.findFirst({ where: { id: groupId, schoolId } });
  if (!group) throw new AppError("Group not found", httpStatus.NOT_FOUND);
  return group;
};

/* "Science" and "science" are the same name, in English and in Bangla. */
const assertNamesFree = async (
  schoolId: string,
  names: { nameEn?: string; nameBn?: string },
  excludeGroupId?: string,
) => {
  const fields: Prisma.GroupWhereInput[] = [];
  if (names.nameEn) fields.push({ nameEn: { equals: names.nameEn, mode: "insensitive" } });
  if (names.nameBn) fields.push({ nameBn: { equals: names.nameBn, mode: "insensitive" } });
  if (fields.length === 0) return;

  const clash = await prisma.group.findFirst({
    where: { schoolId, OR: fields, ...(excludeGroupId ? { id: { not: excludeGroupId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new AppError(DUPLICATE_MESSAGE, httpStatus.CONFLICT);
};

/* The given year, or the current one when none is given. null when the school has no current year. */
const resolveYear = async (schoolId: string, academicYearId?: string) => {
  const year = academicYearId
    ? await prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId }, select: { id: true, name: true } })
    : await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true, name: true } });

  if (academicYearId && !year) {
    throw new AppError("Academic year not found for this school", httpStatus.NOT_FOUND);
  }
  return year;
};

/* Active students and assigned subjects of each group in one year. */
const loadYearCounts = async (academicYearId: string, groupIds: string[]) => {
  const [students, subjects] = await Promise.all([
    prisma.enrollment.groupBy({
      by: ["groupId"],
      where: { academicYearId, groupId: { in: groupIds }, status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.classSubject.groupBy({
      by: ["groupId"],
      where: { academicYearId, groupId: { in: groupIds } },
      _count: { _all: true },
    }),
  ]);

  const studentsBy = new Map(students.map((s) => [s.groupId, s._count._all]));
  const subjectsBy = new Map(subjects.map((s) => [s.groupId, s._count._all]));

  return (groupId: string) => ({
    activeStudents: studentsBy.get(groupId) ?? 0,
    subjects: subjectsBy.get(groupId) ?? 0,
  });
};

// ---------------------------------------------------------------------- crud

const createGroup = async (schoolId: string, data: CreateGroupPayload) => {
  await assertNamesFree(schoolId, data);

  try {
    return await prisma.group.create({ data: { schoolId, nameEn: data.nameEn, nameBn: data.nameBn } });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(DUPLICATE_MESSAGE, httpStatus.CONFLICT);
    throw e;
  }
};

const getGroups = async (schoolId: string, query: GroupQuery) => {
  const year = await resolveYear(schoolId, query.academicYearId);

  const groups = await prisma.group.findMany({ where: { schoolId }, orderBy: { nameEn: "asc" } });
  const countsOf = year ? await loadYearCounts(year.id, groups.map((g) => g.id)) : null;

  return {
    academicYear: year,
    items: groups.map((group) => ({ ...group, yearInfo: countsOf ? countsOf(group.id) : null })),
  };
};

const getGroupById = async (schoolId: string, groupId: string, query: GroupQuery) => {
  const [group, year] = await Promise.all([
    findGroup(schoolId, groupId),
    resolveYear(schoolId, query.academicYearId),
  ]);
  const countsOf = year ? await loadYearCounts(year.id, [group.id]) : null;

  return { ...group, academicYear: year, yearInfo: countsOf ? countsOf(group.id) : null };
};

const updateGroup = async (schoolId: string, groupId: string, data: UpdateGroupPayload) => {
  const group = await findGroup(schoolId, groupId);

  await assertNamesFree(
    schoolId,
    {
      nameEn: data.nameEn !== group.nameEn ? data.nameEn : undefined,
      nameBn: data.nameBn !== group.nameBn ? data.nameBn : undefined,
    },
    groupId,
  );

  try {
    return await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(data.nameEn !== undefined ? { nameEn: data.nameEn } : {}),
        ...(data.nameBn !== undefined ? { nameBn: data.nameBn } : {}),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(DUPLICATE_MESSAGE, httpStatus.CONFLICT);
    throw e;
  }
};

/*
 * Hard delete, only while no student was ever enrolled in the group (in any year) and no
 * subject is assigned to it. Otherwise students would silently lose their group.
 */
const deleteGroup = async (schoolId: string, groupId: string) => {
  await findGroup(schoolId, groupId);

  const [enrollments, subjects] = await Promise.all([
    prisma.enrollment.count({ where: { groupId } }),
    prisma.classSubject.count({ where: { groupId } }),
  ]);
  if (enrollments > 0) {
    throw new AppError(
      `This group has ${enrollments} enrollment record(s) and cannot be deleted`,
      httpStatus.CONFLICT,
    );
  }
  if (subjects > 0) {
    throw new AppError(
      `${subjects} class subject(s) are assigned to this group. Remove them first`,
      httpStatus.CONFLICT,
    );
  }

  try {
    await prisma.group.delete({ where: { id: groupId } });
  } catch (e) {
    // a subject was assigned between the check and the delete
    if (isForeignKeyViolation(e)) {
      throw new AppError("This group is in use and cannot be deleted", httpStatus.CONFLICT);
    }
    throw e;
  }
};

export const GroupService = {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
};
