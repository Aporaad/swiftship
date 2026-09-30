import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText, Search, CreditCard, ShieldAlert, CheckCircle, Wallet, ArrowUpRight,
  ArrowDownLeft, HelpCircle, User, Truck, Calendar, Printer, Download, Star, ExternalLink,
  DollarSign, Activity, FileSpreadsheet, PlusCircle, Scale, Receipt, Sparkles, TrendingUp, RefreshCw, X,
  FolderTree, Wrench, Users, Coins, UserCheck, Eye, ChevronDown, ChevronUp, Edit2, Lock, Trash2, ArrowRightLeft
} from 'lucide-react';
import { db } from '../lib/supabase-adapter';
import { useAuthSession } from '../features/auth/AuthSessionProvider';
import { collection, doc, updateDoc, writeBatch, deleteDoc, query, orderBy, increment, getDocs, where } from '../lib/supabase-adapter';
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
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);

  // Quick Currency Formatter with Conversion Subtext
  const renderCurrencyWithEquiv = (amount: number, currency: string = 'YER') => {
    if (currency !== 'YER') {
      const rate = dbRates[currency] || 1;
      const yerEquiv = amount * rate;
      return (
        <span className="font-mono">
          {amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span className="text-[10px] font-sans text-slate-500">{currency}</span>
          <span className="block text-[9px] font-sans text-slate-500 font-normal mt-0.5">
            (≈ {Math.round(yerEquiv).toLocaleString('en-US')} YER)
          </span>
        </span>
      );
    } else {
      return (
        <span className="font-mono">
          {amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-[10px] font-sans text-slate-550">YER</span>
        </span>
      );
    }
  };

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

  const normalizedCustodyAdvances = useMemo(() => custodyAdvances.map((row: any) => ({
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
  const [selectedSalaryVoucher, setSelectedSalaryVoucher] = useState<any>(null);
  // Employee Statement sub-view
  const [employeeStatementId, setEmployeeStatementId] = useState<string | null>(null);
  const [empStmtDateFilter, setEmpStmtDateFilter] = useState<'all' | '30days' | 'custom'>('all');
  const [empStmtStartDate, setEmpStmtStartDate] = useState('');
  const [empStmtEndDate, setEmpStmtEndDate] = useState('');

  // Edit Journal Entry State
  const [isEditJournalOpen, setIsEditJournalOpen] = useState(false);
  const [selectedEditEntry, setSelectedEditEntry] = useState<any | null>(null);
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
  const [entryToDelete, setEntryToDelete] = useState<any | null>(null);
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
  const [selectedLedgerEntry, setSelectedLedgerEntry] = useState<any | null>(null);

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
  const [printData, setPrintData] = useState<any>(null);

  // Currency utility converter
  const convertToYER = (amount: number, currency: string) => {
    const amt = parseFloat(String(amount || 0));
    if (!currency || currency === 'YER') return amt;
    const rate = dbRates[currency] || 1;
    return amt * rate;
  };

  // Convert YER to original currency if needed for display
  const getDisplayEquivalent = (amtYER: number, currency: string) => {
    if (!currency || currency === 'YER') return amtYER;
    const rate = dbRates[currency] || 1;
    return amtYER / (rate || 1);
  };

  // Asset totals sums based on the existing converter structure
  const vehiclesTotal = useMemo(() => {
    return assets
      .filter(a => a.category === 'Vehicles' && a.status === 'Active')
      .reduce((sum, a) => sum + convertToYER(a.cost || 0, a.currency || 'YER'), 0);
  }, [assets, settings]);

  const scannersTotal = useMemo(() => {
    return assets
      .filter(a => a.category === 'Inspection' && a.status === 'Active')
      .reduce((sum, a) => sum + convertToYER(a.cost || 0, a.currency || 'YER'), 0);
  }, [assets, settings]);

  const officeAssetsTotal = useMemo(() => {
    return assets
      .filter(a => a.category === 'Office' && a.status === 'Active')
      .reduce((sum, a) => sum + convertToYER(a.cost || 0, a.currency || 'YER'), 0);
  }, [assets, settings]);

  // 1. Double-Entry General Chronology Ledger from the new financial tables.
  const ledgerEntries = useMemo(() => {
    const groupedMap = new Map<string, { debitLeg?: any; creditLeg?: any; legs: any[] }>();

    // Group account_trans legs by entryId and keep posted, non-temporary main_entry heads only.
    const entryById = new Map(financialEntries.map((entry: any) => [entry.id, entry]));
    accountTransactions
      .map((tx: any) => {
        const entry = entryById.get(tx.entryId);
        return { ...tx, entry, journalEntryId: tx.entryId, refNumber: tx.refNumber || entry?.entryNumber, journalEntryNumber: entry?.entryNumber, currencyOriginal: tx.currencyOriginal || entry?.currencyOriginal };
      })
      .filter((tx: any) => tx.entry?.postingStatus === 'posted')

      .forEach(tx => {
      const groupKey = tx.journalEntryId || (tx.refNumber ? `REF-${tx.refNumber}` : tx.id);
      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, { legs: [] });
      }
      const group = groupedMap.get(groupKey)!;
      group.legs.push(tx);
      if (tx.type === 'Debit' && !group.debitLeg) {
        group.debitLeg = tx;
      } else if (tx.type === 'Credit' && !group.creditLeg) {
        group.creditLeg = tx;
      }
    });

    const entries: any[] = [];

    // Process grouped transactions into single consolidated voucher objects
    groupedMap.forEach((group, groupKey) => {
      const debitLeg = group.debitLeg || group.legs.find(l => l.type === 'Debit');
      const creditLeg = group.creditLeg || group.legs.find(l => l.type === 'Credit');
      const sample = debitLeg || creditLeg || group.legs[0];
      const date = new Date(new Date(sample.createdAt || Date.now()));

      const debitAcc = debitLeg ? financialAccounts.find(a => a.id === debitLeg.accountId) : null;
      const creditAcc = creditLeg ? financialAccounts.find(a => a.id === creditLeg.accountId) : null;

      const isSourcing = sample.entityType === 'courier' && (() => {
        const c = couriers.find(currCourier => currCourier.id === sample.entityId || currCourier.accountId === sample.accountId);
        return c?.courierType === 'sourcing' || c?.financialCurrency === 'SAR';
      })() || sample.currencyOriginal === 'SAR' || debitAcc?.currency === 'SAR' || creditAcc?.currency === 'SAR';

      const accountCurrency = sample.currencyOriginal || sample.currency || (debitAcc?.currency || creditAcc?.currency) || (isSourcing ? 'SAR' : (settings.currency || 'YER'));
      const amountOriginal = sample.amountOriginal !== undefined ? sample.amountOriginal : sample.amount;
      const convertedAmt = convertToYER(amountOriginal, accountCurrency);

      const debitPartyName = debitLeg
        ? `${debitLeg.accountCode || (debitAcc ? debitAcc.accountCode : '')} - ${debitLeg.entityName || (debitAcc ? (isAr ? debitAcc.nameAr : debitAcc.nameEn) : '')}`.replace(/^- /, '').trim()
        : '—';

      const creditPartyName = creditLeg
        ? `${creditLeg.accountCode || (creditAcc ? creditAcc.accountCode : '')} - ${creditLeg.entityName || (creditAcc ? (isAr ? creditAcc.nameAr : creditAcc.nameEn) : '')}`.replace(/^- /, '').trim()
        : '—';

      entries.push({
        id: sample.id || groupKey,
        groupKey,
        journalEntryId: sample.journalEntryId || null,
        refNumber: sample.refNumber || sample.journalEntryNumber || 'TX-REF',
        date,
        title: sample.description || (debitLeg && creditLeg ? `${debitLeg.entityName || ''} ➔ ${creditLeg.entityName || ''}` : (sample.party || sample.entityName)),
        notes: sample.description || '',
        debitLeg,
        creditLeg,
        debitPartyName,
        creditPartyName,
        debitAccountId: debitLeg?.accountId || '',
        creditAccountId: creditLeg?.accountId || '',
        debitAccountCode: debitLeg?.accountCode || debitAcc?.accountCode || '',
        creditAccountCode: creditLeg?.accountCode || creditAcc?.accountCode || '',
        isDoubleEntry: !!(debitLeg && creditLeg),
        type: debitLeg && !creditLeg ? 'Debit' : (!debitLeg && creditLeg ? 'Credit' : 'Double'),
        amount: convertedAmt,
        currency: settings.currency || 'YER',
        amountOriginal: amountOriginal,
        currencyOriginal: accountCurrency,
        module: sample.module || 'adjustment',
        createdByUid: sample.createdByUid || '',
        createdByName: sample.createdByName || '',
        isSourcing,
        allLegs: group.legs
      });
    });

    // Sort chronologically (oldest to newest for correct running balances, then reverse for display)
    const sorted = entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Compute running balance
    let currentBalance = 0;
    const computed = sorted.map(entry => {
      if (entry.type === 'Debit') {
        currentBalance += entry.amount;
      } else if (entry.type === 'Credit') {
        currentBalance -= entry.amount;
      }
      return {
        ...entry,
        runningBalance: currentBalance
      };
    });

    // Return reversed (newest first for feed view)
    return computed.reverse();
  }, [accountTransactions, financialEntries, isAr, settings, financialAccounts, couriers]);

  // Apply filters to ledger
  const filteredLedgerEntries = useMemo(() => {
    return ledgerEntries.filter(e => {
      // 1. Text Search
      const qr = searchLedgerQuery.toLowerCase();
      if (qr) {
        const matchesText = (
          (e.refNumber || '').toLowerCase().includes(qr) ||
          (e.title || '').toLowerCase().includes(qr) ||
          (e.debitPartyName || '').toLowerCase().includes(qr) ||
          (e.creditPartyName || '').toLowerCase().includes(qr) ||
          (e.party || '').toLowerCase().includes(qr) ||
          (e.notes || '').toLowerCase().includes(qr)
        );
        if (!matchesText) return false;
      }

      // 2. Type Filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'Debit' && !e.debitLeg && e.type !== 'Debit') return false;
        if (typeFilter === 'Credit' && !e.creditLeg && e.type !== 'Credit') return false;
      }

      // 3. Currency original Filter
      if (currencyFilter !== 'all' && e.currencyOriginal !== currencyFilter) return false;

      // 4. Date range filter
      if (dateFilter !== 'all') {
        const entryTime = e.date.getTime();
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (dateFilter === 'today') {
          const endOfToday = new Date();
          endOfToday.setHours(23, 59, 59, 999);
          if (entryTime < now.getTime() || entryTime > endOfToday.getTime()) return false;
        } else if (dateFilter === '7days') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          sevenDaysAgo.setHours(0, 0, 0, 0);
          if (entryTime < sevenDaysAgo.getTime()) return false;
        } else if (dateFilter === '30days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          thirtyDaysAgo.setHours(0, 0, 0, 0);
          if (entryTime < thirtyDaysAgo.getTime()) return false;
        } else if (dateFilter === 'custom') {
          if (customStartDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            if (entryTime < start.getTime()) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (entryTime > end.getTime()) return false;
          }
        }
      }

      // 5. Module Filter
      if (moduleFilter !== 'all' && e.module !== moduleFilter) return false;

      return true;
    });
  }, [ledgerEntries, searchLedgerQuery, typeFilter, currencyFilter, dateFilter, customStartDate, customEndDate, moduleFilter]);

  // Filter financial accounts list based on search and type filters
  const filteredAccountsList = useMemo(() => {
    return accountingHierarchyService.filterPostingAccounts(financialAccounts).filter(acc => {
      // 1. Filter by entity type
      if (accountTypeFilter !== 'all' && acc.entityType !== accountTypeFilter) return false;

      // 2. Filter by search query
      const query = searchAccountQuery.trim().toLowerCase();
      if (query) {
        const matchesQuery =
          (acc.accountCode || '').toLowerCase().includes(query) ||
          (acc.entityName || '').toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [financialAccounts, accountTypeFilter, searchAccountQuery]);

  // Dynamic Multi-Currency Cash Box Vault Balances
  const vaultBalances = useMemo(() => {
    // 1. Identify all accounts under "Cash & Safes" category (Code 1110)
    const cashAccounts = accountingHierarchyService.filterPostingAccounts(financialAccounts).filter(a =>
      a.accountCode === '1110' ||
      a.parentCode === '1110' ||
      a.accountCode?.startsWith('111')
    );

    // 2. Calculate actual YER balance from all YER-denominated cash accounts
    const yerCashAccounts = cashAccounts.filter(a => a.currency === 'YER');
    const totalYerBalance = yerCashAccounts.reduce((sum, a) => sum + (parseFloat(a.balance as any) || 0), 0);

    // 3. Foreign Currencies Card: Show the equivalent value of the YER treasury in USD and SAR as requested
    const usdEquivalent = totalYerBalance / (dbRates.USD || 1);
    const sarEquivalent = totalYerBalance / (dbRates.SAR || 1);

    return {
      yer: { in: 0, out: 0, balance: totalYerBalance },
      usd: { in: 0, out: 0, balance: usdEquivalent },
      sar: { in: 0, out: 0, balance: sarEquivalent },
      totalIn_YER: totalYerBalance,
      totalOut_YER: 0
    };
  }, [financialAccounts, settings]);

  // Dynamic P&L Trial Balance Summary metrics — all values in YER for consistent financial scope
  // These metrics directly feed from the ChartOfAccounts' system account balances.
  const financialTrialMetrics = useMemo(() => {
    // Revenues: Sum of all accounts starting with 4 (Revenues)
    const totalCustomerRevenue = financialAccounts
      .filter(a => a.accountCode?.startsWith('4') || a.accountCode?.startsWith('REV'))
      .reduce((sum, a) => {
        const balance = parseFloat(a.balance as any) || 0;
        return sum + financialAccountService.convertToDefaultCurrency(
          balance,
          a.currency || 'YER',
          settings.currency || 'YER',
          dbRates
        );
      }, 0);

    // ── 4200: Manual debit (inflow) adjustments ──────────────────────────
    const totalAdjustInflows = 0; // Handled implicitly in account balances

    // ── 5000: Operating costs derived from posted ledger entries ─────────
    // Sum of all accounts starting with 5 (Expenses)
    const netOperatingCosts = financialAccounts
      .filter(a => a.accountCode?.startsWith('5') || a.accountCode?.startsWith('EXP'))
      .reduce((sum, a) => {
        const balance = parseFloat(a.balance as any) || 0;
        return sum + financialAccountService.convertToDefaultCurrency(
          balance,
          a.currency || 'YER',
          settings.currency || 'YER',
          dbRates
        );
      }, 0);

    // ── 1130: Receivables = sum of customer balances ─────────────────────
    const netReceivables = financialAccounts
      .filter(a => a.entityType === 'customer' || a.accountCode?.startsWith('1130'))
      .reduce((sum, a) => {
        const balance = parseFloat(a.balance as any) || 0;
        return sum + financialAccountService.convertToDefaultCurrency(
          balance,
          a.currency || 'YER',
          settings.currency || 'YER',
          dbRates
        );
      }, 0);

    // ── 2110: Active custody liabilities ─────────────────────────────────
    const activeCustodyLiabilities = financialAccounts
      .filter(a => a.entityType === 'courier' || a.accountCode?.startsWith('2120'))
      .reduce((sum, a) => {
        const balance = parseFloat(a.balance as any) || 0;
        return sum + financialAccountService.convertToDefaultCurrency(
          balance,
          a.currency || 'YER',
          settings.currency || 'YER',
          dbRates
        );
      }, 0);

    // ── 3200: Net Profit = Revenue - Costs ───────────────────────────────
    const netProfit = totalCustomerRevenue - netOperatingCosts;

    const operatingMargin = totalCustomerRevenue > 0
      ? parseFloat(((netProfit / totalCustomerRevenue) * 100).toFixed(2))
      : 0;

    return {
      totalCustomerRevenue,
      totalAdjustInflows,
      netOperatingCosts,
      activeCustodyLiabilities,
      netReceivables,
      netProfit,
      operatingMargin
    };
  }, [financialAccounts]);

  const handleEditJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editJournalData.amountOriginal || isNaN(parseFloat(editJournalData.amountOriginal))) {
      return notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'قيمة المبلغ غير صالحة' : 'Invalid Amount',
        type: 'error'
      });
    }

    setEditJournalLoading(true);
    try {
      const rawAmt = parseFloat(editJournalData.amountOriginal);
      const convertedAmt = financialAccountService.convertToDefaultCurrency(
        rawAmt,
        editJournalData.currencyOriginal,
        settings.currency || 'YER',
        dbRates
      );

      const parsedCreatedAt = editJournalData.createdAt ? new Date(editJournalData.createdAt).getTime() : Date.now();
      const batch = writeBatch(db);

      const affectedAccountIds = new Set<string>();

      {
        const txId = selectedEditEntry.id;
        const refNum = selectedEditEntry.refNumber;

        const txQuery = refNum
          ? query(collection(db, 'account_trans'), where('ref_number', '==', refNum))
          : query(collection(db, 'account_trans'), where('__name__', '==', txId));

        const txSnap = await getDocs(txQuery);
        const exchangeRates = dbRates;

        const newDebitAcc = editJournalData.debitAccountId ? postingFinancialAccounts.find(a => a.id === editJournalData.debitAccountId) : null;
        const newCreditAcc = editJournalData.creditAccountId ? postingFinancialAccounts.find(a => a.id === editJournalData.creditAccountId) : null;

        if (!txSnap.empty) {
          for (const txDoc of txSnap.docs) {
            const txData = txDoc.data();
            if (txData.accountId) affectedAccountIds.add(txData.accountId);

            const targetAcc = txData.type === 'Debit' ? newDebitAcc : newCreditAcc;
            const targetAccId = targetAcc ? targetAcc.id : txData.accountId;
            if (targetAccId) affectedAccountIds.add(targetAccId);

            const targetCurrency = targetAcc?.currency || txData.currency || 'YER';

            const legNewAmount = financialAccountService.convertToTargetCurrency(
              rawAmt,
              editJournalData.currencyOriginal,
              targetCurrency,
              exchangeRates
            );

            const updateData: any = {
              amount: legNewAmount,
              amountOriginal: rawAmt,
              currencyOriginal: editJournalData.currencyOriginal,
              description: editJournalData.notes,
              createdAt: parsedCreatedAt,
              updatedAt: Date.now()
            };

            if (targetAcc) {
              updateData.accountId = targetAcc.id;
              updateData.accountCode = targetAcc.accountCode;
              updateData.entityName = targetAcc.entityName;
              updateData.entityId = targetAcc.entityId;
              updateData.entityType = targetAcc.entityType;
              updateData.currency = targetAcc.currency;
            }

            batch.update(txDoc.ref, updateData);

          }
        }

        // Update master entry doc in main_entry if exists
        if (selectedEditEntry.journalEntryId) {
          const jvRef = doc(db, 'main_entry', selectedEditEntry.journalEntryId);
          batch.update(jvRef, {
            amount: rawAmt,
            currency: editJournalData.currencyOriginal,
            description: editJournalData.notes,
            debitAccountId: editJournalData.debitAccountId || selectedEditEntry.debitAccountId,
            creditAccountId: editJournalData.creditAccountId || selectedEditEntry.creditAccountId,
            createdAt: parsedCreatedAt,
            updatedAt: Date.now()
          });
        }
      }

      await batch.commit();

      // Recalculate & sync balances for all affected accounts
      affectedAccountIds.forEach(accId => {
        if (accId) {
          financialAccountService.recalculateAndSyncBalance(accId).catch(console.error);
        }
      });

      notificationService.notify({
        title: isAr ? 'تم الحفظ' : 'Saved',
        message: isAr ? 'تم تعديل القيد المالي وتحديث كافة الأرصدة المرتبطة.' : 'Financial entry updated and all associated balances recalculated.',
        type: 'success'
      });

      setIsEditJournalOpen(false);
      setSelectedEditEntry(null);
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: err.message || 'Could not update entry',
        type: 'error'
      });
    } finally {
      setEditJournalLoading(false);
    }
  };

  // Handle Delete Entry with User PIN confirmation
  const handleDeleteJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryToDelete) return;
    setDeletePinError('');

    const trimmedPin = deletePin.trim();
    if (!trimmedPin) {
      setDeletePinError(isAr ? 'يرجى إدخال رمز PIN' : 'Please enter PIN code');
      return;
    }

    // Check PIN against employee systemPins or master fallback PINs ('1234', '0000')
    const isValidPin = employees.some(emp => emp.systemPin && emp.systemPin.trim() === trimmedPin) ||
      trimmedPin === '1234' || trimmedPin === '0000';

    if (!isValidPin) {
      setDeletePinError(isAr ? 'رمز PIN غير صحيح. يرجى التثبت من الرمز وتكرار المحاولة.' : 'Invalid PIN code. Access denied.');
      return;
    }

    setDeleteLoading(true);
    try {
      const affectedAccountIds = new Set<string>();
      if (entryToDelete.debitAccountId) affectedAccountIds.add(entryToDelete.debitAccountId);
      if (entryToDelete.creditAccountId) affectedAccountIds.add(entryToDelete.creditAccountId);

      const batch = writeBatch(db);

      // Find all transaction legs related to this voucher
      if (entryToDelete.allLegs && entryToDelete.allLegs.length > 0) {
        entryToDelete.allLegs.forEach((leg: any) => {
          if (leg.id) {
            batch.delete(doc(db, 'account_trans', leg.id));
          }
          if (leg.accountId) affectedAccountIds.add(leg.accountId);
        });
      } else if (entryToDelete.id && !entryToDelete.id.startsWith('EXP-UNLINKED-')) {
        const refNum = entryToDelete.refNumber;
        const qTx = refNum
          ? query(collection(db, 'account_trans'), where('ref_number', '==', refNum))
          : query(collection(db, 'account_trans'), where('__name__', '==', entryToDelete.id));
        const snap = await getDocs(qTx);
        snap.docs.forEach(d => {
          batch.delete(d.ref);
          const data = d.data();
          if (data.accountId) affectedAccountIds.add(data.accountId);
        });
      }

      // Delete master entry document from main_entry if present
      if (entryToDelete.journalEntryId) {
        batch.delete(doc(db, 'main_entry', entryToDelete.journalEntryId));
      }

      await batch.commit();

      // Recalculate & sync balances for all affected accounts in background
      affectedAccountIds.forEach(accId => {
        if (accId) {
          financialAccountService.recalculateAndSyncBalance(accId).catch(console.error);
        }
      });

      notificationService.notify({
        title: isAr ? 'تم الحذف' : 'Deleted',
        message: isAr ? 'تم حذف القيد المالي نهائياً وإلغاء كافة تأثيراته الحسابية.' : 'Financial entry permanently deleted and all ledger balances synced.',
        type: 'success'
      });

      setIsDeletePinModalOpen(false);
      setEntryToDelete(null);
      setDeletePin('');
    } catch (err: any) {
      console.error("Error deleting entry:", err);
      setDeletePinError(err.message || 'Failed to delete entry');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle addition of quick accounting adjustment voucher
  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustLoading) return;
    if (!adjustData.amount || parseFloat(adjustData.amount) <= 0 || (!adjustData.title && !isSalaryPayment)) {
      notificationService.notify({
        title: isAr ? 'خطأ بالبيانات' : 'Invalid Entry',
        message: isAr ? 'يرجى ملء تفاصيل القيد والمبلغ المالي الصحيح.' : 'Provide precise title and positive currency amount.',
        type: 'error'
      });
      return;
    }

    if (!sourceAccountId || !targetAccountId) {
      notificationService.notify({
        title: isAr ? 'الحسابات غير محددة' : 'Accounts Required',
        message: isAr ? 'يجب تحديد الحساب المصدر (الدائن) والحساب المستهدف (المدين) لإجراء القيد المزدوج.' : 'Please select both source and target accounts to complete the transaction.',
        type: 'error'
      });
      return;
    }

    if (sourceAccountId === targetAccountId) {
      notificationService.notify({
        title: isAr ? 'تطابق الحسابات' : 'Identical Accounts',
        message: isAr ? 'لا يمكن أن يكون الحساب المصدر والحساب المستهدف متطابقين.' : 'Source and target accounts cannot be the same.',
        type: 'error'
      });
      return;
    }

    setAdjustLoading(true);
    try {
      const amountVal = parseFloat(adjustData.amount);
      const convertedAmt = financialAccountService.convertToDefaultCurrency(
        amountVal,
        adjustData.currency,
        settings.currency || 'YER',
        dbRates
      );

      const timestamp = Date.now();
      const randStr = Math.floor(1000 + Math.random() * 9000);

      const srcAccount = postingFinancialAccounts.find(a => a.id === sourceAccountId || a.entityId === sourceAccountId);
      const trgAccount = postingFinancialAccounts.find(a => a.id === targetAccountId || a.entityId === targetAccountId);

      if (!srcAccount || !trgAccount) {
        throw new Error(isAr ? 'أحد الحسابات المحددة غير موجود في الدفاتر.' : 'Selected accounts not found.');
      }

      const voucherCode = `ADJ-${new Date().getFullYear().toString().slice(-2)}-${randStr}`;

      // 1. If it is a Salary Payment, invoke the atomic recordSalaryPayment service
      if (isSalaryPayment && targetType === 'employee') {
        if (!adjustSalaryMonth) {
          notificationService.notify({
            title: isAr ? 'الشهر غير محدد' : 'Month Required',
            message: isAr ? 'يرجى تحديد شهر صرف الراتب.' : 'Please select the salary month.',
            type: 'error'
          });
          setAdjustLoading(false);
          return;
        }

        await financialAccountService.recordSalaryPayment({
          employeeId: trgAccount.entityId,
          employeeName: trgAccount.entityName,
          accountId: targetAccountId,
          accountCode: trgAccount.accountCode,
          amount: convertedAmt,
          currency: adjustData.currency,
          salaryMonth: adjustSalaryMonth,
          notes: adjustData.notes || (isAr ? `صرف راتب شهر ${adjustSalaryMonth}` : `Salary payment for ${adjustSalaryMonth}`),
          createdByUid: currentUser?.id || 'system',
          createdByName: currentUser?.email?.split('@')[0] || 'Finance Auditor'
        });
      }

      // 2. Perform double-entry transaction posting (Debit trgAccount, Credit srcAccount)
      await financialAccountService.recordDoubleEntryTransaction(
        targetAccountId,
        sourceAccountId,
        {
          accountId: targetAccountId,
          accountCode: trgAccount.accountCode,
          entityType: trgAccount.entityType,
          entityId: trgAccount.entityId,
          entityName: trgAccount.entityName,
          amount: convertedAmt,
          amountOriginal: amountVal,
          currencyOriginal: adjustData.currency,
          description: adjustData.title || (isAr ? `قيد تسوية مزدوج: ${voucherCode}` : `Double-entry adjustment: ${voucherCode}`),
          refNumber: voucherCode,
          module: 'adjustment',
          createdAt: timestamp,
          createdByUid: currentUser?.id || 'system',
          createdByName: currentUser?.email?.split('@')[0] || 'Finance Auditor'
        }
      );

      notificationService.notify({
        title: isAr ? 'تم تقييد القيد بنجاح' : 'Adjustment Logged',
        message: isAr ? 'تم حفظ القيد المزدوج ترحيله إلى اليومية المساعدة بنجاح.' : 'Double-entry journal voucher registered successfully.',
        type: 'success'
      });

      setIsAdjustmentModalOpen(false);
      setAdjustData({
        type: 'Debit',
        amount: '',
        currency: 'YER',
        title: '',
        recipientName: '',
        notes: ''
      });
      setTargetType('general');
      setSourceAccountId('');
      setTargetAccountId('');
      setIsSalaryPayment(false);
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: 'Error write-back',
        message: err.message || 'Failed to persist manual voucher entry.',
        type: 'error'
      });
    } finally {
      setAdjustLoading(false);
    }
  };

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
      .filter(o => o.deliveryCourierId === auditedCourierId && (o.orderStatus === 'تم التسليم' || o.orderStatus === 'Delivered') && parseFloat(o.amountRemaining || 0) > 0);

    const totalUnremittedCashValue = currentUnremittedCargoCash.reduce((sum, o) => sum + parseFloat(o.amountRemaining || 0), 0);
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
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [auditedCourierId, accountTransactions, isAr]);

  // Full reconciliation and balance clearance for courier
  const handleFullCourierReconciliation = async () => {
    if (!courierAuditSheet) return;
    const cour = courierAuditSheet.courier;
    const currentBalance = cour.financialBalance || 0;

    if (!window.confirm(isAr
      ? `تحذير: هل أنت متأكد من تصفية ذمة المندوب (${cour.fullName}) بالكامل؟
سيقوم هذا الإجراء بـ:
1. تصفير رصيد الحساب المالي الحالي (${currentBalance.toLocaleString()} YER) بقيد محاسبي تعويضي.
2. تصفية كافة العهد المالية المعلقة.
3. توريد وتصفير كافة تحصيلات الطرود النقدية المعلقة (${courierAuditSheet.totalUnremittedCashValue.toLocaleString()} YER).
هل تريد الاستمرار؟`
      : `Warning: Confirm full audit reconciliation for ${cour.fullName}?
This will:
1. Zero out the financial account balance (${currentBalance.toLocaleString()} YER) with an offsetting journal entry.
2. Reconcile all outstanding open custodies.
3. Settle and remit all unremitted COD cargo collections (${courierAuditSheet.totalUnremittedCashValue.toLocaleString()} YER).
Continue?`
    )) return;

    setBulkReconciliationLoading(true);
    try {
      const batch = writeBatch(db);
      const timestamp = Date.now();
      const randStr = Math.floor(1000 + Math.random() * 9000);
      const mainVoucherCode = `AUDIT-${randStr}`;

      const systemAccs = await financialAccountService.ensureSystemAccounts('YER');

      // 1. Reconcile current financial balance if not zero
      if (currentBalance !== 0) {
        const linkedAccountId = cour.accountId;
        const linkedAccountCode = cour.accountCode;

        if (linkedAccountId) {
          const type = currentBalance > 0 ? 'Credit' : 'Debit'; // Credit to reduce balance, Debit to increase it
          const amount = Math.abs(currentBalance);

          await financialAccountService.recordTransaction({
            date: timestamp,
            description: isAr
              ? `قيد تسوية لمطابقة وتصفير الحساب المالي للمندوب — قيد إقفال`
              : `Offsetting adjustment to zero out courier account balance`,
            module: 'adjustment',
            refNumber: mainVoucherCode,
            amount,
            currency: 'YER',
            debitAccount: type === 'Debit'
              ? { id: linkedAccountId, code: linkedAccountCode || '2120' }
              : { id: systemAccs['sys_cash_account'], code: '1111-0' },
            creditAccount: type === 'Credit'
              ? { id: linkedAccountId, code: linkedAccountCode || '2120' }
              : { id: systemAccs['sys_cash_account'], code: '1111-0' },
            createdByUid: currentUser?.id || 'system',
            createdByName: 'Finance Auditor'
          });
        }
      }

      // 2. Settle all pending open custodies
      const pendingCustodies = courierAuditSheet.custodies.filter(c => c.status === 'Pending');
      for (const exp of pendingCustodies) {
        const docRef = doc(db, 'custody_advances', exp.id);
        batch.update(docRef, {
          status: 'settled',
          settledAt: new Date(timestamp).toISOString(),
          settledByUid: currentUser?.id || 'system',
          amountSettled: exp.amountOriginal ?? exp.amount ?? 0,
          amountOutstanding: 0,
        });

        if (exp.recipientAccountId) {
          const settledAmount = financialAccountService.convertToDefaultCurrency(
            parseFloat(exp.amount || 0),
            exp.currency || 'YER',
            settings.currency || 'SAR',
            dbRates
          );
          await financialAccountService.recordTransaction({
            date: timestamp,
            description: isAr ? `تسوية عهدة تلقائية: ${exp.expenseNumber}` : `Auto custody settlement: ${exp.expenseNumber}`,
            module: 'custody',
            refNumber: `${exp.expenseNumber}-SET`,
            amount: settledAmount,
            currency: 'YER',
            debitAccount: { id: exp.recipientAccountId, code: '2120' },
            creditAccount: { id: systemAccs['sys_cash_account'], code: '1111-0' },
            createdByUid: currentUser?.id || 'system',
            createdByName: 'Finance Auditor'
          });
        }
      }

      // 3. Remit all unremitted COD cargo cash
      courierAuditSheet.currentUnremittedCargoCash.forEach(ord => {
        const orderRef = doc(db, 'orders', ord.id);
        const prevPaid = parseFloat(ord.amountPaid || 0);
        const rem = parseFloat(ord.amountRemaining || 0);

        batch.update(orderRef, {
          amountPaid: prevPaid + rem,
          amountRemaining: 0,
          paymentStatus: isAr ? 'خالص' : 'Fully Paid',
          courierRemittedAt: timestamp
        });
      });

      await batch.commit();

      notificationService.notify({
        title: isAr ? 'نجاح مطابقة الذمة بالكامل' : 'Full Audit Reconciled',
        message: isAr
          ? `تم تصفير رصيد المندوب وتصفية كافة العهد وتحصيلات الشحنات بنجاح!`
          : `Audit successful: All custodies, cargo collections, and balances resolved to 0 YER for ${cour.fullName}.`,
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: 'Audit transaction failed',
        message: err.message || 'Error executing full courier reconciliation.',
        type: 'error'
      });
    } finally {
      setBulkReconciliationLoading(false);
    }
  };

  // Bulk Settle Courier's outstanding physical delivery receipts of COD cargo
  const [cargoRemitLoading, setCargoRemitLoading] = useState(false);
  const handleBulkRemitCourierCash = async () => {
    if (!courierAuditSheet || courierAuditSheet.currentUnremittedCargoCash.length === 0) return;

    const isSourcing = courierAuditSheet.courier.courierType === 'sourcing';
    const currency = isSourcing ? 'SAR' : 'YER';
    const amountLabel = isSourcing
      ? `${courierAuditSheet.totalUnremittedCashValue.toLocaleString()} SAR`
      : `${courierAuditSheet.totalUnremittedCashValue.toLocaleString()} YER`;

    if (!window.confirm(isAr
      ? `هل تريد تصفية كافة مستحقات الشحن المحصلة بذمة المندوب (${amountLabel}) وتوريدها للخزينة؟`
      : `Confirm remittance of ${amountLabel} held by ${courierAuditSheet.courier.fullName}?`
    )) return;

    setCargoRemitLoading(true);
    try {
      const batch = writeBatch(db);

      // Update each unremitted cargo invoice
      courierAuditSheet.currentUnremittedCargoCash.forEach(ord => {
        const orderRef = doc(db, 'orders', ord.id);
        const prevPaid = parseFloat(ord.amountPaid || 0);
        const rem = parseFloat(ord.amountRemaining || 0);

        batch.update(orderRef, {
          amountPaid: prevPaid + rem,
          amountRemaining: 0,
          paymentStatus: isAr ? 'خ خالص' : 'Fully Paid',
          courierRemittedAt: Date.now()
        });
      });

      // Register the remittance as a proper double-entry voucher.
      const randStr = Math.floor(1000 + Math.random() * 9000);
      const voucherCode = `REMIT-${randStr}`;
      const courierAccountId = courierAuditSheet.courier.accountId;
      if (courierAccountId) {
        const systemAccs = await financialAccountService.ensureSystemAccounts(currency);
        const amount = financialAccountService.convertToDefaultCurrency(
          courierAuditSheet.totalUnremittedCashValue,
          currency,
          settings.currency || 'YER',
          dbRates,
        );
        await financialAccountService.recordTransaction({
          date: Date.now(),
          description: isAr
            ? `توريد تحصيلات شحنات المندوب ${courierAuditSheet.courier.fullName}`
            : `Courier cargo remittance: ${courierAuditSheet.courier.fullName}`,
          module: 'payment',
          refNumber: voucherCode,
          amount,
          currency: settings.currency || 'YER',
          debitAccount: { id: systemAccs['sys_cash_account'], code: '1111-0' },
          creditAccount: { id: courierAccountId, code: '2120' },
          createdByUid: currentUser?.id || 'system',
          createdByName: 'Finance Auditor',
        });
      }
      await batch.commit();

      notificationService.notify({
        title: isAr ? 'تم توريد التحصيلات وتصفير الذمة' : 'Cargo Cash Remitted',
        message: isAr
          ? `تم تصفير ذمة المندوب وتوريد مبلغ ${amountLabel} للخزينة بنجاح!`
          : `Remittance logged: safely deposited ${amountLabel} from Courier collections.`,
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: 'Fm transaction error',
        message: err.message || 'Remittance transaction failed.',
        type: 'error'
      });
    } finally {
      setCargoRemitLoading(false);
    }
  };

  // Live Settle specific Custody record from the interactive sheet
  const handleDirectSettleCustody = async (custodyDocId: string, recipientName: string) => {
    if (!window.confirm(isAr
      ? `هل أنت متأكد من مراجعة وتصفية هذا السند العهدة؟`
      : `Are you sure you want to discharge and settle this custody entry?`
    )) return;

    try {
      const docRef = doc(db, 'custody_advances', custodyDocId);
      await updateDoc(docRef, {
        status: 'settled',
        settledAt: new Date().toISOString(),
        settledByUid: currentUser?.id || 'system',
        amountOutstanding: 0,
      });

      notificationService.notify({
        title: isAr ? 'تم تسوية وتصفير العهدة' : 'Custody Discharged',
        message: isAr
          ? `تم إبراء المندوب ${recipientName} من العهدة وتسجيل الإرجاع.`
          : `Disgorged open trust for courier ${recipientName}. Safebox recalculated.`,
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: 'Writeback fault',
        message: err.message || 'Could not discharge custody row in PostgreSQL.',
        type: 'error'
      });
    }
  };

  // 3. Bilateral Customer Statement of Account Ledger (Standard matching sub-ledger using account_trans)
  const customerLedgerDetails = useMemo(() => {
    if (!auditedCustomerId) return null;
    const cust = customers.find(c => c.id === auditedCustomerId);
    if (!cust) return null;

    const customerTx = accountTransactions.filter(tx => tx.entityType === 'customer' && tx.entityId === auditedCustomerId);
    const sortedTx = [...customerTx].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    const rows: any[] = [];
    let cumulativeBalance = 0; // Cumulative customer debt (YER)

    sortedTx.forEach(tx => {
      const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
      const isDebit = tx.type === 'Debit';
      const amt = tx.amount || 0;

      if (isDebit) {
        cumulativeBalance += amt;
      } else {
        cumulativeBalance -= amt;
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

    const grossFreightValuation = sortedTx.filter(t => t.type === 'Debit').reduce((sum, t) => sum + (t.amount || 0), 0);
    const netPaidRevenues = sortedTx.filter(t => t.type === 'Credit').reduce((sum, t) => sum + (t.amount || 0), 0);
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

  // FIFO Payment settlement for selected Customer outstanding debt
  const handleCustomerFIFOPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payLoading) return;
    const amountVal = parseFloat(payAmount);
    if (!customerLedgerDetails || isNaN(amountVal) || amountVal <= 0) {
      notificationService.notify({
        title: isAr ? 'مبلغ غير صالح' : 'Invalid Balance',
        message: isAr ? 'الرجاء إدخال مبلغ دفع إيجابي لتسويته.' : 'Please type a valid currency number.',
        type: 'error'
      });
      return;
    }

    setPayLoading(true);
    try {
      // Find customer orders with remaining debt
      const unpaidOrders = orders
        .filter(o => o.customerId === auditedCustomerId && parseFloat(o.amountRemaining || 0) > 0)
        .sort((a, b) => {
          const d1 = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || 0);
          const d2 = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || 0);
          return d1 - d2;
        });

      if (unpaidOrders.length === 0) {
        notificationService.notify({
          title: isAr ? 'الحساب خالص' : 'No Debts Outstanding',
          message: isAr ? 'لا توجد مديونيات معلقة مسجلة على هذا العميل.' : 'This customer already holds a 0 YER outstanding balance.',
          type: 'warning'
        });
        setIsPayModalOpen(false);
        return;
      }

      let remainingPayment = amountVal;
      const batch = writeBatch(db);

      // Settle unpaid chronological invoices using chronological FIFO queue
      for (const ord of unpaidOrders) {
        if (remainingPayment <= 0) break;

        const ordRemaining = parseFloat(ord.amountRemaining || 0);
        const ordPaid = parseFloat(ord.amountPaid || 0);
        const ordRef = doc(db, 'orders', ord.id);

        if (remainingPayment >= ordRemaining) {
          // Paying off this specific invoice fully
          batch.update(ordRef, {
            amountPaid: ordPaid + ordRemaining,
            amountRemaining: 0,
            paymentStatus: isAr ? 'خالص' : 'Fully Paid'
          });
          remainingPayment -= ordRemaining;
        } else {
          // Partial payment applied to this invoice
          batch.update(ordRef, {
            amountPaid: ordPaid + remainingPayment,
            amountRemaining: ordRemaining - remainingPayment,
            paymentStatus: isAr ? 'دفع جزئي' : 'Partially Paid'
          });
          remainingPayment = 0;
        }
      }

      // --- Register Credit in Customer's Financial Account ---
      const customerRecord = customerLedgerDetails.customer;
      const linkedAccountId = customerRecord.accountId;
      const linkedAccountCode = customerRecord.accountCode;

      // Record cash inflow directly as a new-model payment voucher.
      const randStr = Math.floor(1000 + Math.random() * 9000);
      const voucherNum = `RCV-${randStr}`;

      if (linkedAccountId) {
        const convertedPaid = financialAccountService.convertToDefaultCurrency(
          amountVal,
          'YER',
          settings.currency || 'YER',
          dbRates
        );

        const systemAccs = await financialAccountService.ensureSystemAccounts('YER');

        await financialAccountService.recordTransaction({
          date: Date.now(),
          description: isAr
            ? `دفعة نقدية مستلمة على الحساب كشف حساب: ${payNotes || ''}`
            : `Cash payment received on account statement: ${payNotes || ''}`,
          module: 'payment',
          refNumber: voucherNum,
          amount: convertedPaid,
          currency: 'YER',
          debitAccount: { id: systemAccs['sys_cash_account'], code: '1111-0' },
          creditAccount: { id: linkedAccountId, code: linkedAccountCode || '1130' },
          createdByUid: currentUser?.id || 'system',
          createdByName: 'Finance Auditor'
        });
      }

      await batch.commit();

      notificationService.notify({
        title: isAr ? 'تم استلام وتوريد المبلغ' : 'Payment Deposited',
        message: isAr
          ? `تم استلام وتحصيل ${amountVal.toLocaleString()} YER وتطبيقها على أقدم الفواتير المستحقة.`
          : `FIFO accounting applied: Applied ${amountVal.toLocaleString()} YER to chronological outstanding invoices.`,
        type: 'success'
      });

      setIsPayModalOpen(false);
      setPayAmount('');
      setPayNotes('');
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: 'FIFO writeback error',
        message: err.message || 'Error executing balance clearance.',
        type: 'error'
      });
    } finally {
      setPayLoading(false);
    }
  };

  // CSV Export utility
  const exportLedgerToCSV = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";

      // Headers
      csvContent += isAr
        ? "تاريخ القيد,رقم سند النقر المرجعي,البيان وتفاصيل الحساب,المستفيد,مدين (+),دائن (-),رصيد المتوقع YER\n"
        : "Date/Time,Voucher ID,Particulars/Annotations,Counterparty,Debit (+),Credit (-),Running Balance YER\n";

      filteredLedgerEntries.forEach(e => {
        const isDebit = e.type === 'Debit';
        const row = [
          formatDateTime(e.date),
          `"${e.refNumber || ''}"`,
          `"${(e.title || '').replace(/"/g, '""')}"`,
          `"${(e.party || '').replace(/"/g, '""')}"`,
          isDebit ? e.amount : "0",
          !isDebit ? e.amount : "0",
          e.runningBalance
        ];
        csvContent += row.join(",") + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `General_Ledger_Export_${formatDate()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    }
  };

  // Print Friendly UI Engine
  const triggerPrint = (title: string, contentId: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = document.getElementById(contentId)?.innerHTML || '';

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Cairo', 'Inter', sans-serif; 
              direction: ${isAr ? 'rtl' : 'ltr'}; 
              background-color: white; 
              color: black; 
              padding: 24px; 
              margin: 0; 
            }
            .header {
              text-align: center;
              border-bottom: 3px double #d4af37;
              padding-bottom: 12px;
              margin-bottom: 24px;
            }
            .header h1 { margin: 0; font-size: 20px; color: #111; }
            .header p { margin: 4px 0; font-size: 11px; color: #555; }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 24px;
              font-size: 12px;
              border-bottom: 1px solid #eee;
              padding-bottom: 12px;
            }
            .meta-label { font-weight: bold; color: #444; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
              font-size: 11px;
            }
            th {
              background-color: #f5f5f7;
              color: #111;
              padding: 8px;
              border: 1px solid #ddd;
              text-align: ${isAr ? 'right' : 'left'};
              font-weight: 800;
            }
            td {
              padding: 8px;
              border: 1px solid #eee;
            }
            tr:nth-child(even) { background-color: #fafafc; }
            .bold { font-weight: bold; }
            .text-green { color: #2e7d32; font-weight: bold; }
            .text-red { color: #c62828; font-weight: bold; }
            .summary-box {
              margin-top: 24px;
              padding: 16px;
              background-color: #fdfaf2;
              border: 1px solid #f2e3c0;
              border-radius: 6px;
              font-size: 13px;
            }
            .signatures {
              margin-top: 48px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              text-align: center;
              font-size: 12px;
            }
            .sig-line {
              margin-top: 40px;
              border-top: 1px dashed #aaa;
              padding-top: 8px;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body onload="window.print()">
          <div class="header">
            <h1>AL-XPRESS LOGISTICS & CARGO GROUP</h1>
            <p>${isAr ? 'كشف الحسابات ومطابقات الأرصدة والعهد الرسمية' : 'OFFICIAL LEDGER RECONCILIATION STATEMENT'}</p>
            <p>${isAr ? 'تقرير نظام الحسابات المتقدم المتكامل' : 'AI-POWERED BALANCED TRIAL STATEMENT'}</p>
          </div>
          <div class="meta-grid">
            <div>
              <span class="meta-label">${isAr ? 'تاريخ التصدير:' : 'Date Issued:'}</span> ${formatDateTime()}
            </div>
            <div>
              <span class="meta-label">${isAr ? 'المحاسب المسؤول:' : 'Approved by Email:'}</span> ${currentUser?.email || 'admin@alxpress.system'}
            </div>
          </div>
          ${content}
          
          <div class="signatures">
            <div>
              <p class="bold">${isAr ? 'توقيع المحاسب القانوني' : 'Finance Manager Signature'}</p>
              <div class="sig-line"></div>
            </div>
            <div>
              <p class="bold">${isAr ? 'ختم الشركة والاعتماد' : 'Executive Corporate Seal'}</p>
              <div class="sig-line"></div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
                {isAr ? 'تعديل كافة بيانات القيد المالي' : 'Full Journal Entry Editor'}
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
                  <select
                    value={editJournalData.currencyOriginal}
                    onChange={(e) => setEditJournalData({ ...editJournalData, currencyOriginal: e.target.value })}
                    className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer font-mono bg-[#121215]"
                  >
                    {activeCurrencies.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
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
