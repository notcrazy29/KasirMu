const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.taxSetting.findMany();
  console.log('Tax Settings in DB:', JSON.stringify(settings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
