import httpStatus from "http-status";
import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import type {
  ApplyDiscountPayload,
  BulkDiscountPayload,
  CreateCustomFeePayload,
  ListFeesQuery,
} from "./studentFee.type";

type TxClient = Prisma.TransactionClient;
export type FeeStatusValue = "UNPAID" | "PARTIAL" | "PAID" | "WAIVED";

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeFeeStatus(
  amount: number,
  discountAmount: number,
  paidAmount: number,
): FeeStatusValue {
  const payable = round2(amount - discountAmount);
  if (payable <= 0) return "WAIVED";
  if (paidAmount <= 0) return "UNPAID";
  if (paidAmount >= payable) return "PAID";
  return "PARTIAL";
}

/** 11 -> 2 gives [11, 12, 1, 2]. Bounded, so bad input can never loop forever. */
export function expandMonthRange(fromMonth: number, toMonth: number): number[] {
  const months: number[] = [];
  let m = fromMonth;
  for (let i = 0; i < 12; i++) {
    months.push(m);
    if (m === toMonth) break;
    m = m === 12 ? 1 : m + 1;
  }
  return months;
}

export function getMonthsInRange(startDate: Date, endDate: Date) {
  const months: { month: number; year: number }[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= end) {
    months.push({ month: cursor.getMonth() + 1, year: cursor.getFullYear() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

/*
 * Row locks on fee rows, in a fixed order so two requests can't deadlock.
 * Payments, discounts and custom-fee removal all take this lock inside their
 * transaction, then re-read the rows before deciding anything.
 */
export async function lockStudentFees(tx: TxClient, ids: string[]) {
  if (ids.length === 0) return;
  await tx.$queryRaw`
    SELECT "id" FROM "StudentFee"
    WHERE "id" IN (${Prisma.join(ids)})
    ORDER BY "id"
    FOR UPDATE`;
}

/*
 * Assigns every configured fee for (academicYear, class) to the given students
 * as UNPAID. Used by createFeeStructure (all enrolled students), and later by
 * createStudent and promotion. Nothing configured means nothing happens.
 * Safe to re-run: existing rows are skipped. Inactive fee types are skipped.
 */
export async function generateStudentFees(
  tx: TxClient,
  input: { schoolId: string; studentIds: string[]; academicYearId: string; classId: string },
) {
  const { schoolId, studentIds, academicYearId, classId } = input;
  if (studentIds.length === 0) return;

  const [academicYear, feeStructures] = await Promise.all([
    tx.academicYear.findFirst({ where: { id: academicYearId, schoolId } }),
    tx.feeStructure.findMany({
      where: { schoolId, academicYearId, classId, isActive: true, feeType: { isActive: true } },
      include: { feeType: true, monthlyAmounts: true },
    }),
  ]);
  if (!academicYear || feeStructures.length === 0) return;

  // Postgres treats NULLs as distinct in unique indexes, so ONE_TIME rows are also
  // checked here. The partial unique index is the final guard against races.
  const existing = await tx.studentFee.findMany({
    where: {
      studentId: { in: studentIds },
      academicYearId,
      feeStructureId: { in: feeStructures.map((s) => s.id) },
    },
    select: { studentId: true, feeStructureId: true, month: true, year: true },
  });
  const existingKeys = new Set(
    existing.map((f) => `${f.studentId}:${f.feeStructureId}:${f.month ?? ""}:${f.year ?? ""}`),
  );

  const academicMonths = getMonthsInRange(academicYear.startDate, academicYear.endDate);
  const rows: Prisma.StudentFeeCreateManyInput[] = [];

  for (const structure of feeStructures) {
    type Period = { month: number | null; year: number | null; amount: Prisma.Decimal };
    let periods: Period[];

    if (structure.feeType.frequency === "ONE_TIME") {
      periods = [{ month: null, year: null, amount: structure.amount }];
    } else if (structure.monthlyAmounts.length > 0) {
      // a schedule means months it doesn't list get no fee at all
      const amountByMonth = new Map(structure.monthlyAmounts.map((m) => [m.month, m.amount]));
      periods = academicMonths.flatMap(({ month, year }) => {
        const amount = amountByMonth.get(month);
        return amount === undefined ? [] : [{ month, year, amount }];
      });
    } else {
      periods = academicMonths.map(({ month, year }) => ({ month, year, amount: structure.amount }));
    }

    for (const studentId of studentIds) {
      for (const p of periods) {
        if (existingKeys.has(`${studentId}:${structure.id}:${p.month ?? ""}:${p.year ?? ""}`)) continue;

        rows.push({
          schoolId,
          studentId,
          academicYearId,
          classId,
          feeStructureId: structure.id,
          feeTypeId: structure.feeTypeId,
          fundId: structure.feeType.fundId,
          amount: p.amount,
          month: p.month,
          year: p.year,
          status: "UNPAID",
        });
      }
    }
  }

  if (rows.length > 0) {
    await tx.studentFee.createMany({ data: rows, skipDuplicates: true });
  }
}

// ---------------------------------------------------------------- listing

const dueFilter = (now = new Date()): Prisma.StudentFeeWhereInput => {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    status: { in: ["UNPAID", "PARTIAL"] },
    OR: [{ month: null }, { year: { lt: year } }, { year, month: { lte: month } }],
  };
};

const listFees = async (schoolId: string, query: ListFeesQuery) => {
  const { academicYearId, classId, studentId, feeTypeId, status, month, year, due, page, limit } =
    query;

  const where: Prisma.StudentFeeWhereInput = {
    schoolId,
    ...(academicYearId ? { academicYearId } : {}),
    ...(classId ? { classId } : {}),
    ...(studentId ? { studentId } : {}),
    ...(feeTypeId ? { feeTypeId } : {}),
    ...(status ? { status } : {}),
    ...(month ? { month } : {}),
    ...(year ? { year } : {}),
    ...(due === "true" ? { AND: [dueFilter()] } : {}),
  };

  const [rows, total, agg, byStatus] = await Promise.all([
    prisma.studentFee.findMany({
      where,
      orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        student: { select: { id: true, nameEn: true, nameBn: true, admissionNo: true } },
        feeType: { select: { id: true, name: true, frequency: true } },
        fund: { select: { id: true, name: true } },
      },
    }),
    prisma.studentFee.count({ where }),
    prisma.studentFee.aggregate({
      where,
      _sum: { amount: true, discountAmount: true, paidAmount: true },
    }),
    prisma.studentFee.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);

  const items = rows.map((r) => {
    const payable = round2(Number(r.amount) - Number(r.discountAmount));
    return { ...r, payable, remaining: round2(payable - Number(r.paidAmount)) };
  });

  // totals cover the whole filtered set, not just this page
  const zero = new Prisma.Decimal(0);
  const amount = agg._sum.amount ?? zero;
  const discount = agg._sum.discountAmount ?? zero;
  const paid = agg._sum.paidAmount ?? zero;
  const payable = amount.minus(discount);

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      totalAmount: amount.toFixed(2),
      totalDiscount: discount.toFixed(2),
      totalPayable: payable.toFixed(2),
      totalPaid: paid.toFixed(2),
      totalRemaining: payable.minus(paid).toFixed(2),
      countByStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
    },
  };
};

// ------------------------------------------------------------ custom fees

/* A fee for one student only, not tied to any class-wide FeeStructure. */
const createCustomStudentFee = async (schoolId: string, data: CreateCustomFeePayload) => {
  const [student, academicYear, feeType] = await Promise.all([
    prisma.student.findFirst({ where: { id: data.studentId, schoolId } }),
    prisma.academicYear.findFirst({ where: { id: data.academicYearId, schoolId } }),
    prisma.feeType.findFirst({ where: { id: data.feeTypeId, schoolId } }),
  ]);
  if (!student) throw new AppError("Student not found", httpStatus.NOT_FOUND);
  if (!academicYear) throw new AppError("Academic year not found", httpStatus.NOT_FOUND);
  if (!feeType) throw new AppError("Fee type not found", httpStatus.NOT_FOUND);
  if (!feeType.isActive) throw new AppError("Fee type is inactive", httpStatus.BAD_REQUEST);

  if (feeType.frequency === "MONTHLY") {
    if (data.month === undefined || data.year === undefined) {
      throw new AppError("month and year are required for a MONTHLY fee type", httpStatus.BAD_REQUEST);
    }
    const inYear = getMonthsInRange(academicYear.startDate, academicYear.endDate).some(
      (p) => p.month === data.month && p.year === data.year,
    );
    if (!inYear) {
      throw new AppError("That month is outside the academic year", httpStatus.BAD_REQUEST);
    }
  } else if (data.month !== undefined || data.year !== undefined) {
    throw new AppError("month and year must be omitted for a ONE_TIME fee type", httpStatus.BAD_REQUEST);
  }

  // Charging the same fee twice through the class structure and a custom fee is
  // almost always a mistake. Use a discount to change what a student pays.
  const alreadyAssigned = await prisma.studentFee.findFirst({
    where: {
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      feeTypeId: data.feeTypeId,
      feeStructureId: { not: null },
      month: data.month ?? null,
      year: data.year ?? null,
    },
    select: { id: true },
  });
  if (alreadyAssigned) {
    throw new AppError(
      "This fee is already assigned to the student by the class fee structure. Use a discount to change the amount",
      httpStatus.CONFLICT,
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_academicYearId: { studentId: data.studentId, academicYearId: data.academicYearId },
    },
    select: { classId: true },
  });

  return prisma.studentFee.create({
    data: {
      schoolId,
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      classId: enrollment?.classId,
      feeStructureId: null,
      feeTypeId: data.feeTypeId,
      fundId: feeType.fundId,
      amount: data.amount,
      month: data.month,
      year: data.year,
      dueDate: data.dueDate,
      description: data.description,
      status: "UNPAID",
    },
  });
};

