import { z } from 'zod';

export const PlayerSchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().trim().max(30).optional().or(z.literal('')).transform((value) => (value ? value : null)),
});

export const UpdatePlayerSchema = PlayerSchema.partial();

export type PlayerInput = z.infer<typeof PlayerSchema>;
