import httpStatus from "http-status";
import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { PasswordUtils } from "../../utils/password";
import { generateStudentFees } from "../studentFee/studentFee.service";
import type {
  CreateStudentPayload,
  ListStudentsQuery,
  UpdateStudentPayload,
} from "./student.type";
import { isUniqueViolation } from "../../utils/prismaError";
import {
  type AccountResult,
  findOrCreateAccount,
  grantSchoolRole,
  GUARDIAN_ROLE,
  revokeSchoolRole,
} from "../../shared/schoolAccounts";

type Db = Prisma.TransactionClient;

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };


const CONFLICT_MESSAGE =
  "A conflicting record already exists (admission number, same name with the same father's name, or roll number). Check the details and try again";

const enrollmentSelect = {
  id: true,
  academicYearId: true,
  rollNumber: true,
  status: true,
  enrolledAt: true,
  academicYear: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true, isDefault: true } },
  group: { select: { id: true, nameEn: true, nameBn: true } },
} satisfies Prisma.EnrollmentSelect;

const withEnrollments = {
  enrollments: {
    orderBy: { academicYear: { startDate: "desc" } },
    select: enrollmentSelect,
  },
} satisfies Prisma.StudentInclude;

// ------------------------------------------------------------------ accounts

/* Finds the account for this phone or creates one, then gives it the GUARDIAN role here. */
const provisionAccount = async (
  tx: Db,
  input: { schoolId: string; phone: string; fullname: string },
): Promise<AccountResult> => {
  const account = await findOrCreateAccount(tx, { phone: input.phone, fullname: input.fullname });
  await grantSchoolRole(tx, input.schoolId, account.userId, GUARDIAN_ROLE);
  return account;
};

/*
 * Call after a student has been moved off an account. If that account has no other
 * student in this school it loses the GUARDIAN role here, and if that leaves it with
 * no role at all, its membership goes inactive.
 */
const deprovisionIfOrphaned = async (tx: Db, schoolId: string, userId: string) => {
  const remaining = await tx.student.count({ where: { schoolId, userId } });
  if (remaining > 0) return;

  await revokeSchoolRole(tx, schoolId, userId, GUARDIAN_ROLE.name);
};

const accountPayload = (
  account: AccountResult | null,
  loginPhone: string | null,
  siblingsInSchool: number,
) =>
  account
    ? {
        status: account.created ? ("CREATED" as const) : ("LINKED" as const),
        loginPhone,
        temporaryPassword: account.temporaryPassword, // shown once, only for a new account
        siblingsInSchool,
      }
    : { status: "NONE" as const, loginPhone: null, temporaryPassword: null, siblingsInSchool: 0 };

// ------------------------------------------------------------------- helpers

const resolveAcademicYear = async (db: Db, schoolId: string, academicYearId?: string) => {
  const year = academicYearId
    ? await db.academicYear.findFirst({ where: { id: academicYearId, schoolId } })
    : await db.academicYear.findFirst({ where: { schoolId, isCurrent: true } });

  if (!year) {
    throw academicYearId
      ? new AppError("Academic year not found for this school", httpStatus.NOT_FOUND)
      : new AppError("No current academic year is set. Choose an academic year", httpStatus.BAD_REQUEST);
  }
  return year;
};

const assertPlacement = async (
  db: Db,
  schoolId: string,
  enr: { classId: string; sectionId: string; groupId?: string },
) => {
  const section = await db.section.findFirst({
    where: { id: enr.sectionId, classId: enr.classId, schoolId },
    select: { id: true },
  });
  if (!section) {
    throw new AppError(
      "Class or section not found, or the section does not belong to that class",
      httpStatus.BAD_REQUEST,
    );
  }
  if (enr.groupId) {
    const group = await db.group.findFirst({ where: { id: enr.groupId, schoolId }, select: { id: true } });
    if (!group) throw new AppError("Group not found for this school", httpStatus.NOT_FOUND);
  }
};

