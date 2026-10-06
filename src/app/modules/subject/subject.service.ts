import httpStatus from "http-status";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { isForeignKeyViolation, isUniqueViolation } from "../../utils/prismaError";
import type { CreateSubjectPayload, ListSubjectsQuery, UpdateSubjectPayload } from "./subject.type";

/*
 * One service for both catalogues. owner = null is the platform (shared NCTB list,
 * platform admin only); owner = a schoolId is that school's own extra subjects.
 * A school sees the platform subjects plus its own.
 */
type Owner = string | null;

const DUPLICATE_MESSAGE = "A subject with the same name or code already exists";

const brief = { id: true, nameEn: true, nameBn: true, code: true, religion: true, schoolId: true } satisfies Prisma.SubjectSelect;

/* Subjects the owner can see: the platform list, plus its own when it is a school. */
const visibleTo = (owner: Owner): Prisma.SubjectWhereInput =>
  owner ? { OR: [{ schoolId: null }, { schoolId: owner }] } : { schoolId: null };

// a platform subject's papers can include one school's own papers: show each school only its own
const subjectInclude = (owner: Owner) =>
  ({
    parent: { select: brief },
    papers: { where: visibleTo(owner), select: brief, orderBy: [{ code: "asc" }, { nameEn: "asc" }] },
  }) satisfies Prisma.SubjectInclude;

const withSource = <T extends { schoolId: string | null }>(subject: T) => ({
  ...subject,
  source: subject.schoolId ? ("SCHOOL" as const) : ("PLATFORM" as const),
});

// ------------------------------------------------------------------- helpers

/* A subject this owner may change: a school can never change a platform subject. */
const findOwned = async (owner: Owner, subjectId: string) => {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, ...visibleTo(owner) },
    include: { _count: { select: { papers: true, classSubjects: true } } },
  });
  if (!subject) throw new AppError("Subject not found", httpStatus.NOT_FOUND);
  if (subject.schoolId !== owner) {
    throw new AppError("Subjects from the shared NCTB list can only be changed by the platform admin", httpStatus.FORBIDDEN);
  }
  return subject;
};

/*
 * Names and code are unique, ignoring case, among the platform subjects and within a
 * school, and a school subject cannot reuse a platform subject's name or code.
 */
const assertNamesFree = async (
  owner: Owner,
  values: { nameEn?: string; nameBn?: string; code?: string | null },
  excludeId?: string,
) => {
  const fields: Prisma.SubjectWhereInput[] = [];
  if (values.nameEn) fields.push({ nameEn: { equals: values.nameEn, mode: "insensitive" } });
  if (values.nameBn) fields.push({ nameBn: { equals: values.nameBn, mode: "insensitive" } });
  if (values.code) fields.push({ code: { equals: values.code, mode: "insensitive" } });
  if (fields.length === 0) return;

  const clash = await prisma.subject.findFirst({
    where: {
      AND: [visibleTo(owner), { OR: fields }, ...(excludeId ? [{ id: { not: excludeId } }] : [])],
    },
    select: { nameEn: true, nameBn: true, code: true, schoolId: true },
  });
  if (!clash) return;

  const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
  const field = same(values.nameEn, clash.nameEn)
    ? `English name "${clash.nameEn}"`
    : same(values.nameBn, clash.nameBn)
      ? `Bangla name "${clash.nameBn}"`
      : `code "${clash.code}"`;
  const where = clash.schoolId ? "this school" : "the shared NCTB list";
  throw new AppError(`A subject with the ${field} already exists in ${where}`, httpStatus.CONFLICT);
};

/*
 * A paper's parent must be visible to the owner (a platform paper needs a platform parent)
 * and must not be a paper itself: papers are one level deep.
 */
const assertParent = async (owner: Owner, parentId: string, self?: { id: string; papers: number }) => {
  if (self && self.id === parentId) {
    throw new AppError("A subject cannot be a paper of itself", httpStatus.BAD_REQUEST);
  }
  if (self && self.papers > 0) {
    throw new AppError("This subject has papers of its own, so it cannot become a paper", httpStatus.BAD_REQUEST);
  }

  const parent = await prisma.subject.findFirst({
    where: { id: parentId, ...visibleTo(owner) },
    select: { parentId: true, religion: true },
  });
  if (!parent) throw new AppError("Parent subject not found", httpStatus.NOT_FOUND);
  if (parent.parentId) {
    throw new AppError("The parent is itself a paper. Choose the main subject (e.g. Bangla)", httpStatus.BAD_REQUEST);
  }
  if (parent.religion) {
    throw new AppError("A religion subject cannot have papers", httpStatus.BAD_REQUEST);
  }
};

// -------------------------------------------------------------------- create

