import type { FastifyInstance } from 'fastify';
import { errorResponse, successResponse } from '../../lib/api.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/authorization.js';
import { loginUser } from './auth.service.js';
import { LoginSchema } from './auth.schema.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (request, reply) => {
    const result = LoginSchema.safeParse(request.body);

    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid login payload', result.error.flatten());
    }

    const { email, password } = result.data;
    const { user, token } = await loginUser(prisma, email, password);

    app.log.info({ email }, 'Successful login');
    return successResponse({
      user,
      token,
    });
  });

  app.post('/api/auth/logout', { preHandler: [requireAuth] }, async (request) => {
    app.log.info({ userId: request.user?.id }, 'User logged out');
    return successResponse({ loggedOut: true });
  });

  app.get('/api/auth/me', { preHandler: [requireAuth] }, async (request) => {
    return successResponse(request.user!);
  });

  app.get('/api/auth/admin-check', {
    preHandler: [requireAuth, requireRole('ADMIN')],
  }, async (request) => {
    return successResponse({
      user: request.user!,
      isAdmin: request.user!.role === 'ADMIN',
    });
  });
}
