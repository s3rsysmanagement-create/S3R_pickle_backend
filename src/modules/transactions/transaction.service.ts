import { Prisma, type PrismaClient } from '@prisma/client';
import { badRequest, conflict, notFound, unauthorized } from '../../lib/errors.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type {
  CreateTransactionInput,
  PaymentMethod,
  TransactionResponse,
  UpdateTransactionPlayerRatesInput,
} from './transaction.types.js';

const toCents = (value: string | number | Prisma.Decimal): bigint => {
  const raw = value.toString();
  const [whole, fraction = ''] = raw.split('.');
  const normalized = `${fraction.padEnd(2, '0')}`.slice(0, 2);
  return BigInt(whole || '0') * 100n + BigInt(normalized || '0');
};

const fromCents = (value: bigint): string => {
  const whole = value / 100n;
  const fraction = value % 100n;
  return `${whole}.${fraction.toString().padStart(2, '0')}`;
};

const createTransactionCode = () => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = Math.floor(Math.random() * 9000 + 1000).toString();
  return `TXN-${stamp}-${sequence}`;
};

export function calculateTotalFromRates(rates: Array<{ amount: string | Prisma.Decimal }>): string {
  const totalCents = rates.reduce((sum, rate) => sum + toCents(rate.amount), 0n);
  return fromCents(totalCents);
}

export async function createTransaction(
  prisma: PrismaClient,
  input: CreateTransactionInput,
  cashier: AuthenticatedUser,
  idempotencyKey?: string,
): Promise<TransactionResponse> {
  if (!cashier || !['ADMIN', 'CASHIER'].includes(cashier.role)) {
    throw unauthorized('Authentication required');
  }

  if (!input.players.length) {
    throw badRequest('At least one player is required');
  }

  const court = await prisma.court.findUnique({ where: { id: input.courtId } });
  if (!court || !court.isActive) {
    throw notFound('Court not found or inactive');
  }

  const playerIds = [...new Set(input.players.map((player) => player.playerId))];
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, isActive: true },
  });

  if (players.length !== playerIds.length) {
    throw badRequest('One or more players are invalid or inactive');
  }

  // Check for duplicate player bookings on the same date.
  // We deduplicate by playerId (unique players in this request) so that a player
  // with multiple rates in the SAME request does not falsely trigger the conflict check.
  const date = new Date(input.transactionDate);
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const duplicatePlayers = await prisma.transactionPlayer.findMany({
    where: {
      playerId: { in: playerIds },
      transaction: {
        transactionDate: { gte: dayStart, lte: dayEnd },
        status: { not: 'CANCELLED' },
      },
    },
    include: { player: true },
    distinct: ['playerId'],
  });

  if (duplicatePlayers.length > 0) {
    const names = duplicatePlayers.map((tp) => tp.player.fullName).join(', ');
    throw conflict(`Player(s) already have a transaction on this date: ${names}`);
  }

  const rateIds = [...new Set(input.players.map((player) => player.rateId))];
  const rates = await prisma.rate.findMany({
    where: { id: { in: rateIds }, isActive: true },
  });

  if (rates.length !== rateIds.length) {
    throw badRequest('One or more rates are invalid or inactive');
  }

  const rateMap = new Map(rates.map((rate) => [rate.id, rate]));
  const selectedRateAmounts = input.players.map((player) => {
    const rate = rateMap.get(player.rateId);
    if (!rate) {
      throw badRequest('Invalid rate for player');
    }
    return { playerId: player.playerId, amount: rate.amount.toString() };
  });

  const total = calculateTotalFromRates(selectedRateAmounts.map((entry) => ({ amount: entry.amount })));

  const existing = idempotencyKey
    ? await prisma.auditLog.findFirst({
        where: {
          action: 'CREATE_TRANSACTION',
          description: { contains: idempotencyKey },
        },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  if (existing?.entityId) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: existing.entityId },
    });

    if (transaction) {
      return {
        id: transaction.id,
        transactionCode: transaction.transactionCode,
        cashierId: transaction.cashierId,
        courtId: transaction.courtId,
        transactionDate: transaction.transactionDate.toISOString(),
        startTime: transaction.startTime.toISOString(),
        endTime: transaction.endTime.toISOString(),
        total: transaction.total.toString(),
        paymentMethod: transaction.paymentMethod,
        status: transaction.status,
        createdAt: transaction.createdAt.toISOString(),
      };
    }
  }

  const transactionStatus = input.status === 'UNPAID' ? 'UNPAID' : 'COMPLETED';

  const transaction = await prisma.$transaction(async (tx) => {
    const createdTransaction = await tx.transaction.create({
      data: {
        transactionCode: createTransactionCode(),
        cashierId: cashier.id,
        courtId: court.id,
        transactionDate: new Date(input.transactionDate),
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        total: total,
        paymentMethod: input.paymentMethod as PaymentMethod,
        status: transactionStatus,
      },
    });

    await Promise.all(
      input.players.map((player) =>
        tx.transactionPlayer.create({
          data: {
            transactionId: createdTransaction.id,
            playerId: player.playerId,
            rateId: player.rateId,
            amount: String(rateMap.get(player.rateId)?.amount.toString() ?? '0.00'),
          },
        }),
      ),
    );

    if (transactionStatus === 'COMPLETED') {
      await tx.payment.create({
        data: {
          transactionId: createdTransaction.id,
          type: input.paymentMethod as PaymentMethod,
          amount: total,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: cashier.id,
        transactionId: createdTransaction.id,
        action: 'CREATE_TRANSACTION',
        entityType: 'Transaction',
        entityId: createdTransaction.id,
        description: idempotencyKey ? `Created transaction with idempotency key ${idempotencyKey}` : 'Created transaction',
      },
    });

    return createdTransaction;
  });

  return {
    id: transaction.id,
    transactionCode: transaction.transactionCode,
    cashierId: transaction.cashierId,
    courtId: transaction.courtId,
    transactionDate: transaction.transactionDate.toISOString(),
    startTime: transaction.startTime.toISOString(),
    endTime: transaction.endTime.toISOString(),
    total: transaction.total.toString(),
    paymentMethod: transaction.paymentMethod,
    status: transaction.status,
    createdAt: transaction.createdAt.toISOString(),
  };
}

