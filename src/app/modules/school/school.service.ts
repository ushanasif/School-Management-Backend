import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import httpStatus from "http-status";
import { generateSchoolCode } from "../../helpers/schoolCode";
import { CreateSchoolPayload, GetAllSchoolsQuery } from "./school.type";
import { buildQueryOptions, paginate } from "../../utils/queryBuilder";
import { Prisma } from "../../../../generated/prisma/client";
import { PasswordUtils } from "../../utils/password";


const createSchool = async (data: CreateSchoolPayload) => {

   const [subdomainTaken, emailTaken, emailUsedByUser] = await Promise.all([
    prisma.school.findUnique({
      where: { subdomain: data.subdomain },
      select: { id: true },
    }),
    prisma.school.findUnique({
      where: { email: data.email },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    }),
  ]);

  if (subdomainTaken)
    throw new AppError("Subdomain is already taken", httpStatus.CONFLICT);
  if (emailTaken)
    throw new AppError(
      "Email is already in use by another school",
      httpStatus.CONFLICT,
    );
  if (emailUsedByUser)
    throw new AppError(
      "This email already belongs to a user account. Every school needs its own email address",
      httpStatus.CONFLICT,
    );

  let schoolCode = generateSchoolCode();
  while (await prisma.school.findUnique({ where: { schoolCode } })) {
    schoolCode = generateSchoolCode();
  }

  return prisma.school.create({
    data: { ...data, schoolCode, status: "PENDING" },
  });
};

const activateSchool = async (schoolId: string) => {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });

  if (!school) {
    throw new AppError("School not found", httpStatus.NOT_FOUND);
  }
  if (school.status === "ACTIVE") {
    throw new AppError("School is already active", httpStatus.BAD_REQUEST);
  }
  if (!school.email) {
    throw new AppError(
      "School must have an email set before it can be activated",
      httpStatus.BAD_REQUEST,
    );
  }

  // Fail fast, before touching the DB, if this email is already taken
  // by an unrelated User account.
  const existingUser = await prisma.user.findUnique({
    where: { email: school.email },
    select: { id: true },
  });
  if (existingUser) {
    throw new AppError(
      "A user with this email already exists. Cannot auto-create a super admin account.",
      httpStatus.CONFLICT,
    );
  }

  const temporaryPassword = PasswordUtils.generateTemporaryPassword();
  const passwordHash = await PasswordUtils.hashPassword(temporaryPassword);

  const result = await prisma.$transaction(async (tx) => {
    const updatedSchool = await tx.school.update({
      where: { id: schoolId },
      data: { status: "ACTIVE", activationDate: new Date() },
    });

    // 1. Provision free modules
    const freeModules = await tx.module.findMany({
      where: { type: "FREE", isActive: true },
      select: { id: true },
    });
    
    if (freeModules.length > 0) {
      await tx.schoolModule.createMany({
        data: freeModules.map((m) => ({ schoolId, moduleId: m.id, isEnabled: true })),
        skipDuplicates: true,
      });
    }

    // 2. Ensure SCHOOL_SUPER_ADMIN role exists for this school
    const superAdminRole = await tx.role.upsert({
      where: { scope_schoolId_name: { scope: "SCHOOL", schoolId, name: "SCHOOL_SUPER_ADMIN" } },
      update: {},
      create: {
        scope: "SCHOOL",
        schoolId,
        name: "SCHOOL_SUPER_ADMIN",
        description: "Full access within this school",
        isSystem: true,
      },
    });

    // 3. Create the super admin user, using the school's own email/name
    const superAdminUser = await tx.user.create({
      data: {
        fullname: updatedSchool.nameEn,
        email: updatedSchool.email!, // already validated non-null above
        password: passwordHash,
      },
    });

    // 4. Membership + role assignment
    const membership = await tx.schoolMembership.create({
      data: { userId: superAdminUser.id, schoolId, status: "ACTIVE" },
    });

    await tx.userRole.create({
      data: { userId: superAdminUser.id, roleId: superAdminRole.id, membershipId: membership.id },
    });

    return { school: updatedSchool, superAdminUser };
  });

  return {
    school: result.school,
    superAdmin: {
      id: result.superAdminUser.id,
      fullname: result.superAdminUser.fullname,
      email: result.superAdminUser.email,
    },
    temporaryPassword,
  };
};

// const createSchoolSuperAdmin = async (
//   schoolId: string,
//   data: { fullname: string; email: string },
// ) => {
//   const school = await prisma.school.findUnique({ where: { id: schoolId } });
//   if (!school) throw new AppError("School not found", httpStatus.NOT_FOUND);
//   if (school.status !== "ACTIVE") {
//     throw new AppError(
//       "School must be active before adding a super admin",
//       httpStatus.BAD_REQUEST,
//     );
//   }

//   const superAdminRole = await prisma.role.findUnique({
//     where: {
//       scope_schoolId_name: {
//         scope: "SCHOOL",
//         schoolId,
//         name: "SCHOOL_SUPER_ADMIN",
//       },
//     },
//   });
//   if (!superAdminRole) {
//     throw new AppError(
//       "Super admin role not provisioned for this school",
//       httpStatus.INTERNAL_SERVER_ERROR,
//     );
//   }

//   let user = await prisma.user.findUnique({ where: { email: data.email } });
//   let temporaryPassword: string | undefined;

//   if (!user) {
//   const temporaryPassword = PasswordUtils.generateTemporaryPassword();
//   const passwordHash = await PasswordUtils.hashPassword(temporaryPassword);
  
//     user = await prisma.user.create({
//       data: {
//         fullname: data.fullname,
//         email: data.email,
//         password: passwordHash,
//       },
//     });
//   }

//   const membership = await prisma.schoolMembership.upsert({
//     where: { userId_schoolId: { userId: user.id, schoolId } },
//     update: { status: "ACTIVE" },
//     create: { userId: user.id, schoolId, status: "ACTIVE" },
//   });

//   await prisma.userRole.upsert({
//     where: {
//       userId_roleId_membershipId: {
//         userId: user.id,
//         roleId: superAdminRole.id,
//         membershipId: membership.id,
//       },
//     },
//     update: {},
//     create: {
//       userId: user.id,
//       roleId: superAdminRole.id,
//       membershipId: membership.id,
//     },
//   });

//   return {
//     user: { id: user.id, fullname: user.fullname, email: user.email },
//     temporaryPassword, // undefined if the user already existed (e.g. staff at another school too)
//   };
// };

const getAllSchools = async (query: GetAllSchoolsQuery) => {
  const { where, orderBy, skip, take, page, limit } = buildQueryOptions(query, {
    searchableFields: ["nameEn", "nameBn", "phone", "email"],
  });

  const result = await paginate(
    (args) => prisma.school.findMany(args),
    (args) => prisma.school.count(args),
    { where, orderBy, skip, take } as Prisma.SchoolFindManyArgs,
    page,
    limit,
  );

  return result;
};

export const SchoolService = {
  createSchool,
  activateSchool,
  getAllSchools,
};
