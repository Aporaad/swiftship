import type { AuditDto, IsoUtcString, NumericValue } from './common.dto';
import type { CurrencyCode, OriginalAmount } from '../../shared/contracts/value-primitives';

export interface AccountingDatabaseRow {
  account_id: string;
  account_code: string | null;
  currency: string | null;
  entity_id: string | null;
  type: string;
  acc_sub_id: string | null;
  group_id: string | null;
  entity_type: string | null;
  account_seq: number | null;
  acc_name_ar: string | null;
  acc_name_en: string | null;
  limited_balance: NumericValue;
  cur_no: number | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  last_recalculated_at: string | null;
  balance: NumericValue;
  account_number: string | null;
  account_prefix: string | null;
  entity_name: string | null;
  debit_total: NumericValue;
  credit_total: NumericValue;
  parent_code: string | null;
  notes: string | null;
  monthly_salary: NumericValue | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface AccountHierarchyDatabaseRow {
  account_id?: string;
  acc_main_id?: string;
  acc_sub_id?: string;
  acc_sub_group_id?: string;
  account_code: string | null;
  acc_name_ar: string | null;
  acc_name_en: string | null;
  balance: NumericValue;
  cur_no: number | null;
  is_active: boolean;
  allows_direct_accounts?: boolean;
  entity_type?: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface CurrencyDatabaseRow {
  cur_id: number;
  code: string;
  main_name_ar: string | null;
  sub_name_ar: string | null;
  main_name_en: string | null;
  sub_name_en: string | null;
  is_default: boolean;
  created_at: string | null;
  is_active: boolean;
  symbol: string | null;
  flag: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface CurrencyPriceDatabaseRow {
  cur_price_id: number;
  cur_no: number;
  price: NumericValue;
  day_date: string;
  seq: number | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
}

export interface DefaultAccountDatabaseRow {
  default_account_id: string;
  default_key: string;
  account_id: string;
  acc_name_ar: string | null;
  acc_name_en: string | null;
  cur_no: number | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface CustodyAdvanceDatabaseRow {
  custody_advance_id: string;
  custody_number: string | null;
  recipient_type: string;
  recipient_id: string;
  recipient_name: string | null;
  recipient_account_id: string | null;
  amount_original: NumericValue;
  currency_original_no: number | null;
  currency_price_id: number | null;
  currency_price_seq: number | null;
  amount_settled: NumericValue;
  amount_outstanding: NumericValue;
  status: string;
  issued_entry_id: string | null;
  settlement_entry_id: string | null;
  note: string | null;
  issued_at: string | null;
  issued_by_uid: string | null;
  settled_at: string | null;
  settled_by_uid: string | null;
  created_at: string;
  updated_at: string | null;
  created_by_uid: string | null;
  updated_by_uid: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface AccountingApiDto {
  accountId: string;
  accountCode: string | null;
  accountNumber: string | null;
  accountPrefix: string | null;
  nameAr: string | null;
  nameEn: string | null;
  type: string;
  entityId: string | null;
  entityType: string | null;
  entityName: string | null;
  parentCode: string | null;
  subAccountId: string | null;
  groupId: string | null;
  sequence: number | null;
  currencyId: number | null;
  currencyCode: CurrencyCode | null;
  balance: number;
  debitTotal: number;
  creditTotal: number;
  limitedBalance: number;
  monthlySalary: number | null;
  isActive: boolean;
  notes: string | null;
  lastRecalculatedAt: IsoUtcString | null;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CurrencyApiDto {
  currencyId: number;
  code: CurrencyCode;
  nameAr: string | null;
  subNameAr: string | null;
  nameEn: string | null;
  subNameEn: string | null;
  symbol: string | null;
  flag: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
}

export interface CurrencyPriceApiDto {
  priceId: number;
  currencyId: number;
  price: number;
  dayDate: IsoUtcString;
  sequence: number | null;
}

export interface CustodyAdvanceApiDto {
  custodyAdvanceId: string;
  custodyNumber: string | null;
  recipientType: string;
  recipientId: string;
  recipientName: string | null;
  recipientAccountId: string | null;
  amountOriginal: OriginalAmount;
  currencyOriginalId: number | null;
  amountSettled: OriginalAmount;
  amountOutstanding: OriginalAmount;
  status: string;
  issuedEntryId: string | null;
  settlementEntryId: string | null;
  note: string | null;
  issuedAt: IsoUtcString | null;
  issuedByUserId: string | null;
  settledAt: IsoUtcString | null;
  settledByUserId: string | null;
  createdAt: IsoUtcString;
  updatedAt: IsoUtcString | null;
}

export interface AccountingCreateInput {
  accountCode: string;
  nameAr: string;
  nameEn?: string | null;
  type: string;
  currencyId?: number | null;
  parentCode?: string | null;
  subAccountId?: string | null;
  groupId?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  limitedBalance?: number;
  notes?: string | null;
}
export type AccountingUpdateInput = Partial<AccountingCreateInput> & { isActive?: boolean };
export type AccountingViewModel = Partial<AccountingApiDto> & Pick<AccountingApiDto, 'accountId'>;
export type AccountingAudit = AuditDto;
