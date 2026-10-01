
import { seedModules } from './seedModules';
import { seedPermissions } from './seedPermissions';
import { backfillFreeModules } from './backfillFreeModules';
import { PrismaClient } from '../../generated/prisma/client';
import { seedPlatformAdmin } from './seedPlatformAdmin';

export async function runSeed(prisma: PrismaClient) {
  await seedModules(prisma);
  await seedPermissions(prisma);
  await backfillFreeModules(prisma);
  //await seedPlatformAdmin(prisma)
}