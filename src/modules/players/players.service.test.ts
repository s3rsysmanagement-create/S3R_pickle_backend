import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { deletePlayer } from './players.service.js';

// ============================================================
// HELPERS
// ============================================================

const adminUser = { id: 'admin-1', email: 'admin@pickleball.local', role: 'ADMIN' as const };
const cashierUser = { id: 'cashier-1', email: 'cashier@pickleball.local', role: 'CASHIER' as const };

/**
 * Builds a minimal prisma mock that covers the deletePlayer path.
 *
 * Overrides let individual tests customise specific calls.
 */
function buildPrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  const txClient = {
    transactionPlayer: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    payment: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    transaction: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    player: {
      delete: vi.fn().mockResolvedValue({}),
    },
  };

  return {
    player: {
      findUnique: vi.fn().mockResolvedValue({ id: 'player-1', fullName: 'Test Player', isActive: true }),
    },
    $transaction: vi.fn(async (callback) => callback(txClient)),
    ...overrides,
    // expose inner tx so tests can assert on it
    _txClient: txClient,
  } as unknown as PrismaClient;
}

// ============================================================
// TESTS
// ============================================================

describe('deletePlayer', () => {

  it('returns success message when ADMIN deletes an existing player with no transactions', async () => {
    const prisma = buildPrisma();

    const result = await deletePlayer(prisma, 'player-1', adminUser);

    expect(result.message).toBe('Player and related transaction records removed successfully.');
  });


  it('throws FORBIDDEN when a non-ADMIN tries to delete a player', async () => {
    const prisma = buildPrisma();

    await expect(
      deletePlayer(prisma, 'player-1', cashierUser),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });


  it('throws NOT_FOUND when the player does not exist', async () => {
    const prisma = buildPrisma({
      player: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(
      deletePlayer(prisma, 'missing-player', adminUser),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });


  it('removes transaction-player associations for the deleted player', async () => {
    const prisma = buildPrisma();
    const tx = (prisma as unknown as {
      _txClient: Record<string, { deleteMany: ReturnType<typeof vi.fn> }>;
    })._txClient;

    await deletePlayer(prisma, 'player-1', adminUser);

    expect(tx.transactionPlayer.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playerId: 'player-1' } }),
    );
  });


  it('deletes transactions that become empty after player removal', async () => {
    // player-1 was the only player in txn-1
    const txClient = {
      transactionPlayer: {
        // First findMany: returns the transactions this player was in
        findMany: vi.fn()
          .mockResolvedValueOnce([{ transactionId: 'txn-1' }])
          // Second findMany: no remaining players in txn-1 → it is now empty
          .mockResolvedValueOnce([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      transaction: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      player: {
        delete: vi.fn().mockResolvedValue({}),
      },
    };

    const prisma = {
      player: {
        findUnique: vi.fn().mockResolvedValue({ id: 'player-1', fullName: 'Solo Player', isActive: true }),
      },
      $transaction: vi.fn(async (callback) => callback(txClient)),
    } as unknown as PrismaClient;

    await deletePlayer(prisma, 'player-1', adminUser);

    expect(txClient.transaction.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['txn-1'] } } }),
    );
    expect(txClient.payment.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { transactionId: { in: ['txn-1'] } } }),
    );
  });


  it('does NOT delete transactions that still have other players after removal', async () => {
    // txn-1 has player-1 AND player-2; after removing player-1 it still has player-2
    const txClient = {
      transactionPlayer: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ transactionId: 'txn-1' }])
          // player-2 still exists in txn-1
          .mockResolvedValueOnce([{ transactionId: 'txn-1' }]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      transaction: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      player: {
        delete: vi.fn().mockResolvedValue({}),
      },
    };

    const prisma = {
      player: {
        findUnique: vi.fn().mockResolvedValue({ id: 'player-1', fullName: 'Player One', isActive: true }),
      },
      $transaction: vi.fn(async (callback) => callback(txClient)),
    } as unknown as PrismaClient;

    await deletePlayer(prisma, 'player-1', adminUser);

    // transaction.deleteMany should NOT have been called with txn-1
    expect(txClient.transaction.deleteMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['txn-1'] } } }),
    );
  });


  it('rolls back on failure — $transaction propagates the error', async () => {
    const prisma = {
      player: {
        findUnique: vi.fn().mockResolvedValue({ id: 'player-1', fullName: 'Boom Player', isActive: true }),
      },
      $transaction: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    } as unknown as PrismaClient;

    await expect(
      deletePlayer(prisma, 'player-1', adminUser),
    ).rejects.toThrow('DB connection lost');
  });

});
