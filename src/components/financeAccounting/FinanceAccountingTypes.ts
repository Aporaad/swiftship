import type { ReactNode } from 'react';

export interface FinanceAccountingProps {
  orders: any[];
  couriers: any[];
  customers: any[];
  isAr: boolean;
  settings: any;
  initialTab?: string;
}

export type AccountingTab =
  | 'general_ledger'
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
