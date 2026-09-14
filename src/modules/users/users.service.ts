import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import type { UserInput } from './users.schema.js';

const userWithRole = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  roleId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { name: true } },
};

export async function listUsers(prisma: PrismaClient) {
  return prisma.user.findMany({
    select: userWithRole,
    orderBy: { createdAt: 'desc' },
  });
}

export async function createUser(prisma: PrismaClient, input: UserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) {
    throw conflict('User already exists');
  }

  const role = await prisma.role.findUnique({ where: { name: input.role } });
  if (!role) {
    throw badRequest('Invalid role');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      roleId: role.id,
      isActive: input.isActive ?? true,
    },
    select: userWithRole,
  });
}

export async function updateUser(prisma: PrismaClient, id: string, input: Partial<UserInput>) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('User not found');
  }

  if (input.email) {
    const duplicate = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (duplicate && duplicate.id !== id) {
      throw conflict('User email already exists');
    }
  }

  let roleId: string | undefined;
  if (input.role) {
    const role = await prisma.role.findUnique({ where: { name: input.role } });
    if (!role) {
      throw badRequest('Invalid role');
    }
    roleId = role.id;
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(input.email ? { email: input.email.toLowerCase() } : {}),
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
      ...(roleId ? { roleId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 12) } : {}),
    },
    select: userWithRole,
  });
}
