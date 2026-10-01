import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { CreateAcademicYearPayload } from "./academicYear.type";
import httpStatus from 'http-status'

const createAcademicYear = async (
  schoolId: string,
  payload: CreateAcademicYearPayload
) => {
  const { name, startDate, endDate, isCurrent = false } = payload;

  return prisma.$transaction(async (tx) => {
    // 1. Check duplicate academic year
    const existingAcademicYear = await tx.academicYear.findUnique({
      where: {
        schoolId_name: {
          schoolId,
          name,
        },
      },
    });

    if (existingAcademicYear) {
      throw new AppError(
        `Academic year "${name}" already exists`,
        httpStatus.CONFLICT
      );
    }

    // 2. If this year should become current,
    //    remove current status from existing year
    if (isCurrent) {
      await tx.academicYear.updateMany({
        where: {
          schoolId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });
    }

    // 3. Create academic year
    const academicYear = await tx.academicYear.create({
      data: {
        schoolId,
        name,
        startDate,
        endDate,
        isCurrent,
      },
    });

    return academicYear;
  });
};

export const AcademicYearService = {
  createAcademicYear,
};