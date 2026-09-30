export interface AdjustmentInput {
  type: 'Debit' | 'Credit' | string;
  amount: string;
  currency: string;
  title: string;
  recipientName: string;
  notes: string;
}

export interface JournalEditInput {
  amountOriginal: string;
  currencyOriginal: string;
  notes: string;
  createdAt: string;
  debitAccountId: string;
  creditAccountId: string;
}

/** Pure shape checks kept local to FinanceAccounting for the pre-API transition. */
export const financeAccountingSchemas = {
  adjustment: (value: AdjustmentInput) => Boolean(value.amount && value.currency && value.title),
  journalEdit: (value: JournalEditInput) => Boolean(value.amountOriginal && value.currencyOriginal),
} as const;
