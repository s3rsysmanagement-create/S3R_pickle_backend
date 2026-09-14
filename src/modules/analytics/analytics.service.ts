import type { PrismaClient } from '@prisma/client';

/* =========================================================
   TYPES
   ========================================================= */

type AnalyticsPeriod =
  | 'daily'
  | 'monthly'
  | 'yearly';

type RevenueTrendItem = {
  name: string;
  value: number;
  sortKey: string;
};

/* =========================================================
   NUMBER HELPERS
   ========================================================= */

function decimalToNumber(
  value:
    | { toString: () => string }
    | string
    | number
    | null
    | undefined,
): number {
  const numeric = Number(value ?? 0);

  return Number.isFinite(numeric)
    ? numeric
    : 0;
}

/* =========================================================
   CURRENCY
   ========================================================= */

function formatCurrency(
  value: number,
): string {
  return `₱${value.toFixed(2)}`;
}

/* =========================================================
   PAYMENT METHOD NORMALIZATION
   ========================================================= */

function normalizePaymentMethod(
  value: string | null | undefined,
): string {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();

  switch (normalized) {
    case 'GCASH':
      return 'GCASH';

    case 'CASH':
      return 'CASH';

    case 'BANK_TRANSFER':
      return 'BANK_TRANSFER';

    case 'CARD':
      return 'CARD';

    default:
      return normalized || 'CASH';
  }
}

/* =========================================================
   PAYMENT METHOD SORT ORDER
   ========================================================= */

const paymentOrder = [
  'CASH',
  'GCASH',
  'BANK_TRANSFER',
  'CARD',
];

/* =========================================================
   DATE HELPERS
   ========================================================= */

function startOfDay(
  date: Date,
): Date {
  const result = new Date(date);

  result.setHours(
    0,
    0,
    0,
    0,
  );

  return result;
}

function startOfMonth(
  date: Date,
): Date {
  const result = new Date(date);

  result.setDate(1);

  result.setHours(
    0,
    0,
    0,
    0,
  );

  return result;
}

function startOfYear(
  date: Date,
): Date {
  const result = new Date(date);

  result.setMonth(
    0,
    1,
  );

  result.setHours(
    0,
    0,
    0,
    0,
  );

  return result;
}

function addDays(
  date: Date,
  days: number,
): Date {
  const result = new Date(date);

  result.setDate(
    result.getDate() + days,
  );

  return result;
}

function addMonths(
  date: Date,
  months: number,
): Date {
  const result = new Date(date);

  result.setMonth(
    result.getMonth() + months,
  );

  return result;
}

function addYears(
  date: Date,
  years: number,
): Date {
  const result = new Date(date);

  result.setFullYear(
    result.getFullYear() + years,
  );

  return result;
}

/* =========================================================
   LABEL HELPERS
   ========================================================= */

function formatDailyLabel(
  date: Date,
): string {
  return date.toLocaleDateString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
    },
  );
}

function formatMonthlyLabel(
  date: Date,
): string {
  return date.toLocaleDateString(
    'en-US',
    {
      month: 'short',
      year: 'numeric',
    },
  );
}

function formatYearlyLabel(
  date: Date,
): string {
  return date
    .getFullYear()
    .toString();
}

/* =========================================================
   SORT KEY HELPERS
   ========================================================= */

