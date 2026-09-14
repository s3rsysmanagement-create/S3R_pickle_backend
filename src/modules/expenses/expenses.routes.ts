import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { errorResponse, successResponse } from '../../lib/api.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/authorization.js';
import { ExpenseSchema, UpdateExpenseSchema } from './expenses.schema.js';
import { createExpense, deleteExpense, listExpenses, updateExpense } from './expenses.service.js';

const normalizeExpense = (expense: Awaited<ReturnType<typeof listExpenses>>[number]) => ({
  id: expense.id,
  title: expense.description,
  category: expense.category?.name ?? 'General',
  amount: Number(expense.amount),
  paymentMethod: expense.paymentMethod,
  createdAt: expense.createdAt.toISOString(),
});

export async function expensesRoutes(app: FastifyInstance) {
  app.get('/api/expenses', { preHandler: [requireAuth, requireRole('ADMIN')] }, async () => {
    const expenses = await listExpenses(prisma);
    return successResponse(expenses.map(normalizeExpense));
  });

  app.post('/api/expenses', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request, reply) => {
    const result = ExpenseSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid expense payload', result.error.flatten());
    }

    const expense = await createExpense(prisma, result.data, request.user!.id);
    return successResponse(expense);
  });

  app.put('/api/expenses/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const result = UpdateExpenseSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid expense update data', result.error.flatten());
    }

    const expense = await updateExpense(prisma, id, result.data);
    return successResponse(expense);
  });

  app.delete('/api/expenses/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request) => {
    const id = (request.params as { id: string }).id;
    await deleteExpense(prisma, id);
    return successResponse({ deleted: true });
  });
}

