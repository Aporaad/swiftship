import React, { useState, useMemo, useEffect } from 'react';
const numericValue = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface FinanceEntryState {
  refNumber?: string;
  module?: string;
  title?: string;
  [key: string]: unknown;
}

import { CurrencySelect } from './common/CurrencySelect';
import {
  FileText, Search, CreditCard, ShieldAlert, CheckCircle, Wallet, ArrowUpRight,
  ArrowDownLeft, HelpCircle, User, Truck, Calendar, Printer, Download, Star, ExternalLink,
  DollarSign, Activity, FileSpreadsheet, PlusCircle, Scale, Receipt, Sparkles, TrendingUp, RefreshCw, X,
  FolderTree, Wrench, Users, Coins, UserCheck, Eye, ChevronDown, ChevronUp, Edit2, Lock, Trash2, ArrowRightLeft
} from 'lucide-react';
import { db } from '../data/legacy/legacy-adapter';
import { useAuthSession } from '../features/auth/AuthSessionProvider';
import { collection, doc, updateDoc, writeBatch, deleteDoc, query, orderBy, increment, getDocs, where } from '../data/legacy/legacy-adapter';
import { notificationService } from '../services/notificationService';
import AccountingHierarchyManagement from './AccountingHierarchyManagement';
import AssetsPortfolio from './AssetsPortfolio';
import OrderStatusManagementTab from './OrderStatusManagementTab';
import { financialAccountService } from '../services/financialAccountService';
import { accountingHierarchyService } from '../services/accountingHierarchyService';
import { useRole } from '../hooks/useRole';
import { formatDate, formatDateTime, now } from '../lib/dateUtils';

import { useExchangeRates } from '../hooks/useExchangeRates';
import type { FinanceAccountingProps } from './financeAccounting/FinanceAccountingTypes';
import FinanceAccountingTabNavigation from './financeAccounting/FinanceAccountingTabNavigation';
import FinanceAccountingTabPanel from './financeAccounting/FinanceAccountingTabPanel';
import CourierAuditTab from './finance/CourierAuditTab';
import CustomerAuditTab from './finance/CustomerAuditTab';
import FinancialAccountsTab from './finance/FinancialAccountsTab';
import SalariesHistoryTab from './finance/SalariesHistoryTab';
import GeneralLedgerTab from './finance/GeneralLedgerTab';
import LedgerEntryPreview from './finance/LedgerEntryPreview';
import SalaryVoucherModal from './finance/SalaryVoucherModal';
import ManualJournalAdjustmentModal from './finance/ManualJournalAdjustmentModal';
import CustomerFifoPaymentModal from './finance/CustomerFifoPaymentModal';
import { useFinanceAccountingData } from './financeAccounting/useFinanceAccountingData';
import { useFinanceAccountingSelectors } from './financeAccounting/useFinanceAccountingSelectors';
import { createFinanceAccountingMainEntryActions } from './financeAccounting/financeAccountingMainEntryActions';
import { createFinanceAccountingCourierActions } from './financeAccounting/financeAccountingCourierActions';
import { createFinanceAccountingLedgerActions } from './financeAccounting/financeAccountingLedgerActions';