function formatDailySortKey(
  date: Date,
): string {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatMonthlySortKey(
  date: Date,
): string {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  return `${year}-${month}`;
}

function formatYearlySortKey(
  date: Date,
): string {
  return String(
    date.getFullYear(),
  );
}

/* =========================================================
   GET OVERVIEW
   ========================================================= */

export async function getOverview(
  prisma: PrismaClient,
  period: AnalyticsPeriod = 'daily',
) {
  const now = new Date();

  /* =======================================================
     REPORTING PERIOD
     ======================================================= */

  let periodStart: Date;
  let periodEnd: Date;

  if (period === 'daily') {
    periodStart =
      startOfDay(now);

    periodEnd =
      addDays(
        periodStart,
        1,
      );
  } else if (
    period === 'monthly'
  ) {
    periodStart =
      startOfMonth(now);

    periodEnd =
      addMonths(
        periodStart,
        1,
      );
  } else {
    periodStart =
      startOfYear(now);

    periodEnd =
      addYears(
        periodStart,
        1,
      );
  }

  /* =======================================================
     CURRENT PERIOD KPIs
     ======================================================= */

  const [
    revenue,
    expenses,
    transactions,
    players,
  ] = await Promise.all([
    prisma.payment.aggregate({
      _sum: {
        amount: true,
      },

      where: {
        paidAt: {
          gte: periodStart,
          lt: periodEnd,
        },

        transaction: {
          status: 'COMPLETED',
        },
      },
    }),

    prisma.expense.aggregate({
      _sum: {
        amount: true,
      },

      where: {
        expenseDate: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
    }),

    prisma.transaction.count({
      where: {
        transactionDate: {
          gte: periodStart,
          lt: periodEnd,
        },

        status: 'COMPLETED',
      },
    }),

    prisma.transactionPlayer.count({
      where: {
        transaction: {
          transactionDate: {
            gte: periodStart,
            lt: periodEnd,
          },

          status: 'COMPLETED',
        },
      },
    }),
  ]);

  const revenueValue =
    decimalToNumber(
      revenue._sum.amount,
    );

  const expenseValue =
    decimalToNumber(
      expenses._sum.amount,
    );

  const netRevenue =
    revenueValue -
    expenseValue;

  /* =======================================================
     REVENUE TREND
     ======================================================= */

  let revenueTrend:
    RevenueTrendItem[] = [];

  /* =======================================================
     DAILY
     Last 7 days
     ======================================================= */

  if (period === 'daily') {
    const dates =
      Array.from(
        {
          length: 7,
        },
        (_, index) => {
          const date =
            new Date(now);

          date.setHours(
            0,
            0,
            0,
            0,
          );

          date.setDate(
            date.getDate() -
              (6 - index),
          );

          return date;
        },
      );

    revenueTrend =
      await Promise.all(
        dates.map(
          async (date) => {
            const start =
              startOfDay(date);

            const end =
              addDays(
                start,
                1,
              );

            const summary =
              await prisma.payment.aggregate(
                {
                  _sum: {
                    amount: true,
                  },

                  where: {
                    paidAt: {
                      gte: start,
                      lt: end,
                    },

                    transaction: {
                      status:
                        'COMPLETED',
                    },
                  },
                },
              );

            return {
              name:
                formatDailyLabel(
                  date,
                ),

              value:
                decimalToNumber(
                  summary._sum
                    .amount,
                ),

              sortKey:
                formatDailySortKey(
                  date,
                ),
            };
          },
        ),
      );
  }

  /* =======================================================
     MONTHLY
     Last 12 months
     ======================================================= */

  if (period === 'monthly') {
    const months =
      Array.from(
        {
          length: 12,
        },
        (_, index) => {
          const date =
            new Date(now);

          date.setDate(1);

          date.setHours(
            0,
            0,
            0,
            0,
          );

          date.setMonth(
            date.getMonth() -
              (11 - index),
          );

          return date;
        },
      );

    revenueTrend =
      await Promise.all(
        months.map(
          async (date) => {
            const start =
              startOfMonth(date);

            const end =
              addMonths(
                start,
                1,
              );

            const summary =
              await prisma.payment.aggregate(
                {
                  _sum: {
                    amount: true,
                  },

                  where: {
                    paidAt: {
                      gte: start,
                      lt: end,
                    },

                    transaction: {
                      status:
                        'COMPLETED',
                    },
                  },
                },
              );

            return {
              name:
                formatMonthlyLabel(
                  date,
                ),

              value:
                decimalToNumber(
                  summary._sum
                    .amount,
                ),

              sortKey:
                formatMonthlySortKey(
                  date,
                ),
            };
          },
        ),
      );
  }

  /* =======================================================
     YEARLY
     Last 5 years
     ======================================================= */

  if (period === 'yearly') {
    const years =
      Array.from(
        {
          length: 5,
        },
        (_, index) => {
          const date =
            new Date(now);

          date.setMonth(
            0,
            1,
          );

          date.setHours(
            0,
            0,
            0,
            0,
          );

          date.setFullYear(
            date.getFullYear() -
              (4 - index),
          );

          return date;
        },
      );

    revenueTrend =
      await Promise.all(
        years.map(
          async (date) => {
            const start =
              startOfYear(date);

            const end =
              addYears(
                start,
                1,
              );

            const summary =
              await prisma.payment.aggregate(
                {
                  _sum: {
                    amount: true,
                  },

                  where: {
                    paidAt: {
                      gte: start,
                      lt: end,
                    },

                    transaction: {
                      status:
                        'COMPLETED',
                    },
                  },
                },
              );

            return {
              name:
                formatYearlyLabel(
                  date,
                ),

              value:
                decimalToNumber(
                  summary._sum
                    .amount,
                ),

              sortKey:
                formatYearlySortKey(
                  date,
                ),
            };
          },
        ),
      );
  }

  /* =======================================================
     FINAL REVENUE SORT
     ======================================================= */

  revenueTrend.sort(
    (a, b) =>
      a.sortKey.localeCompare(
        b.sortKey,
      ),
  );

  /* =======================================================
     PAYMENT BREAKDOWN
     ======================================================= */

  const paymentBreakdownData =
    await prisma.payment.groupBy(
      {
        by: ['type'],

        where: {
          paidAt: {
            gte: periodStart,
            lt: periodEnd,
          },

          transaction: {
            status: 'COMPLETED',
          },
        },

        _sum: {
          amount: true,
        },
      },
    );

  const paymentBreakdown =
    paymentBreakdownData
      .map((entry) => ({
        name:
          normalizePaymentMethod(
            entry.type,
          ),

        value:
          decimalToNumber(
            entry._sum.amount,
          ),
      }))
      .sort((a, b) => {
        const indexA =
          paymentOrder.indexOf(
            a.name,
          );

        const indexB =
          paymentOrder.indexOf(
            b.name,
          );

        const safeA =
          indexA === -1
            ? paymentOrder.length
            : indexA;

        const safeB =
          indexB === -1
            ? paymentOrder.length
            : indexB;

        return safeA - safeB;
      });

  /* =======================================================
     COURT USAGE
     ======================================================= */

  const courtUsageData =
    await prisma.transaction.groupBy(
      {
        by: ['courtId'],

        where: {
          transactionDate: {
            gte: periodStart,
            lt: periodEnd,
          },

          status: 'COMPLETED',
        },

        _count: {
          id: true,
        },
      },
    );

  const courtUsage =
    await Promise.all(
      courtUsageData.map(
        async (entry) => {
          const court =
            await prisma.court.findUnique(
              {
                where: {
                  id: entry.courtId,
                },
              },
            );

          return {
            name:
              court?.name ??
              'Court',

            value:
              entry._count.id,
          };
        },
      ),
    );

  /* =======================================================
     CASHIER SUMMARY
     ======================================================= */

  const cashierSummaryData =
    await prisma.transaction.groupBy(
      {
        by: ['cashierId'],

        where: {
          transactionDate: {
            gte: periodStart,
            lt: periodEnd,
          },

          status: 'COMPLETED',
        },

        _sum: {
          total: true,
        },

        _count: {
          id: true,
        },
      },
    );

  const cashierSummary =
    await Promise.all(
      cashierSummaryData.map(
        async (entry) => {
          const cashier =
            await prisma.user.findUnique(
              {
                where: {
                  id: entry.cashierId,
                },

                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            );

          const displayName =
            cashier
              ? `${cashier.firstName} ${cashier.lastName}`.trim()
              : 'Staff';

          return {
            name:
              displayName,

            value:
              decimalToNumber(
                entry._sum?.total ??
                  0,
              ),
          };
        },
      ),
    );

  /* =======================================================
     PLAYER ANALYTICS
     ======================================================= */

  const playerAnalytics =
    await prisma.transactionPlayer.groupBy(
      {
        by: ['playerId'],

        where: {
          transaction: {
            transactionDate: {
              gte: periodStart,
              lt: periodEnd,
            },

            status: 'COMPLETED',
          },
        },

        _count: {
          playerId: true,
        },
      },
    );

  /* =======================================================
     KPI STATS
     ======================================================= */

  const periodLabel =
    period === 'daily'
      ? 'Today'
      : period === 'monthly'
        ? 'This Month'
        : 'This Year';

  const stats = [
    {
      label:
        `Players ${periodLabel}`,

      value:
        String(players),

      delta:
        players > 0
          ? `${players} check-ins`
          : 'No check-ins yet',

      tone:
        'neutral' as const,
    },

    {
      label:
        `Revenue ${periodLabel}`,

      value:
        formatCurrency(
          revenueValue,
        ),

      delta:
        `${periodLabel} sales`,

      tone:
        'positive' as const,
    },

    {
      label:
        `Transactions ${periodLabel}`,

      value:
        String(transactions),

      delta:
        transactions > 0
          ? 'Completed transactions'
          : 'No activity',

      tone:
        'neutral' as const,
    },

    {
      label:
        `Expenses ${periodLabel}`,

      value:
        formatCurrency(
          expenseValue,
        ),

      delta:
        'Operating costs',

      tone:
        'warning' as const,
    },

    {
      label:
        'Net Revenue',

      value:
        formatCurrency(
          netRevenue,
        ),

      delta:
        'Revenue minus expenses',

      tone:
        'positive' as const,
    },
  ];

  /* =======================================================
     RESPONSE
     ======================================================= */

  return {
    period,

    stats,

    revenueTrend,

    revenueByPeriod:
      revenueTrend,

    paymentBreakdown,

    paymentSummary:
      paymentBreakdown,

    courtUsage,

    courtAnalytics:
      courtUsage,

    cashierSummary,

    cashierAnalytics:
      cashierSummary,

    playerAnalytics:
      playerAnalytics.map(
        (entry) => ({
          name:
            entry.playerId,

          value:
            entry._count
              .playerId,
        }),
      ),
  };
}

/* =========================================================
   OTHER ANALYTICS FUNCTIONS
   ========================================================= */

export async function getRevenue(
  prisma: PrismaClient,
) {
  return prisma.payment.groupBy({
    by: ['type'],

    where: {
      transaction: {
        status: 'COMPLETED',
      },
    },

    _sum: {
      amount: true,
    },
  });
}

/* =========================================================
   PLAYERS ANALYTICS
   ========================================================= */

export async function getPlayersAnalytics(
  prisma: PrismaClient,
) {
  return prisma.transactionPlayer.groupBy({
    by: ['playerId'],

    where: {
      transaction: {
        status: 'COMPLETED',
      },
    },

    _count: {
      playerId: true,
    },
  });
}

/* =========================================================
   PAYMENT METHOD ANALYTICS
   ========================================================= */

export async function getPaymentMethodAnalytics(
  prisma: PrismaClient,
) {
  return prisma.payment.groupBy({
    by: ['type'],

    where: {
      transaction: {
        status: 'COMPLETED',
      },
    },

    _sum: {
      amount: true,
    },
  });
}

/* =========================================================
   COURT ANALYTICS
   ========================================================= */

export async function getCourtAnalytics(
  prisma: PrismaClient,
) {
  return prisma.transaction.groupBy({
    by: ['courtId'],

    where: {
      status: 'COMPLETED',
    },

    _count: {
      id: true,
    },

    _sum: {
      total: true,
    },
  });
}

/* =========================================================
   CASHIER ANALYTICS
   ========================================================= */

export async function getCashierAnalytics(
  prisma: PrismaClient,
) {
  return prisma.transaction.groupBy({
    by: ['cashierId'],

    where: {
      status: 'COMPLETED',
    },

    _count: {
      id: true,
    },

    _sum: {
      total: true,
    },
  });
}