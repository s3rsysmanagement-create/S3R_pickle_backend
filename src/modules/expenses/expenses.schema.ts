import { z } from 'zod';

export const ExpensePaymentMethodSchema = z.enum(['CASH', 'GCASH', 'CARD', 'BANK_TRANSFER', 'VENMO']);

export const ExpenseSchema = z.object({
  categoryId: z.string().min(1),
  description: z.string().min(2).max(500),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  expenseDate: z.string().min(1),
  paymentMethod: ExpensePaymentMethodSchema,
  notes: z.string().max(1000).optional().or(z.literal('')).transform((value) => (value ? value : null)),
});

export const UpdateExpenseSchema = ExpenseSchema.partial();

export type ExpenseInput = z.infer<typeof ExpenseSchema>;
