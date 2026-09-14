import type { FastifyInstance } from 'fastify';

import {
  errorResponse,
  successResponse,
} from '../../lib/api.js';

import { prisma } from '../../lib/prisma.js';

import { requireAuth } from '../../middleware/auth.js';

import { requireRole } from '../../middleware/authorization.js';

import {
  CreateTransactionSchema,
  UpdateTransactionPlayerRatesSchema,
  TransactionPlayerRatesParamSchema,
  TransactionIdParamSchema,
} from './transaction.schema.js';

import {
  cancelTransaction,
  createTransaction,
  getTransactionById,
  getTransactions,
  markTransactionAsPaid,
  updateTransactionPlayerRates,
} from './transaction.service.js';

/*
 * ============================================================
 * NORMALIZERS
 * ============================================================
 */

/*
 * Convert database transaction status
 * into the status expected by the frontend.
 */
const normalizeTransactionStatus = (
  status: string,
) => {
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'UNPAID') return 'UNPAID';
  return 'PAID';
};

/*
 * Convert payment method names if needed.
 *
 * Your existing application maps GCASH -> VENMO.
 */
const normalizePaymentMethod = (
  method: string,
) => {
  if (method === 'GCASH') {
    return 'GCASH';
  }

  return method;
};

/*
 * ============================================================
 * TRANSACTION RESPONSE NORMALIZER
 * ============================================================
 *
 * Converts the Prisma transaction into the
 * structure expected by the React frontend.
 *
 * Result:
 *
 * {
 *   id,
 *   createdAt,
 *   cashierName,
 *   courtName,
 *   status,
 *   paymentMethod,
 *   total,
 *   players: [
 *     {
 *       playerId,
 *       playerName,
 *       amount
 *     }
 *   ]
 * }
 *
 */

const normalizeTransaction = (
  transaction: Awaited<
    ReturnType<typeof getTransactions>
  >[number],
) => {
  return {
    /*
     * Transaction ID
     */
    id: transaction.id,

    /*
     * Date/time transaction was created.
     */
    createdAt:
      transaction.createdAt.toISOString(),

    /*
     * Cashier/staff full name.
     */
    cashierName:
      `${transaction.cashier.firstName} ${transaction.cashier.lastName}`.trim(),

    /*
     * Court name.
     */
    courtName:
      transaction.court.name,

    /*
     * Transaction status.
     */
    status:
      normalizeTransactionStatus(
        transaction.status,
      ),

    /*
     * Payment method.
     */
    paymentMethod:
      normalizePaymentMethod(
        transaction.paymentMethod,
      ),

    /*
     * Transaction total.
     */
    total:
      Number(transaction.total),

    /*
     * Individual players.
     *
     * transaction.players is the
     * transaction_players relation.
     * Each row is one player-rate line item —
     * the same player may appear multiple times
     * with different rates.
     */
    players:
      transaction.players.map(
        (transactionPlayer) => ({
          /*
           * Player ID.
           */
          playerId:
            transactionPlayer.player.id,

          /*
           * Player full name.
           */
          playerName: transactionPlayer.player.fullName,

          /*
           * Rate ID for this line item.
           */
          rateId: transactionPlayer.rate.id,

          /*
           * Rate name label.
           */
          rateName: transactionPlayer.rate.name,

          /*
           * Amount for this line item.
           */
          amount:
            Number(
              transactionPlayer.amount,
            ),
        }),
      ),
  };
};

/*
 * ============================================================
 * ROUTES
 * ============================================================
 */