/* Removes a custom fee added by mistake. Only if nothing was ever paid against it. */
const removeCustomStudentFee = async (schoolId: string, studentFeeId: string) => {
  return prisma.$transaction(async (tx) => {
    await lockStudentFees(tx, [studentFeeId]);

    const fee = await tx.studentFee.findFirst({
      where: { id: studentFeeId, schoolId },
      include: { _count: { select: { allocations: true } } },
    });
    if (!fee) throw new AppError("Fee not found for this school", httpStatus.NOT_FOUND);
    if (fee.feeStructureId !== null) {
      throw new AppError(
        "Only custom fees can be removed. Use a discount for class fees",
        httpStatus.BAD_REQUEST,
      );
    }
    if (Number(fee.paidAmount) > 0 || fee._count.allocations > 0) {
      throw new AppError("This fee has payment history and cannot be removed", httpStatus.BAD_REQUEST);
    }

    await tx.studentFee.delete({ where: { id: studentFeeId } });
    return { id: studentFeeId };
  });
};

// -------------------------------------------------------------- discounts

const discountFields = (amount: number, reason: string | undefined, actorId: string) =>
  amount > 0
    ? { discountAmount: amount, discountReason: reason ?? null, discountedBy: actorId, discountedAt: new Date() }
    : { discountAmount: 0, discountReason: null, discountedBy: null, discountedAt: null };

