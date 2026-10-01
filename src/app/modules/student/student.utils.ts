import { Prisma } from "../../../../generated/prisma/client";
import bcrypt from 'bcryptjs'

export async function getOrCreatePortalUser(
  tx: Prisma.TransactionClient,
  phone: string,
  fallbackFullname: string,
) {
  const existing = await tx.user.findUnique({ where: { phone } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(phone, 12);
  return tx.user.create({
    data: { fullname: fallbackFullname, phone, password: passwordHash },
  });
}