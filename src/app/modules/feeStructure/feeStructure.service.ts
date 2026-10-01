import httpStatus from "http-status";
import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import {
  computeFeeStatus,
  expandMonthRange,
  generateStudentFees,
  round2,
} from "../studentFee/studentFee.service";
import type { CreateFeeStructurePayload, ListFeeStructuresQuery } from "./feeStructure.type";

type TxClient = Prisma.TransactionClient;

type BlockedFee = {
  studentFeeId: string;
  studentId: string;
  month: number | null;
  paidAmount: string;
  reason: string;
};

/*
 * Makes already-generated StudentFee rows match the structure's current amounts.
 * - no payments and nothing to protect: the row is re-priced or removed
 * - money paid, payment history, or a discount larger than the new amount:
 *   the row is left alone and returned in `blocked` for a human to decide
 */
async function syncStructureFees(tx: TxClient, schoolId: string, feeStructureId: string) {
  const structure = await tx.feeStructure.findFirst({
    where: { id: feeStructureId, schoolId },
    include: { feeType: true, monthlyAmounts: true },
  });
  if (!structure) throw new AppError("Fee structure not found", httpStatus.NOT_FOUND);

  const isMonthly = structure.feeType.frequency === "MONTHLY";
  const scheduled = new Map(structure.monthlyAmounts.map((m) => [m.month, Number(m.amount)]));

  const expectedFor = (month: number | null): number | undefined => {
    if (!isMonthly) return Number(structure.amount);
    if (month === null) return undefined;
    return scheduled.size > 0 ? scheduled.get(month) : Number(structure.amount);
  };

  const fees = await tx.studentFee.findMany({
    where: { schoolId, feeStructureId },
    select: {
      id: true,
      studentId: true,
      month: true,
      amount: true,
      discountAmount: true,
      paidAmount: true,
      _count: { select: { allocations: true } },
    },
  });

  const removable: string[] = [];
  const updateGroups = new Map<string, { amount: number; status: string; ids: string[] }>();
  const blocked: BlockedFee[] = [];

  for (const fee of fees) {
    const block = (reason: string) =>
      blocked.push({
        studentFeeId: fee.id,
        studentId: fee.studentId,
        month: fee.month,
        paidAmount: fee.paidAmount.toString(),
        reason,
      });

    const expected = expectedFor(fee.month);
    const paid = Number(fee.paidAmount);

    if (expected === undefined) {
      if (paid > 0) block("month removed from schedule, but payments exist");
      else if (fee._count.allocations > 0) block("month removed from schedule, but it has payment history");
      else removable.push(fee.id);
      continue;
    }

    if (round2(Number(fee.amount)) === expected) continue;

    if (paid > 0) {
      block("amount changed, but payments exist");
      continue;
    }
    const discount = Number(fee.discountAmount);
    if (discount > expected) {
      block("existing discount is larger than the new amount");
      continue;
    }

    const status = computeFeeStatus(expected, discount, 0);
    const key = `${expected}:${status}`;
    const group = updateGroups.get(key) ?? { amount: expected, status, ids: [] };
    group.ids.push(fee.id);
    updateGroups.set(key, group);
  }

  if (removable.length > 0) {
    await tx.studentFee.deleteMany({ where: { id: { in: removable } } });
  }

  let updated = 0;
  for (const group of updateGroups.values()) {
    await tx.studentFee.updateMany({
      where: { id: { in: group.ids } },
      data: { amount: group.amount, status: group.status as any },
    });
    updated += group.ids.length;
  }

  return { removed: removable.length, updated, blocked };
}

/* Assign the structure to everyone enrolled in the class, then reconcile existing rows. */
async function reconcileStructure(tx: TxClient, schoolId: string, feeStructureId: string) {
  const structure = await tx.feeStructure.findFirst({
    where: { id: feeStructureId, schoolId },
    select: { academicYearId: true, classId: true },
  });
  if (!structure) throw new AppError("Fee structure not found", httpStatus.NOT_FOUND);

  const enrollments = await tx.enrollment.findMany({
    where: {
      academicYearId: structure.academicYearId,
      classId: structure.classId,
      status: "ACTIVE",
      student: { schoolId },
    },
    select: { studentId: true },
  });

  await generateStudentFees(tx, {
    schoolId,
    studentIds: enrollments.map((e) => e.studentId),
    academicYearId: structure.academicYearId,
    classId: structure.classId,
  });

  return syncStructureFees(tx, schoolId, feeStructureId);
}