function assertDiscountAllowed(
  fee: { amount: unknown; paidAmount: unknown; month: number | null },
  discount: number,
) {
  const label = fee.month ? ` (month ${fee.month})` : "";
  if (discount < 0) {
    throw new AppError("Discount cannot be negative", httpStatus.BAD_REQUEST);
  }
  if (discount > Number(fee.amount)) {
    throw new AppError(`Discount cannot exceed the fee amount${label}`, httpStatus.BAD_REQUEST);
  }
  // a discount that drops the payable below what was already paid would mean an overpayment
  if (round2(Number(fee.amount) - discount) < Number(fee.paidAmount)) {
    throw new AppError(
      `Discount would make the payable amount lower than what is already paid${label}`,
      httpStatus.BAD_REQUEST,
    );
  }
}

/* Discount on one row: a single month, or a one-time fee. */
const applyDiscount = async (
  schoolId: string,
  studentFeeId: string,
  actorId: string,
  data: ApplyDiscountPayload,
) => {
  return prisma.$transaction(async (tx) => {
    await lockStudentFees(tx, [studentFeeId]);

    const fee = await tx.studentFee.findFirst({ where: { id: studentFeeId, schoolId } });
    if (!fee) throw new AppError("Fee not found for this school", httpStatus.NOT_FOUND);

    assertDiscountAllowed(fee, data.discountAmount);

    return tx.studentFee.update({
      where: { id: studentFeeId },
      data: {
        ...discountFields(data.discountAmount, data.discountReason, actorId),
        status: computeFeeStatus(Number(fee.amount), data.discountAmount, Number(fee.paidAmount)),
      },
    });
  });
};

