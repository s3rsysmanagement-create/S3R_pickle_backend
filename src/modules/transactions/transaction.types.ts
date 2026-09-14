export type PaymentMethod = 'CASH' | 'GCASH' | 'CARD' | 'BANK_TRANSFER' | 'VENMO';

export type TransactionStatus = 'COMPLETED' | 'CANCELLED' | 'UNPAID';

export type TransactionPlayerInput = {
  playerId: string;
  rateId: string;
};

export type CreateTransactionInput = {
  courtId: string;
  transactionDate: string;
  startTime: string;
  endTime: string;
  paymentMethod: PaymentMethod;
  status?: TransactionStatus;
  players: TransactionPlayerInput[];
};

export type UpdateTransactionPlayerRatesInput = {
  rateIds: string[];
};

export type TransactionResponse = {
  id: string;
  transactionCode: string;
  cashierId: string;
  courtId: string;
  transactionDate: string;
  startTime: string;
  endTime: string;
  total: string;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  createdAt: string;
};
