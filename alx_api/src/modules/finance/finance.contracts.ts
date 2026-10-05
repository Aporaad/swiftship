export type FinancialEntryCategory = 'General' | 'Compound' | 'Temp' | 'Reversing';
export type FinancialPostingStatus = 'draft' | 'posted' | 'voided';
export type FinancialTransactionType = 'Debit' | 'Credit';
export type FinancialPaymentMethod = 'cash' | 'bank' | 'mixed' | 'deferred';

export interface PageQuery {
  limit: number;
  offset: number;
  search?: string | undefined;
}
export interface PageResult<T> {
  items: readonly T[];
  total: number;
}
export interface FinanceRepository {
  listAccounts(input: PageQuery): Promise<PageResult<Record<string, unknown>>>;
  getAccount(accountId: string): Promise<Record<string, unknown> | null>;
  listAccountMovements(accountId: string, input: PageQuery): Promise<PageResult<Record<string, unknown>>>;
  listEntryModules(): Promise<readonly Record<string, unknown>[]>;
  listEntryTypes(moduleId?: string): Promise<readonly Record<string, unknown>[]>;
  listEntries(input: PageQuery): Promise<PageResult<Record<string, unknown>>>;
  getEntry(entryId: string): Promise<Record<string, unknown> | null>;
  createEntry(input: CreateEntryInput): Promise<Record<string, unknown>>;
  postEntry(entryId: string): Promise<Record<string, unknown>>;
  reverseEntry(input: ReverseEntryInput): Promise<Record<string, unknown>>;
  voidDraft(entryId: string): Promise<Record<string, unknown>>;
  listAutoEntryRules(input: PageQuery): Promise<PageResult<Record<string, unknown>>>;
  getAutoEntryRule(ruleId: string): Promise<Record<string, unknown> | null>;
  createAutoEntryRule(input: AutoEntryRuleInput): Promise<Record<string, unknown>>;
  updateAutoEntryRule(input: AutoEntryRuleInput & { autoEntryId: string }): Promise<Record<string, unknown> | null>;
  deleteAutoEntryRule(ruleId: string): Promise<boolean>;
  listCustodyAdvances(input: PageQuery): Promise<PageResult<Record<string, unknown>>>;
}
export interface CreateEntryLineInput {
  accountId: string;
  accountCurNo: number;
  transType: FinancialTransactionType;
  amount: number;
  amountOriginal: number;
  currencyOriginalNo: number;
  currencyPriceId?: number | undefined;
  currencyPriceSeq?: number | undefined;
  accountCurrencyPriceId?: number | undefined;
  accountCurrencyPriceSeq?: number | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  paymentMethod?: FinancialPaymentMethod | undefined;
  orderId?: string | undefined;
  shipmentId?: string | undefined;
  custodyId?: string | undefined;
  description?: string | undefined;
  note?: string | undefined;
}
export interface CreateEntryInput {
  entryNumber?: string | undefined;
  moduleId: string;
  entryTypeId: string;
  entryCategory: FinancialEntryCategory;
  postingStatus: Exclude<FinancialPostingStatus, 'voided'>;
  description: string;
  notes?: string | undefined;
  attachments?: string[] | undefined;
  paymentMethod?: FinancialPaymentMethod | undefined;
  orderId?: string | undefined;
  shipmentId?: string | undefined;
  custodyId?: string | undefined;
  automationKey?: string | undefined;
  autoRuleId?: string | undefined;
  isAutomatic?: boolean | undefined;
  effectiveAt?: string | undefined;
  createdByUid: string;
  lines: readonly CreateEntryLineInput[];
}
export interface ReverseEntryInput {
  entryId: string;
  description: string;
  createdByUid: string;
  effectiveAt?: string | undefined;
}
export interface AutoEntryRuleInput {
  autoEntryId?: string | undefined;
  statusId?: number | undefined;
  statusNameAr?: string | undefined;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  amountSource: string;
  amountSources: readonly string[];
  amountStrategy: 'sum';
  currency?: string | undefined;
  currencyNo?: number | undefined;
  skipWhenZero: boolean;
  autoPost: boolean;
  debitAccount: string;
  creditAccount: string;
  descriptionTemplateAr: string;
  descriptionTemplateEn: string;
}
