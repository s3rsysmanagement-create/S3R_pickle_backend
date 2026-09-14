import type { FastifyInstance } from 'fastify';
import { successResponse } from '../../lib/api.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    return successResponse({
      status: 'ok',
      service: 'pickleball-api',
      timestamp: new Date().toISOString(),
    });
  });
}
