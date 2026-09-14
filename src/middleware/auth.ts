import type { FastifyRequest } from 'fastify';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';
import type { AuthenticatedUser } from '../modules/auth/auth.types.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export async function requireAuth(request: FastifyRequest) {
  const bearerToken = request.headers.authorization;

  if (!bearerToken || !bearerToken.startsWith('Bearer ')) {
    throw unauthorized('Authentication required');
  }

  const token = bearerToken.replace(/^Bearer\s+/i, '').trim();

  try {
    const payload = verifyAccessToken(token);

    request.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    throw unauthorized('Invalid or expired session');
  }
}
