import type { PrismaClient } from "../../generated/prisma/client";


export async function backfillFreeModules(prisma: PrismaClient) {
  console.log('Backfilling FREE modules to active schools...');

  const freeModules = await prisma.module.findMany({
    where: { type: 'FREE', isActive: true },
    select: { id: true, code: true },
  });

  if (freeModules.length === 0) return;

  const activeSchools = await prisma.school.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  if (activeSchools.length === 0) return;

  const rows = activeSchools.flatMap((school) =>
    freeModules.map((mod) => ({
      schoolId: school.id,
      moduleId: mod.id,
      isEnabled: true,
    }))
  );

  const result = await prisma.schoolModule.createMany({
    data: rows,
    skipDuplicates: true, // won't touch schools that already have the module
  });

  console.log(`  ✓ Ensured ${freeModules.length} free module(s) across ${activeSchools.length} active school(s) (${result.count} new rows created)`);
}