const createSubject = async (owner: Owner, data: CreateSubjectPayload) => {
  await assertNamesFree(owner, data);
  if (data.parentId) await assertParent(owner, data.parentId);

  try {
    const subject = await prisma.subject.create({
      data: {
        schoolId: owner,
        nameEn: data.nameEn,
        nameBn: data.nameBn,
        code: data.code ?? null,
        parentId: data.parentId ?? null,
        religion: data.religion ?? null,
      },
      include: subjectInclude(owner),
    });
    return withSource(subject);
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(DUPLICATE_MESSAGE, httpStatus.CONFLICT);
    throw e;
  }
};

// ------------------------------------------------------------------- reading

const getSubjects = async (owner: Owner, query: ListSubjectsQuery) => {
  const sourceFilter: Prisma.SubjectWhereInput =
    query.source === "PLATFORM" ? { schoolId: null } : query.source === "SCHOOL" ? { schoolId: owner } : {};

  const subjects = await prisma.subject.findMany({
    where: {
      AND: [
        visibleTo(owner),
        sourceFilter,
        query.search
          ? {
              OR: [
                { nameEn: { contains: query.search, mode: "insensitive" } },
                { nameBn: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    orderBy: [{ code: { sort: "asc", nulls: "last" } }, { nameEn: "asc" }],
    include: subjectInclude(owner),
  });

  return subjects.map(withSource);
};

const getSubjectById = async (owner: Owner, subjectId: string) => {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, ...visibleTo(owner) },
    include: subjectInclude(owner),
  });
  if (!subject) throw new AppError("Subject not found", httpStatus.NOT_FOUND);
  return withSource(subject);
};

// -------------------------------------------------------------------- update

const updateSubject = async (owner: Owner, subjectId: string, data: UpdateSubjectPayload) => {
  const subject = await findOwned(owner, subjectId);

  await assertNamesFree(
    owner,
    {
      nameEn: data.nameEn !== subject.nameEn ? data.nameEn : undefined,
      nameBn: data.nameBn !== subject.nameBn ? data.nameBn : undefined,
      code: data.code !== subject.code ? data.code : undefined,
    },
    subjectId,
  );

  if (data.parentId !== undefined && data.parentId !== subject.parentId) {
    // classes may hold both this subject and its new parent, or results may already be
    // split by paper: changing the paper structure is only safe before any assignment
    if (subject._count.classSubjects > 0) {
      throw new AppError(
        "This subject is already assigned to classes, so whether it is a paper cannot change",
        httpStatus.CONFLICT,
      );
    }
    if (data.parentId) {
      await assertParent(owner, data.parentId, { id: subject.id, papers: subject._count.papers });
    }
  }

  if (data.religion !== undefined && data.religion !== subject.religion) {
    // the students who take it would change under existing classes (and later results)
    if (subject._count.classSubjects > 0) {
      throw new AppError(
        "This subject is already assigned to classes, so its religion cannot change",
        httpStatus.CONFLICT,
      );
    }
    if (data.religion) {
      const parentId = data.parentId !== undefined ? data.parentId : subject.parentId;
      if (parentId) throw new AppError("A religion subject cannot be a paper", httpStatus.BAD_REQUEST);
      if (subject._count.papers > 0) {
        throw new AppError("A subject with papers cannot be a religion subject", httpStatus.BAD_REQUEST);
      }
    }
  }
  if (data.parentId && subject.religion && data.religion === undefined) {
    throw new AppError("A religion subject cannot be a paper", httpStatus.BAD_REQUEST);
  }

  try {
    const updated = await prisma.subject.update({
      where: { id: subjectId },
      data: {
        ...(data.nameEn !== undefined ? { nameEn: data.nameEn } : {}),
        ...(data.nameBn !== undefined ? { nameBn: data.nameBn } : {}),
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
        ...(data.religion !== undefined ? { religion: data.religion } : {}),
      },
      include: subjectInclude(owner),
    });
    return withSource(updated);
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(DUPLICATE_MESSAGE, httpStatus.CONFLICT);
    throw e;
  }
};

// -------------------------------------------------------------------- delete

/* Hard delete, only while no class (in any school) uses it and it has no papers. */
const deleteSubject = async (owner: Owner, subjectId: string) => {
  const subject = await findOwned(owner, subjectId);

  if (subject._count.papers > 0) {
    throw new AppError("Delete or detach its papers first", httpStatus.CONFLICT);
  }
  if (subject._count.classSubjects > 0) {
    throw new AppError(
      owner
        ? "This subject is assigned to classes and cannot be deleted"
        : "Schools have assigned this subject to classes, so it cannot be deleted",
      httpStatus.CONFLICT,
    );
  }

  try {
    await prisma.subject.delete({ where: { id: subjectId } });
  } catch (e) {
    // assigned or given a paper between the check and the delete
    if (isForeignKeyViolation(e)) {
      throw new AppError("This subject is in use and cannot be deleted", httpStatus.CONFLICT);
    }
    throw e;
  }
};

export const SubjectService = {
  createSubject,
  getSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
};
