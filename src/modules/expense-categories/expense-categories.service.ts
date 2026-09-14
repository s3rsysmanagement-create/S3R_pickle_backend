import { Prisma, type PrismaClient } from '@prisma/client';
import { conflict, notFound } from '../../lib/errors.js';
import type { ExpenseCategoryInput } from './expense-categories.schema.js';

export async function listExpenseCategories(prisma: PrismaClient) {
  return prisma.expenseCategory.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createExpenseCategory(prisma: PrismaClient, input: ExpenseCategoryInput) {
  const existing = await prisma.expenseCategory.findUnique({ where: { name: input.name } });
  if (existing) {
    throw conflict('Expense category already exists');
  }

  return prisma.expenseCategory.create({
    data: {
      name: input.name,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateExpenseCategory(prisma: PrismaClient, id: string, input: Partial<ExpenseCategoryInput>) {
  const existing = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Expense category not found');
  }

  if (input.name) {
    const duplicate = await prisma.expenseCategory.findUnique({ where: { name: input.name } });
    if (duplicate && duplicate.id !== id) {
      throw conflict('Expense category already exists');
    }
  }

  return prisma.expenseCategory.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

export async function deleteExpenseCategory(prisma: PrismaClient, id: string) {
  const existing = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Expense category not found');
  }

  try {
    await prisma.expenseCategory.delete({ where: { id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw conflict('This expense category has existing expenses and cannot be deleted.');
    }

    throw error;
  }
}
