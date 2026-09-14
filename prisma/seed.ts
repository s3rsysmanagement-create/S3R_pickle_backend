import { PrismaClient, RoleName } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const cashierEmail = 'cashier@pickleball.local';
  const cashierPassword = 'Cashier123!';

  const adminRole = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: {},
    create: { name: RoleName.ADMIN },
  });

  const cashierRole = await prisma.role.upsert({
    where: { name: RoleName.CASHIER },
    update: {},
    create: { name: RoleName.CASHIER },
  });

  const adminPasswordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  const cashierPasswordHash = await bcrypt.hash(cashierPassword, 10);

  await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: {
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Admin',
      roleId: adminRole.id,
      isActive: true,
    },
    create: {
      email: env.ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Admin',
      roleId: adminRole.id,
    },
  });

  await prisma.user.upsert({
    where: { email: cashierEmail },
    update: {
      passwordHash: cashierPasswordHash,
      firstName: 'Front',
      lastName: 'Cashier',
      roleId: cashierRole.id,
      isActive: true,
    },
    create: {
      email: cashierEmail,
      passwordHash: cashierPasswordHash,
      firstName: 'Front',
      lastName: 'Cashier',
      roleId: cashierRole.id,
      isActive: true,
    },
  });

  await prisma.court.upsert({
    where: { code: 'COURT-1' },
    update: {},
    create: { name: 'Court 1', code: 'COURT-1' },
  });

  await prisma.court.upsert({
    where: { code: 'COURT-2' },
    update: {},
    create: { name: 'Court 2', code: 'COURT-2' },
  });

  await prisma.rate.upsert({
    where: { code: 'REGULAR' },
    update: {},
    create: { name: 'Regular', code: 'REGULAR', amount: 100.00 },
  });

  await prisma.rate.upsert({
    where: { code: 'MEMBER' },
    update: {},
    create: { name: 'Member', code: 'MEMBER', amount: 80.00 },
  });

  await prisma.expenseCategory.upsert({
    where: { name: 'Facility Maintenance' },
    update: {},
    create: { name: 'Facility Maintenance' },
  });

  await prisma.expenseCategory.upsert({
    where: { name: 'Utilities' },
    update: {},
    create: { name: 'Utilities' },
  });

  console.log('Seed data applied. Roles, users, courts, rates, and expense categories are ready.');
  console.log('Admin email:', env.ADMIN_EMAIL);
  console.log('Cashier email:', cashierEmail);

  await prisma.role.findFirst();
  void cashierRole;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
