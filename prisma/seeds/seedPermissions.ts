
import type { PrismaClient } from '../../generated/prisma/client';
import { permissionsData } from './data/permissions.data';

export async function seedPermissions(prisma: PrismaClient) {
  console.log('Seeding permissions...');

  // build a lookup so we don't hit the DB in a loop for every permission
  const modules = await prisma.module.findMany({ select: { id: true, code: true } });
  const moduleIdByCode = new Map(modules.map((m) => [m.code, m.id]));

  for (const p of permissionsData) {
    const moduleId = moduleIdByCode.get(p.moduleCode);
    if (!moduleId) {
      throw new Error(
        `Permission "${p.code}" references unknown module code "${p.moduleCode}". Add it to modules.data.ts first.`
      );
    }

    const permission = await prisma.permission.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        description: p.description,
        moduleId,
      },
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        moduleId,
      },
    });
    console.log(`  ✓ ${permission.code}`);
  }
}