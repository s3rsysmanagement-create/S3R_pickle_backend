import type { PrismaClient } from '@prisma/client';
import { conflict, notFound, forbidden } from '../../lib/errors.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { PlayerInput } from './players.schema.js';

export async function listPlayers(prisma: PrismaClient) {
  return prisma.player.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPlayerById(prisma: PrismaClient, id: string) {
  const player = await prisma.player.findUnique({ where: { id } });

  if (!player) {
    throw notFound('Player not found');
  }

  return player;
}

export async function createPlayer(prisma: PrismaClient, input: PlayerInput) {
  const fullName = input.fullName.trim();

  const duplicate = await prisma.player.findFirst({
    where: { fullName: { equals: fullName, mode: 'insensitive' } },
  });

  if (duplicate) {
    throw conflict(`A player named "${fullName}" already exists`);
  }

  return prisma.player.create({
    data: {
      fullName,
      phone: input.phone ?? null,
    },
  });
}

export async function updatePlayer(prisma: PrismaClient, id: string, input: Partial<PlayerInput>) {
  const existing = await prisma.player.findUnique({ where: { id } });

  if (!existing) {
    throw notFound('Player not found');
  }

  if (input.fullName) {
    const trimmed = input.fullName.trim();

    const duplicate = await prisma.player.findFirst({
      where: {
        fullName: { equals: trimmed, mode: 'insensitive' },
        NOT: { id },
      },
    });

    if (duplicate) {
      throw conflict(`A player named "${trimmed}" already exists`);
    }

    input = { ...input, fullName: trimmed };
  }

  return prisma.player.update({
    where: { id },
    data: {
      ...(input.fullName ? { fullName: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
    },
  });
}

export async function deletePlayer(
  prisma: PrismaClient,
  id: string,
  requestingUser: AuthenticatedUser,
): Promise<{ message: string }> {
  if (requestingUser.role !== 'ADMIN') {
    throw forbidden('Only admins can remove players');
  }

  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) {
    throw notFound('Player not found');
  }

  await prisma.$transaction(async (tx) => {
    // Find all transactions that include this player.
    const affectedTransactionIds = (
      await tx.transactionPlayer.findMany({
        where: { playerId: id },
        select: { transactionId: true },
      })
    ).map((row) => row.transactionId);

    // Remove all transaction-player association rows for this player.
    await tx.transactionPlayer.deleteMany({ where: { playerId: id } });

    if (affectedTransactionIds.length > 0) {
      // Find transactions that are now empty (no remaining players).
      const stillPopulated = await tx.transactionPlayer.findMany({
        where: { transactionId: { in: affectedTransactionIds } },
        select: { transactionId: true },
        distinct: ['transactionId'],
      });

      const stillPopulatedIds = new Set(stillPopulated.map((r) => r.transactionId));
      const emptyTransactionIds = affectedTransactionIds.filter(
        (txnId) => !stillPopulatedIds.has(txnId),
      );

      if (emptyTransactionIds.length > 0) {
        // Clean up dependent rows for empty transactions before deleting them.
        await tx.payment.deleteMany({ where: { transactionId: { in: emptyTransactionIds } } });
        await tx.auditLog.updateMany({
          where: { transactionId: { in: emptyTransactionIds } },
          data: { transactionId: null },
        });
        await tx.transaction.deleteMany({ where: { id: { in: emptyTransactionIds } } });
      }
    }

    // Finally, delete the player.
    await tx.player.delete({ where: { id } });
  });

  return { message: 'Player and related transaction records removed successfully.' };
}
