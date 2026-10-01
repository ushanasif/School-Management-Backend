import httpStatus from "http-status";
import { randomUUID } from "node:crypto";
import { prisma } from "../../../../lib/prisma";
import { Prisma } from "../../../../generated/prisma/client";
import { AppError } from "../../errorHandler/AppError";
import {
  decimalOrZero,
  getFundBalance,
  isCredit,
  lockFund,
  netFromGroups,
} from "./fund.ledger";
import type {
  CreateFundPayload,
  DepositPayload,
  LedgerQuery,
  TransferPayload,
  UpdateFundPayload,
} from "./fund.type";
import { isUniqueViolation } from "../../utils/prismaError";



const createFund = async (schoolId: string, data: CreateFundPayload) => {
  try {
    // the unique index on (schoolId, name) decides, so two simultaneous
    // requests can't both create the same fund
    return await prisma.fund.create({ data: { schoolId, ...data } });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new AppError("A fund with this name already exists", httpStatus.CONFLICT);
    }
    throw e;
  }
};

const getFunds = async (schoolId: string, opts: { includeInactive?: boolean }) => {
  const [funds, groups] = await Promise.all([
    prisma.fund.findMany({
      where: { schoolId, ...(opts.includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" },
    }),
    prisma.fundTransaction.groupBy({
      by: ["fundId", "type"],
      where: { schoolId },
      _sum: { amount: true },
    }),
  ]);

  const balances = new Map<string, Prisma.Decimal>();
  for (const g of groups) {
    const amount = decimalOrZero(g._sum.amount);
    const signed = isCredit(g.type) ? amount : amount.negated();
    balances.set(g.fundId, (balances.get(g.fundId) ?? new Prisma.Decimal(0)).plus(signed));
  }

  return funds.map((fund) => ({
    ...fund,
    balance: (balances.get(fund.id) ?? new Prisma.Decimal(0)).toFixed(2),
  }));
};

const getFundById = async (schoolId: string, fundId: string) => {
  const fund = await prisma.fund.findFirst({ where: { id: fundId, schoolId } });
  if (!fund) throw new AppError("Fund not found", httpStatus.NOT_FOUND);

  const balance = await getFundBalance(prisma, schoolId, fundId);
  return { ...fund, balance: balance.toFixed(2) };
};

const updateFund = async (schoolId: string, fundId: string, data: UpdateFundPayload) => {
  const fund = await prisma.fund.findFirst({ where: { id: fundId, schoolId } });
  if (!fund) throw new AppError("Fund not found", httpStatus.NOT_FOUND);

  if (data.isActive === false && fund.isActive) {
    const activeFeeTypes = await prisma.feeType.count({
      where: { schoolId, fundId, isActive: true },
    });
    if (activeFeeTypes > 0) {
      throw new AppError(
        "Active fee types still use this fund. Move or deactivate them first",
        httpStatus.BAD_REQUEST,
      );
    }

    const balance = await getFundBalance(prisma, schoolId, fundId);
    if (!balance.isZero()) {
      throw new AppError(
        `This fund still holds ${balance.toFixed(2)}. Transfer it to another fund first`,
        httpStatus.BAD_REQUEST,
      );
    }
  }

  try {
    return await prisma.fund.update({ where: { id: fundId }, data });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new AppError("A fund with this name already exists", httpStatus.CONFLICT);
    }
    throw e;
  }
};

const deposit = async (
  schoolId: string,
  fundId: string,
  userId: string,
  data: DepositPayload,
) => {
  return prisma.$transaction(async (tx) => {
    const fund = await tx.fund.findFirst({
      where: { id: fundId, schoolId },
      select: { id: true, isActive: true },
    });
    if (!fund) throw new AppError("Fund not found", httpStatus.NOT_FOUND);
    if (!fund.isActive) {
      throw new AppError("Cannot add money to an inactive fund", httpStatus.BAD_REQUEST);
    }

    const transaction = await tx.fundTransaction.create({
      data: {
        schoolId,
        fundId,
        type: "INCOME",
        source: "MANUAL_DEPOSIT",
        amount: data.amount,
        transactionDate: data.transactionDate ?? new Date(),
        description: data.description,
        createdBy: userId,
      },
    });

    const balance = await getFundBalance(tx, schoolId, fundId);
    return { transaction, balance: balance.toFixed(2) };
  });
};

const transfer = async (schoolId: string, userId: string, data: TransferPayload) => {
  const amount = new Prisma.Decimal(data.amount);

  return prisma.$transaction(async (tx) => {
    // lock the source fund first, then check its balance, so two simultaneous
    // transfers can't both spend the same money
    const from = await lockFund(tx, schoolId, data.fromFundId);

    const to = await tx.fund.findFirst({
      where: { id: data.toFundId, schoolId },
      select: { id: true, isActive: true },
    });
    if (!to) throw new AppError("Destination fund not found", httpStatus.NOT_FOUND);
    if (!from.isActive || !to.isActive) {
      throw new AppError("Both funds must be active", httpStatus.BAD_REQUEST);
    }

    const balance = await getFundBalance(tx, schoolId, from.id);
    if (balance.lt(amount)) {
      throw new AppError(
        `Insufficient balance. Available: ${balance.toFixed(2)}`,
        httpStatus.BAD_REQUEST,
      );
    }

    // both sides share one transferId
    const transferId = randomUUID();
    const common = {
      schoolId,
      source: "TRANSFER" as const,
      amount,
      transferId,
      transactionDate: data.transactionDate ?? new Date(),
      description: data.description,
      createdBy: userId,
    };

    const out = await tx.fundTransaction.create({
      data: { ...common, fundId: data.fromFundId, type: "TRANSFER_OUT" },
    });
    const incoming = await tx.fundTransaction.create({
      data: { ...common, fundId: data.toFundId, type: "TRANSFER_IN" },
    });

    return {
      transferId,
      out,
      in: incoming,
      fromBalance: balance.minus(amount).toFixed(2),
    };
  });
};

const getLedger = async (schoolId: string, query: LedgerQuery) => {
  const { fundId, type, source, from, to, page, limit } = query;

  const where: Prisma.FundTransactionWhereInput = {
    schoolId,
    ...(fundId ? { fundId } : {}),
    ...(type ? { type } : {}),
    ...(source ? { source } : {}),
    ...(from || to
      ? { transactionDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  const [items, total, groups] = await Promise.all([
    prisma.fundTransaction.findMany({
      where,
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: { fund: { select: { id: true, name: true } } },
    }),
    prisma.fundTransaction.count({ where }),
    prisma.fundTransaction.groupBy({ by: ["type"], where, _sum: { amount: true } }),
  ]);

  // totals cover the whole filtered set, not just this page
  let totalIn = new Prisma.Decimal(0);
  let totalOut = new Prisma.Decimal(0);
  const byType: Record<string, string> = {};
  for (const g of groups) {
    const amount = decimalOrZero(g._sum.amount);
    byType[g.type] = amount.toFixed(2);
    if (isCredit(g.type)) totalIn = totalIn.plus(amount);
    else totalOut = totalOut.plus(amount);
  }

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      totalIn: totalIn.toFixed(2),
      totalOut: totalOut.toFixed(2),
      net: netFromGroups(groups).toFixed(2),
      byType,
    },
  };
};

export const FundService = {
  createFund,
  getFunds,
  getFundById,
  updateFund,
  deposit,
  transfer,
  getLedger,
};