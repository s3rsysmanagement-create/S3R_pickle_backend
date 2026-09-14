import { z } from 'zod';

export const MoneyStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);

export const RateSchema = z.object({
  name: z.string().min(2).max(200),
  amount: MoneyStringSchema,
  isActive: z.boolean().optional(),
});

export const UpdateRateSchema = RateSchema.partial();

export type RateInput = z.infer<typeof RateSchema>;