const assertNoClash = async (
  db: Db,
  schoolId: string,
  v: { admissionNo: string; nameEn: string; nameBn: string; fatherName: string },
  excludeStudentId?: string,
) => {
  const clash = await db.student.findFirst({
    where: {
      schoolId,
      ...(excludeStudentId ? { id: { not: excludeStudentId } } : {}),
      OR: [
        { admissionNo: v.admissionNo },
        { nameEn: v.nameEn, nameBn: v.nameBn, fatherName: v.fatherName },
      ],
    },
    select: { admissionNo: true },
  });
  if (clash) {
    throw new AppError(
      clash.admissionNo === v.admissionNo
        ? `Admission number ${v.admissionNo} is already in use`
        : "A student with the same name and father's name already exists",
      httpStatus.CONFLICT,
    );
  }
};

/*
 * Next number from the school's own counter, e.g. 20270001. The counter row is locked
 * until the transaction ends, so two admissions can't get the same number. A number
 * someone already typed in by hand is skipped.
 */
const nextAdmissionNo = async (tx: Db, schoolId: string, academicYearStart: Date) => {
  const year = academicYearStart.getFullYear();
  const key = `admission:${year}`;

  for (let i = 0; i < 20; i++) {
    const seq = await tx.schoolSequence.upsert({
      where: { schoolId_key: { schoolId, key } },
      update: { value: { increment: 1 } },
      create: { schoolId, key, value: 1 },
    });
    const admissionNo = `${year}${String(seq.value).padStart(4, "0")}`;

    const taken = await tx.student.findUnique({
      where: { schoolId_admissionNo: { schoolId, admissionNo } },
      select: { id: true },
    });
    if (!taken) return admissionNo;
  }
  throw new AppError(
    "Could not generate an admission number. Please enter one manually",
    httpStatus.INTERNAL_SERVER_ERROR,
  );
};

// -------------------------------------------------------------------- create

/*
 * Admits a student: profile, enrollment for the academic year, the login account (if a
 * phone was given) and every fee configured for that class and year, all in one
 * transaction. If anything fails, nothing is saved.
 */
