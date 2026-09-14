import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { errorResponse, successResponse } from '../../lib/api.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/authorization.js';
import { RateSchema, UpdateRateSchema } from './rates.schema.js';
import { createRate, deleteRate, listRates, updateRate } from './rates.service.js';

const normalizeRate = (rate: Awaited<ReturnType<typeof listRates>>[number]) => ({
  id: rate.id,
  name: rate.name,
  description: rate.code,
  amount: Number(rate.amount),
  active: rate.isActive,
});

export async function ratesRoutes(app: FastifyInstance) {
  app.get('/api/rates', { preHandler: [requireAuth, requireRole('ADMIN', 'CASHIER')] }, async () => {
    const rates = await listRates(prisma);
    return successResponse(rates.map(normalizeRate));
  });

  app.post('/api/rates', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request, reply) => {
    const result = RateSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid rate payload', result.error.flatten());
    }

    const rate = await createRate(prisma, result.data);
    return successResponse(rate);
  });

  app.put('/api/rates/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const result = UpdateRateSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid rate update data', result.error.flatten());
    }

    const rate = await updateRate(prisma, id, result.data);
    return successResponse(rate);
  });

  app.delete('/api/rates/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request) => {
    const id = (request.params as { id: string }).id;
    await deleteRate(prisma, id);
    return successResponse({ deleted: true });
  });
}


