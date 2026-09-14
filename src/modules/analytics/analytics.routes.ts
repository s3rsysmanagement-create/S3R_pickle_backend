import type { FastifyInstance } from 'fastify';

import { prisma } from '../../lib/prisma.js';
import { successResponse } from '../../lib/api.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/authorization.js';

import {
  getCashierAnalytics,
  getCourtAnalytics,
  getOverview,
  getPaymentMethodAnalytics,
  getPlayersAnalytics,
  getRevenue,
} from './analytics.service.js';

type AnalyticsPeriod = 'daily' | 'monthly' | 'yearly';

interface AnalyticsQuery {
  period?: AnalyticsPeriod;
}

export async function analyticsRoutes(app: FastifyInstance) {
  /* =========================================================
     DASHBOARD OVERVIEW
     ========================================================= */

  app.get(
    '/api/dashboard/overview',
    {
      preHandler: [
        requireAuth,
        requireRole('ADMIN'),
      ],
    },
    async () => {
      return successResponse(
        await getOverview(prisma, 'daily'),
      );
    },
  );


  /* =========================================================
     ANALYTICS OVERVIEW
     ========================================================= */

  app.get<{ Querystring: AnalyticsQuery }>(
    '/api/analytics/overview',
    {
      preHandler: [
        requireAuth,
        requireRole('ADMIN'),
      ],
    },
    async (request, reply) => {
      const period = request.query.period ?? 'daily';

      if (
        period !== 'daily' &&
        period !== 'monthly' &&
        period !== 'yearly'
      ) {
        return reply.status(400).send({
          success: false,
          message:
            'Invalid period. Use daily, monthly, or yearly.',
        });
      }

      const data = await getOverview(
        prisma,
        period,
      );

      return successResponse(data);
    },
  );


  /* =========================================================
     REVENUE
     ========================================================= */

  app.get(
    '/api/analytics/revenue',
    {
      preHandler: [
        requireAuth,
        requireRole('ADMIN'),
      ],
    },
    async () => {
      return successResponse(
        await getRevenue(prisma),
      );
    },
  );


  /* =========================================================
     PLAYERS
     ========================================================= */

  app.get(
    '/api/analytics/players',
    {
      preHandler: [
        requireAuth,
        requireRole('ADMIN'),
      ],
    },
    async () => {
      return successResponse(
        await getPlayersAnalytics(prisma),
      );
    },
  );


  /* =========================================================
     PAYMENT METHODS
     ========================================================= */

  app.get(
    '/api/analytics/payment-methods',
    {
      preHandler: [
        requireAuth,
        requireRole('ADMIN'),
      ],
    },
    async () => {
      return successResponse(
        await getPaymentMethodAnalytics(prisma),
      );
    },
  );


  /* =========================================================
     COURTS
     ========================================================= */

  app.get(
    '/api/analytics/courts',
    {
      preHandler: [
        requireAuth,
        requireRole('ADMIN'),
      ],
    },
    async () => {
      return successResponse(
        await getCourtAnalytics(prisma),
      );
    },
  );


  /* =========================================================
     CASHIERS
     ========================================================= */

  app.get(
    '/api/analytics/cashiers',
    {
      preHandler: [
        requireAuth,
        requireRole('ADMIN'),
      ],
    },
    async () => {
      return successResponse(
        await getCashierAnalytics(prisma),
      );
    },
  );
}