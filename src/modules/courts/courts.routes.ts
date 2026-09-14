import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { errorResponse, successResponse } from '../../lib/api.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/authorization.js';
import { z } from 'zod';
import { CourtSchema, UpdateCourtSchema } from './courts.schema.js';
import { createCourt, deleteCourt, listCourts, updateCourt } from './courts.service.js';

const normalizeCourt = (court: Awaited<ReturnType<typeof listCourts>>[number]) => ({
  id: court.id,
  name: court.name,
  indoor: /indoor|inside/i.test(court.name),
  surface: /outdoor/i.test(court.name) ? 'Outdoor' : 'Hardcourt',
  rate: 35,
});

export async function courtsRoutes(app: FastifyInstance) {
  const CourtIdParamSchema = z.object({ id: z.string().min(1) });

  app.get('/api/courts', { preHandler: [requireAuth, requireRole('ADMIN', 'CASHIER')] }, async () => {
    const courts = await listCourts(prisma);
    return successResponse(courts.map(normalizeCourt));
  });

  app.post('/api/courts', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request, reply) => {
    const result = CourtSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid court payload', result.error.flatten());
    }

    const court = await createCourt(prisma, result.data);
    return successResponse(court);
  });

  app.put('/api/courts/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request, reply) => {
    const paramResult = CourtIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid court id', paramResult.error.flatten());
    }

    const result = UpdateCourtSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid court update data', result.error.flatten());
    }

    const court = await updateCourt(prisma, paramResult.data.id, result.data);
    return successResponse(court);
  });

  app.delete('/api/courts/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request, reply) => {
    const paramResult = CourtIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid court id', paramResult.error.flatten());
    }

    await deleteCourt(prisma, paramResult.data.id);
    return successResponse({ deleted: true });
  });
}

