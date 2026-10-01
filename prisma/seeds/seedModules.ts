
import type { PrismaClient } from '../../generated/prisma/client';
import { modulesData } from './data/modules.data';

export async function seedModules(prisma: PrismaClient) {
  console.log('Seeding modules...');

  const results = [];
  for (const m of modulesData) {
    const module = await prisma.module.upsert({
      where: { code: m.code },
      update: {
        name: m.name,
        description: m.description,
        type: m.type,
        price: m.price ?? null,
      },
      create: {
        code: m.code,
        name: m.name,
        description: m.description,
        type: m.type,
        price: m.price ?? null,
      },
    });
    results.push(module);
    console.log(`  ✓ ${module.code} (${module.type})`);
  }

  return results; // array of Module records, used by next steps
}