export default function FinanceAccounting({
  orders,
  couriers,
  customers,
  isAr,
  settings,
  initialTab = 'general_ledger'
}: FinanceAccountingProps) {
  const { user: currentUser } = useAuthSession();
  const [accountingTab, setAccountingTab] = useState<string>(initialTab);
  const { activeCurrencies, rates: dbRates } = useExchangeRates();

  // Selected order details drawer state
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<FinanceEntryState | null>(null);

  const formatAmountWithEquiv = (amount: number, currency: string) => {
    const formatted = `${amount.toLocaleString()} ${currency}`;
    if (currency !== 'YER') {
      const rate = dbRates[currency] || 1;
      const yerEquiv = amount * rate;
      return `${formatted} (≈ ${Math.round(yerEquiv).toLocaleString()} YER)`;
    }
    return formatted;
  };

  const formatCurrencyWithYerEquiv = (amount: number, currency: string) => {
    return formatAmountWithEquiv(amount || 0, currency || 'YER');
  };

  const {
    assets,
    financialAccounts,
    custodyAdvances,
    accountTransactions,
    financialEntries,
    salaryHistory,
    employees,
  } = useFinanceAccountingData();

  const normalizedCustodyAdvances = useMemo(() => custodyAdvances.map((row) => ({
    ...row,
    recipientId: row.recipientId ?? row.recipient_id,
    recipientName: row.recipientName ?? row.recipient_name,
    recipientAccountId: row.recipientAccountId ?? row.recipient_account_id,
    amount: Number(row.amountOriginal ?? row.amount_original ?? 0),
    currency: row.currency ?? 'YER',
    status: String(row.status ?? '').toLowerCase() === 'settled' ? 'Settled' : row.status,
    expenseNumber: row.custodyNumber ?? row.custody_number ?? row.id,
  })), [custodyAdvances]);
  const postingFinancialAccounts = useMemo(
    () => accountingHierarchyService.filterPostingAccounts(financialAccounts),
    [financialAccounts],
  );
  const { role, hasPermission } = useRole();
  const canEditFinance = role === 'Admin' || hasPermission('edit_finance');

  // New states for Unified Ledger and Salary Audits
  const [moduleFilter, setModuleFilter] = useState<'all' | 'order' | 'custody' | 'payment' | 'salary' | 'adjustment'>('all');
  const [isSalaryPayment, setIsSalaryPayment] = useState(false);
  const [adjustSalaryMonth, setAdjustSalaryMonth] = useState('');
  const [bulkReconciliationLoading, setBulkReconciliationLoading] = useState(false);

  // ── Salary History tab states ──
  const [salarySearch, setSalarySearch] = useState('');
  const [salaryEmployeeFilter, setSalaryEmployeeFilter] = useState('all');
  const [salaryMonthFilter, setSalaryMonthFilter] = useState('');
  const [selectedSalaryVoucher, setSelectedSalaryVoucher] = useState<Record<string, unknown> | null>(null);
  // Employee Statement sub-view
  const [employeeStatementId, setEmployeeStatementId] = useState<string | null>(null);
  const [empStmtDateFilter, setEmpStmtDateFilter] = useState<'all' | '30days' | 'custom'>('all');
  const [empStmtStartDate, setEmpStmtStartDate] = useState('');
  const [empStmtEndDate, setEmpStmtEndDate] = useState('');

  // Edit Main Entry State
  const [isEditJournalOpen, setIsEditJournalOpen] = useState(false);
  const [selectedEditEntry, setSelectedEditEntry] = useState<FinanceEntryState | null>(null);
  const [editJournalLoading, setEditJournalLoading] = useState(false);
  const [editJournalData, setEditJournalData] = useState({
    amountOriginal: '',
    currencyOriginal: 'YER',
    notes: '',
    createdAt: '',
    debitAccountId: '',
    creditAccountId: ''
  });

  // Delete Entry with PIN Modal State
  const [isDeletePinModalOpen, setIsDeletePinModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<FinanceEntryState | null>(null);
  const [deletePin, setDeletePin] = useState('');
  const [deletePinError, setDeletePinError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    // Default adjustSalaryMonth to current month YYYY-MM
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    setAdjustSalaryMonth(`${YYYY}-${MM}`);
  }, []);

  // Selection states
  const [auditedCourierId, setAuditedCourierId] = useState('');
  const [auditedCustomerId, setAuditedCustomerId] = useState('');
  const [searchLedgerQuery, setSearchLedgerQuery] = useState('');

  // Financial Accounts dashboard filter states
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'customer' | 'courier' | 'employee' | 'source' | 'shipping_company' | 'asset'>('all');
  const [searchAccountQuery, setSearchAccountQuery] = useState('');

  // Filtering ledger states
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Debit' | 'Credit'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'YER' | 'USD' | 'SAR'>('all');
  const [selectedLedgerEntry, setSelectedLedgerEntry] = useState<FinanceEntryState | null>(null);

  // Target sub-account selection state for manual adjustment modal
  const [targetType, setTargetType] = useState<'general' | 'customer' | 'courier' | 'employee' | 'system' | string>('general');

  // NEW: Double-Entry Manual Adjustment States
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [targetSearchQuery, setTargetSearchQuery] = useState('');
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);

  // Quick manual adjustment voucher modal state
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustData, setAdjustData] = useState({
    type: 'Debit', // Debit = Cash Inflow, Credit = Cash Outflow
    amount: '',
    currency: 'YER',
    title: '',
    recipientName: '',
    notes: ''
  });
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Quick Customer FIFO Settle payment state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  // Print modal state
  const [printData, setPrintData] = useState<Record<string, unknown> | null>(null);

  // Currency utility converter
  const convertToYER = (amount: number, currency: string) => {
    const amt = parseFloat(String(amount || 0));
    if (!currency || currency === 'YER') return amt;
    const rate = dbRates[currency] || 1;
    return amt * rate;
  };

  const {
    vehiclesTotal,
    scannersTotal,
    officeAssetsTotal,
    ledgerEntries,
    filteredLedgerEntries,
    filteredAccountsList,
    vaultBalances,
    financialTrialMetrics,
  } = useFinanceAccountingSelectors({
    assets,
    financialAccounts,
    accountTransactions,
    financialEntries,
    couriers,
    isAr,
    settings,
    dbRates,
    searchLedgerQuery,
    typeFilter,
    currencyFilter,
    dateFilter,
    customStartDate,
    customEndDate,
    moduleFilter,
    accountTypeFilter,
    searchAccountQuery,
  });

  // 2. Individual Courier Custody & Deliveries Auditor
  const courierAuditSheet = useMemo(() => {
    if (!auditedCourierId) return null;
    const cour = couriers.find(c => c.id === auditedCourierId);
    if (!cour) return null;

    // Custodies assigned
    const courierExpenses = normalizedCustodyAdvances.filter(e => e.recipientId === auditedCourierId);

    // Shipments handled
    const courierOrders = orders.filter(o => o.deliveryCourierId === auditedCourierId || o.shippingCourierId === auditedCourierId);

    const linkedAccount = financialAccounts.find(a => a.id === cour.accountId || a.entityId === cour.accountId);
    const currency = linkedAccount?.currency || cour.financialCurrency || 'YER';

    const totalCustodyIssued = courierExpenses.reduce((sum, exp) => sum + convertToYER(exp.amount || 0, exp.currency), 0);
    const totalCustodySettled = courierExpenses.filter(e => e.status === 'Settled').reduce((sum, exp) => sum + convertToYER(exp.amount || 0, exp.currency), 0);
    const netLiableBalance = totalCustodyIssued - totalCustodySettled;

    // Calculation for dynamic physical COD cash holdings
    const currentUnremittedCargoCash = orders
      .filter(o => o.deliveryCourierId === auditedCourierId && (o.orderStatus === 'تم التسليم' || o.orderStatus === 'Delivered') && numericValue(o.amountRemaining) > 0);

    const totalUnremittedCashValue = currentUnremittedCargoCash.reduce((sum, o) => sum + numericValue(o.amountRemaining), 0);
    const totalUnremittedCashValueInTargetCurrency = currency === 'SAR' ? totalUnremittedCashValue / (dbRates.SAR || 1) : totalUnremittedCashValue;

    const totalOrdersDelivered = courierOrders.filter(o => o.orderStatus === 'تم التسليم' || o.orderStatus === 'Delivered').length;
    const successRate = courierOrders.length > 0
      ? Math.round((totalOrdersDelivered / courierOrders.length) * 100)
      : 0;

    return {
      courier: cour,
      custodies: courierExpenses,
      ordersHandled: courierOrders,
      totalCustodyIssued,
      totalCustodySettled,
      netLiableBalance,
      currentUnremittedCargoCash,
      totalUnremittedCashValue,
      totalUnremittedCashValueInTargetCurrency,
      totalOrdersDelivered,
      successRate,
      currency
    };
  }, [auditedCourierId, couriers, normalizedCustodyAdvances, orders, settings, financialAccounts]);

  // Courier transactions list
  const courierTransactions = useMemo(() => {
    if (!auditedCourierId) return [];
    const filtered = accountTransactions
      .filter(tx => tx.entityType === 'courier' && tx.entityId === auditedCourierId);

    return filtered.map(tx => {
      let type = tx.type || 'Debit';
      let title = tx.description || tx.module || '';

      if (tx.module === 'custody') {
        const isSettlement = (tx.description || '').includes('تسوية') ||
          (tx.description || '').includes('سداد') ||
          (tx.description || '').toLowerCase().includes('settle');
        if (isSettlement) {
          type = 'Credit';
          title = isAr ? 'تسوية وسداد عهدة مالية' : 'Custody Settlement / Return';
        } else {
          type = 'Debit';
          title = isAr ? 'تسليم عهدة مالية للمندوب' : 'Custody Handed Over';
        }
      } else if (tx.module === 'order') {
        if (tx.type === 'Debit') {
          title = isAr ? 'تحصيل قيمة شحنة (كاش بعهدة المندوب)' : 'Collected COD Cargo Cash';
        } else {
          title = isAr ? 'أجور توصيل وعمولة المندوب للطلب' : 'Earned Courier Delivery Commission';
        }
      } else if (tx.module === 'expense') {
        type = 'Credit';
        title = isAr ? 'مصروف تشغيلي / أجور مسددة' : 'Operating Expense / Disbursed';
      } else if (tx.module === 'wage' || tx.module === 'salary_payment') {
        type = 'Credit';
        title = isAr ? 'صرف راتب أو مستحقات الموظف' : 'Salary / Wages Paid';
      }

      return {
        ...tx,
        type,
        normalizedDescription: title
      };
    }).sort((a, b) => numericValue(b.createdAt) - numericValue(a.createdAt));
  }, [auditedCourierId, accountTransactions, isAr]);

  // Bulk Settle Courier's outstanding physical delivery receipts of COD cargo
  const [cargoRemitLoading, setCargoRemitLoading] = useState(false);

  // 3. Bilateral Customer Statement of Account Ledger (Standard matching sub-ledger using account_trans)
  const customerLedgerDetails = useMemo(() => {
    if (!auditedCustomerId) return null;
    const cust = customers.find(c => c.id === auditedCustomerId);
    if (!cust) return null;

    const customerTx = accountTransactions.filter(tx => tx.entityType === 'customer' && tx.entityId === auditedCustomerId);
    const sortedTx = [...customerTx].sort((a, b) => numericValue(a.createdAt) - numericValue(b.createdAt));

    const rows: Array<Record<string, unknown>> = [];
    let cumulativeBalance = 0; // Cumulative customer debt (YER)

    sortedTx.forEach(tx => {
      const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
      const isDebit = tx.type === 'Debit';
      const amt = tx.amount || 0;

      if (isDebit) {
        cumulativeBalance += numericValue(amt);
      } else {
        cumulativeBalance -= numericValue(amt);
      }

      rows.push({
        id: tx.id || `TX-${Math.random()}`,
        date,
        ref: tx.refNumber || 'TX',
        description: tx.description || (isDebit ? (isAr ? 'قيد مدين' : 'Debit Entry') : (isAr ? 'قيد دائن' : 'Credit Entry')),
        debit: isDebit ? amt : 0,
        credit: !isDebit ? amt : 0,
        balance: cumulativeBalance,
        amountOriginal: tx.amountOriginal || amt,
        currencyOriginal: tx.currencyOriginal || tx.currency || (settings.currency || 'YER')
      });
    });

    // Reversed for display (newest events first)
    const reversedRows = [...rows].reverse();

    const grossFreightValuation = sortedTx.filter(t => t.type === 'Debit').reduce((sum, t) => sum + numericValue(t.amount), 0);
    const netPaidRevenues = sortedTx.filter(t => t.type === 'Credit').reduce((sum, t) => sum + numericValue(t.amount), 0);
    const outstandingDebits = cumulativeBalance > 0 ? cumulativeBalance : 0;

    return {
      customer: cust,
      orders: orders.filter(o => o.customerId === auditedCustomerId),
      accountingTimeline: reversedRows,
      grossFreightValuation,
      netPaidRevenues,
      outstandingDebits,
      currentOutstandingBalance: cumulativeBalance
    };
  }, [auditedCustomerId, customers, accountTransactions, orders, isAr]);

  // Domain actions live outside the page shell; behavior remains in their original handlers.
  const { handleEditJournalSubmit, handleDeleteJournalSubmit, handleAddAdjustment, handleCustomerFIFOPayment } = createFinanceAccountingMainEntryActions({ adjustData, adjustLoading, adjustSalaryMonth, auditedCustomerId, collection, currentUser, customerLedgerDetails, db, dbRates, deletePin, doc, editJournalData, employees, entryToDelete, financialAccountService, getDocs, isAr, isSalaryPayment, notificationService, orders, payAmount, payLoading, payNotes, postingFinancialAccounts, query, selectedEditEntry, setAdjustData, setAdjustLoading, setDeleteLoading, setDeletePin, setDeletePinError, setEditJournalLoading, setEntryToDelete, setIsAdjustmentModalOpen, setIsDeletePinModalOpen, setIsEditJournalOpen, setIsPayModalOpen, setIsSalaryPayment, setPayAmount, setPayLoading, setPayNotes, setSelectedEditEntry, setSourceAccountId, setTargetAccountId, setTargetType, settings, sourceAccountId, targetAccountId, targetType, where, writeBatch });
  const { handleFullCourierReconciliation, handleBulkRemitCourierCash, handleDirectSettleCustody } = createFinanceAccountingCourierActions({ courierAuditSheet, currentUser, db, dbRates, doc, financialAccountService, isAr, notificationService, setBulkReconciliationLoading, setCargoRemitLoading, settings, updateDoc, writeBatch });
  const { exportLedgerToCSV, triggerPrint } = createFinanceAccountingLedgerActions({ currentUser, filteredLedgerEntries, formatDate, formatDateTime, isAr });

