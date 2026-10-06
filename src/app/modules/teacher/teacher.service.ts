import httpStatus from "http-status";
import type { Prisma } from "../../../../generated/prisma/client";
import type { TeacherStatus } from "../../../../generated/prisma/enums";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { dayKey, todayInBangladesh } from "../../shared/scheduleSchemas";
import {
  assertAccountOnlyInSchool,
  findOrCreateAccount,
  grantSchoolRole,
  revokeSchoolRole,
  TEACHER_ROLE,
} from "../../shared/schoolAccounts";
import { PasswordUtils } from "../../utils/password";
import { isUniqueViolation } from "../../utils/prismaError";
import { dayStatus, loadCalendar } from "../calendar/calendar.resolver";
import { resolveSectionHours } from "../schedule/schedule.service";
import type {
  CreateTeacherPayload,
  DeactivateTeacherPayload,
  ListTeachersQuery,
  ScheduleQuery,
  UpdateTeacherPayload,
  YearQuery,
} from "./teacher.type";

type Auth = NonNullable<Express.Request["auth"]>;

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

/* A teacher who still works at the school (on leave included). */
export const WORKING_STATUSES: TeacherStatus[] = ["ACTIVE", "ON_LEAVE"];

const teacherInclude = {
  membership: {
    select: {
      id: true,
      status: true,
      user: { select: { id: true, fullname: true, phone: true, isActive: true, mustChangePassword: true } },
    },
  },
} satisfies Prisma.TeacherProfileInclude;

// ------------------------------------------------------------------- helpers