/*
 * One student, one fee type, one academic year. Either a flat discount on every
 * row, or different discounts per month range:
 *   discounts: [{ fromMonth: 1, toMonth: 4, discountAmount: 100 },
 *               { fromMonth: 5, toMonth: 12, discountAmount: 50 }]
 * The amount applies to each month, it is not split across them. Everything is
 * validated first and applied in one transaction, so it is all or nothing.
 */
const applyDiscountForFeeType = async (
  schoolId: string,
  actorId: string,
  data: BulkDiscountPayload,
) => {
  return prisma.$transaction(async (tx) => {
    const idRows = await tx.studentFee.findMany({
      where: {
        schoolId,
        studentId: data.studentId,
        feeTypeId: data.feeTypeId,
        academicYearId: data.academicYearId,
      },
      select: { id: true },
    });
    if (idRows.length === 0) {
      throw new AppError(
        "No fees found for this student, fee type and academic year",
        httpStatus.NOT_FOUND,
      );
    }

    const ids = idRows.map((r) => r.id);
    await lockStudentFees(tx, ids);
    const fees = await tx.studentFee.findMany({ where: { id: { in: ids } } });

    type Target = { fee: (typeof fees)[number]; discount: number };
    let targets: Target[] = [];
    const skippedMonths: number[] = [];

    if (data.discounts) {
      if (fees.some((f) => f.month === null)) {
        throw new AppError(
          "Month ranges only apply to monthly fees. Use discountAmount for one-time fees",
          httpStatus.BAD_REQUEST,
        );
      }

      const discountByMonth = new Map<number, number>();
      for (const period of data.discounts) {
        for (const month of expandMonthRange(period.fromMonth, period.toMonth)) {
          if (discountByMonth.has(month)) {
            throw new AppError(`Month ${month} appears in more than one range`, httpStatus.BAD_REQUEST);
          }
          discountByMonth.set(month, period.discountAmount);
        }
      }

      for (const fee of fees) {
        const discount = discountByMonth.get(fee.month!);
        if (discount !== undefined) targets.push({ fee, discount });
      }

      // months in a range that have no fee row (e.g. months the schedule skips)
      const matched = new Set(targets.map((t) => t.fee.month));
      for (const month of discountByMonth.keys()) {
        if (!matched.has(month)) skippedMonths.push(month);
      }
    } else {
      targets = fees.map((fee) => ({ fee, discount: data.discountAmount! }));
    }

    if (targets.length === 0) {
      throw new AppError("No fee rows matched the given months", httpStatus.NOT_FOUND);
    }

    for (const { fee, discount } of targets) assertDiscountAllowed(fee, discount);

    const updated = [];
    for (const { fee, discount } of targets) {
      updated.push(
        await tx.studentFee.update({
          where: { id: fee.id },
          data: {
            ...discountFields(discount, data.discountReason, actorId),
            status: computeFeeStatus(Number(fee.amount), discount, Number(fee.paidAmount)),
          },
        }),
      );
    }

    return {
      updatedCount: updated.length,
      skippedMonths: skippedMonths.sort((a, b) => a - b),
      fees: updated,
    };
  });
};

export const StudentFeeService = {
  listFees,
  createCustomStudentFee,
  removeCustomStudentFee,
  applyDiscount,
  applyDiscountForFeeType,
};