return (
    <div className="space-y-6 pt-2 animate-fade-in text-start">

      {/* 4 Cards Quick Financial Dashboard Summary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* Card 1: Cash Box Vaults */}
        <div className="bg-black/40 backdrop-blur-md border border-slate-850 p-5 rounded-3xl relative overflow-hidden group hover:border-[#d4af37]/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-bl-full filter blur-xl group-hover:bg-[#d4af37]/10 transition-all pointer-events-none" />
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-[#d4af37]/10 rounded-2xl border border-[#d4af37]/25 text-[#d4af37]">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">{isAr ? 'خزينة الريال اليمني YER' : 'YER Safe-Box'}</span>
          </div>
          <p className="text-xl font-mono font-black text-white leading-tight">
            {vaultBalances.yer.balance.toLocaleString()} YER
          </p>
          <div className="mt-3 pt-2.5 border-t border-slate-850/60 flex justify-between items-center text-[9px] text-slate-500">
            <span>{isAr ? 'وارد:' : 'In:'} <span className="text-emerald-400 font-bold font-mono">+{vaultBalances.yer.in.toLocaleString()}</span></span>
            <span>{isAr ? 'صادر:' : 'Out:'} <span className="text-rose-400 font-bold font-mono">-{vaultBalances.yer.out.toLocaleString()}</span></span>
          </div>
        </div>

        {/* Card 2: Foreign Cash Boxes Vault */}
        <div className="bg-black/40 backdrop-blur-md border border-slate-850 p-5 rounded-3xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-bl-full filter blur-xl group-hover:bg-cyan-500/10 transition-all pointer-events-none" />
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-cyan-500/10 rounded-2xl border border-cyan-500/25 text-cyan-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">{isAr ? 'العملات الأجنبية المحفوظة' : 'Remittance forex'}</span>
          </div>
          <div className="space-y-1 font-mono text-xs font-black text-slate-200">
            <p className="flex justify-between">
              <span>{isAr ? 'الموازي بالدولار USD:' : 'USD Equivalent:'}</span>
              <span className="text-white">${vaultBalances.usd.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </p>
            <p className="flex justify-between">
              <span>{isAr ? 'الموازي بالسعودي SAR:' : 'SAR Equivalent:'}</span>
              <span className="text-white">{vaultBalances.sar.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</span>
            </p>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-slate-850/60 flex justify-between text-[9px] text-[#d4af37] font-bold">
            <span>{isAr ? 'إجمالي رصيد الخزينة (YER):' : 'Total Treasury (YER):'}</span>
            <span>{vaultBalances.yer.balance.toLocaleString()} YER</span>
          </div>
        </div>

        {/* Card 3: Outstanding Customer Debt Receivables */}
        <div className="bg-black/40 backdrop-blur-md border border-slate-850 p-5 rounded-3xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full filter blur-xl pointer-events-none" />
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-amber-500/10 rounded-2xl border border-amber-500/25 text-amber-500">
              <CheckCircle className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">{isAr ? 'ديون وذمم العملاء' : 'Direct Receivables'}</span>
          </div>
          <p className="text-xl font-mono font-black text-amber-500 leading-tight">
            {financialTrialMetrics.netReceivables.toLocaleString()} YER
          </p>
          <p className="text-[9px] text-slate-550 mt-2.5 leading-snug">
            {isAr ? 'مستحقات الشحنات غير الخالصة المجدولة للتحصيل بالخزينة.' : 'Cargo dues scheduled to collect from deliverable buyers.'}
          </p>
        </div>

        {/* Card 4: Operating Net Margin / Estimated profit */}
        <div className="bg-black/40 backdrop-blur-md border border-[#d4af37]/15 p-5 rounded-3xl relative overflow-hidden group hover:border-[#d4af37]/45 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/1 w-32 h-32 rounded-bl-full filter blur-xl pointer-events-none" />
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 bg-emerald-500/10 rounded-2xl border border-emerald-500/25 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-550 font-black uppercase tracking-wider">{isAr ? 'العائد الصافي التشغيلي' : 'Treasury Balance Net'}</span>
          </div>
          <p className="text-xl font-mono font-black text-emerald-400 leading-tight">
            {financialTrialMetrics.netProfit.toLocaleString()} YER
          </p>
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-bold">
            <span>{isAr ? 'الهامش الربحي المتوقع:' : 'Net margin rate:'}</span>
            <span className="text-[#d4af37] bg-amber-950/20 px-2 py-0.5 rounded-md font-mono">{financialTrialMetrics.operatingMargin}%</span>
          </div>
        </div>

      </div>

      <FinanceAccountingTabNavigation
        accountingTab={accountingTab}
        isAr={isAr}
        onTabChange={setAccountingTab}
      />
      {/* RENDER TAB 1: GENERAL DOUBLE-ENTRY LEDGER */}
      {accountingTab === 'general_ledger' && (
        <GeneralLedgerTab
          isAr={isAr}
          exportLedgerToCSV={exportLedgerToCSV}
          triggerPrint={triggerPrint}
          setIsAdjustmentModalOpen={setIsAdjustmentModalOpen}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          moduleFilter={moduleFilter}
          setModuleFilter={setModuleFilter}
          currencyFilter={currencyFilter}
          setCurrencyFilter={setCurrencyFilter}
          activeCurrencies={activeCurrencies}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          searchLedgerQuery={searchLedgerQuery}
          setSearchLedgerQuery={setSearchLedgerQuery}
          customStartDate={customStartDate}
          setCustomStartDate={setCustomStartDate}
          customEndDate={customEndDate}
          setCustomEndDate={setCustomEndDate}
          filteredLedgerEntries={filteredLedgerEntries}
          setSelectedLedgerEntry={setSelectedLedgerEntry}
          canEditFinance={canEditFinance}
          setSelectedEditEntry={setSelectedEditEntry}
          setEditJournalData={setEditJournalData}
          setIsEditJournalOpen={setIsEditJournalOpen}
          setEntryToDelete={setEntryToDelete}
          setDeletePin={setDeletePin}
          setDeletePinError={setDeletePinError}
          setIsDeletePinModalOpen={setIsDeletePinModalOpen}
        />
      )}
      {/* RENDER TAB 2: INDIVIDUAL COURIER CUSTODY & DELIVERIES AUDIT */}
      {accountingTab === 'courier_audit' && (
        <CourierAuditTab
          isAr={isAr}
          couriers={couriers}
          auditedCourierId={auditedCourierId}
          setAuditedCourierId={setAuditedCourierId}
          courierAuditSheet={courierAuditSheet}
          triggerPrint={triggerPrint}
          formatCurrencyWithYerEquiv={formatCurrencyWithYerEquiv}
          handleBulkRemitCourierCash={handleBulkRemitCourierCash}
          cargoRemitLoading={cargoRemitLoading}
          handleFullCourierReconciliation={handleFullCourierReconciliation}
          bulkReconciliationLoading={bulkReconciliationLoading}
          handleDirectSettleCustody={handleDirectSettleCustody}
          courierTransactions={courierTransactions}
          formatAmountWithEquiv={formatAmountWithEquiv}
          dbRates={dbRates}
        />
      )}
      {/* RENDER TAB 3: INDIVIDUAL CUSTOMER ACCOUNT RECONCILIATION */}
      {accountingTab === 'customer_audit' && (
        <CustomerAuditTab
          isAr={isAr}
          customers={customers}
          auditedCustomerId={auditedCustomerId}
          setAuditedCustomerId={setAuditedCustomerId}
          customerLedgerDetails={customerLedgerDetails}
          triggerPrint={triggerPrint}
          setIsPayModalOpen={setIsPayModalOpen}
        />
      )}
      {accountingTab === 'financial_accounts' && (
        <FinancialAccountsTab
          isAr={isAr}
          accountTypeFilter={accountTypeFilter}
          setAccountTypeFilter={setAccountTypeFilter}
          searchAccountQuery={searchAccountQuery}
          setSearchAccountQuery={setSearchAccountQuery}
          financialAccounts={financialAccounts}
          filteredAccountsList={filteredAccountsList}
          dbRates={dbRates}
          setAdjustData={setAdjustData}
          setTargetType={setTargetType}
          setSourceAccountId={setSourceAccountId}
          setTargetAccountId={setTargetAccountId}
          setIsAdjustmentModalOpen={setIsAdjustmentModalOpen}
          setAuditedCustomerId={setAuditedCustomerId}
          setAuditedCourierId={setAuditedCourierId}
          setAccountingTab={setAccountingTab}
        />
      )}
      {/* RENDER TAB 4: CHART OF ACCOUNTS TREE */}
      <FinanceAccountingTabPanel active={accountingTab === 'chart_of_accounts'}>
        <AccountingHierarchyManagement isAr={isAr} canEdit={canEditFinance} />
      </FinanceAccountingTabPanel>
      {/* RENDER TAB 5: PHYSICAL ASSETS PORTFOLIO & MAINTENANCE */}
      <FinanceAccountingTabPanel active={accountingTab === 'assets_management'}>
        <AssetsPortfolio
          isAr={isAr}
          settings={settings}
          couriers={couriers}
        />
      </FinanceAccountingTabPanel>
      {/* RENDER TAB 7: SALARY HISTORY & EMPLOYEE STATEMENTS */}
      {accountingTab === 'salary_history' && (
        <SalariesHistoryTab
          isAr={isAr}
          salaryHistory={salaryHistory}
          employees={employees}
          accountTransactions={accountTransactions}
          setSelectedSalaryVoucher={setSelectedSalaryVoucher}
          salarySearch={salarySearch}
          setSalarySearch={setSalarySearch}
          salaryEmployeeFilter={salaryEmployeeFilter}
          setSalaryEmployeeFilter={setSalaryEmployeeFilter}
          salaryMonthFilter={salaryMonthFilter}
          setSalaryMonthFilter={setSalaryMonthFilter}
          employeeStatementId={employeeStatementId}
          setEmployeeStatementId={setEmployeeStatementId}
          empStmtDateFilter={empStmtDateFilter}
          setEmpStmtDateFilter={setEmpStmtDateFilter}
          empStmtStartDate={empStmtStartDate}
          setEmpStmtStartDate={setEmpStmtStartDate}
          empStmtEndDate={empStmtEndDate}
          setEmpStmtEndDate={setEmpStmtEndDate}
        />
      )}
      <SalaryVoucherModal
        isAr={isAr}
        settings={settings}
        selectedSalaryVoucher={selectedSalaryVoucher}
        setSelectedSalaryVoucher={setSelectedSalaryVoucher}
      />

      <ManualJournalAdjustmentModal
        activeCurrencies={activeCurrencies}
        adjustData={adjustData}
        adjustLoading={adjustLoading}
        adjustSalaryMonth={adjustSalaryMonth}
        financialAccounts={financialAccounts}
        handleAddAdjustment={handleAddAdjustment}
        isAdjustmentModalOpen={isAdjustmentModalOpen}
        isAr={isAr}
        isSalaryPayment={isSalaryPayment}
        isSourceDropdownOpen={isSourceDropdownOpen}
        isTargetDropdownOpen={isTargetDropdownOpen}
        postingFinancialAccounts={postingFinancialAccounts}
        setAdjustData={setAdjustData}
        setAdjustSalaryMonth={setAdjustSalaryMonth}
        setIsAdjustmentModalOpen={setIsAdjustmentModalOpen}
        setIsSalaryPayment={setIsSalaryPayment}
        setIsSourceDropdownOpen={setIsSourceDropdownOpen}
        setIsTargetDropdownOpen={setIsTargetDropdownOpen}
        setSourceAccountId={setSourceAccountId}
        setSourceSearchQuery={setSourceSearchQuery}
        setTargetAccountId={setTargetAccountId}
        setTargetSearchQuery={setTargetSearchQuery}
        setTargetType={setTargetType}
        settings={settings}
        sourceAccountId={sourceAccountId}
        sourceSearchQuery={sourceSearchQuery}
        targetAccountId={targetAccountId}
        targetSearchQuery={targetSearchQuery}
        targetType={targetType}
      />

      <CustomerFifoPaymentModal
        auditedCustomerId={auditedCustomerId}
        customerLedgerDetails={customerLedgerDetails}
        handleCustomerFIFOPayment={handleCustomerFIFOPayment}
        isAr={isAr}
        isPayModalOpen={isPayModalOpen}
        orders={orders}
        payAmount={payAmount}
        payLoading={payLoading}
        payNotes={payNotes}
        setIsPayModalOpen={setIsPayModalOpen}
        setPayAmount={setPayAmount}
        setPayNotes={setPayNotes}
      />

      <LedgerEntryPreview
        isAr={isAr}
        selectedLedgerEntry={selectedLedgerEntry}
        setSelectedLedgerEntry={setSelectedLedgerEntry}
        triggerPrint={triggerPrint}
      />

      {/* MODAL 3: FULL UPGRADED EDIT JOURNAL ENTRY MODAL */}
      {isEditJournalOpen && selectedEditEntry && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleEditJournalSubmit} className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden font-sans text-start">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تعديل كافة بيانات القيد المالي' : 'Full Main Entry Editor'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditJournalOpen(false);
                  setSelectedEditEntry(null);
                }}
                className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg cursor-pointer transition-colors"
                title={isAr ? 'إغلاق' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-start font-sans">
              <div className="bg-[#d4af37]/5 border border-[#d4af37]/15 p-3 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">{isAr ? 'الرقم المرجعي للسند' : 'Voucher Serial ID'}</span>
                  <span className="text-xs font-mono font-black text-[#d4af37]">{selectedEditEntry.refNumber}</span>
                </div>
                <span className="text-[10px] bg-black/40 text-slate-400 border border-slate-800 px-2 py-1 rounded-md font-mono">
                  {selectedEditEntry.module}
                </span>
              </div>

              {/* Debit Account Selection */}
              <div className="text-start">
                <label className="block text-[10px] font-black text-emerald-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {isAr ? 'الطرف المدين (من حـ/)' : 'Debit Account (Dr.)'}
                </label>
                <select
                  value={editJournalData.debitAccountId}
                  onChange={(e) => setEditJournalData({ ...editJournalData, debitAccountId: e.target.value })}
                  className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-emerald-500/60 outline-none text-xs font-bold cursor-pointer font-sans bg-[#121215]"
                >
                  <option value="">{isAr ? '-- اختر الحساب المدين --' : '-- Select Debit Account --'}</option>
                  {financialAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountCode ? `[${acc.accountCode}] ` : ''}{acc.entityName || (isAr ? acc.nameAr : acc.nameEn)} ({acc.currency || 'YER'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Credit Account Selection */}
              <div className="text-start">
                <label className="block text-[10px] font-black text-rose-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  {isAr ? 'الطرف الدائن (إلى حـ/)' : 'Credit Account (Cr.)'}
                </label>
                <select
                  value={editJournalData.creditAccountId}
                  onChange={(e) => setEditJournalData({ ...editJournalData, creditAccountId: e.target.value })}
                  className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-rose-500/60 outline-none text-xs font-bold cursor-pointer font-sans bg-[#121215]"
                >
                  <option value="">{isAr ? '-- اختر الحساب الدائن --' : '-- Select Credit Account --'}</option>
                  {financialAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountCode ? `[${acc.accountCode}] ` : ''}{acc.entityName || (isAr ? acc.nameAr : acc.nameEn)} ({acc.currency || 'YER'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount and Currency */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2 text-start">
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'المبلغ المالي' : 'Amount'}</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={editJournalData.amountOriginal}
                    onChange={(e) => setEditJournalData({ ...editJournalData, amountOriginal: e.target.value })}
                    placeholder="25000"
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                  />
                </div>
                <div className="text-start">
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'العملة' : 'Currency'}</label>
                  <CurrencySelect
                    isAr={isAr}
                    currencies={activeCurrencies.map(c => ({ id: c.code, code: c.code }))}
                    value={editJournalData.currencyOriginal}
                    onChange={currency => setEditJournalData(prev => ({ ...prev, currencyOriginal: currency }))}
                    className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer font-mono bg-[#121215]"
                  />
                </div>
              </div>

              {/* Effective Date */}
              <div className="text-start">
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'تاريخ ووقت القيد' : 'Effective Date'}</label>
                <input
                  type="datetime-local"
                  value={editJournalData.createdAt}
                  onChange={(e) => setEditJournalData({ ...editJournalData, createdAt: e.target.value })}
                  className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold font-mono text-center"
                />
              </div>

              {/* Particulars / Notes */}
              <div className="text-start">
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'البيان والوصف' : 'Particulars / Notes'}</label>
                <textarea
                  required
                  value={editJournalData.notes}
                  onChange={(e) => setEditJournalData({ ...editJournalData, notes: e.target.value })}
                  className="w-full bg-[#121215] border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none h-20 text-start"
                  placeholder={isAr ? "البيان لتعديل القيد المالي..." : "Enter particulars for this financial entry..."}
                ></textarea>
              </div>
            </div>

            <div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsEditJournalOpen(false);
                  setSelectedEditEntry(null);
                }}
                className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={editJournalLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                {editJournalLoading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'اعتماد وحفظ التعديلات' : 'Save Adjustments')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: DELETE JOURNAL ENTRY WITH SECURITY PIN CONFIRMATION */}
      {isDeletePinModalOpen && entryToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleDeleteJournalSubmit} className="bg-gradient-to-b from-[#161215] to-[#0d090b] border border-rose-900/40 rounded-3xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden font-sans text-start animate-fade-in">
            <div className="p-5 border-b border-rose-950 flex justify-between items-center bg-rose-950/20 shrink-0">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-500" />
                {isAr ? 'تأكيد حذف القيد المالي بـ PIN' : 'Confirm Delete Entry'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsDeletePinModalOpen(false);
                  setEntryToDelete(null);
                  setDeletePin('');
                }}
                className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-start font-sans">
              <div className="bg-rose-950/20 border border-rose-900/30 p-3.5 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold text-rose-400 block uppercase tracking-wider">{isAr ? 'رقم السند المراد حذفه' : 'Voucher to Delete'}</span>
                <span className="text-sm font-mono font-black text-white block">{entryToDelete.refNumber}</span>
                <span className="text-[10px] text-slate-400 block mt-1">{entryToDelete.title}</span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                {isAr
                  ? 'سيتم حذف القيد المالي من قاعدة البيانات وإعادة احتساب الأرصدة وتعديل حركة الحسابات نهائياً. أدخل رمز PIN الخاص بك لتأكيد العملية:'
                  : 'Deleting this entry will purge all related debit/credit legs and automatically update associated account balances. Enter your PIN to proceed:'}
              </p>

              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">{isAr ? 'رمز PIN الخاص بالمستخدم' : 'User Security PIN'}</label>
                <input
                  type="password"
                  required
                  autoFocus
                  maxLength={10}
                  value={deletePin}
                  onChange={(e) => setDeletePin(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-black/60 border border-slate-800 text-center font-mono font-black text-lg text-white rounded-xl p-3 focus:border-rose-500 outline-none tracking-widest"
                />
              </div>

              {deletePinError && (
                <div className="bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs p-3 rounded-xl font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  {deletePinError}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-900 bg-[#0a0709] flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsDeletePinModalOpen(false);
                  setEntryToDelete(null);
                  setDeletePin('');
                }}
                className="w-1/2 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-xl text-xs transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={deleteLoading || !deletePin.trim()}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-xs rounded-xl shadow-md transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {deleteLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {isAr ? 'تأكيد الحذف النهابي' : 'Confirm Delete'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
