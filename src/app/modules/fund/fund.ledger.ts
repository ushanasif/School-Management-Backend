import httpStatus from "http-status";
import { Prisma } from "../../../../generated/prisma/client";
import { AppError } from "../../errorHandler/AppError";

type Client = Prisma.TransactionClient;

export const isCredit = (type: string) => type === "INCOME" || type === "TRANSFER_IN";

const decimalOrZero = (v: Prisma.Decimal | null | undefined) => v ?? new Prisma.Decimal(0);

type TypeGroup = { type: string; _sum: { amount: Prisma.Decimal | null } };

/** Net balance from groupBy({ by: ["type"] }) results: credits minus debits. */
export const netFromGroups = (groups: TypeGroup[]) =>
  groups.reduce((net, g) => {
    const amount = decimalOrZero(g._sum.amount);
    return isCredit(g.type) ? net.plus(amount) : net.minus(amount);
  }, new Prisma.Decimal(0));

/** Fund balance, always calculated from the ledger. */
export async function getFundBalance(client: Client, schoolId: string, fundId: string) {
  const groups = await client.fundTransaction.groupBy({
    by: ["type"],
    where: { schoolId, fundId },
    _sum: { amount: true },
  });
  return netFromGroups(groups);
}

/*
 * Row lock on a fund. Take it inside a transaction BEFORE checking the balance
 * of any operation that takes money out (transfer out, expense, payment
 * reversal). Two such operations on the same fund then run one after the other,
 * so both can't pass the balance check against the same money.
 * Deposits don't need it.
 */
export async function lockFund(tx: Client, schoolId: string, fundId: string) {
  const rows = await tx.$queryRaw<{ id: string; isActive: boolean }[]>`
    SELECT "id", "isActive" FROM "Fund"
    WHERE "id" = ${fundId} AND "schoolId" = ${schoolId}
    FOR UPDATE`;

  if (rows.length === 0) {
    throw new AppError("Fund not found", httpStatus.NOT_FOUND);
  }
  return rows[0];
}

export { decimalOrZero };