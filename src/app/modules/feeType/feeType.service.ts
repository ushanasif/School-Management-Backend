import httpStatus from "http-status";
import { prisma } from "../../../../lib/prisma";
import { Prisma } from "../../../../generated/prisma/client";
import { AppError } from "../../errorHandler/AppError";
import type { CreateFeeTypePayload, UpdateFeeTypePayload } from "./feeType.type";
import { isUniqueViolation } from "../../utils/prismaError";


const assertUsableFund = async (schoolId: string, fundId: string) => {
  const fund = await prisma.fund.findFirst({
    where: { id: fundId, schoolId },
    select: { id: true, isActive: true },
  });
  if (!fund) throw new AppError("Fund not found for this school", httpStatus.NOT_FOUND);
  if (!fund.isActive) throw new AppError("Fund is inactive", httpStatus.BAD_REQUEST);
};

const createFeeType = async (schoolId: string, data: CreateFeeTypePayload) => {
  await assertUsableFund(schoolId, data.fundId);

  try {
    // the unique index on (schoolId, name) decides duplicates
    return await prisma.feeType.create({
      data: { schoolId, ...data },
      include: { fund: { select: { id: true, name: true } } },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new AppError("A fee type with this name already exists", httpStatus.CONFLICT);
    }
    throw e;
  }
};

const getFeeTypes = async (
  schoolId: string,
  opts: { includeInactive?: boolean; frequency?: "ONE_TIME" | "MONTHLY" },
) => {
  return prisma.feeType.findMany({
    where: {
      schoolId,
      ...(opts.includeInactive ? {} : { isActive: true }),
      ...(opts.frequency ? { frequency: opts.frequency } : {}),
    },
    include: { fund: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
};

const updateFeeType = async (
  schoolId: string,
  feeTypeId: string,
  data: UpdateFeeTypePayload,
) => {
  const feeType = await prisma.feeType.findFirst({ where: { id: feeTypeId, schoolId } });
  if (!feeType) throw new AppError("Fee type not found", httpStatus.NOT_FOUND);

  const fundChanged = data.fundId !== undefined && data.fundId !== feeType.fundId;
  const reactivating = data.isActive === true && !feeType.isActive;

  if (fundChanged) await assertUsableFund(schoolId, data.fundId!);
  if (reactivating && !fundChanged) await assertUsableFund(schoolId, feeType.fundId);

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.feeType.update({
        where: { id: feeTypeId },
        data,
        include: { fund: { select: { id: true, name: true } } },
      });

      // Fees with nothing paid move to the new fund. Fees that already have money
      // keep their old fund, so their ledger entries stay consistent.
      let unpaidFeesMoved = 0;
      if (fundChanged) {
        const moved = await tx.studentFee.updateMany({
          where: { schoolId, feeTypeId, paidAmount: 0 },
          data: { fundId: data.fundId },
        });
        unpaidFeesMoved = moved.count;
      }

      return { feeType: updated, unpaidFeesMoved };
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new AppError("A fee type with this name already exists", httpStatus.CONFLICT);
    }
    throw e;
  }
};

export const FeeTypeService = { createFeeType, getFeeTypes, updateFeeType };