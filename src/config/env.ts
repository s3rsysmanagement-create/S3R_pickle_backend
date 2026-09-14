import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/pickleball'),
  JWT_SECRET: z.string().min(32).default('development-jwt-secret-change-me-please'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('*'),
  FACILITY_TIMEZONE: z.string().default('Asia/Manila'),
  ADMIN_EMAIL: z.string().email().default('admin@pickleball.local'),
  ADMIN_PASSWORD: z.string().min(8).default('Password123!'),
});

export const env = envSchema.parse(process.env);

export type AppEnv = typeof env;
