import { Prisma, type PrismaClient } from '@prisma/client';
import { conflict, notFound } from '../../lib/errors.js';
import type { RateInput } from './rates.schema.js';

function toRateCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'RATE';
}

async function generateUniqueRateCode(prisma: PrismaClient, name: string): Promise<string> {
  const baseCode = toRateCode(name);
  const existing = await prisma.rate.findMany({
    where: { code: { startsWith: baseCode } },
    select: { code: true },
  });

  if (!existing.some((entry) => entry.code === baseCode)) {
    return baseCode;
  }

  let suffix = 2;
  let candidate = `${baseCode}_${suffix}`;
  while (existing.some((entry) => entry.code === candidate)) {
    suffix += 1;
    candidate = `${baseCode}_${suffix}`;
  }

  return candidate;
}

export async function listRates(prisma: PrismaClient) {
  return prisma.rate.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createRate(prisma: PrismaClient, input: RateInput) {
  const trimmedName = input.name.trim();

  const duplicate = await prisma.rate.findFirst({
    where: { name: { equals: trimmedName, mode: 'insensitive' } },
  });

  if (duplicate) {
    throw conflict(`A rate named "${trimmedName}" already exists`);
  }

  const code = await generateUniqueRateCode(prisma, trimmedName);

  return prisma.rate.create({
    data: {
      name: trimmedName,
      code,
      amount: input.amount,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateRate(prisma: PrismaClient, id: string, input: Partial<RateInput>) {
  const existing = await prisma.rate.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Rate not found');
  }

  if (input.name) {
    const trimmedName = input.name.trim();

    if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.rate.findFirst({
        where: {
          name: { equals: trimmedName, mode: 'insensitive' },
          NOT: { id },
        },
      });

      if (duplicate) {
        throw conflict(`A rate named "${trimmedName}" already exists`);
      }
    }

    input = { ...input, name: trimmedName };
  }

  return prisma.rate.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.amount ? { amount: input.amount } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

export async function deleteRate(prisma: PrismaClient, id: string) {
  const existing = await prisma.rate.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Rate not found');
  }

  try {
    await prisma.rate.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw conflict('This rate has existing transactions and cannot be deleted. Deactivate it instead.');
    }
    throw error;
  }
}
