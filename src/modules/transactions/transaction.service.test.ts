import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  calculateTotalFromRates,
  createTransaction,
  updateTransactionPlayerRates,
} from './transaction.service.js';

// ============================================================
// SHARED FIXTURE HELPERS
// ============================================================

const CASHIER = { id: 'cashier-1', email: 'cashier@pickleball.local', role: 'CASHIER' as const };

const BASE_INPUT = {
  courtId: 'court-1',
  transactionDate: '2026-08-24',
  startTime: '2026-08-24T18:00:00.000Z',
  endTime: '2026-08-24T20:00:00.000Z',
  paymentMethod: 'CASH' as const,
};

/** Builds a minimal tx-client mock used inside prisma.$transaction */
function makeTxClient(transactionOverride = {}) {
  return {
    transaction: {
      create: vi.fn().mockResolvedValue({
        id: 'txn-1',
        transactionCode: 'TXN-20260824-0001',
        cashierId: 'cashier-1',
        courtId: 'court-1',
        transactionDate: new Date('2026-08-24'),
        startTime: new Date('2026-08-24T18:00:00Z'),
        endTime: new Date('2026-08-24T20:00:00Z'),
        total: { toString: () => '180.00' },
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        createdAt: new Date('2026-08-24T12:00:00Z'),
        ...transactionOverride,
      }),
    },
    // createMany is gone; service now uses individual create calls.
    transactionPlayer: { create: vi.fn().mockResolvedValue({ id: 'tp-1' }) },
    payment: { create: vi.fn().mockResolvedValue({ id: 'pay-1' }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'log-1' }) },
  };
}

/** Builds a full prisma mock for happy-path createTransaction calls */
function makePrisma(options: {
  players?: object[];
  rates?: object[];
  existingConflict?: object[];
  txOverride?: object;
} = {}) {
  const {
    players = [{ id: 'player-1', isActive: true }, { id: 'player-2', isActive: true }],
    rates = [
      { id: 'rate-regular', isActive: true, amount: { toString: () => '100.00' } },
      { id: 'rate-ball-fee', isActive: true, amount: { toString: () => '50.00' } },
    ],
    existingConflict = [],
    txOverride = {},
  } = options;

  const txClient = makeTxClient(txOverride);

  return {
    court: { findUnique: vi.fn().mockResolvedValue({ id: 'court-1', isActive: true }) },
    player: { findMany: vi.fn().mockResolvedValue(players) },
    rate: { findMany: vi.fn().mockResolvedValue(rates) },
    transactionPlayer: { findMany: vi.fn().mockResolvedValue(existingConflict) },
    $transaction: vi.fn(async (cb) => cb(txClient)),
    auditLog: { findFirst: vi.fn().mockResolvedValue(null) },
    _txClient: txClient,
  } as unknown as PrismaClient & { _txClient: ReturnType<typeof makeTxClient> };
}


// ============================================================
// calculateTotalFromRates
// ============================================================

describe('calculateTotalFromRates', () => {
  it('sums regular and member amounts without floating-point drift', () => {
    expect(
      calculateTotalFromRates([
        { amount: '100.00' },
        { amount: '80.00' },
        { amount: '100.00' },
      ]),
    ).toBe('280.00');
  });

  it('sums a single-player multi-rate scenario correctly', () => {
    // player-1 regular=100, player-1 ball-fee=50, player-2 regular=100 → 250
    expect(
      calculateTotalFromRates([
        { amount: '100.00' },
        { amount: '50.00' },
        { amount: '100.00' },
      ]),
    ).toBe('250.00');
  });
});


// ============================================================
// createTransaction
// ============================================================