export async function getTransactions(prisma: PrismaClient) {
  return prisma.transaction.findMany({
    include: {
      court: true,
      cashier: true,
      payments: true,
      players: {
        include: {
          player: true,
          rate: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTransactionById(prisma: PrismaClient, id: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      court: true,
      cashier: true,
      payments: true,
      players: {
        include: {
          player: true,
          rate: true,
        },
      },
    },
  });

  if (!transaction) {
    throw notFound('Transaction not found');
  }

  return transaction;
}

export async function updateTransactionPlayerRates(
  prisma: PrismaClient,
  transactionId: string,
  playerId: string,
  input: UpdateTransactionPlayerRatesInput,
  cashier: AuthenticatedUser,
) {
  if (!cashier || !['ADMIN', 'CASHIER'].includes(cashier.role)) {
    throw unauthorized('Authentication required');
  }

  const uniqueRateIds = [...new Set(input.rateIds.map((rateId) => rateId.trim()).filter(Boolean))];
  if (!uniqueRateIds.length) {
    throw badRequest('At least one rate is required');
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!transaction) {
    throw notFound('Transaction not found');
  }

  if (transaction.status === 'CANCELLED') {
    throw badRequest('Cannot modify rates for a cancelled transaction');
  }

  const playerLineItems = await prisma.transactionPlayer.findMany({
    where: { transactionId, playerId },
    select: { id: true },
  });
  if (!playerLineItems.length) {
    throw notFound('Player is not part of this transaction');
  }

  const rates = await prisma.rate.findMany({
    where: {
      id: { in: uniqueRateIds },
      isActive: true,
    },
  });
  if (rates.length !== uniqueRateIds.length) {
    throw badRequest('One or more rates are invalid or inactive');
  }

  const rateMap = new Map(rates.map((rate) => [rate.id, rate]));

  await prisma.$transaction(async (tx) => {
    await tx.transactionPlayer.deleteMany({
      where: {
        transactionId,
        playerId,
      },
    });

    await Promise.all(
      uniqueRateIds.map((rateId) =>
        tx.transactionPlayer.create({
          data: {
            transactionId,
            playerId,
            rateId,
            amount: rateMap.get(rateId)?.amount.toString() ?? '0.00',
          },
        }),
      ),
    );

    const allLineItems = await tx.transactionPlayer.findMany({
      where: { transactionId },
      select: { amount: true },
    });
    const updatedTotal = calculateTotalFromRates(allLineItems);

    await tx.transaction.update({
      where: { id: transactionId },
      data: { total: updatedTotal },
    });

    if (transaction.status === 'COMPLETED') {
      const paymentUpdate = await tx.payment.updateMany({
        where: { transactionId },
        data: { amount: updatedTotal },
      });

      if (paymentUpdate.count === 0) {
        await tx.payment.create({
          data: {
            transactionId,
            type: transaction.paymentMethod,
            amount: updatedTotal,
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        userId: cashier.id,
        transactionId,
        action: 'UPDATE_TRANSACTION_PLAYER_RATES',
        entityType: 'Transaction',
        entityId: transactionId,
        description: `Updated rates for player ${playerId}`,
      },
    });
  });

  return getTransactionById(prisma, transactionId);
}

export async function cancelTransaction(prisma: PrismaClient, id: string, cashier: AuthenticatedUser) {
  const transaction = await prisma.transaction.findUnique({ where: { id } });

  if (!transaction) {
    throw notFound('Transaction not found');
  }

  if (cashier.role !== 'ADMIN') {
    throw unauthorized('Only admins can cancel transactions');
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  await prisma.auditLog.create({
    data: {
      userId: cashier.id,
      transactionId: updated.id,
      action: 'CANCEL_TRANSACTION',
      entityType: 'Transaction',
      entityId: updated.id,
      description: 'Cancelled transaction',
    },
  });

  return updated;
}

export async function markTransactionAsPaid(
  prisma: PrismaClient,
  id: string,
  cashier: AuthenticatedUser,
) {
  const transaction = await prisma.transaction.findUnique({ where: { id } });

  if (!transaction) {
    throw notFound('Transaction not found');
  }

  if (transaction.status !== 'UNPAID') {
    throw badRequest(
      transaction.status === 'CANCELLED'
        ? 'Cannot mark a cancelled transaction as paid'
        : 'Transaction is already completed',
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedTransaction = await tx.transaction.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: {
        court: true,
        cashier: true,
        payments: true,
        players: {
          include: {
            player: true,
            rate: true,
          },
        },
      },
    });

    await tx.payment.create({
      data: {
        transactionId: id,
        type: updatedTransaction.paymentMethod,
        amount: updatedTransaction.total,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: cashier.id,
        transactionId: id,
        action: 'MARK_TRANSACTION_PAID',
        entityType: 'Transaction',
        entityId: id,
        description: 'Marked transaction as paid',
      },
    });

    return updatedTransaction;
  });

  return updated;
}
