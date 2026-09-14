import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { errorResponse, successResponse } from '../../lib/api.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/authorization.js';
import { ExpenseCategorySchema, UpdateExpenseCategorySchema } from './expense-categories.schema.js';
import {
  createExpenseCategory,
  deleteExpenseCategory,
  listExpenseCategories,
  updateExpenseCategory,
} from './expense-categories.service.js';

export async function expenseCategoriesRoutes(app: FastifyInstance) {
  app.get('/api/expense-categories', { preHandler: [requireAuth, requireRole('ADMIN')] }, async () => {
    return successResponse(await listExpenseCategories(prisma));
  });

  app.post('/api/expense-categories', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request, reply) => {
    const result = ExpenseCategorySchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid expense category payload', result.error.flatten());
    }

    const category = await createExpenseCategory(prisma, result.data);
    return successResponse(category);
  });

  app.put('/api/expense-categories/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const result = UpdateExpenseCategorySchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid expense category update data', result.error.flatten());
    }

    const category = await updateExpenseCategory(prisma, id, result.data);
    return successResponse(category);
  });

  app.delete('/api/expense-categories/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request) => {
    const id = (request.params as { id: string }).id;
    await deleteExpenseCategory(prisma, id);
    return successResponse({ deleted: true });
  });
}

