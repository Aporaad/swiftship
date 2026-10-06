import type { ReactNode } from 'react';

export interface FinanceAccountingEntity {
  id: string;
  deliveryCourierId?: string | null;
  shippingCourierId?: string | null;
  customerId?: string | null;
  accountId?: string | null;
  entityId?: string | null;
  financialCurrency?: string | null;
  orderStatus?: string | null;
  amountRemaining?: number | string | null;
  currency?: string | null;
}

export interface FinanceAccountingSettings {
  currency?: string;
}

export interface FinanceAccountingProps {
  orders: FinanceAccountingEntity[];
  couriers: FinanceAccountingEntity[];
  customers: FinanceAccountingEntity[];
  isAr: boolean;
  settings: FinanceAccountingSettings;
  initialTab?: string;
}

export type AccountingTab =
  | 'general_ledger'
  | 'portal_payment_review'
  | 'courier_audit'
  | 'customer_audit'
  | 'salary_history'
  | 'assets_management'
  | 'chart_of_accounts'
  | 'financial_accounts'
  | (string & {});

export type LedgerDateFilter = 'all' | 'today' | '7days' | '30days' | 'custom';
export type LedgerTypeFilter = 'all' | 'Debit' | 'Credit';
export type LedgerCurrencyFilter = 'all' | 'YER' | 'USD' | 'SAR';
export type AccountTypeFilter = 'all' | 'customer' | 'courier' | 'employee' | 'source' | 'shipping_company' | 'asset';
export type LedgerModuleFilter = 'all' | 'order' | 'custody' | 'payment' | 'salary' | 'adjustment';

export interface FinanceAccountingTabNavigationProps {
  accountingTab: string;
  isAr: boolean;
  onTabChange: (tab: AccountingTab) => void;
}

export interface FinanceAccountingTabShellProps {
  children: ReactNode;
}
