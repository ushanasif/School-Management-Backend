import httpStatus from "http-status";
import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { AppError } from "../../errorHandler/AppError";
import { getFundBalance, lockFund } from "../fund/fund.ledger";
import type {
  CreateExpensePayload,
  ListExpensesQuery,
  VoidExpensePayload,
} from "./expense.type";

const ZERO = new Prisma.Decimal(0);

const createExpense = async (schoolId: string, userId: string, data: CreateExpensePayload) => {
  const amount = new Prisma.Decimal(data.amount);

  return prisma.$transaction(async (tx) => {
    // lock the fund, then check its balance, so two expenses made at the same moment
    // can't both spend the same money
    const fund = await lockFund(tx, schoolId, data.fundId);
    if (!fund.isActive) {
      throw new AppError("Cannot spend from an inactive fund", httpStatus.BAD_REQUEST);
    }

    const balance = await getFundBalance(tx, schoolId, fund.id);
    if (balance.lt(amount)) {
      throw new AppError(
        `Insufficient balance. Available: ${balance.toFixed(2)}`,
        httpStatus.BAD_REQUEST,
      );
    }

    const transaction = await tx.fundTransaction.create({
      data: {
        schoolId,
        fundId: fund.id,
        type: "EXPENSE",
        source: "EXPENSE",
        amount,
        category: data.category,
        description: data.description,
        transactionDate: data.transactionDate ?? new Date(),
        createdBy: userId,
      },
      include: { fund: { select: { id: true, name: true } } },
    });

    return { transaction, balance: balance.minus(amount).toFixed(2) };
  });
};

const listExpenses = async (schoolId: string, query: ListExpensesQuery) => {
  const { fundId, category, from, to, includeVoided, page, limit } = query;

  const base: Prisma.FundTransactionWhereInput = {
    schoolId,
    type: "EXPENSE",
    source: "EXPENSE",
    ...(fundId ? { fundId } : {}),
    ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
    ...(from || to
      ? { transactionDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  // a voided expense never counts towards totals, whether or not it is listed
  const notVoided: Prisma.FundTransactionWhereInput = { ...base, reversedBy: { is: null } };
  const listWhere = includeVoided === "true" ? base : notVoided;

  const [items, total, agg, byCategory] = await Promise.all([
    prisma.fundTransaction.findMany({
      where: listWhere,
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        fund: { select: { id: true, name: true } },
        reversedBy: { select: { id: true, description: true, createdAt: true, createdBy: true } },
      },
    }),
    prisma.fundTransaction.count({ where: listWhere }),
    prisma.fundTransaction.aggregate({ where: notVoided, _sum: { amount: true } }),
    prisma.fundTransaction.groupBy({
      by: ["category"],
      where: notVoided,
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
  ]);

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      totalExpense: (agg._sum.amount ?? ZERO).toFixed(2),
      byCategory: byCategory.map((g) => ({
        category: g.category,
        count: g._count._all,
        amount: (g._sum.amount ?? ZERO).toFixed(2),
      })),
    },
  };
};

/* Categories already used in this school, most used first (for a dropdown/autocomplete). */
const getCategories = async (schoolId: string) => {
  const groups = await prisma.fundTransaction.groupBy({
    by: ["category"],
    where: { schoolId, type: "EXPENSE", source: "EXPENSE", category: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { category: "desc" } },
  });
  return groups.map((g) => g.category as string);
};

/*
 * Voids a mistaken expense by writing an opposite entry (money returns to the fund).
 * The unique reversesId column means an expense can be voided only once. The entry
 * takes the expense's own date, so the day's totals come out right; createdAt keeps
 * the real time of the void.
 */
const voidExpense = async (
  schoolId: string,
  userId: string,
  expenseId: string,
  data: VoidExpensePayload,
) => {
  const original = await prisma.fundTransaction.findFirst({
    where: { id: expenseId, schoolId, type: "EXPENSE", source: "EXPENSE" },
  });
  if (!original) throw new AppError("Expense not found", httpStatus.NOT_FOUND);

  try {
    return await prisma.fundTransaction.create({
      data: {
        schoolId,
        fundId: original.fundId,
        type: "INCOME",
        source: "ADJUSTMENT",
        amount: original.amount,
        category: original.category,
        description: `Void of expense: ${data.reason}`,
        transactionDate: original.transactionDate,
        reversesId: original.id,
        createdBy: userId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError("This expense has already been voided", httpStatus.CONFLICT);
    }
    throw e;
  }
};

export const ExpenseService = { createExpense, listExpenses, getCategories, voidExpense };