const TX_OPTIONS = { maxWait: 10_000, timeout: 60_000 };

const createFeeStructure = async (schoolId: string, data: CreateFeeStructurePayload) => {
  const [academicYear, schoolClass, feeType] = await Promise.all([
    prisma.academicYear.findFirst({ where: { id: data.academicYearId, schoolId } }),
    prisma.schoolClass.findFirst({ where: { id: data.classId, schoolId } }),
    prisma.feeType.findFirst({ where: { id: data.feeTypeId, schoolId } }),
  ]);
  if (!academicYear) throw new AppError("Academic year not found for this school", httpStatus.NOT_FOUND);
  if (!schoolClass) throw new AppError("Class not found for this school", httpStatus.NOT_FOUND);
  if (!feeType) throw new AppError("Fee type not found for this school", httpStatus.NOT_FOUND);
  if (!feeType.isActive) throw new AppError("Fee type is inactive", httpStatus.BAD_REQUEST);

  const schedule = data.monthlySchedule ?? [];
  if (schedule.length > 0 && feeType.frequency !== "MONTHLY") {
    throw new AppError("A monthly schedule only applies to MONTHLY fee types", httpStatus.BAD_REQUEST);
  }

  const amountByMonth = new Map<number, number>();
  for (const period of schedule) {
    for (const month of expandMonthRange(period.fromMonth, period.toMonth)) {
      if (amountByMonth.has(month)) {
        throw new AppError(`Month ${month} appears in more than one period`, httpStatus.BAD_REQUEST);
      }
      amountByMonth.set(month, period.amount);
    }
  }

  const baseAmount = data.amount ?? schedule[0]?.amount;
  if (baseAmount === undefined) {
    throw new AppError("Either amount or monthlySchedule is required", httpStatus.BAD_REQUEST);
  }

  return prisma.$transaction(async (tx) => {
    const structure = await tx.feeStructure.upsert({
      where: {
        schoolId_academicYearId_classId_feeTypeId: {
          schoolId,
          academicYearId: data.academicYearId,
          classId: data.classId,
          feeTypeId: data.feeTypeId,
        },
      },
      update: { amount: baseAmount, isActive: true },
      create: {
        schoolId,
        academicYearId: data.academicYearId,
        classId: data.classId,
        feeTypeId: data.feeTypeId,
        amount: baseAmount,
      },
    });

    // the schedule is configuration only, so replacing it wholesale is safe
    await tx.feeStructureMonth.deleteMany({ where: { feeStructureId: structure.id } });
    if (amountByMonth.size > 0) {
      await tx.feeStructureMonth.createMany({
        data: [...amountByMonth].map(([month, amount]) => ({
          feeStructureId: structure.id,
          month,
          amount,
        })),
      });
    }

    const sync = await reconcileStructure(tx, schoolId, structure.id);

    const saved = await tx.feeStructure.findUnique({
      where: { id: structure.id },
      include: { monthlyAmounts: { orderBy: { month: "asc" } } },
    });

    return { structure: saved, sync };
  }, TX_OPTIONS);
};

const getFeeStructures = async (schoolId: string, filters: ListFeeStructuresQuery) => {
  return prisma.feeStructure.findMany({
    where: {
      schoolId,
      ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
      ...(filters.classId ? { classId: filters.classId } : {}),
    },
    include: {
      feeType: { include: { fund: { select: { id: true, name: true } } } },
      schoolClass: { select: { id: true, name: true } },
      monthlyAmounts: { orderBy: { month: "asc" } },
    },
    orderBy: [{ schoolClass: { numericLevel: "asc" } }, { feeType: { name: "asc" } }],
  });
};

/* Repair tool: re-assign missing fees and re-price existing ones for one structure. */
const syncFeeStructure = async (schoolId: string, feeStructureId: string) => {
  return prisma.$transaction((tx) => reconcileStructure(tx, schoolId, feeStructureId), TX_OPTIONS);
};

export const FeeStructureService = { createFeeStructure, getFeeStructures, syncFeeStructure };