describe('createTransaction', () => {

  // ----------------------------------------------------------
  // Happy path — single rate per player (existing behaviour)
  // ----------------------------------------------------------

  it('creates a transaction with one rate per player and returns correct total', async () => {
    const prisma = makePrisma({
      players: [{ id: 'player-1', isActive: true }, { id: 'player-2', isActive: true }],
      rates: [
        { id: 'rate-regular', isActive: true, amount: { toString: () => '100.00' } },
        { id: 'rate-ball-fee', isActive: true, amount: { toString: () => '50.00' } },
      ],
      txOverride: { total: { toString: () => '150.00' } },
    });

    const result = await createTransaction(
      prisma,
      {
        ...BASE_INPUT,
        players: [
          { playerId: 'player-1', rateId: 'rate-regular' },
          { playerId: 'player-2', rateId: 'rate-ball-fee' },
        ],
      },
      CASHIER,
    );

    expect(result.total).toBe('150.00');
    expect(result.paymentMethod).toBe('CASH');
  });


  // ----------------------------------------------------------
  // Multi-rate: same player, different rates
  // ----------------------------------------------------------

  it('allows the same player with multiple different rates (multi-rate)', async () => {
    const prisma = makePrisma({
      players: [{ id: 'player-1', isActive: true }],
      rates: [
        { id: 'rate-regular', isActive: true, amount: { toString: () => '100.00' } },
        { id: 'rate-ball-fee', isActive: true, amount: { toString: () => '50.00' } },
      ],
      txOverride: { total: { toString: () => '150.00' } },
    });

    const result = await createTransaction(
      prisma,
      {
        ...BASE_INPUT,
        players: [
          { playerId: 'player-1', rateId: 'rate-regular' },
          { playerId: 'player-1', rateId: 'rate-ball-fee' },
        ],
      },
      CASHIER,
    );

    expect(result.total).toBe('150.00');
    // Both line items were persisted via individual create calls.
    const txCreate = (prisma as unknown as { _txClient: ReturnType<typeof makeTxClient> })._txClient.transactionPlayer.create;
    expect(txCreate).toHaveBeenCalledTimes(2);
  });


  it('creates transactions with multiple players each having multiple rates', async () => {
    const prisma = makePrisma({
      players: [{ id: 'player-1', isActive: true }, { id: 'player-2', isActive: true }],
      rates: [
        { id: 'rate-regular', isActive: true, amount: { toString: () => '100.00' } },
        { id: 'rate-ball-fee', isActive: true, amount: { toString: () => '50.00' } },
      ],
      txOverride: { total: { toString: () => '250.00' } },
    });

    const result = await createTransaction(
      prisma,
      {
        ...BASE_INPUT,
        players: [
          { playerId: 'player-1', rateId: 'rate-regular' },
          { playerId: 'player-1', rateId: 'rate-ball-fee' },
          { playerId: 'player-2', rateId: 'rate-regular' },
        ],
      },
      CASHIER,
    );

    expect(result.total).toBe('250.00');
    const txCreate = (prisma as unknown as { _txClient: ReturnType<typeof makeTxClient> })._txClient.transactionPlayer.create;
    expect(txCreate).toHaveBeenCalledTimes(3);
  });


  // ----------------------------------------------------------
  // Conflict check — only fires against DB records, not same-request duplicates
  // ----------------------------------------------------------

  it('rejects when a player already has a non-cancelled transaction on the same date in the DB', async () => {
    const prisma = makePrisma({
      players: [{ id: 'player-1', isActive: true }],
      rates: [{ id: 'rate-regular', isActive: true, amount: { toString: () => '100.00' } }],
      existingConflict: [{ playerId: 'player-1', player: { fullName: 'Juan Dela Cruz' } }],
    });

    await expect(
      createTransaction(
        prisma,
        {
          ...BASE_INPUT,
          players: [{ playerId: 'player-1', rateId: 'rate-regular' }],
        },
        CASHIER,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('does NOT reject when the same player appears twice in the request with different rates (multi-rate)', async () => {
    // The transactionPlayer.findMany mock returns empty → no DB conflict.
    const prisma = makePrisma({
      players: [{ id: 'player-1', isActive: true }],
      rates: [
        { id: 'rate-regular', isActive: true, amount: { toString: () => '100.00' } },
        { id: 'rate-ball-fee', isActive: true, amount: { toString: () => '50.00' } },
      ],
      existingConflict: [],
    });

    await expect(
      createTransaction(
        prisma,
        {
          ...BASE_INPUT,
          players: [
            { playerId: 'player-1', rateId: 'rate-regular' },
            { playerId: 'player-1', rateId: 'rate-ball-fee' },
          ],
        },
        CASHIER,
      ),
    ).resolves.toBeDefined();
  });


  // ----------------------------------------------------------
  // Validation errors
  // ----------------------------------------------------------

  it('rejects invalid or inactive rates', async () => {
    const prisma = makePrisma({
      players: [{ id: 'player-1', isActive: true }],
      rates: [],
    });

    await expect(
      createTransaction(
        prisma,
        {
          ...BASE_INPUT,
          players: [{ playerId: 'player-1', rateId: 'missing-rate' }],
        },
        CASHIER,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects when the player does not exist', async () => {
    const prisma = makePrisma({
      players: [],
      rates: [{ id: 'rate-regular', isActive: true, amount: { toString: () => '100.00' } }],
    });

    await expect(
      createTransaction(
        prisma,
        {
          ...BASE_INPUT,
          players: [{ playerId: 'ghost-player', rateId: 'rate-regular' }],
        },
        CASHIER,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });


  // ----------------------------------------------------------
  // UNPAID status
  // ----------------------------------------------------------

  it('creates an UNPAID transaction and does NOT create a payment record', async () => {
    const prisma = makePrisma({
      players: [{ id: 'player-1', isActive: true }],
      rates: [{ id: 'rate-regular', isActive: true, amount: { toString: () => '100.00' } }],
      txOverride: { status: 'UNPAID', total: { toString: () => '100.00' } },
    });

    const result = await createTransaction(
      prisma,
      {
        ...BASE_INPUT,
        status: 'UNPAID',
        players: [{ playerId: 'player-1', rateId: 'rate-regular' }],
      },
      CASHIER,
    );

    expect(result.status).toBe('UNPAID');
    const txClient = (prisma as unknown as { _txClient: ReturnType<typeof makeTxClient> })._txClient;
    expect(txClient.payment.create).not.toHaveBeenCalled();
  });
});

describe('updateTransactionPlayerRates', () => {
  it('replaces player rates and recomputes total', async () => {
    const txClient = {
      transactionPlayer: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        create: vi.fn().mockResolvedValue({ id: 'tp-new' }),
        findMany: vi
          .fn()
          .mockResolvedValue([{ amount: { toString: () => '200.00' } }, { amount: { toString: () => '50.00' } }]),
      },
      transaction: {
        update: vi.fn().mockResolvedValue({ id: 'txn-1' }),
      },
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({ id: 'pay-1' }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    const prisma = {
      transaction: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: 'txn-1', status: 'COMPLETED', paymentMethod: 'CASH' })
          .mockResolvedValueOnce({
            id: 'txn-1',
            court: { id: 'court-1', name: 'Court 1' },
            cashier: { id: 'cashier-1', firstName: 'Cash', lastName: 'ier' },
            payments: [],
            players: [],
          }),
      },
      transactionPlayer: {
        findMany: vi.fn().mockResolvedValue([{ id: 'tp-1' }]),
      },
      rate: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'rate-1', isActive: true, amount: { toString: () => '200.00' } },
          { id: 'rate-2', isActive: true, amount: { toString: () => '50.00' } },
        ]),
      },
      $transaction: vi.fn(async (callback) => callback(txClient)),
    } as unknown as PrismaClient;

    await updateTransactionPlayerRates(
      prisma,
      'txn-1',
      'player-1',
      { rateIds: ['rate-1', 'rate-2'] },
      CASHIER,
    );

    expect(txClient.transactionPlayer.deleteMany).toHaveBeenCalledWith({
      where: { transactionId: 'txn-1', playerId: 'player-1' },
    });
    expect(txClient.transactionPlayer.create).toHaveBeenCalledTimes(2);
    expect(txClient.transaction.update).toHaveBeenCalledWith({
      where: { id: 'txn-1' },
      data: { total: '250.00' },
    });
    expect(txClient.payment.updateMany).toHaveBeenCalledWith({
      where: { transactionId: 'txn-1' },
      data: { amount: '250.00' },
    });
  });

  it('rejects empty rate selection', async () => {
    const prisma = {} as PrismaClient;

    await expect(
      updateTransactionPlayerRates(
        prisma,
        'txn-1',
        'player-1',
        { rateIds: [] },
        CASHIER,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
