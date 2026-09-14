import { z } from 'zod';

export const CourtSchema = z.object({
  name: z.string().min(2).max(200),
  isActive: z.boolean().optional(),
});

export const UpdateCourtSchema = CourtSchema.partial();

export type CourtInput = z.infer<typeof CourtSchema>;
