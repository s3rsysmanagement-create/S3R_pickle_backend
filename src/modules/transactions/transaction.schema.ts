import { z } from 'zod';

export const PaymentMethodSchema = z.enum(['CASH', 'GCASH', 'CARD', 'BANK_TRANSFER', 'VENMO']);

export const TransactionPlayerSchema = z.object({
  playerId: z.string().min(1),
  rateId: z.string().min(1),
});

export const CreateTransactionSchema = z.object({
  courtId: z.string().min(1),
  transactionDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  paymentMethod: PaymentMethodSchema,
  status: z.enum(['COMPLETED', 'UNPAID']).optional(),
  // Up to 20 players × 5 rates each = 100 line items max.
  players: z.array(TransactionPlayerSchema).min(1).max(100),
}).superRefine((data, ctx) => {
  // Reject exact duplicate { playerId, rateId } pairs within the same request.
  const seen = new Set<string>();
  for (const [i, p] of data.players.entries()) {
    const key = `${p.playerId}::${p.rateId}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate player-rate combination at index ${i}: the same player cannot have the same rate added twice.`,
        path: ['players', i],
      });
    }
    seen.add(key);
  }
});

export const TransactionIdParamSchema = z.object({
  id: z.string().min(1),
});

export const TransactionPlayerRatesParamSchema = z.object({
  transactionId: z.string().min(1),
  playerId: z.string().min(1),
});

export const UpdateTransactionPlayerRatesSchema = z.object({
  rateIds: z.array(z.string().min(1)).min(1).superRefine((rateIds, ctx) => {
    const seen = new Set<string>();
    for (const [index, rateId] of rateIds.entries()) {
      const normalized = rateId.trim();
      if (seen.has(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate rateId at index ${index}`,
          path: [index],
        });
      }
      seen.add(normalized);
    }
  }),
});

export type CreateTransactionRequest = z.infer<typeof CreateTransactionSchema>;
