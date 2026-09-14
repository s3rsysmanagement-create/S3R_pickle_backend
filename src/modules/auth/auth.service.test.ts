import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { loginUser } from './auth.service.js';
import { requireRole } from '../../middleware/authorization.js';
import { signAccessToken } from '../../lib/jwt.js';

const buildApp = (user: any) => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
  },
  log: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}) as any;

describe('loginUser', () => {
  it('returns a token and user payload for a valid admin login', async () => {
    const validHash = await bcrypt.hash('Password123!', 10);
    const app = buildApp({
      id: 'user-1',
      email: 'admin@pickleball.local',
      isActive: true,
      passwordHash: validHash,
      role: { name: 'ADMIN' },
    });

    const actual = await loginUser(app.prisma, 'admin@pickleball.local', 'Password123!');

    expect(actual.user).toEqual({
      id: 'user-1',
      email: 'admin@pickleball.local',
      role: 'ADMIN',
    });

    expect(actual.token).toBe(signAccessToken(actual.user));
  });

  it('rejects invalid credentials', async () => {
    const validHash = await bcrypt.hash('Password123!', 10);
    const app = buildApp({
      id: 'user-1',
      email: 'admin@pickleball.local',
      isActive: true,
      passwordHash: validHash,
      role: { name: 'ADMIN' },
    });

    await expect(loginUser(app.prisma, 'admin@pickleball.local', 'wrong-password')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });
});

describe('requireRole', () => {
  it('blocks cashier access to admin-only routes', async () => {
    const request = {
      user: {
        id: 'user-2',
        email: 'cashier@pickleball.local',
        role: 'CASHIER',
      },
    } as any;

    await expect(requireRole('ADMIN')(request)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });
});
