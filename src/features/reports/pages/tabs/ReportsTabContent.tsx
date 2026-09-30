import React from 'react';
import FinancialOverviewReport from '../reports/FinancialOverviewReport';
import ExpensesReport from '../reports/ExpensesReport';
import PackagingReport from '../reports/PackagingReport';
import OrdersCostReport from '../reports/OrdersCostReport';
import ShippingCompaniesReport from '../reports/ShippingCompaniesReport';
import CustomersReport from '../reports/CustomersReport';
import CouriersReport from '../reports/CouriersReport';
import UsersReport from '../reports/UsersReport';
import AccountLedgerReport from '../reports/AccountLedgerReport';

export interface ReportsTabContentProps {
  activeReport: string;
  isAr: boolean;
  filteredData: any;
  reportMetrics: any;
  treasuryBalances: any;
  pnlData: any[];
  EXPENSE_CATEGORIES_DYNAMIC: any[];
  selectedExpenseCategory: string | null;
  setSelectedExpenseCategory: (category: string | null) => void;
  accountTransactions: any[];
  accounts: any[];
  ledgerMetrics: any;
  searchMatchList: (list: any[], keyField: string) => any[];
  convertToYER: (amount: number, currency: string) => number;
  convertCurrency: (amount: number, from: string, to: string) => number;
  selectedPackagingAccountIds: string[];
  setSelectedPackagingAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedOrdersCostAccountIds: string[];
  setSelectedOrdersCostAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedShippingCompaniesAccountIds: string[];
  setSelectedShippingCompaniesAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  selectedCourierId: string | null;
  setSelectedCourierId: (id: string | null) => void;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  handleSaveAccountSelection: (reportType: string) => void;
  MultiAccountSelectorComponent: React.ComponentType<any>;
}

/** Feature-local report tab composition. Business calculations remain in ReportsPage. */
export const ReportsTabContent: React.FC<ReportsTabContentProps> = ({
  activeReport,
  isAr,
  filteredData,
  reportMetrics,
  treasuryBalances,
  pnlData,
  EXPENSE_CATEGORIES_DYNAMIC,
  selectedExpenseCategory,
  setSelectedExpenseCategory,
  accountTransactions,
  accounts,
  ledgerMetrics,
  searchMatchList,
  convertToYER,
  convertCurrency,
  selectedPackagingAccountIds,
  setSelectedPackagingAccountIds,
  selectedOrdersCostAccountIds,
  setSelectedOrdersCostAccountIds,
  selectedShippingCompaniesAccountIds,
  setSelectedShippingCompaniesAccountIds,
  selectedOrderId,
  setSelectedOrderId,
  selectedCustomerId,
  setSelectedCustomerId,
  selectedCourierId,
  setSelectedCourierId,
  selectedCompanyId,
  setSelectedCompanyId,
  selectedUserId,
  setSelectedUserId,
  handleSaveAccountSelection,
  MultiAccountSelectorComponent,
}) => {
  switch (activeReport) {
    case 'financial_overview':
      return <FinancialOverviewReport isAr={isAr} reportMetrics={reportMetrics} treasuryBalances={treasuryBalances} pnlData={pnlData} filteredData={filteredData} />;
    case 'expenses':
      return <ExpensesReport isAr={isAr} filteredData={filteredData} selectedExpenseCategory={selectedExpenseCategory} setSelectedExpenseCategory={setSelectedExpenseCategory} EXPENSE_CATEGORIES_DYNAMIC={EXPENSE_CATEGORIES_DYNAMIC} reportMetrics={reportMetrics} accountTransactions={accountTransactions} accounts={accounts} searchMatchList={searchMatchList} convertToYER={convertToYER} />;
    case 'packaging':
      return <PackagingReport isAr={isAr} filteredData={filteredData} accounts={accounts} accountTransactions={accountTransactions} selectedPackagingAccountIds={selectedPackagingAccountIds} setSelectedPackagingAccountIds={setSelectedPackagingAccountIds} handleSaveAccountSelection={handleSaveAccountSelection} convertCurrency={convertCurrency} convertToYER={convertToYER} MultiAccountSelectorComponent={MultiAccountSelectorComponent} />;
    case 'orders_cost':
      return <OrdersCostReport isAr={isAr} filteredData={filteredData} accounts={accounts} accountTransactions={accountTransactions} selectedOrdersCostAccountIds={selectedOrdersCostAccountIds} setSelectedOrdersCostAccountIds={setSelectedOrdersCostAccountIds} selectedOrderId={selectedOrderId} setSelectedOrderId={setSelectedOrderId} handleSaveAccountSelection={handleSaveAccountSelection} convertCurrency={convertCurrency} convertToYER={convertToYER} searchMatchList={searchMatchList} MultiAccountSelectorComponent={MultiAccountSelectorComponent} />;
    case 'shipping_companies':
      return <ShippingCompaniesReport isAr={isAr} filteredData={filteredData} accounts={accounts} accountTransactions={accountTransactions} selectedShippingCompaniesAccountIds={selectedShippingCompaniesAccountIds} setSelectedShippingCompaniesAccountIds={setSelectedShippingCompaniesAccountIds} selectedCompanyId={selectedCompanyId} setSelectedCompanyId={setSelectedCompanyId} handleSaveAccountSelection={handleSaveAccountSelection} convertCurrency={convertCurrency} convertToYER={convertToYER} searchMatchList={searchMatchList} MultiAccountSelectorComponent={MultiAccountSelectorComponent} />;
    case 'customers':
      return <CustomersReport isAr={isAr} filteredData={filteredData} accounts={accounts} accountTransactions={accountTransactions} selectedCustomerId={selectedCustomerId} setSelectedCustomerId={setSelectedCustomerId} searchMatchList={searchMatchList} convertToYER={convertToYER} convertCurrency={convertCurrency} />;
    case 'couriers':
      return <CouriersReport isAr={isAr} filteredData={filteredData} accounts={accounts} accountTransactions={accountTransactions} selectedCourierId={selectedCourierId} setSelectedCourierId={setSelectedCourierId} searchMatchList={searchMatchList} convertToYER={convertToYER} />;
    case 'users':
      return <UsersReport isAr={isAr} filteredData={filteredData} accounts={accounts} accountTransactions={accountTransactions} selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} searchMatchList={searchMatchList} convertToYER={convertToYER} />;
    case 'account_ledger':
      return <AccountLedgerReport isAr={isAr} accounts={accounts} accountTransactions={accountTransactions} ledgerMetrics={ledgerMetrics} />;
    default:
      return null;
  }
};

export default ReportsTabContent;
