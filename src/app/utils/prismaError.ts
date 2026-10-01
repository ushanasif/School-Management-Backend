import { Prisma } from "../../../generated/prisma/client";

type KnownError = Prisma.PrismaClientKnownRequestError;

const isPrismaError = (e: unknown, code: string): e is KnownError =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;

/** Unique constraint violation (P2002). */
export const isUniqueViolation = (e: unknown): e is KnownError =>
  isPrismaError(e, "P2002");

/** Foreign key violation (P2003). */
export const isForeignKeyViolation = (e: unknown): e is KnownError =>
  isPrismaError(e, "P2003");

/** Record not found on update/delete (P2025). */
export const isRecordNotFound = (e: unknown): e is KnownError =>
  isPrismaError(e, "P2025");

/**
 * Field names behind a P2002. Prisma may report `target` as an array of
 * columns, a single string (index/constraint name), or not at all.
 * `schoolId` is dropped because it is just the tenant column.
 */
export const uniqueFields = (err: KnownError): string[] => {
  const t = err.meta?.target;
  const list = Array.isArray(t) ? (t as string[]) : typeof t === "string" ? [t] : [];
  return list.filter((f) => f !== "schoolId");
};