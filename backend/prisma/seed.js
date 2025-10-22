const { PrismaClient, ItemType } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');
  
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
    await prisma.itemCatalog.upsert({
      where: { slug: item.slug },
      create: item,
      update: item,
    });
    console.log(`✅ Seeded: ${item.name}`);
  }
  
  console.log('✅ Database seed completed successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
