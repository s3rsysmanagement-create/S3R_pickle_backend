import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { unauthorized } from '../../lib/errors.js';
import { signAccessToken } from '../../lib/jwt.js';
import type { AuthenticatedUser } from './auth.types.js';

export async function loginUser(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<{ user: AuthenticatedUser; token: string }> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw unauthorized('Invalid email or password');
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    throw unauthorized('Invalid email or password');
  }

  const authUser: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    role: user.role.name as AuthenticatedUser['role'],
  };

  return {
    user: authUser,
    token: signAccessToken(authUser),
  };
}
