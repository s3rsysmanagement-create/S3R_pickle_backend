import type { FastifyRequest } from 'fastify';
import { forbidden } from '../lib/errors.js';
import type { AuthenticatedUser } from '../modules/auth/auth.types.js';

export function requireRole(...allowedRoles: AuthenticatedUser['role'][]) {
  return async function authorize(request: FastifyRequest) {
    const currentUser = request.user;

    if (!currentUser) {
      throw forbidden('Authentication required');
    }

    if (!allowedRoles.includes(currentUser.role)) {
      throw forbidden('You do not have permission to perform this action');
    }
  };
}
