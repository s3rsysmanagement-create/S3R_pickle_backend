import { describe, expect, it } from 'vitest';
import { getOverview } from './analytics.service.js';

describe('getOverview', () => {
  it('returns the frontend dashboard and analytics payload shape', async () => {
    const prisma = {
      payment: {
        aggregate: async () => ({ _sum: { amount: 1250.0 } }),
        groupBy: async () => [
          { type: 'CASH', _sum: { amount: 500.0 } },
          { type: 'CARD', _sum: { amount: 750.0 } },
        ],
      },
      expense: {
        aggregate: async () => ({ _sum: { amount: 200.0 } }),
      },
      transaction: {
        count: async () => 3,
        groupBy: async () => [
          { courtId: 'court-1', _count: { id: 2 }, _sum: { total: 200.0 } },
          { courtId: 'court-2', _count: { id: 1 }, _sum: { total: 100.0 } },
        ],
      },
      transactionPlayer: {
        count: async () => 4,
        groupBy: async () => [{ playerId: 'player-1', _count: { playerId: 2 } }],
      },
      court: {
        findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, name: `Court ${where.id}` }),
      },
      user: {
        findUnique: async () => ({ firstName: 'Alice', lastName: 'Ng' }),
      },
    } as any;

    const result = await getOverview(prisma);

    expect(result.stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Players Today' }),
        expect.objectContaining({ label: 'Revenue Today' }),
        expect.objectContaining({ label: 'Net Revenue' }),
      ]),
    );

    expect(result.revenueTrend).toEqual(expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })]));
    expect(result.paymentBreakdown).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'CASH' })]));
    expect(result.courtUsage).toEqual(expect.arrayContaining([expect.objectContaining({ name: expect.any(String), value: expect.any(Number) })]));
    expect(result.cashierSummary).toEqual(expect.arrayContaining([expect.objectContaining({ name: expect.any(String), value: expect.any(Number) })]));
    expect(result.playerAnalytics).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'player-1', value: 2 })]));
  });
});
