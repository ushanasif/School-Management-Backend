
import httpStatus from "http-status";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";


const createSection = async(schoolId: string, data: { classId: string; name: string }) => {

  const classRecord = await prisma.schoolClass.findFirst({
    where: { id: data.classId, schoolId },
  });

  if (!classRecord) {
    throw new AppError("Class not found for this school", httpStatus.NOT_FOUND);
  }

  const existing = await prisma.section.findFirst({
    where: { schoolId, classId: data.classId, name: data.name },
  });
  
  if (existing) {
    throw new AppError("A section with this name already exists for this class", httpStatus.CONFLICT);
  }

  return prisma.section.create({
    data: { schoolId, classId: data.classId, name: data.name },
  });
}

// export async function getSections(schoolId: string, classId?: string) {
//   return prisma.section.findMany({
//     where: { schoolId, ...(classId ? { classId } : {}) },
//     include: { class: { select: { id: true, name: true, numericLevel: true } } },
//     orderBy: [{ class: { numericLevel: "asc" } }, { name: "asc" }],
//   });
// }

// export async function getSectionById(schoolId: string, sectionId: string) {
//   const section = await prisma.section.findFirst({
//     where: { id: sectionId, schoolId },
//     include: { class: true },
//   });
//   if (!section) {
//     throw new AppError("Section not found", httpStatus.NOT_FOUND);
//   }
//   return section;
// }

// export async function updateSection(schoolId: string, sectionId: string, data: { name: string }) {
//   const section = await prisma.section.findFirst({ where: { id: sectionId, schoolId } });
//   if (!section) {
//     throw new AppError("Section not found", httpStatus.NOT_FOUND);
//   }

//   const duplicate = await prisma.section.findFirst({
//     where: { schoolId, classId: section.classId, name: data.name, NOT: { id: sectionId } },
//   });
//   if (duplicate) {
//     throw new AppError("A section with this name already exists for this class", httpStatus.CONFLICT);
//   }

//   return prisma.section.update({
//     where: { id: sectionId },
//     data: { name: data.name },
//   });
// }

// export async function deleteSection(schoolId: string, sectionId: string) {
//   const section = await prisma.section.findFirst({ where: { id: sectionId, schoolId } });
//   if (!section) {
//     throw new AppError("Section not found", httpStatus.NOT_FOUND);
//   }

//   const enrollmentCount = await prisma.enrollment.count({ where: { sectionId } });
//   if (enrollmentCount > 0) {
//     throw new AppError(
//       "Cannot delete a section with enrollment history. Consider leaving it inactive instead.",
//       httpStatus.CONFLICT,
//     );
//   }

//   await prisma.section.delete({ where: { id: sectionId } });
// }

// /*
//  * Section year config: capacity + class teacher, scoped per academic year.
//  */
// export async function setSectionYearConfig(
//   schoolId: string,
//   sectionId: string,
//   data: { academicYearId: string; classTeacherMembershipId?: string; capacity?: number },
// ) {
//   const section = await prisma.section.findFirst({ where: { id: sectionId, schoolId } });
//   if (!section) {
//     throw new AppError("Section not found", httpStatus.NOT_FOUND);
//   }

//   const academicYear = await prisma.academicYear.findFirst({
//     where: { id: data.academicYearId, schoolId },
//   });
//   if (!academicYear) {
//     throw new AppError("Academic year not found for this school", httpStatus.NOT_FOUND);
//   }

//   if (data.classTeacherMembershipId) {
//     const membership = await prisma.schoolMembership.findFirst({
//       where: { id: data.classTeacherMembershipId, schoolId, status: "ACTIVE" },
//     });
//     if (!membership) {
//       throw new AppError("Selected teacher is not an active member of this school", httpStatus.BAD_REQUEST);
//     }
//   }

//   return prisma.sectionYearConfig.upsert({
//     where: { sectionId_academicYearId: { sectionId, academicYearId: data.academicYearId } },
//     update: {
//       classTeacherMembershipId: data.classTeacherMembershipId,
//       capacity: data.capacity,
//     },
//     create: {
//       sectionId,
//       academicYearId: data.academicYearId,
//       classTeacherMembershipId: data.classTeacherMembershipId,
//       capacity: data.capacity,
//     },
//   });
// }

// export async function getSectionYearConfig(schoolId: string, sectionId: string, academicYearId: string) {
//   const section = await prisma.section.findFirst({ where: { id: sectionId, schoolId } });
//   if (!section) {
//     throw new AppError("Section not found", httpStatus.NOT_FOUND);
//   }

//   return prisma.sectionYearConfig.findUnique({
//     where: { sectionId_academicYearId: { sectionId, academicYearId } },
//     include: {
//       classTeacherMembership: {
//         include: { user: { select: { id: true, fullname: true, phone: true, email: true } } },
//       },
//     },
//   }); // null is valid — means no config set yet for this year
// }


export const SectionService = {createSection}