import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { errorResponse, successResponse } from '../../lib/api.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/authorization.js';
import { UpdateUserSchema, UserSchema } from './users.schema.js';
import { createUser, listUsers, updateUser } from './users.service.js';

export async function usersRoutes(app: FastifyInstance) {
  app.get('/api/users', { preHandler: [requireAuth, requireRole('ADMIN')] }, async () => {
    return successResponse(await listUsers(prisma));
  });

  app.post('/api/users', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request, reply) => {
    const result = UserSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid user payload', result.error.flatten());
    }

    const user = await createUser(prisma, result.data);
    return successResponse(user);
  });

  app.put('/api/users/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const result = UpdateUserSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid user update data', result.error.flatten());
    }

    const user = await updateUser(prisma, id, result.data);
    return successResponse(user);
  });
}


