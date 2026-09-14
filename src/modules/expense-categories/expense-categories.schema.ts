import { z } from 'zod';

export const ExpenseCategorySchema = z.object({
  name: z.string().min(2).max(200),
  isActive: z.boolean().optional(),
});

export const UpdateExpenseCategorySchema = ExpenseCategorySchema.partial();

export type ExpenseCategoryInput = z.infer<typeof ExpenseCategorySchema>;
