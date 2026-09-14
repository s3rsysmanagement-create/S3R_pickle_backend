import { z } from 'zod';

export const UserRoleSchema = z.enum(['ADMIN', 'CASHIER']);

export const UserSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: UserRoleSchema,
  isActive: z.boolean().optional(),
});

export const UpdateUserSchema = UserSchema.partial().extend({
  password: z.string().min(8).max(128).optional(),
});

export type UserInput = z.infer<typeof UserSchema>;
