import type { AuditDto, IsoUtcString, NumericValue } from './common.dto';

export interface FinanceEntryDatabaseRow {
  main_entry_id: string;
  entry_number: string | null;
  module_id: string | null;
  entry_type_id: string | null;
  entry_category: string | null;
  posting_status: string | null;
  description: string | null;
  notes: string | null;
  attachments: string[] | null;
  payment_method: string | null;
  order_id: string | null;
  shipment_id: string | null;
  custody_id: string | null;
  automation_key: string | null;
  auto_rule_id: string | null;
  is_automatic: boolean;
  reverses_entry_id: string | null;
  effective_at: string | null;
  posted_at: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string | null;
  created_by_uid: string | null;
  updated_by_uid: string | null;
  posted_by_uid: string | null;
  voided_by_uid: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface AccountTransactionDatabaseRow {
  account_trans_id: string;
  main_entry_id: string;
  line_no: number;
  trans_type: string;
  account_id: string;
  account_cur_no: number | null;
  amount: NumericValue;
  amount_original: NumericValue | null;
  currency_original_no: number | null;
  currency_price_id: number | null;
  currency_price_seq: number | null;
  entity_type: string | null;
  entity_id: string | null;
  payment_method: string | null;
  order_id: string | null;
  shipment_id: string | null;
  custody_id: string | null;
  auto_rule_id: string | null;
  automation_key: string | null;
  description: string | null;
  note: string | null;
  created_at: string;
  updated_at: string | null;
  created_by_uid: string | null;
  updated_by_uid: string | null;
  conversion_rate: NumericValue | null;
  amount_original_text: string | null;
  account_currency_price_id: number | null;
  account_currency_price_seq: number | null;
  amount_text: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface EntryPaymentDetailDatabaseRow {
  entry_payment_detail_id: string;
  main_entry_id: string;
  allocation_no: number;
  payment_method: string;
  account_id: string | null;
  amount_original: NumericValue;
  currency_original_no: number | null;
  bank_reference: string | null;
  due_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string | null;
  created_by_uid: string | null;
  updated_by_uid: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface FinanceEntryLineDto {
  transactionId: string;
  lineNumber: number;
  direction: string;
  accountId: string;
  accountCurrencyId: number | null;
  amount: number;
  originalAmount: number | null;
  originalCurrencyId: number | null;
  conversionRate: number | null;
  entityType: string | null;
  entityId: string | null;
  paymentMethod: string | null;
  description: string | null;
  note: string | null;
}

export interface FinanceEntryPaymentDetailDto {
  paymentDetailId: string;
  allocationNumber: number;
  paymentMethod: string;
  accountId: string | null;
  originalAmount: number;
  originalCurrencyId: number | null;
  bankReference: string | null;
  dueAt: IsoUtcString | null;
  note: string | null;
}

export interface FinanceEntryApiDto {
  entryId: string;
  entryNumber: string | null;
  moduleId: string | null;
  entryTypeId: string | null;
  category: string | null;
  postingStatus: string | null;
  description: string | null;
  notes: string | null;
  attachments: string[];
  paymentMethod: string | null;
  orderId: string | null;
  shipmentId: string | null;
  custodyId: string | null;
  automationKey: string | null;
  autoRuleId: string | null;
  isAutomatic: boolean;
  reversesEntryId: string | null;
  effectiveAt: IsoUtcString | null;
  postedAt: IsoUtcString | null;
  voidedAt: IsoUtcString | null;
  postedByUserId: string | null;
  voidedByUserId: string | null;
  lines: FinanceEntryLineDto[];
  paymentDetails: FinanceEntryPaymentDetailDto[];
  createdAt: IsoUtcString;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface FinanceEntryCreateInput {
  moduleId: string;
  entryTypeId: string;
  category?: string | null;
  description?: string | null;
  notes?: string | null;
  attachments?: string[];
  paymentMethod?: string | null;
  orderId?: string | null;
  shipmentId?: string | null;
  custodyId?: string | null;
  effectiveAt?: IsoUtcString | null;
  lines: Array<Omit<FinanceEntryLineDto, 'transactionId'>>;
  paymentDetails?: Array<Omit<FinanceEntryPaymentDetailDto, 'paymentDetailId'>>;
}
export interface FinanceEntryUpdateInput {
  description?: string | null;
  notes?: string | null;
  attachments?: string[];
  effectiveAt?: IsoUtcString | null;
}
export type FinanceEntryViewModel = Partial<FinanceEntryApiDto> & Pick<FinanceEntryApiDto, 'entryId'> & { status?: string | null };
export type FinanceEntryAudit = AuditDto;