const createStudent = async (schoolId: string, data: CreateStudentPayload) => {
  const { enrollment: enr, phone, admissionNo: givenAdmissionNo, ...profile } = data;

  try {
    return await prisma.$transaction(async (tx) => {
      const academicYear = await resolveAcademicYear(tx, schoolId, enr.academicYearId);
      await assertPlacement(tx, schoolId, enr);

      if (enr.rollNumber) {
        const taken = await tx.enrollment.findFirst({
          where: {
            academicYearId: academicYear.id,
            sectionId: enr.sectionId,
            rollNumber: enr.rollNumber,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        if (taken) {
          throw new AppError(
            `Roll number ${enr.rollNumber} is already used in this section`,
            httpStatus.CONFLICT,
          );
        }
      }

      // the account first: it is the slow part (password hashing) and needs no counter lock
      const account = phone
        ? await provisionAccount(tx, {
            schoolId,
            phone,
            fullname: profile.guardianName ?? profile.fatherName,
          })
        : null;

      const admissionNo = givenAdmissionNo ?? (await nextAdmissionNo(tx, schoolId, academicYear.startDate));
      await assertNoClash(tx, schoolId, {
        admissionNo,
        nameEn: profile.nameEn,
        nameBn: profile.nameBn,
        fatherName: profile.fatherName,
      });

      const student = await tx.student.create({
        data: {
          schoolId,
          admissionNo,
          ...profile,
          phone: phone ?? null,
          userId: account?.userId ?? null,
        },
      });

      await tx.enrollment.create({
        data: {
          studentId: student.id,
          academicYearId: academicYear.id,
          classId: enr.classId,
          sectionId: enr.sectionId,
          groupId: enr.groupId,
          rollNumber: enr.rollNumber,
        },
      });

      // assign every configured fee for this class and year; nothing configured = nothing assigned
      await generateStudentFees(tx, {
        schoolId,
        studentIds: [student.id],
        academicYearId: academicYear.id,
        classId: enr.classId,
      });
      const feesAssigned = await tx.studentFee.count({
        where: { studentId: student.id, academicYearId: academicYear.id },
      });

      const siblingsInSchool = account
        ? await tx.student.count({
            where: { schoolId, userId: account.userId, id: { not: student.id } },
          })
        : 0;

      const saved = await tx.student.findUniqueOrThrow({
        where: { id: student.id },
        include: withEnrollments,
      });

      // a section's capacity is only a warning: the student is admitted either way
      const warnings: string[] = [];
      const sectionConfig = await tx.sectionYearConfig.findUnique({
        where: { sectionId_academicYearId: { sectionId: enr.sectionId, academicYearId: academicYear.id } },
        select: { capacity: true },
      });
      if (sectionConfig?.capacity != null) {
        const activeInSection = await tx.enrollment.count({
          where: { academicYearId: academicYear.id, sectionId: enr.sectionId, status: "ACTIVE" },
        });
        if (activeInSection > sectionConfig.capacity) {
          warnings.push(
            `This section now has ${activeInSection} students, more than its capacity of ${sectionConfig.capacity}`,
          );
        }
      }

      return {
        student: saved,
        account: accountPayload(account, phone ?? null, siblingsInSchool),
        feesAssigned, // 0 means no fee structure is set up yet for this class and year
        warnings,
      };
    }, TX_OPTIONS);
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(CONFLICT_MESSAGE, httpStatus.CONFLICT);
    throw e;
  }
};

// -------------------------------------------------------------------- update

const updateStudent = async (schoolId: string, studentId: string, data: UpdateStudentPayload) => {
  const { phone, ...rest } = data;

  try {
    return await prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirst({ where: { id: studentId, schoolId } });
      if (!student) throw new AppError("Student not found", httpStatus.NOT_FOUND);

      if (
        rest.admissionNo !== undefined ||
        rest.nameEn !== undefined ||
        rest.nameBn !== undefined ||
        rest.fatherName !== undefined
      ) {
        await assertNoClash(
          tx,
          schoolId,
          {
            admissionNo: rest.admissionNo ?? student.admissionNo,
            nameEn: rest.nameEn ?? student.nameEn,
            nameBn: rest.nameBn ?? student.nameBn,
            fatherName: rest.fatherName ?? student.fatherName,
          },
          studentId,
        );
      }

      // a new number, a removed number, or the same number but no account yet
      let account: AccountResult | null = null;
      let newUserId: string | null | undefined; // undefined = account link unchanged

      if (phone !== undefined && (phone !== student.phone || (phone !== null && !student.userId))) {
        if (phone === null) {
          newUserId = null;
        } else {
          account = await provisionAccount(tx, {
            schoolId,
            phone,
            fullname:
              rest.guardianName ?? student.guardianName ?? rest.fatherName ?? student.fatherName,
          });
          newUserId = account.userId;
        }
      }

      await tx.student.update({
        where: { id: studentId },
        data: {
          ...rest,
          ...(phone !== undefined ? { phone } : {}),
          ...(newUserId !== undefined ? { userId: newUserId } : {}),
        },
      });

      // the account this student left may now have nobody to look after in this school
      if (student.userId && newUserId !== undefined && newUserId !== student.userId) {
        await deprovisionIfOrphaned(tx, schoolId, student.userId);
      }

      const saved = await tx.student.findUniqueOrThrow({
        where: { id: studentId },
        include: withEnrollments,
      });

      const siblingsInSchool = account
        ? await tx.student.count({
            where: { schoolId, userId: account.userId, id: { not: studentId } },
          })
        : 0;

      return {
        student: saved,
        // only present when this update created or linked an account
        account: account ? accountPayload(account, phone ?? null, siblingsInSchool) : null,
      };
    }, TX_OPTIONS);
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(CONFLICT_MESSAGE, httpStatus.CONFLICT);
    throw e;
  }
};

// ------------------------------------------------------------------- reading

const getStudentById = async (schoolId: string, studentId: string) => {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      ...withEnrollments,
      user: { select: { phone: true, isActive: true, mustChangePassword: true } },
    },
  });
  if (!student) throw new AppError("Student not found", httpStatus.NOT_FOUND);

  const { user, ...rest } = student;
  const siblingsInSchool = student.userId
    ? await prisma.student.count({
        where: { schoolId, userId: student.userId, id: { not: studentId } },
      })
    : 0;

  return {
    ...rest,
    account: {
      hasAccount: user !== null,
      loginPhone: user?.phone ?? null,
      isActive: user?.isActive ?? null,
      // true until the family has logged in and chosen their own password
      mustChangePassword: user?.mustChangePassword ?? null,
      siblingsInSchool,
    },
  };
};

