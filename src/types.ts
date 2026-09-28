// مهم: يجب تحديد خصائص وحقول كل الكيانات التي بالنظام هنا 
// System Interface Definitions — Standard camelCase naming convention
export interface Customer {
  id: string;
  fullName: string;
  /** Normalized bilingual name columns; optional during the migration window. */
  nameAr?: string;
  nameEn?: string;
  /** Canonical financial relation; balances are derived from ledger entries. */
  accountId?: string;
  phone: string;
  email?: string;
  address?: string;
  gpsLocation?: string;
  notes?: string;
  financialBalance?: number;
  financialCurrency?: string;
  financialAccountCode?: string;
  financialAccountId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Courier {
  id: string;
  fullName: string;
  /** Normalized bilingual name columns; optional during the migration window. */
  nameAr?: string;
  nameEn?: string;
  /** Canonical financial relation; balances are derived from ledger entries. */
  accountId?: string;
  phone: string;
  email?: string;
  address?: string;
  gpsLocation?: string;
  disabled?: boolean;
  courierCustomId?: string;
  commissionRate?: number;
  notes?: string;
  courierType?: 'sourcing' | 'local';
  financialBalance?: number;
  financialCurrency?: string;
  financialAccountCode?: string;
  financialAccountId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  id?: string;
  date: number; // Date of transaction (timestamp)
  description: string;
  module: string;
  refNumber: string;
  amount: number;
  currency: string;
  amountOriginal?: number;
  currencyOriginal?: string;
  debitAccount: {
    id: string;
    code: string;
    name?: string;
  };
  creditAccount: {
    id: string;
    code: string;
    name?: string;
  };
  createdByName: string;
  createdByUid: string;
  orderId?: string;
  orderNumber?: string;
  shipmentId?: string;
  automationKey?: string;
  autoRuleId?: string;
  statusId?: number;
  isAutomatic?: boolean;
  amountSources?: string[];
  amountBreakdown?: Array<{ source: string; amount: number; currency: string; convertedAmount: number }>;
  attachments?: string[];
  notes?: string;
}
