import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { AuthenticatedUser } from '../modules/auth/auth.types.js';

export type AccessTokenPayload = JwtPayload & {
  sub: string;
  email: string;
  role: AuthenticatedUser['role'];
};

export function signAccessToken(user: AuthenticatedUser): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    options,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;

  if (!payload.sub || !payload.email || !payload.role) {
    throw new Error('Invalid token payload');
  }

  return payload;
}