const getStudents = async (schoolId: string, query: ListStudentsQuery) => {
  const { search, status, religion, academicYearId, classId, sectionId, groupId, hasAccount, sortBy, sortOrder, page, limit } =
    query;

  const yearId =
    academicYearId ??
    (await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } }))?.id;

  const placementFilter = Boolean(classId || sectionId || groupId);
  if (placementFilter && !yearId) {
    throw new AppError(
      "No current academic year is set. Choose an academic year to filter by class, section or group",
      httpStatus.BAD_REQUEST,
    );
  }

  const where: Prisma.StudentWhereInput = {
    schoolId,
    ...(status ? { status } : {}),
    ...(religion ? { religion } : {}),
    ...(hasAccount ? { userId: hasAccount === "true" ? { not: null } : null } : {}),
    ...(search
      ? {
          OR: [
            { nameEn: { contains: search, mode: "insensitive" } },
            { nameBn: { contains: search, mode: "insensitive" } },
            { admissionNo: { contains: search, mode: "insensitive" } },
            { fatherName: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { guardianPhone: { contains: search } },
          ],
        }
      : {}),
    ...(placementFilter || academicYearId
      ? {
          enrollments: {
            some: {
              academicYearId: yearId,
              ...(classId ? { classId } : {}),
              ...(sectionId ? { sectionId } : {}),
              ...(groupId ? { groupId } : {}),
            },
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: [{ [sortBy]: sortOrder } as Prisma.StudentOrderByWithRelationInput, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        // the enrollment for the chosen (or current) year, else the latest one
        enrollments: {
          where: yearId ? { academicYearId: yearId } : undefined,
          orderBy: { academicYear: { startDate: "desc" } },
          take: 1,
          select: enrollmentSelect,
        },
      },
    }),
    prisma.student.count({ where }),
  ]);

  const items = rows.map(({ enrollments, ...student }) => ({
    ...student,
    hasAccount: student.userId !== null,
    enrollment: enrollments[0] ?? null,
  }));

  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// ------------------------------------------------------------ reset password

/*
 * Gives the family a new generated password. Refused when the account is also used
 * for anything else (a teacher role, another school, the platform): a school admin
 * must not be able to set the password of somebody else's login.
 */
const resetGuardianPassword = async (schoolId: string, studentId: string) => {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { userId: true },
  });
  if (!student) throw new AppError("Student not found", httpStatus.NOT_FOUND);
  if (!student.userId) {
    throw new AppError("This student has no login account. Add a phone number first", httpStatus.BAD_REQUEST);
  }

  const user = await prisma.user.findUnique({
    where: { id: student.userId },
    select: {
      id: true,
      phone: true,
      memberships: { select: { schoolId: true } },
      userRoles: { select: { membershipId: true, role: { select: { name: true } } } },
    },
  });
  if (!user) throw new AppError("Account not found", httpStatus.NOT_FOUND);

  const usedElsewhere = user.memberships.some((m) => m.schoolId !== schoolId);
  const hasOtherRoles = user.userRoles.some(
    (ur) => ur.membershipId === null || ur.role.name !== GUARDIAN_ROLE.name,
  );
  if (usedElsewhere || hasOtherRoles) {
    throw new AppError(
      "This account is also used for another role or school, so only its owner can change the password",
      httpStatus.FORBIDDEN,
    );
  }

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

export const StudentService = {
  createStudent,
  updateStudent,
  getStudentById,
  getStudents,
  resetGuardianPassword,
};