export async function transactionRoutes(
  app: FastifyInstance,
) {

  /*
   * ==========================================================
   * CREATE TRANSACTION
   * ==========================================================
   *
   * POST /api/transactions
   *
   * Allowed:
   * - ADMIN
   * - CASHIER
   */
  app.post(
    '/api/transactions',
    {
      preHandler: [
        requireAuth,
        requireRole(
          'ADMIN',
          'CASHIER',
        ),
      ],
    },

    async (
      request,
      reply,
    ) => {

      /*
       * Validate request body.
       */
      const result =
        CreateTransactionSchema.safeParse(
          request.body,
        );

      if (!result.success) {
        reply.code(400);

        return errorResponse(
          'VALIDATION_ERROR',
          'Invalid transaction payload',
          result.error.flatten(),
        );
      }

      /*
       * Get idempotency key.
       */
      const idempotencyKey =
        typeof request.headers[
          'idempotency-key'
        ] === 'string'
          ? request.headers[
              'idempotency-key'
            ]
          : undefined;

      /*
       * Create transaction.
       */
      const transaction =
        await createTransaction(
          prisma,
          result.data,
          request.user!,
          idempotencyKey,
        );

      return successResponse(
        transaction,
      );
    },
  );

  /*
   * ==========================================================
   * GET ALL TRANSACTIONS
   * ==========================================================
   *
   * GET /api/transactions
   *
   * Returns:
   *
   * [
   *   {
   *     id,
   *     createdAt,
   *     cashierName,
   *     courtName,
   *     status,
   *     paymentMethod,
   *     total,
   *     players: [...]
   *   }
   * ]
   *
   * Allowed:
   * - ADMIN
   * - CASHIER
   */
  app.get(
    '/api/transactions',
    {
      preHandler: [
        requireAuth,
        requireRole(
          'ADMIN',
          'CASHIER',
        ),
      ],
    },

    async () => {

      /*
       * Get transactions from database.
       *
       * getTransactions() already includes:
       *
       * court
       * cashier
       * payments
       * players
       * player
       * rate
       */
      const transactions =
        await getTransactions(
          prisma,
        );

      /*
       * Convert Prisma objects into
       * frontend-friendly objects.
       */
      const normalizedTransactions =
        transactions.map(
          normalizeTransaction,
        );

      return successResponse(
        normalizedTransactions,
      );
    },
  );

  /*
   * ==========================================================
   * GET SINGLE TRANSACTION
   * ==========================================================
   *
   * GET /api/transactions/:id
   *
   * Allowed:
   * - ADMIN
   * - CASHIER
   */
  app.get(
    '/api/transactions/:id',
    {
      preHandler: [
        requireAuth,
        requireRole(
          'ADMIN',
          'CASHIER',
        ),
      ],
    },

    async (
      request,
      reply,
    ) => {

      /*
       * Validate transaction ID.
       */
      const result =
        TransactionIdParamSchema.safeParse(
          request.params,
        );

      if (!result.success) {
        reply.code(400);

        return errorResponse(
          'VALIDATION_ERROR',
          'Invalid transaction id',
          result.error.flatten(),
        );
      }

      /*
       * Get transaction including:
       *
       * court
       * cashier
       * payments
       * players
       * player
       * rate
       */
      const transaction =
        await getTransactionById(
          prisma,
          result.data.id,
        );

      /*
       * Normalize response.
       */
      return successResponse(
        normalizeTransaction(
          transaction,
        ),
      );
    },
  );

  /*
   * ==========================================================
   * MARK TRANSACTION AS PAID
   * ==========================================================
   *
   * PATCH /api/transactions/:id/mark-paid
   *
   * Allowed:
   * - ADMIN
   * - CASHIER
   */
  app.patch(
    '/api/transactions/:id/mark-paid',
    {
      preHandler: [
        requireAuth,
        requireRole(
          'ADMIN',
          'CASHIER',
        ),
      ],
    },

    async (
      request,
      reply,
    ) => {

      /*
       * Validate transaction ID.
       */
      const result =
        TransactionIdParamSchema.safeParse(
          request.params,
        );

      if (!result.success) {
        reply.code(400);

        return errorResponse(
          'VALIDATION_ERROR',
          'Invalid transaction id',
          result.error.flatten(),
        );
      }

      /*
       * Mark transaction as paid.
       */
      const transaction =
        await markTransactionAsPaid(
          prisma,
          result.data.id,
          request.user!,
        );

      /*
       * Return normalized transaction.
       */
      return successResponse(
        normalizeTransaction(
          transaction,
        ),
      );
    },
  );

  /*
   * ==========================================================
   * UPDATE TRANSACTION PLAYER RATES
   * ==========================================================
   *
   * PATCH /api/transactions/:transactionId/players/:playerId/rates
   *
   * Allowed:
   * - ADMIN
   * - CASHIER
   */
  app.patch(
    '/api/transactions/:transactionId/players/:playerId/rates',
    {
      preHandler: [
        requireAuth,
        requireRole(
          'ADMIN',
          'CASHIER',
        ),
      ],
    },
    async (
      request,
      reply,
    ) => {
      const paramsResult = TransactionPlayerRatesParamSchema.safeParse(
        request.params,
      );

      if (!paramsResult.success) {
        reply.code(400);
        return errorResponse(
          'VALIDATION_ERROR',
          'Invalid transaction/player id',
          paramsResult.error.flatten(),
        );
      }

      const bodyResult = UpdateTransactionPlayerRatesSchema.safeParse(
        request.body,
      );

      if (!bodyResult.success) {
        reply.code(400);
        return errorResponse(
          'VALIDATION_ERROR',
          'Invalid rate update payload',
          bodyResult.error.flatten(),
        );
      }

      const transaction = await updateTransactionPlayerRates(
        prisma,
        paramsResult.data.transactionId,
        paramsResult.data.playerId,
        bodyResult.data,
        request.user!,
      );

      return successResponse(
        normalizeTransaction(
          transaction,
        ),
      );
    },
  );

  /*
   * ==========================================================
   * CANCEL TRANSACTION
   * ==========================================================
   *
   * POST /api/transactions/:id/cancel
   *
   * Only ADMIN can cancel.
   */
  app.post(
    '/api/transactions/:id/cancel',
    {
      preHandler: [
        requireAuth,
        requireRole('ADMIN'),
      ],
    },

    async (
      request,
      reply,
    ) => {

      /*
       * Validate transaction ID.
       */
      const result =
        TransactionIdParamSchema.safeParse(
          request.params,
        );

      if (!result.success) {
        reply.code(400);

        return errorResponse(
          'VALIDATION_ERROR',
          'Invalid transaction id',
          result.error.flatten(),
        );
      }

      /*
       * Cancel transaction.
       */
      const transaction =
        await cancelTransaction(
          prisma,
          result.data.id,
          request.user!,
        );

      /*
       * Return cancelled transaction.
       */
      return successResponse(
        transaction,
      );
    },
  );
}