const findTeacher = async (schoolId: string, teacherId: string) => {
  const teacher = await prisma.teacherProfile.findFirst({
    where: { id: teacherId, schoolId },
    include: teacherInclude,
  });
  if (!teacher) throw new AppError("Teacher not found", httpStatus.NOT_FOUND);
  return teacher;
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

/* Sections where the teacher is class teacher, and the subjects they teach, in one year. */
const loadAssignments = async (teacher: { id: string; membershipId: string }, academicYearId: string) => {
  const [classTeacherOf, subjects] = await Promise.all([
    prisma.sectionYearConfig.findMany({
      where: { academicYearId, classTeacherMembershipId: teacher.membershipId },
      select: {
        section: {
          select: { id: true, name: true, isDefault: true, class: { select: { id: true, name: true, numericLevel: true } } },
        },
      },
    }),
    prisma.subjectTeacher.findMany({
      where: { academicYearId, teacherId: teacher.id },
      select: {
        id: true,
        section: {
          select: { id: true, name: true, isDefault: true, class: { select: { id: true, name: true, numericLevel: true } } },
        },
        classSubject: {
          select: {
            id: true,
            type: true,
            group: { select: { id: true, nameEn: true, nameBn: true } },
            subject: { select: { id: true, nameEn: true, nameBn: true, code: true } },
          },
        },
      },
    }),
  ]);

  const byClassLevel = (a: { section: { class: { numericLevel: number } } }, b: typeof a) =>
    a.section.class.numericLevel - b.section.class.numericLevel;

  return {
    classTeacherOf: classTeacherOf.map((c) => c.section).sort((a, b) => a.class.numericLevel - b.class.numericLevel),
    subjects: subjects.sort(byClassLevel),
  };
};

/* The teacher behind a school session: only for real members who still teach here. */
const findMyProfile = async (auth: Auth) => {
  const teacher = auth.membershipId
    ? await prisma.teacherProfile.findUnique({ where: { membershipId: auth.membershipId }, include: teacherInclude })
    : null;
  if (!teacher || !WORKING_STATUSES.includes(teacher.status)) {
    throw new AppError("You are not a teacher at this school", httpStatus.FORBIDDEN);
  }
  return teacher;
};

const profileData = (data: Partial<CreateTeacherPayload>) => ({
  designation: data.designation,
  mpoIndex: data.mpoIndex,
  joiningDate: data.joiningDate,
  qualification: data.qualification,
  specialization: data.specialization,
  gender: data.gender,
  photo: data.photo,
  nid: data.nid,
});

// -------------------------------------------------------------------- create

/*
 * Adds a teacher. The phone decides the account: an existing account (for example a
 * guardian's) is linked and keeps its name and password; otherwise a new one is created
 * with a generated password. A teacher who left earlier is taken back on the same profile.
 */
const createTeacher = async (schoolId: string, data: CreateTeacherPayload) => {
  const result = await prisma.$transaction(async (tx) => {
    const account = await findOrCreateAccount(tx, { phone: data.phone, fullname: data.fullname });
    const membershipId = await grantSchoolRole(tx, schoolId, account.userId, TEACHER_ROLE);

    const existing = await tx.teacherProfile.findUnique({ where: { membershipId } });
    if (existing && WORKING_STATUSES.includes(existing.status)) {
      throw new AppError("This person is already a teacher at this school", httpStatus.CONFLICT);
    }

    const teacher = existing
      ? await tx.teacherProfile.update({
          where: { id: existing.id },
          // rejoining: back to work, with any details given now
          data: { ...profileData(data), status: "ACTIVE", leftAt: null },
          include: teacherInclude,
        })
      : await tx.teacherProfile.create({
          data: { schoolId, membershipId, ...profileData(data) },
          include: teacherInclude,
        });

    return { teacher, account, rejoined: existing !== null };
  }, TX_OPTIONS);

  return {
    teacher: result.teacher,
    account: {
      status: result.account.created ? ("CREATED" as const) : ("LINKED" as const),
      loginPhone: data.phone,
      // shown once, only for a new account
      temporaryPassword: result.account.temporaryPassword,
    },
    rejoined: result.rejoined,
  };
};

// ------------------------------------------------------------------- reading

const getTeachers = async (schoolId: string, query: ListTeachersQuery) => {
  const where: Prisma.TeacherProfileWhereInput = {
    schoolId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { membership: { user: { fullname: { contains: query.search, mode: "insensitive" } } } },
            { membership: { user: { phone: { contains: query.search } } } },
            { designation: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.teacherProfile.findMany({
      where,
      orderBy: [{ membership: { user: { fullname: "asc" } } }, { id: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: teacherInclude,
    }),
    prisma.teacherProfile.count({ where }),
  ]);

  return {
    items,
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
};

const getTeacherById = async (schoolId: string, teacherId: string, query: YearQuery) => {
  const [teacher, year] = await Promise.all([
    findTeacher(schoolId, teacherId),
    resolveYear(schoolId, query.academicYearId),
  ]);

  const assignments = year ? await loadAssignments(teacher, year.id) : null;
  return { ...teacher, academicYear: year, assignments };
};

// -------------------------------------------------------------------- update

const updateTeacher = async (schoolId: string, teacherId: string, data: UpdateTeacherPayload) => {
  const teacher = await findTeacher(schoolId, teacherId);
  const user = teacher.membership.user;
  const { fullname, phone, status, ...profile } = data;

  if (status && !WORKING_STATUSES.includes(teacher.status)) {
    throw new AppError("This teacher has left. Add them as a teacher again to take them back", httpStatus.CONFLICT);
  }

  const nameChanged = fullname !== undefined && fullname !== user.fullname;
  const phoneChanged = phone !== undefined && phone !== user.phone;

  try {
    return await prisma.$transaction(async (tx) => {
      if (nameChanged || phoneChanged) {
        // the name and phone belong to the account, which may be used at another school
        await assertAccountOnlyInSchool(tx, schoolId, user.id);
        await tx.user.update({
          where: { id: user.id },
          data: { ...(nameChanged ? { fullname } : {}), ...(phoneChanged ? { phone } : {}) },
        });
        if (phoneChanged) {
          // the same account may be this school's family login: keep the students in step
          await tx.student.updateMany({ where: { schoolId, userId: user.id }, data: { phone } });
        }
      }

      return tx.teacherProfile.update({
        where: { id: teacherId },
        data: { ...profile, ...(status ? { status } : {}) },
        include: teacherInclude,
      });
    }, TX_OPTIONS);
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new AppError("This phone number already belongs to another account", httpStatus.CONFLICT);
    }
    throw e;
  }
};

// ---------------------------------------------------------------- deactivate

/*
 * A teacher leaving (resigned or retired). Nothing is deleted: past years keep them as
 * class teacher and subject teacher. They lose the TEACHER role (and with it this school's
 * login, unless they are also a guardian here), and are removed as class teacher and
 * subject teacher in every year that has not ended yet.
 */
const deactivateTeacher = async (schoolId: string, teacherId: string, data: DeactivateTeacherPayload) => {
  const teacher = await findTeacher(schoolId, teacherId);
  if (!WORKING_STATUSES.includes(teacher.status)) {
    throw new AppError("This teacher has already left", httpStatus.CONFLICT);
  }

  const leftAt = data.leftAt ?? todayInBangladesh();
  const today = todayInBangladesh();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.teacherProfile.update({
      where: { id: teacherId },
      data: { status: data.status, leftAt },
      include: teacherInclude,
    });

    await revokeSchoolRole(tx, schoolId, teacher.membership.user.id, TEACHER_ROLE.name);

    const unfinishedYear = { endDate: { gte: today } };
    const classTeacher = await tx.sectionYearConfig.updateMany({
      where: { classTeacherMembershipId: teacher.membershipId, academicYear: unfinishedYear },
      data: { classTeacherMembershipId: null },
    });
    const subjects = await tx.subjectTeacher.deleteMany({
      where: { teacherId, academicYear: unfinishedYear },
    });

    return {
      teacher: updated,
      removedAsClassTeacher: classTeacher.count,
      removedSubjectAssignments: subjects.count,
    };
  }, TX_OPTIONS);
};

// ------------------------------------------------------------ reset password

/* Allowed when the account is used in this school alone; refused if it belongs to another school too. */
const resetPassword = async (schoolId: string, teacherId: string) => {
  const teacher = await findTeacher(schoolId, teacherId);
  const user = teacher.membership.user;

  await assertAccountOnlyInSchool(prisma, schoolId, user.id);

  const temporaryPassword = PasswordUtils.generateTemporaryPassword();
  const passwordHash = await PasswordUtils.hashPassword(temporaryPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash, mustChangePassword: true, tokensValidAfter: new Date() },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);

  return { loginPhone: user.phone, temporaryPassword };
};

