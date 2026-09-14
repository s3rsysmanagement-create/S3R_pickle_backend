import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { errorResponse, successResponse } from '../../lib/api.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/authorization.js';
import { PlayerSchema, UpdatePlayerSchema } from './players.schema.js';
import { createPlayer, deletePlayer, getPlayerById, listPlayers, updatePlayer } from './players.service.js';

const normalizePlayer = (player: Awaited<ReturnType<typeof listPlayers>>[number]) => ({
  id: player.id,
  name: player.fullName,
  phone: player.phone ?? undefined,
  active: player.isActive,
  email: undefined,
  skillLevel: 'Casual',
});

export async function playersRoutes(app: FastifyInstance) {
  app.get('/api/players', { preHandler: [requireAuth, requireRole('ADMIN', 'CASHIER')] }, async () => {
    const players = await listPlayers(prisma);
    return successResponse(players.map(normalizePlayer));
  });

  app.get('/api/players/:id', { preHandler: [requireAuth, requireRole('ADMIN', 'CASHIER')] }, async (request) => {
    const id = (request.params as { id: string }).id;
    const player = await getPlayerById(prisma, id);
    return successResponse(normalizePlayer(player));
  });

  app.post('/api/players', { preHandler: [requireAuth, requireRole('ADMIN', 'CASHIER')] }, async (request, reply) => {
    const result = PlayerSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid player payload', result.error.flatten());
    }

    const player = await createPlayer(prisma, result.data);
    return successResponse(player);
  });

  app.put('/api/players/:id', { preHandler: [requireAuth, requireRole('ADMIN', 'CASHIER')] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const result = UpdatePlayerSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400);
      return errorResponse('VALIDATION_ERROR', 'Invalid player update data', result.error.flatten());
    }

    const player = await updatePlayer(prisma, id, result.data);
    return successResponse(player);
  });

  /*
   * ============================================================
   * DELETE PLAYER
   * ============================================================
   *
   * DELETE /api/players/:id
   *
   * ADMIN only. Removes the player and cleans up all related
   * transaction-player rows. Transactions that become empty
   * after the removal are also deleted.
   */
  app.delete(
    '/api/players/:id',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request) => {
      const { id } = request.params as { id: string };

      if (!id || id.trim() === '') {
        return errorResponse('VALIDATION_ERROR', 'Invalid player id');
      }

      const result = await deletePlayer(prisma, id, request.user!);
      return successResponse(result);
    },
  );
}