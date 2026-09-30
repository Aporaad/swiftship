/**
 * Script to split ReportsPage.tsx into smaller focused files
 * سكريبت لتقسيم ReportsPage.tsx إلى ملفات أصغر ومركزة
 */

const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('src/features/reports/pages/ReportsPage.tsx', 'utf8');
const lines = content.split('\n');

// Helper: get section of lines (0-indexed, inclusive)
function getSection(start, end) {
  return lines.slice(start, end + 1).join('\n');
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. FinancialOverviewReport (lines 1743-1898, 0-indexed: 1742-1897)
// ══════════════════════════════════════════════════════════════════════════════
const finOvSection = getSection(1742, 1897);

const finOvFile = `/**
 * @file FinancialOverviewReport.tsx
 * @description تقرير التحليل المالي والأرباح العام
 * Financial overview report - P&L metrics, treasury balances, charts
 */

import React from 'react';
import { TrendingUp, ArrowDownLeft, CheckCircle2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { REPORT_COLORS } from '../types/reports.types';

// ألوان الرسوم البيانية
const COLORS = REPORT_COLORS;

interface FinancialOverviewReportProps {
  isAr: boolean;
  reportMetrics: {
    revenue: number;
    costs: number;
    profit: number;
    packagingCosts: number;
    operationalCosts: number;
    shippingCosts: number;
    salaryCosts: number;
  };
  treasuryBalances: {
    yer: { in: number; out: number; balance: number };
    usd: { in: number; out: number; balance: number };
    sar: { in: number; out: number; balance: number };
    combinedTotalYER: number;
  };
  pnlData: { name: string; value: number }[];
  filteredData: { orders: any[] };
}

// ─── FinancialOverviewReport Component ────────────────────────────────────
const FinancialOverviewReport: React.FC<FinancialOverviewReportProps> = ({
  isAr,
  reportMetrics,
  treasuryBalances,
  pnlData,
  filteredData
}) => {
  return (
${finOvSection}
  );
};

export default FinancialOverviewReport;
`;

fs.writeFileSync('src/features/reports/pages/reports/FinancialOverviewReport.tsx', finOvFile);
console.log('✅ Created FinancialOverviewReport.tsx');

// ══════════════════════════════════════════════════════════════════════════════
// 2. ExpensesReport (lines 1903-2109, 0-indexed: 1902-2108)
// ══════════════════════════════════════════════════════════════════════════════
const expSection = getSection(1902, 2108);

const expFile = `/**
 * @file ExpensesReport.tsx
 * @description تقرير المصروفات التفصيلي
 * Detailed expenses report with category breakdown and drilldown
 */

import React from 'react';
import { format } from 'date-fns';

interface ExpensesReportProps {
  isAr: boolean;
  filteredData: { expenses: any[]; orders: any[] };
  selectedExpenseCategory: string | null;
  setSelectedExpenseCategory: (cat: string | null) => void;
  EXPENSE_CATEGORIES_DYNAMIC: any[];
  reportMetrics: { costs: number };
  accountTransactions: any[];
  accounts: any[];
  searchMatchList: (list: any[], keyField: string) => any[];
  convertToYER: (amount: number, currency: string) => number;
}

// ─── ExpensesReport Component ───────────────────────────────────────────────
const ExpensesReport: React.FC<ExpensesReportProps> = ({
  isAr,
  filteredData,
  selectedExpenseCategory,
  setSelectedExpenseCategory,
  EXPENSE_CATEGORIES_DYNAMIC,
  reportMetrics,
  accountTransactions,
  accounts,
  searchMatchList,
  convertToYER
}) => {
  return (
${expSection}
  );
};

export default ExpensesReport;
`;

fs.writeFileSync('src/features/reports/pages/reports/ExpensesReport.tsx', expFile);
console.log('✅ Created ExpensesReport.tsx');

// ══════════════════════════════════════════════════════════════════════════════
// 3. PackagingReport (lines 2111-2529, 0-indexed: 2110-2528)
// ══════════════════════════════════════════════════════════════════════════════
const pkgSection = getSection(2110, 2528);

const pkgFile = `/**
 * @file PackagingReport.tsx
 * @description تقرير رسوم التغليف وتكاليف الشحن المحلي
 * Packaging fees and local shipping costs report
 */

import React from 'react';
import { format } from 'date-fns';

interface PackagingReportProps {
  isAr: boolean;
  filteredData: { orders: any[]; expenses: any[] };
  accounts: any[];
  accountTransactions: any[];
  selectedPackagingAccountIds: string[];
  setSelectedPackagingAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleSaveAccountSelection: (type: string) => void;
  convertCurrency: (amount: number, from: string, to: string) => number;
  convertToYER: (amount: number, currency: string) => number;
  MultiAccountSelectorComponent: React.ComponentType<any>;
}

// ─── PackagingReport Component ──────────────────────────────────────────────
const PackagingReport: React.FC<PackagingReportProps> = ({
  isAr,
  filteredData,
  accounts,
  accountTransactions,
  selectedPackagingAccountIds,
  setSelectedPackagingAccountIds,
  handleSaveAccountSelection,
  convertCurrency,
  convertToYER,
  MultiAccountSelectorComponent
}) => {
  return (
${pkgSection}
  );
};

export default PackagingReport;
`;

fs.writeFileSync('src/features/reports/pages/reports/PackagingReport.tsx', pkgFile);
console.log('✅ Created PackagingReport.tsx');

// ══════════════════════════════════════════════════════════════════════════════
// 4. AccountLedgerFirstSection (lines 2420-2529 is already included above)
// OrdersCostReport (lines 2531-2887, 0-indexed: 2530-2886)
// ══════════════════════════════════════════════════════════════════════════════
const ordersCostSection = getSection(2530, 2886);

const ordersCostFile = `/**
 * @file OrdersCostReport.tsx
 * @description تقرير تكاليف الطلبات والشحنات
 * Orders cost analysis report
 */

import React from 'react';
import { format } from 'date-fns';

interface OrdersCostReportProps {
  isAr: boolean;
  filteredData: { orders: any[] };
  accounts: any[];
  accountTransactions: any[];
  selectedOrdersCostAccountIds: string[];
  setSelectedOrdersCostAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  handleSaveAccountSelection: (type: string) => void;
  convertCurrency: (amount: number, from: string, to: string) => number;
  convertToYER: (amount: number, currency: string) => number;
  MultiAccountSelectorComponent: React.ComponentType<any>;
}

// ─── OrdersCostReport Component ─────────────────────────────────────────────
const OrdersCostReport: React.FC<OrdersCostReportProps> = ({
  isAr,
  filteredData,
  accounts,
  accountTransactions,
  selectedOrdersCostAccountIds,
  setSelectedOrdersCostAccountIds,
  selectedOrderId,
  setSelectedOrderId,
  handleSaveAccountSelection,
  convertCurrency,
  convertToYER,
  MultiAccountSelectorComponent
}) => {
  return (
${ordersCostSection}
  );
};

export default OrdersCostReport;
`;

fs.writeFileSync('src/features/reports/pages/reports/OrdersCostReport.tsx', ordersCostFile);
console.log('✅ Created OrdersCostReport.tsx');

// ══════════════════════════════════════════════════════════════════════════════
// 5. ShippingCompaniesReport (lines 2887-3108, 0-indexed: 2886-3107)
// ══════════════════════════════════════════════════════════════════════════════
const shippingSection = getSection(2886, 3107);

const shippingFile = `/**
 * @file ShippingCompaniesReport.tsx
 * @description تقرير شركات الشحن والعمولات
 * Shipping companies report with commissions and settlements
 */

import React from 'react';
import { format } from 'date-fns';

interface ShippingCompaniesReportProps {
  isAr: boolean;
  filteredData: { orders: any[]; shippingCompanies: any[] };
  accounts: any[];
  accountTransactions: any[];
  selectedShippingCompaniesAccountIds: string[];
  setSelectedShippingCompaniesAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  handleSaveAccountSelection: (type: string) => void;
  convertCurrency: (amount: number, from: string, to: string) => number;
  convertToYER: (amount: number, currency: string) => number;
  searchMatchList: (list: any[], key: string) => any[];
  MultiAccountSelectorComponent: React.ComponentType<any>;
}

// ─── ShippingCompaniesReport Component ─────────────────────────────────────
const ShippingCompaniesReport: React.FC<ShippingCompaniesReportProps> = ({
  isAr,
  filteredData,
  accounts,
  accountTransactions,
  selectedShippingCompaniesAccountIds,
  setSelectedShippingCompaniesAccountIds,
  selectedCompanyId,
  setSelectedCompanyId,
  handleSaveAccountSelection,
  convertCurrency,
  convertToYER,
  searchMatchList,
  MultiAccountSelectorComponent
}) => {
  return (
${shippingSection}
  );
};

export default ShippingCompaniesReport;
`;

fs.writeFileSync('src/features/reports/pages/reports/ShippingCompaniesReport.tsx', shippingFile);
console.log('✅ Created ShippingCompaniesReport.tsx');

// ══════════════════════════════════════════════════════════════════════════════
// 6. CustomersReport (lines 3108-3302, 0-indexed: 3107-3301)
// ══════════════════════════════════════════════════════════════════════════════
const custSection = getSection(3107, 3301);

const custFile = `/**
 * @file CustomersReport.tsx
 * @description تقرير كشف العملاء والذمم والمديونيات
 * Customers ledger and balances report
 */

import React from 'react';
import { format } from 'date-fns';

interface CustomersReportProps {
  isAr: boolean;
  filteredData: { customers: any[]; orders: any[] };
  accounts: any[];
  accountTransactions: any[];
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  searchMatchList: (list: any[], key: string) => any[];
  convertToYER: (amount: number, currency: string) => number;
}

// ─── CustomersReport Component ──────────────────────────────────────────────
const CustomersReport: React.FC<CustomersReportProps> = ({
  isAr,
  filteredData,
  accounts,
  accountTransactions,
  selectedCustomerId,
  setSelectedCustomerId,
  searchMatchList,
  convertToYER
}) => {
  return (
${custSection}
  );
};

export default CustomersReport;
`;

fs.writeFileSync('src/features/reports/pages/reports/CustomersReport.tsx', custFile);
console.log('✅ Created CustomersReport.tsx');

// ══════════════════════════════════════════════════════════════════════════════
// 7. CouriersReport (lines 3302-3513, 0-indexed: 3301-3512)
// ══════════════════════════════════════════════════════════════════════════════
const courSection = getSection(3301, 3512);

const courFile = `/**
 * @file CouriersReport.tsx
 * @description تقرير المناديب والتحصيلات والعهدة المعلقة
 * Couriers registry and outstanding custody report
 */

import React from 'react';
import { format } from 'date-fns';

interface CouriersReportProps {
  isAr: boolean;
  filteredData: { couriers: any[]; orders: any[] };
  accounts: any[];
  accountTransactions: any[];
  selectedCourierId: string | null;
  setSelectedCourierId: (id: string | null) => void;
  searchMatchList: (list: any[], key: string) => any[];
  convertToYER: (amount: number, currency: string) => number;
}

// ─── CouriersReport Component ───────────────────────────────────────────────
const CouriersReport: React.FC<CouriersReportProps> = ({
  isAr,
  filteredData,
  accounts,
  accountTransactions,
  selectedCourierId,
  setSelectedCourierId,
  searchMatchList,
  convertToYER
}) => {
  return (
${courSection}
  );
};

export default CouriersReport;
`;

fs.writeFileSync('src/features/reports/pages/reports/CouriersReport.tsx', courFile);
console.log('✅ Created CouriersReport.tsx');

// ══════════════════════════════════════════════════════════════════════════════
// 8. UsersReport (lines 3513-3644, 0-indexed: 3512-3643)
// ══════════════════════════════════════════════════════════════════════════════
const usersSection = getSection(3512, 3643);

const usersFile = `/**
 * @file UsersReport.tsx
 * @description تقرير حسابات المستخدمين والرواتب
 * Users accounts and salaries report
 */

import React from 'react';
import { format } from 'date-fns';

interface UsersReportProps {
  isAr: boolean;
  filteredData: { users: any[]; orders: any[] };
  accounts: any[];
  accountTransactions: any[];
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  searchMatchList: (list: any[], key: string) => any[];
  convertToYER: (amount: number, currency: string) => number;
}

// ─── UsersReport Component ──────────────────────────────────────────────────
const UsersReport: React.FC<UsersReportProps> = ({
  isAr,
  filteredData,
  accounts,
  accountTransactions,
  selectedUserId,
  setSelectedUserId,
  searchMatchList,
  convertToYER
}) => {
  return (
${usersSection}
  );
};

export default UsersReport;
`;

fs.writeFileSync('src/features/reports/pages/reports/UsersReport.tsx', usersFile);
console.log('✅ Created UsersReport.tsx');

// ══════════════════════════════════════════════════════════════════════════════
// 9. AccountLedgerReport (lines 3646-4382, 0-indexed: 3645-4381)
// ══════════════════════════════════════════════════════════════════════════════
const ledgerSection = getSection(3645, 4381);

const ledgerFile = `/**
 * @file AccountLedgerReport.tsx
 * @description تقرير تفصيلي لأي حساب (شجرة الحسابات)
 * Detailed account ledger report with running balance calculation
 */

import React from 'react';
import { format } from 'date-fns';
import { Layers } from 'lucide-react';

interface AccountLedgerReportProps {
  isAr: boolean;
  accounts: any[];
  filters: any;
  accountTransactions: any[];
  ledgerMetrics: any | null;
  handleExportExcel: () => void;
  triggerNativePrint: () => void;
  isPreviewModalOpen: boolean;
  setIsPreviewModalOpen: (open: boolean) => void;
}

// ─── AccountLedgerReport Component ─────────────────────────────────────────
const AccountLedgerReport: React.FC<AccountLedgerReportProps> = ({
  isAr,
  accounts,
  filters,
  accountTransactions,
  ledgerMetrics,
  handleExportExcel,
  triggerNativePrint,
  isPreviewModalOpen,
  setIsPreviewModalOpen
}) => {
  return (
${ledgerSection}
  );
};

export default AccountLedgerReport;
`;

fs.writeFileSync('src/features/reports/pages/reports/AccountLedgerReport.tsx', ledgerFile);
console.log('✅ Created AccountLedgerReport.tsx');

console.log('\n✅ All report files created successfully!');
console.log('Files created in: src/features/reports/pages/reports/');
