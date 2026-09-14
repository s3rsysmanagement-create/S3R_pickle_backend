import pino from 'pino';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';

const loggerPlugin: FastifyPluginAsync = async (app) => {
  const logger = pino({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.NODE_ENV === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
  });

  app.decorate('log', logger);
};

export default loggerPlugin;
