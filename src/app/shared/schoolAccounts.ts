import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { AppError } from "../errorHandler/AppError";
import { PasswordUtils } from "../utils/password";

/*
 * One account per person (decision 3): a phone number belongs to one User, and that user
 * gets a membership plus roles in each school. Students (the family login) and teachers
 * use the same rules, so a guardian who becomes a teacher keeps one account with two roles.
 */

type Db = Prisma.TransactionClient;

export type SystemRole = { name: string; description: string };

export const GUARDIAN_ROLE: SystemRole = { name: "GUARDIAN", description: "Student / guardian account" };
export const TEACHER_ROLE: SystemRole = { name: "TEACHER", description: "Teacher" };

/*
 * What a new TEACHER role can do until role management exists. Applied only when the role
 * is first created, so later changes made by the school are never overwritten.
 */
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  TEACHER: [
    "student:view",
    "section:view",
    "subject:view",
    "class_subject:view",
    "group:view",
    "schedule:view",
    "teacher:view",
    "holiday:view",
    "exam:view",
    "exam:view_result",
  ],
};

export type AccountResult = { userId: string; created: boolean; temporaryPassword: string | null };

/* The account for this phone, or a new one with a generated password to change at first login. */
export const findOrCreateAccount = async (
  tx: Db,
  input: { phone: string; fullname: string },
): Promise<AccountResult> => {
  const existing = await tx.user.findUnique({ where: { phone: input.phone }, select: { id: true } });
  // an existing account keeps its name and password: they belong to the person
  if (existing) return { userId: existing.id, created: false, temporaryPassword: null };

  const temporaryPassword = PasswordUtils.generateTemporaryPassword();
  const user = await tx.user.create({
    data: {
      fullname: input.fullname,
      phone: input.phone,
      password: await PasswordUtils.hashPassword(temporaryPassword),
      mustChangePassword: true,
    },
  });
  return { userId: user.id, created: true, temporaryPassword };
};

const ensureRole = async (tx: Db, schoolId: string, role: SystemRole) => {
  // ON CONFLICT DO NOTHING: safe when two requests create the role at the same moment,
  // and count tells us whether this call is the one that created it
  const { count } = await tx.role.createMany({
    data: [{ scope: "SCHOOL", schoolId, name: role.name, description: role.description, isSystem: true }],
    skipDuplicates: true,
  });
  const schoolRole = await tx.role.findUniqueOrThrow({
    where: { scope_schoolId_name: { scope: "SCHOOL", schoolId, name: role.name } },
  });

  const codes = DEFAULT_PERMISSIONS[role.name] ?? [];
  if (count === 1 && codes.length > 0) {
    // permissions missing from the database (seed not run) are simply skipped
    const permissions = await tx.permission.findMany({ where: { code: { in: codes } }, select: { id: true } });
    await tx.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: schoolRole.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  return schoolRole;
};

/*
 * Gives the account a membership in this school (reopening one that went inactive) and
 * the role. Never touches the password. Returns the membership id.
 */
export const grantSchoolRole = async (tx: Db, schoolId: string, userId: string, role: SystemRole) => {
  const schoolRole = await ensureRole(tx, schoolId, role);

  let membership = await tx.schoolMembership.findUnique({
    where: { userId_schoolId: { userId, schoolId } },
  });
  if (!membership) {
    membership = await tx.schoolMembership.create({ data: { userId, schoolId, status: "ACTIVE" } });
  } else if (membership.status === "INACTIVE") {
    // INACTIVE is what we set when the last role went away; SUSPENDED is left alone
    membership = await tx.schoolMembership.update({
      where: { id: membership.id },
      data: { status: "ACTIVE", leftAt: null },
    });
  }

  await tx.userRole.upsert({
    where: {
      userId_roleId_membershipId: { userId, roleId: schoolRole.id, membershipId: membership.id },
    },
    update: {},
    create: { userId, roleId: schoolRole.id, membershipId: membership.id },
  });
  return membership.id;
};

/*
 * Takes the role away in this school. When no role is left, the membership goes inactive
 * and the person can no longer log in to this school.
 */
export const revokeSchoolRole = async (tx: Db, schoolId: string, userId: string, roleName: string) => {
  const membership = await tx.schoolMembership.findUnique({
    where: { userId_schoolId: { userId, schoolId } },
    select: { id: true },
  });
  if (!membership) return;

  await tx.userRole.deleteMany({
    where: { membershipId: membership.id, role: { name: roleName, scope: "SCHOOL", schoolId } },
  });

  const rolesLeft = await tx.userRole.count({ where: { membershipId: membership.id } });
  if (rolesLeft === 0) {
    await tx.schoolMembership.updateMany({
      where: { id: membership.id, status: "ACTIVE" },
      data: { status: "INACTIVE", leftAt: new Date() },
    });
  }
};

/*
 * A school may reset a password or change the login of an account only when the account
 * is used in this school alone (any roles here are fine) and has no platform role:
 * otherwise it would control somebody's login at another school.
 */
export const assertAccountOnlyInSchool = async (tx: Db, schoolId: string, userId: string) => {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      memberships: { select: { schoolId: true } },
      userRoles: { where: { membershipId: null }, select: { id: true } },
    },
  });
  if (!user) throw new AppError("Account not found", httpStatus.NOT_FOUND);

  if (user.userRoles.length > 0 || user.memberships.some((m) => m.schoolId !== schoolId)) {
    throw new AppError(
      "This account is also used at another school, so only its owner can change it",
      httpStatus.FORBIDDEN,
    );
  }
};
