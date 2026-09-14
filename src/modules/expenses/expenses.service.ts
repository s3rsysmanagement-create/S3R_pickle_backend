import { Prisma, type PrismaClient } from '@prisma/client';
import { badRequest, notFound, unauthorized } from '../../lib/errors.js';
import type { ExpenseInput } from './expenses.schema.js';

export async function listExpenses(prisma: PrismaClient) {
  return prisma.expense.findMany({
    include: {
      category: true,
      createdBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createExpense(prisma: PrismaClient, input: ExpenseInput, createdById: string) {
  const category = await prisma.expenseCategory.findUnique({ where: { id: input.categoryId } });
  if (!category || !category.isActive) {
    throw badRequest('Invalid or inactive expense category');
  }

  try {
    return await prisma.expense.create({
      data: {
        categoryId: input.categoryId,
        description: input.description,
        amount: input.amount,
        expenseDate: new Date(input.expenseDate),
        paymentMethod: input.paymentMethod,
        notes: input.notes ?? null,
        createdById,
      },
      include: { category: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw unauthorized('Your session is no longer valid. Please log out and log back in.');
    }
    throw error;
  }
}

export async function updateExpense(prisma: PrismaClient, id: string, input: Partial<ExpenseInput>) {
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Expense not found');
  }

  if (input.categoryId) {
    const category = await prisma.expenseCategory.findUnique({ where: { id: input.categoryId } });
    if (!category || !category.isActive) {
      throw badRequest('Invalid or inactive expense category');
    }
  }

  return prisma.expense.update({
    where: { id },
    data: {
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.amount ? { amount: input.amount } : {}),
      ...(input.expenseDate ? { expenseDate: new Date(input.expenseDate) } : {}),
      ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
    },
    include: { category: true },
  });
}

export async function deleteExpense(prisma: PrismaClient, id: string) {
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Expense not found');
  }

  await prisma.expense.delete({ where: { id } });
}