// ---------------------------------------------------------- the teacher's own

const getMyProfile = (auth: Auth) => findMyProfile(auth);

const getMyAssignments = async (auth: Auth, query: YearQuery) => {
  const teacher = await findMyProfile(auth);
  const year = await resolveYear(auth.schoolId!, query.academicYearId);

  return { academicYear: year, ...(year ? await loadAssignments(teacher, year.id) : { classTeacherOf: [], subjects: [] }) };
};

/* The class hours, on one date, of every section the teacher is class teacher of or teaches in. */
const getMySchedule = async (auth: Auth, query: ScheduleQuery) => {
  const teacher = await findMyProfile(auth);
  const schoolId = auth.schoolId!;
  const date = query.date ?? todayInBangladesh();

  const [year, calendar] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { schoolId, startDate: { lte: date }, endDate: { gte: date } },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    }),
    loadCalendar(prisma, schoolId, date, date),
  ]);
  // whether the teacher works that day (weekly, national or school holiday)
  const teacherDay = dayStatus(calendar, date, "TEACHERS");
  if (!year) return { date: dayKey(date), academicYear: null, teacherDay, items: [] };

  const { classTeacherOf, subjects } = await loadAssignments(teacher, year.id);

  // one entry per section, with what the teacher does there
  const bySection = new Map<
    string,
    {
      section: (typeof classTeacherOf)[number];
      isClassTeacher: boolean;
      subjects: (typeof subjects)[number]["classSubject"][];
    }
  >();
  for (const section of classTeacherOf) {
    bySection.set(section.id, { section, isClassTeacher: true, subjects: [] });
  }
  for (const s of subjects) {
    const entry = bySection.get(s.section.id) ?? { section: s.section, isClassTeacher: false, subjects: [] };
    entry.subjects.push(s.classSubject);
    bySection.set(s.section.id, entry);
  }

  const entries = [...bySection.values()];
  const hours = await resolveSectionHours(
    prisma,
    schoolId,
    year.id,
    date,
    entries.map((e) => ({ id: e.section.id, classId: e.section.class.id })),
  );

  return {
    date: dayKey(date),
    academicYear: year,
    teacherDay,
    items: entries
      .map((e) => {
        // a class can be off while the teacher works (e.g. holiday for classes 9-10 only)
        const day = dayStatus(calendar, date, { classId: e.section.class.id });
        const sectionHours = hours.get(e.section.id)!;
        return {
          ...e,
          day,
          hours: day.isSchoolDay ? sectionHours : { ...sectionHours, startTime: null, endTime: null },
        };
      })
      .sort((a, b) => (a.hours.startTime ?? "99:99").localeCompare(b.hours.startTime ?? "99:99")),
  };
};

export const TeacherService = {
  createTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  deactivateTeacher,
  resetPassword,
  getMyProfile,
  getMyAssignments,
  getMySchedule,
};
