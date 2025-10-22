import { PrismaClient, ItemType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const catalogItems = [
    {
      slug: 'med-kit',
      name: 'Med Kit',
      description: 'Restores 50% persistent health instantly.',
      type: ItemType.MEDKIT,
      priceBnb: 0,
      priceCfc: 1000,
    },
    {
      slug: 'energy-capsule',
      name: 'Energy Capsule',
      description: 'Restores 25% max energy instantly.',
      type: ItemType.CAPSULE,
      priceBnb: 0,
      priceCfc: 1000,
    },
  ];

  for (const item of catalogItems) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.itemCatalog.upsert({
      where: { slug: item.slug },
      create: item,
      update: item,
    });
  }
}

main()
  .catch((error) => {
    console.error('Seeding failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
