import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { env } from './config/env.js';

import loggerPlugin from './plugins/logger.js';
import prismaPlugin from './plugins/prisma.js';
import openApiPlugin from './plugins/openapi.js';

import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { transactionRoutes } from './modules/transactions/transaction.routes.js';
import { playersRoutes } from './modules/players/players.routes.js';
import { courtsRoutes } from './modules/courts/courts.routes.js';
import { ratesRoutes } from './modules/rates/rates.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { expensesRoutes } from './modules/expenses/expenses.routes.js';
import { expenseCategoriesRoutes } from './modules/expense-categories/expense-categories.routes.js';
import { analyticsRoutes } from './modules/analytics/analytics.routes.js';

import { AppError } from './lib/errors.js';
import { errorResponse } from './lib/api.js';


/* =========================================================
   BUILD APPLICATION
   ========================================================= */

export async function buildApp() {
  const app = Fastify({
    logger: true,

    ajv: {
      customOptions: {
        allErrors: true,
      },
    },

    trustProxy: true,
  });


  /* =========================================================
     PLUGINS
     ========================================================= */

  await app.register(loggerPlugin);

  await app.register(helmet, {
    global: true,
  });

  await app.register(prismaPlugin);


  /* =========================================================
     CORS
     ========================================================= */

  await app.register(cors, {
    origin:
      env.CORS_ORIGIN === '*'
        ? true
        : env.CORS_ORIGIN.split(','),

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    credentials: true,
  });


  /* =========================================================
     RATE LIMIT
     ========================================================= */

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    global: true,
  });


  /* =========================================================
     OPEN API
     ========================================================= */

  if (env.NODE_ENV !== 'production') {
    await app.register(openApiPlugin);
  }


  /* =========================================================
     ROUTES
     ========================================================= */

  await app.register(healthRoutes);

  await app.register(authRoutes);

  await app.register(transactionRoutes);

  await app.register(playersRoutes);


  /* ---------------------------------------------------------
     COURTS
     
     GET    /api/courts
     POST   /api/courts
     PUT    /api/courts/:id
     DELETE /api/courts/:id
     --------------------------------------------------------- */

  await app.register(courtsRoutes);


  /* ---------------------------------------------------------
     RATES
     
     GET    /api/rates
     POST   /api/rates
     PUT    /api/rates/:id
     DELETE /api/rates/:id
     --------------------------------------------------------- */

  await app.register(ratesRoutes);


  /* ---------------------------------------------------------
     USERS
     
     GET    /api/users
     POST   /api/users
     PUT    /api/users/:id
     DELETE /api/users/:id
     --------------------------------------------------------- */

  await app.register(usersRoutes);


  /* ---------------------------------------------------------
     EXPENSES
     
     GET    /api/expenses
     POST   /api/expenses
     PUT    /api/expenses/:id
     DELETE /api/expenses/:id
     --------------------------------------------------------- */

  await app.register(expensesRoutes);


  /* ---------------------------------------------------------
     EXPENSE CATEGORIES
     
     GET    /api/expense-categories
     POST   /api/expense-categories
     PUT    /api/expense-categories/:id
     DELETE /api/expense-categories/:id
     --------------------------------------------------------- */

  await app.register(expenseCategoriesRoutes);


  /* ---------------------------------------------------------
     ANALYTICS
     --------------------------------------------------------- */

  await app.register(analyticsRoutes);


  /* =========================================================
     ERROR HANDLER
     ========================================================= */

  app.setErrorHandler((error, request, reply) => {
    const fastifyError = error as Error & {
      validation?: unknown[];
      statusCode?: number;
      code?: string;
    };


    /* -------------------------------------------------------
       APPLICATION ERROR
       ------------------------------------------------------- */

    if (error instanceof AppError) {
      reply.code(error.statusCode);

      return errorResponse(
        error.code,
        error.message,
        error.details,
      );
    }


    /* -------------------------------------------------------
       FASTIFY VALIDATION ERROR
       ------------------------------------------------------- */

    if (fastifyError.validation) {
      reply.code(400);

      return errorResponse(
        'VALIDATION_ERROR',
        'Invalid request data',
        fastifyError.validation,
      );
    }


    /* -------------------------------------------------------
       UNHANDLED ERROR
       ------------------------------------------------------- */

    app.log.error(
      {
        err: fastifyError,
        url: request.url,
        method: request.method,
      },
      'Unhandled error',
    );

    reply.code(500);

    return errorResponse(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred',
    );
  });


  return app;
}

