import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText, Search, CreditCard, ShieldAlert, CheckCircle, Wallet, ArrowUpRight,
  ArrowDownLeft, HelpCircle, User, Truck, Calendar, Printer, Download, Star, ExternalLink,
  DollarSign, Activity, FileSpreadsheet, PlusCircle, Scale, Receipt, Sparkles, TrendingUp, RefreshCw, X,
  FolderTree, Wrench, Users, Coins, UserCheck, Eye, ChevronDown, ChevronUp, Edit2, Lock, Trash2, ArrowRightLeft
} from 'lucide-react';
import { db, auth } from '../lib/supabase-firebase-adapter';
import { collection, addDoc, doc, updateDoc, writeBatch, deleteDoc, onSnapshot, query, orderBy, increment, getDocs, where } from '../lib/supabase-firebase-adapter';
import { notificationService } from '../services/notificationService';
import ChartOfAccounts from './ChartOfAccounts';
import AssetsPortfolio from './AssetsPortfolio';
import OrderStatusManagementTab from './OrderStatusManagementTab';
import { useExpenseCategories } from '../hooks/useExpenseCategories';
import { financialAccountService } from '../services/financialAccountService';
import { useRole } from '../hooks/useRole';
import { formatDate, formatDateTime, now } from '../lib/dateUtils';

import { useExchangeRates } from '../hooks/useExchangeRates';

interface FinanceAccountingProps {
  orders: any[];
  expenses: any[];
  couriers: any[];
  customers: any[];
  isAr: boolean;
  settings: any;
  initialTab?: string;
}

export default function FinanceAccounting({
  orders,
  expenses,
  couriers,
  customers,
  isAr,
  settings,
  initialTab = 'general_ledger'
}: FinanceAccountingProps) {
  const [accountingTab, setAccountingTab] = useState<string>(initialTab);
  const EXPENSE_CATEGORIES_DYNAMIC = useExpenseCategories();
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

  // Real-time assets sync for dynamic pricing in Chart of Accounts
  const [assets, setAssets] = useState<any[]>([]);
  // Real-time financial accounts sync
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'assets'), (snap) => {
      setAssets(snap.docs.map((doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error loading assets for balance list:", error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'accounts'), (snap) => {
      setFinancialAccounts(snap.docs.map((doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error loading financial accounts:", error);
    });
    return () => unsub();
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

  // New states for Unified Ledger and Salary Audits
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);
  const [moduleFilter, setModuleFilter] = useState<'all' | 'order' | 'expenses' | 'custody' | 'payment' | 'salary' | 'adjustment'>('all');
  const [isSalaryPayment, setIsSalaryPayment] = useState(false);
  const [adjustSalaryMonth, setAdjustSalaryMonth] = useState('');
  const [bulkReconciliationLoading, setBulkReconciliationLoading] = useState(false);

  // ── Salary History tab states ──
  const [salaryHistory, setSalaryHistory] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [salarySearch, setSalarySearch] = useState('');
  const [salaryEmployeeFilter, setSalaryEmployeeFilter] = useState('all');
  const [salaryMonthFilter, setSalaryMonthFilter] = useState('');
  const [selectedSalaryVoucher, setSelectedSalaryVoucher] = useState<any>(null);
  // Employee Statement sub-view
  const [employeeStatementId, setEmployeeStatementId] = useState<string | null>(null);
  const [empStmtDateFilter, setEmpStmtDateFilter] = useState<'all' | '30days' | 'custom'>('all');
  const [empStmtStartDate, setEmpStmtStartDate] = useState('');
  const [empStmtEndDate, setEmpStmtEndDate] = useState('');

  const { role, hasPermission } = useRole();
  const canEditFinance = role === 'Admin' || hasPermission('edit_finance');

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

    // Snapshot listener for account transactions
    const unsub = onSnapshot(collection(db, 'account_transactions'), (snap) => {
      setAccountTransactions(snap.docs.map((doc: { id: any; data: () => any; }) => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error loading account transactions:", error);
    });
    return () => unsub();
  }, []);

  // Load salary history & employees for the Salary History tab
  useEffect(() => {
    const qHist = query(collection(db, 'salary_history'), orderBy('createdAt', 'desc'));
    const unsubH = onSnapshot(qHist, (snap) => {
      setSalaryHistory(snap.docs.map((d: { id: any; data: () => any; }) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('[SalaryTab] salary_history error:', err));

    const unsubE = onSnapshot(collection(db, 'users'), (snap) => {
      setEmployees(snap.docs.map((d: { id: any; data: () => any; }) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('[SalaryTab] users error:', err));

    return () => { unsubH(); unsubE(); };
  }, []);

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

  // 1. Double-Entry General Chronology Ledger (Unified & Grouped from account_transactions and unlinked expenses)
  const ledgerEntries = useMemo(() => {
    const groupedMap = new Map<string, { debitLeg?: any; creditLeg?: any; legs: any[] }>();

    // Group account_transactions legs by journalEntryId or refNumber
    accountTransactions.forEach(tx => {
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
        const c = couriers.find(currCourier => currCourier.id === sample.entityId || currCourier.financialAccountId === sample.accountId);
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

    // B. Push unlinked expenses (general safebox outflows / inflows)
    expenses.forEach(exp => {
      if (exp.linkedAccountId || exp.financialAccountId) return;

      const date = exp.createdAt ? new Date(exp.createdAt) : new Date();
      const convertedAmt = convertToYER(exp.amount || 0, exp.currency);
      const isManualDebit = exp.notes && (exp.notes.includes('[MANUAL-DEBIT]') || exp.notes.includes('قيد تسوية مدين'));

      if (isManualDebit) {
        entries.push({
          id: `EXP-UNLINKED-${exp.id}`,
          groupKey: `EXP-UNLINKED-${exp.id}`,
          refNumber: exp.expenseNumber || 'EXP-UNLINKED',
          date,
          title: exp.notes.replace('[MANUAL-DEBIT]', '').trim(),
          notes: isAr ? 'تسوية حسابية يدوية داخلية للأصول' : 'Bilateral manual treasury entry',
          debitPartyName: exp.recipientName || (isAr ? 'الخزينة العامة' : 'Central Treasury'),
          creditPartyName: isAr ? 'حساب التسويات' : 'Adjustment Account',
          isDoubleEntry: false,
          type: 'Debit',
          amount: convertedAmt,
          currency: 'YER',
          amountOriginal: exp.amount,
          currencyOriginal: exp.currency,
          module: 'adjustment',
          allLegs: []
        });
      } else {
        const catObj = EXPENSE_CATEGORIES_DYNAMIC.find((c: { id: any; }) => c.id === exp.category) || EXPENSE_CATEGORIES_DYNAMIC.find((c: { id: string; }) => c.id === 'other');
        const catLabel = catObj ? (isAr ? catObj.labelAr : catObj.labelEn) : (isAr ? 'مصروف تشغيلي' : 'Operational Expense');
        entries.push({
          id: `EXP-UNLINKED-${exp.id}`,
          groupKey: `EXP-UNLINKED-${exp.id}`,
          refNumber: exp.expenseNumber || 'EXP-UNLINKED',
          date,
          title: isAr ? `سند صرف [${catLabel}]: ${exp.notes}` : `Expense voucher [${catLabel}]: ${exp.notes}`,
          notes: isAr ? 'خصم المصروف من الخزينة مباشرة (غير مرتبط بحساب)' : 'Direct expense safe outflow (unlinked)',
          debitPartyName: isAr ? `مصروفات [${catLabel}]` : `Expense [${catLabel}]`,
          creditPartyName: exp.recipientName || (isAr ? 'خزينة المكتب' : 'Office Safe'),
          isDoubleEntry: false,
          type: 'Credit',
          amount: convertedAmt,
          currency: 'YER',
          amountOriginal: exp.amount,
          currencyOriginal: exp.currency,
          module: 'expenses',
          allLegs: []
        });
      }
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
  }, [accountTransactions, expenses, isAr, settings, financialAccounts, couriers]);

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
    return financialAccounts.filter(acc => {
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
    const cashAccounts = financialAccounts.filter(a =>
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

    // ── 5000: All operating expenses ─────────────────────────────────────
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

      const isUnlinked = selectedEditEntry.id.startsWith('EXP-UNLINKED-');
      const affectedAccountIds = new Set<string>();

      if (isUnlinked) {
        const expId = selectedEditEntry.id.replace('EXP-UNLINKED-', '');
        const expRef = doc(db, 'expenses', expId);

        batch.update(expRef, {
          amount: rawAmt,
          currency: editJournalData.currencyOriginal,
          amountInDefaultCurrency: convertedAmt,
          notes: editJournalData.notes,
          createdAt: parsedCreatedAt,
          updatedAt: Date.now()
        });
      } else {
        const txId = selectedEditEntry.id;
        const refNum = selectedEditEntry.refNumber;

        const txQuery = refNum
          ? query(collection(db, 'account_transactions'), where('refNumber', '==', refNum))
          : query(collection(db, 'account_transactions'), where('__name__', '==', txId));

        const txSnap = await getDocs(txQuery);
        const exchangeRates = dbRates;

        const newDebitAcc = editJournalData.debitAccountId ? financialAccounts.find(a => a.id === editJournalData.debitAccountId) : null;
        const newCreditAcc = editJournalData.creditAccountId ? financialAccounts.find(a => a.id === editJournalData.creditAccountId) : null;

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

            if (txData.refNumber) {
              const expQ = query(collection(db, 'expenses'), where('expenseNumber', '==', txData.refNumber));
              const expSnaps = await getDocs(expQ);
              if (!expSnaps.empty) {
                expSnaps.forEach((expDoc) => {
                  batch.update(expDoc.ref, {
                    amount: rawAmt,
                    currency: editJournalData.currencyOriginal,
                    amountInDefaultCurrency: convertedAmt,
                    notes: editJournalData.notes,
                    createdAt: parsedCreatedAt,
                    updatedAt: Date.now()
                  });
                });
              }
            }
          }
        }

        // Update master journal entry doc if exists
        if (selectedEditEntry.journalEntryId) {
          const jvRef = doc(db, 'journal_entries', selectedEditEntry.journalEntryId);
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
            batch.delete(doc(db, 'account_transactions', leg.id));
          }
          if (leg.accountId) affectedAccountIds.add(leg.accountId);
        });
      } else if (entryToDelete.id && !entryToDelete.id.startsWith('EXP-UNLINKED-')) {
        const refNum = entryToDelete.refNumber;
        const qTx = refNum
          ? query(collection(db, 'account_transactions'), where('refNumber', '==', refNum))
          : query(collection(db, 'account_transactions'), where('__name__', '==', entryToDelete.id));
        const snap = await getDocs(qTx);
        snap.docs.forEach(d => {
          batch.delete(d.ref);
          const data = d.data();
          if (data.accountId) affectedAccountIds.add(data.accountId);
        });
      }

      // Delete master journal entry document if present
      if (entryToDelete.journalEntryId) {
        batch.delete(doc(db, 'journal_entries', entryToDelete.journalEntryId));
      }

      // Delete unlinked expense document if present
      if (entryToDelete.id && entryToDelete.id.startsWith('EXP-UNLINKED-')) {
        const expId = entryToDelete.id.replace('EXP-UNLINKED-', '');
        batch.delete(doc(db, 'expenses', expId));
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

      const srcAccount = financialAccounts.find(a => a.id === sourceAccountId || a.entityId === sourceAccountId);
      const trgAccount = financialAccounts.find(a => a.id === targetAccountId || a.entityId === targetAccountId);

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
          createdByUid: auth.currentUser?.uid || 'system',
          createdByName: auth.currentUser?.email?.split('@')[0] || 'Finance Auditor'
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
          createdByUid: auth.currentUser?.uid || 'system',
          createdByName: auth.currentUser?.email?.split('@')[0] || 'Finance Auditor'
        }
      );

      // 3. Insert into general daily ledger expense/cash flow so it displays correctly
      const trgName = trgAccount.nameAr || trgAccount.entityName;
      const srcName = srcAccount.nameAr || srcAccount.entityName;
      const notesLabel = `[DOUBLE-ENTRY] ${adjustData.title || (isAr ? 'قيد تسوية' : 'Adjustment Voucher')} (من حـ/: ${trgAccount.accountCode} - ${trgName} -> إلى حـ/: ${srcAccount.accountCode} - ${srcName})`;

      const payload = {
        expenseNumber: voucherCode,
        category: isSalaryPayment ? 'salary' : 'accounting',
        type: isSalaryPayment ? 'Salary' : 'General',
        amount: amountVal,
        currency: adjustData.currency,
        amountInDefaultCurrency: convertedAmt,
        recipientId: trgAccount.entityId || 'adjustment',
        recipientName: trgAccount.entityName || (isAr ? 'التعديلات المحاسبية' : 'Ledger Adjustments'),
        notes: notesLabel + (adjustData.notes ? ` : ${adjustData.notes}` : ''),
        status: 'Completed',
        createdByUid: auth.currentUser?.uid || 'system',
        createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
        createdByName: auth.currentUser?.email?.split('@')[0] || 'Finance Auditor',
        createdAt: timestamp,
        financialAccountId: targetAccountId,
        financialAccountCode: trgAccount.accountCode,
        salaryMonth: isSalaryPayment ? adjustSalaryMonth : null
      };

      await addDoc('exp_' + voucherCode, collection(db, 'expenses'), payload);

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
    const courierExpenses = expenses.filter(e => e.type === 'Custody' && e.recipientId === auditedCourierId);

    // Shipments handled
    const courierOrders = orders.filter(o => o.deliveryCourierId === auditedCourierId || o.shippingCourierId === auditedCourierId);

    const linkedAccount = financialAccounts.find(a => a.id === cour.financialAccountId || a.entityId === cour.financialAccountId);
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
  }, [auditedCourierId, couriers, expenses, orders, settings, financialAccounts]);

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
        const linkedAccountId = cour.financialAccountId;
        const linkedAccountCode = cour.financialAccountCode;

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
            createdByUid: auth.currentUser?.uid || 'system',
            createdByName: 'Finance Auditor'
          });
        }
      }

      // 2. Settle all pending open custodies
      const pendingCustodies = courierAuditSheet.custodies.filter(c => c.status === 'Pending');
      for (const exp of pendingCustodies) {
        const docRef = doc(db, 'expenses', exp.id);
        batch.update(docRef, {
          status: 'Settled',
          settledAt: timestamp,
          settledByEmail: auth.currentUser?.email || 'admin@swiftship.system',
          settledByName: 'Finance Auditor'
        });

        if (exp.linkedAccountId) {
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
            debitAccount: { id: exp.linkedAccountId, code: exp.linkedAccountCode || '2120' },
            creditAccount: { id: systemAccs['sys_cash_account'], code: '1111-0' },
            createdByUid: auth.currentUser?.uid || 'system',
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

      // 4. Create one big adjustment document in expenses
      const expensesRef = collection(db, 'expenses');
      await addDoc('exp_' + mainVoucherCode, expensesRef, {
        expenseNumber: mainVoucherCode,
        type: 'General',
        amount: Math.abs(currentBalance) + courierAuditSheet.totalUnremittedCashValue,
        currency: 'YER',
        recipientId: cour.id,
        recipientName: cour.fullName,
        notes: `[MANUAL-DEBIT] قيد مطابقة شامل وإقفال ذمة المندوب ${cour.fullName}`,
        status: 'Completed',
        createdByUid: auth.currentUser?.uid || 'system',
        createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
        createdByName: 'Finance Auditor',
        createdAt: timestamp
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

      // Insert a Double-Entry safe box inflow receipt voucher
      const randStr = Math.floor(1000 + Math.random() * 9000);
      const voucherCode = `REMIT-${randStr}`;
      const remitsRef = collection(db, 'expenses');

      const payload = {
        expenseNumber: voucherCode,
        type: 'General',
        amount: courierAuditSheet.totalUnremittedCashValue,
        currency: currency,
        amountInDefaultCurrency: isSourcing
          ? courierAuditSheet.totalUnremittedCashValue * (dbRates.SAR || 1)
          : courierAuditSheet.totalUnremittedCashValue,
        recipientId: courierAuditSheet.courier.id,
        recipientName: courierAuditSheet.courier.fullName,
        notes: `[MANUAL-DEBIT] توريد تحصيلات شحنات المندوب ${courierAuditSheet.courier.fullName}`,
        status: 'Completed',
        createdByUid: auth.currentUser?.uid || 'system',
        createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
        createdByName: 'Finance Auditor',
        createdAt: Date.now()
      };

      await addDoc('exp_' + voucherCode, remitsRef, payload);
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
      const docRef = doc(db, 'expenses', custodyDocId);
      await updateDoc(docRef, {
        status: 'Settled',
        settledAt: Date.now(),
        settledByEmail: auth.currentUser?.email || 'admin@swiftship.system',
        settledByName: 'Finance Auditor'
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
        message: err.message || 'Could not discharge custody row in Firestore.',
        type: 'error'
      });
    }
  };

  // 3. Bilateral Customer Statement of Account Ledger (Standard matching sub-ledger using account_transactions)
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
      const linkedAccountId = customerRecord.financialAccountId;
      const linkedAccountCode = customerRecord.financialAccountCode;

      // Record cash inflow adjustment voucher in ledger safe box
      const randStr = Math.floor(1000 + Math.random() * 9000);
      const voucherNum = `RCV-${randStr}`;
      const adjustmentsRef = collection(db, 'expenses');

      const payload = {
        expenseNumber: voucherNum,
        type: 'General',
        amount: amountVal,
        currency: 'YER',
        recipientId: customerLedgerDetails.customer.id,
        recipientName: customerLedgerDetails.customer.fullName,
        notes: `[MANUAL-DEBIT] سند قبض دفعة على الحساب للعميل: ${customerLedgerDetails.customer.fullName} - ${payNotes || ''}`,
        status: 'Completed',
        createdByUid: auth.currentUser?.uid || 'system',
        createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
        createdByName: 'Finance Auditor',
        createdAt: Date.now(),
        financialAccountId: linkedAccountId || null,
        financialAccountCode: linkedAccountCode || null
      };

      await addDoc('exp_' + voucherNum, adjustmentsRef, payload);

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
          createdByUid: auth.currentUser?.uid || 'system',
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
              <span class="meta-label">${isAr ? 'المحاسب المسؤول:' : 'Approved by Email:'}</span> ${auth.currentUser?.email || 'admin@alxpress.system'}
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

      {/* Tab Selectors header */}
      <div className="flex flex-wrap border-b border-slate-850 gap-4 mb-2">
        <button
          onClick={() => setAccountingTab('general_ledger')}
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${accountingTab === 'general_ledger'
            ? 'border-[#d4af37] text-white'
            : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
        >
          <Scale className="w-3.5 h-3.5 animate-pulse" />
          {isAr ? '⚖️ الدفتر اليومي والمقاصة' : 'Daily Double-Entry Ledger'}
        </button>
        <button
          onClick={() => setAccountingTab('courier_audit')}
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${accountingTab === 'courier_audit'
            ? 'border-[#d4af37] text-white'
            : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
        >
          <Truck className="w-3.5 h-3.5" />
          {isAr ? '🔑 كاشف ومطابقة حسابات المناديب' : 'Courier Custody Statement'}
        </button>
        <button
          onClick={() => setAccountingTab('customer_audit')}
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${accountingTab === 'customer_audit'
            ? 'border-[#d4af37] text-white'
            : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
        >
          <User className="w-3.5 h-3.5" />
          {isAr ? '👥 كشف حساب ومطابقات العملاء' : 'Customer Account Audits'}
        </button>

        {/* Tab 4: Chart of Accounts */}
        <button
          onClick={() => setAccountingTab('chart_of_accounts')}
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${accountingTab === 'chart_of_accounts'
            ? 'border-[#d4af37] text-white'
            : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
        >
          <FolderTree className="w-3.5 h-3.5 text-[#d4af37]" />
          {isAr ? '🌳 الشجرة المحاسبية (COA)' : 'Chart of Accounts'}
        </button>

        {/* Tab 5: Financial Accounts Dashboard */}
        <button
          onClick={() => setAccountingTab('financial_accounts')}
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${accountingTab === 'financial_accounts'
            ? 'border-[#d4af37] text-white'
            : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
        >
          <Wallet className="w-3.5 h-3.5 text-[#d4af37]" />
          {isAr ? '💳 إدارة الحسابات المالية' : 'Financial Accounts'}
        </button>

        {/* Tab 6: Assets Management */}
        <button
          onClick={() => setAccountingTab('assets_management')}
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${accountingTab === 'assets_management'
            ? 'border-[#d4af37] text-white'
            : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
        >
          <Wrench className="w-3.5 h-3.5 text-[#d4af37]" />
          {isAr ? '📦 سجل الأصول والثابتة وصيانتها' : 'Assets & Maintenance Portfolio'}
        </button>

        {/* Tab 7: Salary History & Employee Statements */}
        <button
          onClick={() => setAccountingTab('salary_history')}
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${accountingTab === 'salary_history'
            ? 'border-[#d4af37] text-white'
            : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
        >
          <Users className="w-3.5 h-3.5 text-[#d4af37]" />
          {isAr ? '💼 سجل الرواتب وكشف حساب الموظفين' : 'Salary History & Staff Statements'}
        </button>

        {/* Tab 8: Automatic Posting Rules Manager */}
        <button
          onClick={() => setAccountingTab('auto_voucher_rules')}
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${accountingTab === 'auto_voucher_rules'
            ? 'border-[#d4af37] text-white'
            : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
        >
          <Activity className="w-3.5 h-3.5 text-[#d4af37]" />
          {isAr ? '⚙️ تهيئة قيود الطلبات التلقائية' : 'Configure Auto Vouchers'}
        </button>
      </div>

      {/* RENDER TAB 1: GENERAL DOUBLE-ENTRY LEDGER */}
      {accountingTab === 'general_ledger' && (
        <div className="space-y-6">

          {/* Advanced Multi-Filters Desk && Quick voucher adjustment trigger */}
          <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1">{isAr ? 'مرشحات المراجعة المالية المتقدمة' : 'Advanced Accounting Audit Bench'}</h3>
                <p className="text-[10px] text-slate-550 font-medium">{isAr ? 'قم بفلترة قيود الخزينة وميزان المراجعة تزامناً مع الدفاتر.' : 'Filter daily cash books and compute targeted balances live.'}</p>
              </div>

              <div className="flex flex-wrap gap-2.5 w-full lg:w-auto">
                {/* Export Link */}
                <button
                  onClick={exportLedgerToCSV}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-black transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  {isAr ? 'تصدير الدفتر CSV' : 'Export Ledger Sheet'}
                </button>

                {/* Print button */}
                <button
                  onClick={() => triggerPrint(isAr ? 'الدفتر المالي العام' : 'General Chronology Ledger', 'ledger-print-wrapper')}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-black transition-all"
                >
                  <Printer className="w-3.5 h-3.5 text-[#d4af37]" />
                  {isAr ? 'طباعة الدفتر' : 'Print General Book'}
                </button>

                {/* Trigger Adjustment Modal */}
                <button
                  onClick={() => setIsAdjustmentModalOpen(true)}
                  className="flex items-center gap-1.5 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/25 text-[#d4af37] px-3.5 py-2 rounded-xl text-xs font-black transition-all ml-auto lg:ml-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  {isAr ? 'قيد تسوية وتعديل مالي' : 'Manual Journal Entry'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-black/20 p-4 rounded-2xl border border-slate-900">

              {/* Type Filter */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">{isAr ? 'نوع القيد الدفتري' : 'Transaction Type'}</label>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as any)}
                  className="bg-black/40 border border-slate-850 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#d4af37] w-full cursor-pointer"
                >
                  <option value="all">{isAr ? 'جميع القيود' : 'All Ledger Entries'}</option>
                  <option value="Debit">{isAr ? 'مقبوضات / مدين (+)' : 'Inflows / Debits'}</option>
                  <option value="Credit">{isAr ? 'مصروفات وصرف / دائن (-)' : 'Outflows / Credits'}</option>
                </select>
              </div>

              {/* Module Filter */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">{isAr ? 'فلتر المعاملة (الوحدة)' : 'Module / Type'}</label>
                <select
                  value={moduleFilter}
                  onChange={e => setModuleFilter(e.target.value as any)}
                  className="bg-black/40 border border-slate-850 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#d4af37] w-full cursor-pointer"
                >
                  <option value="all">{isAr ? 'جميع الوحدات' : 'All Modules'}</option>
                  <option value="order">{isAr ? 'طلبات الشحن الشحنات' : 'Cargo Orders'}</option>
                  <option value="expenses">{isAr ? 'مصروفات عامة' : 'Expenses'}</option>
                  <option value="custody">{isAr ? 'عهد مالية' : 'Custodies'}</option>
                  <option value="payment">{isAr ? 'قبض دفعات' : 'Customer Payments'}</option>
                  <option value="salary">{isAr ? 'صرف رواتب' : 'Salaries'}</option>
                  <option value="adjustment">{isAr ? 'قيود تسوية' : 'Adjustments'}</option>
                </select>
              </div>

              {/* Currency original Filter */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">{isAr ? 'حسب عملة السداد الأصلية' : 'Billed CurrencyOriginal'}</label>
                <select
                  value={currencyFilter}
                  onChange={e => setCurrencyFilter(e.target.value as any)}
                  className="bg-black/40 border border-slate-850 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#d4af37] w-full cursor-pointer"
                >
                  <option value="all">{isAr ? 'جميع العملات' : 'All currencies'}</option>
                  {activeCurrencies.map(c => (
                    <option key={c.code} value={c.code}>
                      {isAr ? (c.main_nameAR || c.sup_nameAR || c.code) : (c.main_nameEn || c.sup_nameEn || c.code)} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Predefined Date Ranges */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">{isAr ? 'الفترة الزمنية' : 'Accounting Period'}</label>
                <select
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value as any)}
                  className="bg-black/40 border border-slate-850 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#d4af37] w-full cursor-pointer"
                >
                  <option value="all">{isAr ? 'كامل السجل التاريخي' : 'All time records'}</option>
                  <option value="today">{isAr ? 'اليوم' : 'Today only'}</option>
                  <option value="7days">{isAr ? 'آخر 7 أيام' : 'Last 7 Days'}</option>
                  <option value="30days">{isAr ? 'آخر 30 يوم' : 'Last 30 Days'}</option>
                  <option value="custom">{isAr ? 'فترة زمنية مخصصة' : '-- Custom Date Range --'}</option>
                </select>
              </div>

              {/* Text Search input */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">{isAr ? 'بحث سريع بالنص' : 'Interactive text search'}</label>
                <div className="relative">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-550 w-3 h-3" />
                  <input
                    type="text"
                    value={searchLedgerQuery}
                    onChange={e => setSearchLedgerQuery(e.target.value)}
                    placeholder={isAr ? "رقم مرجعي، عميل، سند..." : "Search particulars..."}
                    className="w-full pr-8 pl-3 py-1.5 bg-black/40 border border-slate-850 text-white rounded-lg text-xs font-semibold outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

            </div>

            {/* Custom Date Pickers Expanded */}
            {dateFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-3 bg-black/35 p-3 rounded-2xl border border-dashed border-slate-850 animate-fade-in max-w-xl">
                <div>
                  <label className="block text-[9px] text-slate-550 mb-1">{isAr ? 'من تاريخ:' : 'Starting date:'}</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="bg-black/50 border border-slate-850 text-white rounded-lg p-1.5 text-xs font-bold w-full outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-550 mb-1">{isAr ? 'إلى تاريخ:' : 'Ending date:'}</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="bg-black/50 border border-slate-850 text-white rounded-lg p-1.5 text-xs font-bold w-full outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Ledger Table Section */}
          <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-xl" id="ledger-print-wrapper">

            {/* PDF/Print Custom Header - Hidden in Standard view */}
            <div className="hidden print:block p-4 border-b border-black">
              <h2 className="text-sm font-bold">{isAr ? 'مراجع دفتر اليومية العام' : 'Consolidated General Ledger Feed'}</h2>
              <p className="text-xs">
                {isAr ? `تصفية المرشحات: نوع القيد [${typeFilter}] العملة [${currencyFilter}] الفترة [${dateFilter}]`
                  : `Filters applied: Module [${typeFilter}] Currency [${currencyFilter}] Range [${dateFilter}]`}
              </p>
              <br />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start">
                <thead className="bg-[#0a0a0d] text-slate-500 text-[9.5px] font-black uppercase tracking-wider border-b border-slate-850">
                  <tr>
                    <th className="p-4">{isAr ? 'التاريخ الفعلي' : 'Effective Date'}</th>
                    <th className="p-4">{isAr ? 'سند مرجعي / رمز القيد' : 'Voucher Node'}</th>
                    <th className="p-4">{isAr ? 'البيان والوصف التفصيلي' : 'Particulars / Annotations'}</th>
                    <th className="p-4">{isAr ? 'الطرف المدين (من حـ/)' : 'Debit Side (Dr.)'}</th>
                    <th className="p-4">{isAr ? 'الطرف الدائن (إلى حـ/)' : 'Credit Side (Cr.)'}</th>
                    <th className="p-4 text-center">{isAr ? 'مبلغ القيد والعملة' : 'Voucher Amount'}</th>
                    <th className="p-4 text-center">{isAr ? 'العمليات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-805 bg-black/10 font-bold">
                  {filteredLedgerEntries.map((e) => {
                    return (
                      <tr key={e.id} className="hover:bg-slate-950/40 transition-colors">
                        <td className="p-4 text-slate-500 text-[10px] whitespace-nowrap">
                          {e.date.toLocaleDateString()} <span className="text-[9px] block text-slate-600 font-normal">{e.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="p-4">
                          <button
                            type="button"
                            onClick={() => setSelectedLedgerEntry(e)}
                            className="bg-slate-900 hover:bg-slate-850 hover:border-slate-700 border border-slate-800 text-[#d4af37] px-2.5 py-1 rounded-lg text-[9.5px] font-mono whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none"
                            title={isAr ? 'معاينة القيد المالي المزدوج المتقابل وتفاصيله' : 'Preview Balanced Voucher Details'}
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            {e.refNumber}
                          </button>
                        </td>
                        <td className="p-4 max-w-xs">
                          <span className="text-slate-200 block text-xs font-black truncate">{e.title}</span>
                          {e.notes && e.notes !== e.title && (
                            <span className="text-[9px] text-slate-500 block font-normal truncate">{e.notes}</span>
                          )}
                        </td>
                        <td className="p-4 font-bold text-emerald-400">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] px-1 py-0.2 bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 rounded shrink-0">مدين</span>
                            <span className="text-xs text-slate-200">{e.debitPartyName || '—'}</span>
                          </div>
                        </td>
                        <td className="p-4 font-bold text-rose-400">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] px-1 py-0.2 bg-rose-950/60 border border-rose-800/40 text-rose-400 rounded shrink-0">دائن</span>
                            <span className="text-xs text-slate-200">{e.creditPartyName || '—'}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-black text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-white text-xs">
                              {e.amountOriginal.toLocaleString()} {e.currencyOriginal}
                            </span>
                            {e.currencyOriginal !== 'YER' && (
                              <span className="text-[9.5px] text-slate-500 font-normal" dir="ltr">
                                (≈ {e.amount.toLocaleString()} YER)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedLedgerEntry(e)}
                              className="p-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                              title={isAr ? 'معاينة القيد والطباعة' : 'View Voucher'}
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                            </button>

                            {/* Edit Button */}
                            {canEditFinance && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEditEntry(e);
                                  setEditJournalData({
                                    amountOriginal: (e.amountOriginal || e.amount).toString(),
                                    currencyOriginal: e.currencyOriginal || 'YER',
                                    notes: e.notes || e.title || '',
                                    createdAt: new Date(e.date).toISOString().substring(0, 16),
                                    debitAccountId: e.debitAccountId || e.debitLeg?.accountId || '',
                                    creditAccountId: e.creditAccountId || e.creditLeg?.accountId || ''
                                  });
                                  setIsEditJournalOpen(true);
                                }}
                                className="p-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-amber-400 rounded-lg text-xs transition-all cursor-pointer"
                                title={isAr ? 'تعديل بيانات القيد المالي' : 'Edit Entry'}
                              >
                                <Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />
                              </button>
                            )}

                            {/* Delete Button */}
                            {canEditFinance && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEntryToDelete(e);
                                  setDeletePin('');
                                  setDeletePinError('');
                                  setIsDeletePinModalOpen(true);
                                }}
                                className="p-1.5 bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-400 rounded-lg text-xs transition-all cursor-pointer"
                                title={isAr ? 'حذف القيد المالي (يتطلب رمز PIN)' : 'Delete Entry (PIN required)'}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLedgerEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-16 text-center text-slate-500 font-bold font-mono text-[10px] uppercase select-none">
                        [ {isAr ? 'لا توجد قيود بالدفتر اليومي مطابقة للمرشحات' : 'no_ledger_vouchers_recorded_in_current_scope'} ]
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Trial Balance Footer Stats block */}
            <div className="bg-[#0e0e11] p-4 border-t border-slate-850 flex flex-wrap justify-between items-center text-xs text-slate-400">
              <span className="font-mono text-[10px] uppercase">[ {filteredLedgerEntries.length} chronological_vouchers_rendered ]</span>
              <div className="flex gap-4 font-bold">
                <span className="text-emerald-400">{isAr ? 'إجمالي المقبوض:' : 'Total Debit:'} {filteredLedgerEntries.filter(e => e.type === 'Debit').reduce((sum, e) => sum + e.amount, 0).toLocaleString()} YER</span>
                <span className="text-rose-500">{isAr ? 'إجمالي المنصرف:' : 'Total Credit:'} {filteredLedgerEntries.filter(e => e.type === 'Credit').reduce((sum, e) => sum + e.amount, 0).toLocaleString()} YER</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* RENDER TAB 2: INDIVIDUAL COURIER CUSTODY & DELIVERIES AUDIT */}
      {accountingTab === 'courier_audit' && (
        <div className="space-y-6">
          <div className="bg-[#121215] border border-slate-850 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-[#d4af37] mb-1.5 uppercase tracking-wider">{isAr ? 'اختر المندوب المراد سحب وكشف مطابقة حساباته المفتوحة' : 'Select Corporate Courier for Liability Audit'}</label>
              <select
                value={auditedCourierId}
                onChange={e => setAuditedCourierId(e.target.value)}
                className="bg-black/40 border border-slate-850 text-white rounded-xl px-4 py-3 text-xs font-extrabold outline-none focus:border-[#d4af37] cursor-pointer w-full md:max-w-md"
              >
                <option value="">{isAr ? '-- اختر مندوب التوزيع والمقاصة --' : '-- Choose Corporate Courier --'}</option>
                {couriers.map(c => (
                  <option key={c.id} value={c.id}>{c.fullName} ({c.courierCustomId})</option>
                ))}
              </select>
            </div>

            {courierAuditSheet && (
              <button
                onClick={() => triggerPrint(isAr ? `كشف حساب المندوب: ${courierAuditSheet.courier.fullName}` : 'Courier Liability Report', 'courier-print-wrapper')}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-black transition-all"
              >
                <Printer className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'طباعة كشف المندوب وعهدته' : 'Print Courier Statement'}
              </button>
            )}
          </div>

          {courierAuditSheet ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="courier-print-wrapper">

              {/* Liabilities profile & metrics */}
              <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl text-start shadow-md space-y-4 lg:col-span-1">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="bg-[#d4af37]/10 p-2.5 rounded-2xl border border-[#d4af37]/20 text-[#d4af37]">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{courierAuditSheet.courier.fullName}</h3>
                    <p className="text-[9px] text-[#d4af37] font-bold uppercase">{courierAuditSheet.courier.courierCustomId || 'Logistics Partner'}</p>
                    <p className="text-[9.5px] text-slate-500 font-mono">{courierAuditSheet.courier.phone}</p>
                  </div>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-black">{isAr ? 'العهد المالية الإجمالية المستلمة' : 'Gross Custodies Issued'}</span>
                    <span className="text-base font-mono font-black text-white">{formatCurrencyWithYerEquiv(courierAuditSheet.totalCustodyIssued, courierAuditSheet.currency)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-black">{isAr ? 'العهد المصفاة والمسلمة' : 'Reconciled & Settled'}</span>
                    <span className="text-base font-mono font-black text-emerald-450">{formatCurrencyWithYerEquiv(courierAuditSheet.totalCustodySettled, courierAuditSheet.currency)}</span>
                  </div>

                  {/* Active liability trust */}
                  <div className="bg-[#ef4444]/5 p-3 rounded-2xl border border-[#ef4444]/15">
                    <span className="text-[10px] text-rose-400 uppercase block font-black">{isAr ? 'الرصيد المالي الإجمالي المطلوب من المندوب' : 'Net Liable Ledger Balance'}</span>
                    <span className="text-lg font-mono font-black text-rose-500">{formatCurrencyWithYerEquiv(courierAuditSheet.courier.financialBalance || 0, courierAuditSheet.currency)}</span>
                    <span className="text-[8.5px] text-slate-500 block mt-1 leading-snug">{isAr ? 'الرصيد الجاري الفعلي للمندوب المطابق لشجرة الحسابات ودفتر اليومية الموحد.' : 'Actual current balance of the courier matching the chart of accounts and journal entries.'}</span>
                  </div>

                  {/* Delivery Cargo COD Cash holding - HUGE Logistics-finance highlight! */}
                  <div className="bg-cyan-500/5 p-4 rounded-3xl border border-cyan-500/15 space-y-3">
                    <div>
                      <span className="text-[10px] text-cyan-400 uppercase block font-black">{isAr ? 'التحصيلات النقدية للشحنات المسلمة بذمته' : 'Cargo Cash Held (COD)'}</span>
                      <span className="text-lg font-mono font-black text-cyan-400">{formatCurrencyWithYerEquiv(courierAuditSheet.totalUnremittedCashValueInTargetCurrency, courierAuditSheet.currency)}</span>
                      <span className="text-[8.5px] text-slate-500 block mt-1 leading-snug">
                        {isAr ? `نقدية محصلة من ${courierAuditSheet.currentUnremittedCargoCash.length} طرد مسلّم، في انتظار التوريد المالي للخزينة.` : `Direct cash collected from ${courierAuditSheet.currentUnremittedCargoCash.length} delivered items waiting transfer.`}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {courierAuditSheet.totalUnremittedCashValue > 0 && (
                        <button
                          onClick={handleBulkRemitCourierCash}
                          disabled={cargoRemitLoading}
                          className="w-full bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-black py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-950/20 disabled:opacity-50 cursor-pointer"
                        >
                          {cargoRemitLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Receipt className="w-3.5 h-3.5" />
                          )}
                          {isAr ? 'توريد النقدية وتصفير تحصيلات الطرود' : 'Deposit COD Collections Cash'}
                        </button>
                      )}

                      <button
                        onClick={handleFullCourierReconciliation}
                        disabled={bulkReconciliationLoading}
                        className="w-full bg-[#d4af37] hover:bg-[#bfa032] active:bg-[#aa8e2b] text-black py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-950/20 disabled:opacity-50 cursor-pointer"
                      >
                        {bulkReconciliationLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Scale className="w-3.5 h-3.5" />
                        )}
                        {isAr ? 'تصفير الذمة والمطابقة الكاملة' : 'Full Audit Reconciliation'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-850 flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-400">{isAr ? 'نسبة تسليم الشحنات الناجحة:' : 'Success Deliver rate:'}</span>
                    <span className="text-cyan-400 bg-cyan-950/20 px-2 py-0.5 rounded font-mono font-black">{courierAuditSheet.successRate}% ({courierAuditSheet.totalOrdersDelivered} Delivered)</span>
                  </div>
                </div>
              </div>

              {/* Transactions list & cash holding table */}
              <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl text-start shadow-md lg:col-span-2 space-y-6">

                {/* 1. Custodies Ledger section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider border-b border-slate-850 pb-2">
                    {isAr ? 'أولاً: تفاصيل العهد التشغيلية المسلمة وتصفيتها' : 'I. Office Custody Slips & Reconciliations'}
                  </h3>

                  <div className="divide-y divide-slate-850 space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {courierAuditSheet.custodies.map((cust) => {
                      const isSettled = cust.status === 'Settled';
                      return (
                        <div key={cust.id} className="pt-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className={`bg-slate-900 border border-slate-800 text-[#d4af37] px-2 py-0.5 rounded text-[9px] font-mono mr-2`}>
                              {cust.expenseNumber}
                            </span>
                            <span className="text-slate-300 font-bold">{cust.notes || (isAr ? 'سند عهدة' : 'Custody Slip')}</span>
                            <span className="text-[9px] text-slate-550 block font-normal">
                              بواسطة: {cust.createdByName || 'المسؤول'} • {cust.createdAt?.toDate ? cust.createdAt.toDate().toLocaleDateString() : new Date(cust.createdAt || Date.now()).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="text-right flex items-center gap-3">
                            <div>
                              <span className="text-[#d4af37] font-mono font-black block">{formatAmountWithEquiv(cust.amount || 0, cust.currency || 'YER')}</span>
                              {isSettled ? (
                                <span className="text-[8.5px] font-black text-emerald-400 bg-emerald-950/25 px-1.5 rounded uppercase">{isAr ? `مسواة في: ${cust.settledAt ? new Date(cust.settledAt).toLocaleDateString() : ''}` : 'Settled'}</span>
                              ) : (
                                <span className="text-[8.5px] font-black text-amber-500 bg-amber-950/25 px-1.5 rounded uppercase animate-pulse">{isAr ? 'علقة جارية' : 'Active Pending'}</span>
                              )}
                            </div>

                            {!isSettled && (
                              <button
                                onClick={() => handleDirectSettleCustody(cust.id, cust.recipientName)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-black px-2.5 py-1 rounded-lg text-[9px] font-black transition-all"
                              >
                                {isAr ? 'تسوية عاجلة' : 'Settle'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {courierAuditSheet.custodies.length === 0 && (
                      <p className="p-12 text-center text-slate-550 font-bold font-mono text-[9px] uppercase select-none">
                        [ no_custody_vouchers_filed_for_courier ]
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. Courier Transactions Ledger section */}
                <div className="space-y-3 pt-4 border-t border-slate-850">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider pb-2 border-b border-slate-850">
                    {isAr ? 'ثانياً: المعاملات المالية والحركات المقيدة على الحساب' : 'II. Financial Transactions Sub-Ledger'}
                  </h3>

                  <div className="divide-y divide-slate-850 space-y-2 max-h-60 overflow-y-auto pr-1">
                    {courierTransactions.map((tx) => {
                      const isCredit = tx.type === 'Credit';
                      return (
                        <div key={tx.id} className="pt-2 flex items-center justify-between text-xs">
                          <div>
                            <span className="bg-slate-900 border border-slate-800 text-[#d4af37] px-2 py-0.5 rounded text-[9px] font-mono mr-2">
                              {tx.refNumber}
                            </span>
                            <span className="text-slate-305 text-slate-300 font-bold">{tx.normalizedDescription || tx.description || tx.module}</span>
                            <span className="text-[9px] text-slate-550 block font-normal">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ''}
                            </span>
                          </div>

                          <div className="text-right">
                            <div className={`font-mono font-black ${isCredit ? 'text-emerald-400' : 'text-rose-500'}`}>
                              {isCredit ? '+' : '-'}{formatAmountWithEquiv(tx.amountOriginal || tx.amount || 0, tx.currencyOriginal || 'YER')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {courierTransactions.length === 0 && (
                      <p className="p-12 text-center text-slate-550 font-bold font-mono text-[9px] uppercase select-none">
                        [ no_financial_transactions_logged_for_courier ]
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. Shipped Cargo Collections held COD */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider border-b border-slate-850 pb-2 flex justify-between">
                    <span>{isAr ? 'ثانياً: الطرود المسلمة في حوزته قيد التحصيل' : 'II. Handed Cargo Delivered COD Outstanding'}</span>
                    <span className="text-[10px] text-cyan-400 font-mono">({courierAuditSheet.currentUnremittedCargoCash.length} items)</span>
                  </h3>

                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-start text-[11px]">
                      <thead className="bg-[#0c0c0f] text-slate-550 text-[9px] font-bold uppercase border-b border-slate-850">
                        <tr>
                          <th className="p-2">{isAr ? 'رقم الطرد' : 'Order No'}</th>
                          <th className="p-2">{isAr ? 'اسم المستلم' : 'Recipient'}</th>
                          <th className="p-2">{isAr ? 'الموعد المالي' : 'Delivered Time'}</th>
                          <th className="p-2 text-left">{isAr ? 'مبلغ التحصيل لليمن' : 'Collection due'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 bg-black/5">
                        {courierAuditSheet.currentUnremittedCargoCash.map((ord: any) => (
                          <tr key={ord.id} className="hover:bg-slate-900/30">
                            <td className="p-2 font-mono font-bold text-[#d4af37]">{ord.orderNumber}</td>
                            <td className="p-2 text-slate-300 font-bold">{ord.customerName}</td>
                            <td className="p-2 text-slate-500">
                              {ord.deliveredAt?.toDate ? ord.deliveredAt.toDate().toLocaleDateString() : (ord.deliveredAt ? new Date(ord.deliveredAt).toLocaleDateString() : '—')}
                            </td>
                            <td className="p-2 text-left font-mono font-black text-cyan-400">
                              {courierAuditSheet.courier.courierType === 'sourcing' ? (
                                <div className="text-right">
                                  <span>{((parseFloat(ord.amountRemaining || 0) / (dbRates.SAR || 1))).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} SAR</span>
                                  <span className="block text-[9px] text-slate-550 font-normal">({parseFloat(ord.amountRemaining || 0).toLocaleString()} YER)</span>
                                </div>
                              ) : (
                                <span>{parseFloat(ord.amountRemaining || 0).toLocaleString()} YER</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {courierAuditSheet.currentUnremittedCargoCash.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-12 text-center text-slate-600 font-mono text-[9px] uppercase select-none">
                              [ {isAr ? 'لا توجد شحنات معلقة التحصيل بذمة المندوب' : 'no_unremitted_cargo_collections_outstanding'} ]
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="p-16 text-center text-slate-500 font-black font-mono text-[10px] uppercase border border-dashed border-slate-850 rounded-3xl">
              [ {isAr ? 'يرجى اختيار مندوب التوزيع لمراجعة حسابه المالي وعُهده' : 'select_courier_from_selector_to_render_standing_account'} ]
            </div>
          )}
        </div>
      )}

      {/* RENDER TAB 3: INDIVIDUAL CUSTOMER ACCOUNT RECONCILIATION */}
      {accountingTab === 'customer_audit' && (
        <div className="space-y-6 flex flex-col">
          <div className="bg-[#121215] border border-slate-850 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-[#d4af37] mb-1.5 uppercase tracking-wider">{isAr ? 'اختر العميل المراد فتح كشف حسابه الدفتري التفصيلي بمستحقات الشحن' : 'Select Customer Account for Sub-Ledger Audit'}</label>
              <select
                value={auditedCustomerId}
                onChange={e => setAuditedCustomerId(e.target.value)}
                className="bg-black/40 border border-slate-850 text-white rounded-xl px-4 py-3 text-xs font-extrabold outline-none focus:border-[#d4af37] cursor-pointer w-full md:max-w-md"
              >
                <option value="">{isAr ? '-- اختر العميل من قائمة الحسابات --' : '-- Choose Customer Account --'}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.fullName} ({c.phone})</option>
                ))}
              </select>
            </div>

            {customerLedgerDetails && (
              <div className="flex gap-2 w-full md:w-auto">
                {/* Print Statement Button */}
                <button
                  onClick={() => triggerPrint(isAr ? `كشف الحساب المالي لعميل: ${customerLedgerDetails.customer.fullName}` : 'Client Account Sub-Ledger', 'customer-print-wrapper')}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-black transition-all"
                >
                  <Printer className="w-4 h-4 text-[#d4af37]" />
                  {isAr ? 'طباعة كشف حساب رسمي' : 'Print Account Statement'}
                </button>

                {/* Receive Cash payment button */}
                <button
                  onClick={() => setIsPayModalOpen(true)}
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 ml-auto md:ml-0"
                >
                  <CreditCard className="w-4 h-4" />
                  {isAr ? 'توريد دفعة نقدية (السداد بـ FIFO)' : 'Receive Debt Cash Payment'}
                </button>
              </div>
            )}
          </div>

          {customerLedgerDetails ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="customer-print-wrapper">

              {/* Detailed Client ledger summary cards */}
              <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl text-start shadow-md space-y-4 lg:col-span-1">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20 text-emerald-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{customerLedgerDetails.customer.fullName}</h3>
                    <p className="text-[9px] text-[#d4af37] font-bold uppercase">{customerLedgerDetails.customer.phone || 'Corporate Customer'}</p>
                    <p className="text-[9.5px] text-slate-500 font-mono mt-0.5">{customerLedgerDetails.customer.address || (isAr ? 'اليمن' : 'Yemen')}</p>
                  </div>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-black">{isAr ? 'إجمالي قيمة تعاملات الشحن المدين' : 'Gross Purchases / Cargo Debits'}</span>
                    <span className="text-base font-mono font-black text-white">{customerLedgerDetails.grossFreightValuation.toLocaleString()} {customerLedgerDetails.customer.financialCurrency || 'YER'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-black">{isAr ? 'المبالغ المسددة والمقيدة كداين' : 'Settle Paid Revenues'}</span>
                    <span className="text-base font-mono font-black text-emerald-400">{customerLedgerDetails.netPaidRevenues.toLocaleString()} {customerLedgerDetails.customer.financialCurrency || 'YER'}</span>
                  </div>

                  {/* Cumulative Ledger Net balance */}
                  <div className="bg-amber-500/5 p-4 rounded-3xl border border-amber-500/10">
                    <span className="text-[10px] text-amber-500 uppercase block font-black">{isAr ? 'رصيد الحساب المتبقي بذمته (مطالبة مالية)' : 'Actual Outstanding Debit Balance'}</span>
                    <span className="text-xl font-mono font-black text-amber-500">{customerLedgerDetails.currentOutstandingBalance.toLocaleString()} {customerLedgerDetails.customer.financialCurrency || 'YER'}</span>
                    <span className="text-[8.5px] text-slate-500 block mt-1 leading-snug">
                      {isAr ? 'حاصل المديونية التراكمي المتبقي بذمة هذا الحساب عن شحنات الشحن والرسوم المعلقة.' : 'Cumulative balanced outstanding cargo debts waiting for collections.'}
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl text-[9.5px] font-bold flex justify-between items-center text-slate-300">
                    <span>{isAr ? 'أولوية سداد الديون:' : 'Aging / payment logic:'}</span>
                    <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded uppercase font-extrabold font-mono">FIFO Queue Settle</span>
                  </div>
                </div>
              </div>

              {/* Chronological Subsidiary sub-ledger list */}
              <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl text-start shadow-md lg:col-span-2 space-y-4 flex flex-col">
                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>{isAr ? 'السجل التفصيلي لقيود حساب العميل' : 'Customer Account Timeline Sub-Ledger'}</span>
                  <span className="text-[10px] text-[#d4af37] font-mono">({customerLedgerDetails.accountingTimeline.length} entries)</span>
                </h3>

                <div className="overflow-x-auto flex-1 max-h-96">
                  <table className="w-full text-start text-[11px]">
                    <thead className="bg-[#0b0b0e] text-slate-500 text-[9px] font-bold uppercase border-b border-slate-850">
                      <tr>
                        <th className="p-3">{isAr ? 'الحدث' : 'Date'}</th>
                        <th className="p-3">{isAr ? 'سند/مرجع' : 'Document ID'}</th>
                        <th className="p-3">{isAr ? 'البيان وتفاصيل الحركة' : 'Particulars'}</th>
                        <th className="p-3 text-right">{isAr ? 'مدين (+)' : 'Debit (+)'}</th>
                        <th className="p-3 text-right">{isAr ? 'دائن (-)' : 'Credit (-)'}</th>
                        <th className="p-3 text-left">{isAr ? 'الرصيد التراكمي' : 'Balance'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 font-semibold bg-black/5">
                      {customerLedgerDetails.accountingTimeline.map((row: any) => (
                        <tr key={row.id} className="hover:bg-slate-900/30">
                          <td className="p-3 text-slate-500 text-[10px] whitespace-nowrap">
                            {row.date.toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            <span className="bg-slate-900 text-slate-350 px-2 py-0.5 rounded font-mono text-[9px] border border-slate-800">
                              {row.ref}
                            </span>
                          </td>
                          <td className="p-3 text-slate-300 text-xs">
                            {row.description}
                          </td>
                          <td className="p-3 text-right font-mono text-rose-452 text-rose-400">
                            {row.debit > 0 ? (
                              <div className="flex flex-col items-end">
                                <span>+{(row.amountOriginal || row.debit).toLocaleString()} {row.currencyOriginal || (customerLedgerDetails.customer.financialCurrency || 'YER')}</span>
                                {row.currencyOriginal && row.currencyOriginal !== (customerLedgerDetails.customer.financialCurrency || 'YER') && (
                                  <span className="text-[8px] text-slate-500 font-normal">≈ {row.debit.toLocaleString()} {customerLedgerDetails.customer.financialCurrency || 'YER'}</span>
                                )}
                              </div>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-400">
                            {row.credit > 0 ? (
                              <div className="flex flex-col items-end">
                                <span>-{(row.amountOriginal || row.credit).toLocaleString()} {row.currencyOriginal || (customerLedgerDetails.customer.financialCurrency || 'YER')}</span>
                                {row.currencyOriginal && row.currencyOriginal !== (customerLedgerDetails.customer.financialCurrency || 'YER') && (
                                  <span className="text-[8px] text-slate-500 font-normal">≈ {row.credit.toLocaleString()} {customerLedgerDetails.customer.financialCurrency || 'YER'}</span>
                                )}
                              </div>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-left font-mono font-black text-slate-200">
                            {row.balance.toLocaleString()} {customerLedgerDetails.customer.financialCurrency || 'YER'}
                          </td>
                        </tr>
                      ))}
                      {customerLedgerDetails.accountingTimeline.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-16 text-center text-slate-500 font-bold font-mono text-[10px] uppercase select-none">
                            [ no_ledger_activities_logged_for_customer ]
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="p-16 text-center text-slate-500 font-black font-mono text-[10px] uppercase border border-dashed border-slate-850 rounded-3xl">
              [ {isAr ? 'يرجى اختيار العميل من القائمة أعلاه لسحب ومطابقة كشوفات ذمته التفصيلية' : 'select_buyer_from_selector_to_render_standing_account'} ]
            </div>
          )}
        </div>
      )}

      {accountingTab === 'financial_accounts' && (
        <div className="space-y-6">
          {/* Dashboard Header & Quick Actions */}
          <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1">
                  {isAr ? 'لوحة التحكم بالحسابات المالية' : 'Financial Accounts Dashboard'}
                </h3>
                <p className="text-[10px] text-slate-550 font-medium">
                  {isAr
                    ? 'إدارة ومطابقة أرصدة حسابات العملاء، المناديب، والموظفين مباشرة مع التحويل الفوري للعملات.'
                    : 'Manage and reconcile balances for customers, couriers, and staff with real-time exchange rates.'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
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
                    setIsAdjustmentModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/35 text-[#d4af37] px-4 py-2 rounded-xl text-xs font-black transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  {isAr ? 'قيد تسوية جديد' : 'New Journal Entry'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/20 p-4 rounded-2xl border border-slate-900">
              {/* Entity Type Filter */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">
                  {isAr ? 'تصنيف الحساب المالي' : 'Account Category'}
                </label>
                <select
                  value={accountTypeFilter}
                  onChange={e => setAccountTypeFilter(e.target.value as any)}
                  className="bg-black/40 border border-slate-850 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#d4af37] w-full cursor-pointer"
                >
                  <option value="all">{isAr ? 'جميع الحسابات' : 'All Accounts'}</option>
                  <option value="customer">{isAr ? 'حسابات العملاء (1130)' : 'Customer Accounts'}</option>
                  <option value="courier">{isAr ? 'حسابات المناديب (2120)' : 'Courier Accounts'}</option>
                  <option value="employee">{isAr ? 'حسابات الموظفين (2130)' : 'Employee Accounts'}</option>
                  <option value="source">{isAr ? 'حسابات مصادر الطلبات (2140)' : 'Order Source Accounts'}</option>
                  <option value="shipping_company">{isAr ? 'حسابات شركات الشحن (2150)' : 'Shipping Company Accounts'}</option>
                  <option value="asset">{isAr ? 'حسابات الأصول الثابتة (12xx)' : 'Fixed Asset Accounts'}</option>
                </select>
              </div>

              {/* Text Search */}
              <div>
                <label className="block text-[9px] text-slate-500 font-extrabold uppercase mb-1">
                  {isAr ? 'البحث بالاسم أو رمز الحساب' : 'Search name or account code'}
                </label>
                <div className="relative">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 w-3 h-3" />
                  <input
                    type="text"
                    value={searchAccountQuery}
                    onChange={e => setSearchAccountQuery(e.target.value)}
                    placeholder={isAr ? "بحث..." : "Search..."}
                    className="w-full pr-8 pl-3 py-1.5 bg-black/40 border border-slate-850 text-white rounded-lg text-xs font-semibold outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              {/* Quick Summary Cards */}
              <div className="flex items-center justify-around bg-black/35 rounded-xl border border-slate-850 px-2">
                <div className="text-center">
                  <span className="block text-[8px] text-slate-500 font-black">{isAr ? 'إجمالي العملاء' : 'Cust Bal'}</span>
                  <span className="font-mono text-[10px] font-bold text-white block">
                    {financialAccounts.filter(a => a.entityType === 'customer').reduce((sum, a) => sum + financialAccountService.convertToDefaultCurrency(a.balance || 0, a.currency || 'YER', 'YER', dbRates), 0).toLocaleString()} YER
                  </span>
                </div>
                <div className="text-center border-l border-r border-slate-850 px-3">
                  <span className="block text-[8px] text-slate-500 font-black">{isAr ? 'إجمالي المناديب' : 'Courier Bal'}</span>
                  <span className="font-mono text-[10px] font-bold text-amber-500 block">
                    {financialAccounts.filter(a => a.entityType === 'courier').reduce((sum, a) => sum + financialAccountService.convertToDefaultCurrency(a.balance || 0, a.currency || 'YER', 'YER', dbRates), 0).toLocaleString()} YER
                  </span>
                </div>
                <div className="text-center">
                  <span className="block text-[8px] text-slate-500 font-black">{isAr ? 'إجمالي الموظفين' : 'Staff Bal'}</span>
                  <span className="font-mono text-[10px] font-bold text-indigo-400 block">
                    {financialAccounts.filter(a => a.entityType === 'employee').reduce((sum, a) => sum + financialAccountService.convertToDefaultCurrency(a.balance || 0, a.currency || 'YER', 'YER', dbRates), 0).toLocaleString()} YER
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Accounts List Table */}
          <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-start">
                <thead className="bg-[#0a0a0d] text-slate-500 text-[9.5px] font-black uppercase tracking-wider border-b border-slate-850">
                  <tr>
                    <th className="p-4">{isAr ? 'رمز الحساب' : 'Account Code'}</th>
                    <th className="p-4">{isAr ? 'الاسم المستهدف' : 'Name'}</th>
                    <th className="p-4">{isAr ? 'نوع الحساب' : 'Type'}</th>
                    <th className="p-4">{isAr ? 'الراتب الشهري' : 'Monthly Salary'}</th>
                    <th className="p-4">{isAr ? 'العملة الافتراضية' : 'Currency'}</th>
                    <th className="p-4">{isAr ? 'الرصيد باليمني' : 'YER Balance'}</th>
                    <th className="p-4">{isAr ? 'المعادل بالدولار' : 'USD Balance'}</th>
                    <th className="p-4">{isAr ? 'المعادل بالسعودي' : 'SAR Balance'}</th>
                    <th className="p-4 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-805 bg-black/10 font-bold">
                  {filteredAccountsList.map((acc, idx) => {
                    const balanceInUSD = financialAccountService.convertToTargetCurrency(acc.balance || 0, acc.currency || 'YER', 'USD', dbRates);
                    const balanceInSAR = financialAccountService.convertToTargetCurrency(acc.balance || 0, acc.currency || 'YER', 'SAR', dbRates);

                    return (
                      <tr key={`${acc.id}-${idx}`} className="hover:bg-slate-950/40 transition-colors">
                        <td className="p-4">
                          <span className="bg-slate-900 border border-slate-800 text-[#d4af37] px-2.5 py-1 rounded-lg text-[9.5px] font-mono">
                            {acc.accountCode}
                          </span>
                        </td>
                        <td className="p-4 text-white text-xs font-black">
                          <span
                            onClick={() => {
                              if (acc.entityId && (acc.entityType === 'customer' || acc.entityType === 'courier')) {
                                window.dispatchEvent(new CustomEvent('open-entity-ledger', {
                                  detail: { entityId: acc.entityId, entityType: acc.entityType }
                                }));
                              }
                            }}
                            className={
                              acc.entityId && (acc.entityType === 'customer' || acc.entityType === 'courier')
                                ? 'hover:text-[#d4af37] cursor-pointer underline decoration-dotted decoration-[#d4af37]/40 transition-colors'
                                : ''
                            }
                          >
                            {acc.entityName}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`text-[8px] uppercase font-black px-2 py-0.5 rounded ${acc.entityType === 'customer' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/20' :
                            acc.entityType === 'courier' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/20' :
                              'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/10'
                            }`}>
                            {isAr
                              ? (acc.entityType === 'customer' ? 'عميل' : acc.entityType === 'courier' ? 'مندوب' : 'موظف')
                              : acc.entityType
                            }
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-300">
                          {acc.entityType === 'employee' && acc.monthlySalary !== undefined ? (
                            <span className="text-[#d4af37] font-black">
                              {acc.monthlySalary.toLocaleString()} {acc.currency}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-400 font-mono">
                          {acc.currency}
                        </td>
                        <td className={`p-4 font-mono font-black ${(acc.balance || 0) >= 0 ? 'text-emerald-400' : 'text-rose-500'
                          }`}>
                          {acc.currency && acc.currency !== 'YER' ? (
                            <div>
                              <span>
                                {acc.currency === 'SAR' ? 'SR' : acc.currency === 'USD' ? '$' : acc.currency} {
                                  (acc.currency === 'SAR' ? balanceInSAR : balanceInUSD).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                }
                              </span>
                              <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                                (≈ {acc.balance?.toLocaleString()} YER)
                              </span>
                            </div>
                          ) : (
                            <span>{acc.balance?.toLocaleString()} YER</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-350 font-mono">
                          ${balanceInUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-slate-350 font-mono">
                          SR {balanceInSAR.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-center space-x-1.5 space-x-reverse">
                          <button
                            onClick={() => {
                              setAdjustData({
                                type: 'Debit',
                                amount: '',
                                currency: 'YER',
                                title: isAr ? 'تسوية حساب مالي' : 'Reconciliation of Account',
                                recipientName: acc.entityName,
                                notes: ''
                              });
                              setTargetType(acc.entityType);
                              setSourceAccountId('');
                              setTargetAccountId(acc.id);
                              setIsAdjustmentModalOpen(true);
                            }}
                            className="bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/25 text-[#d4af37] px-2 py-1 rounded-lg text-[10px] transition-all"
                          >
                            {isAr ? 'تسوية' : 'Reconcile'}
                          </button>

                          {acc.entityType === 'customer' && (
                            <button
                              onClick={() => {
                                setAuditedCustomerId(acc.entityId);
                                setAccountingTab('customer_audit');
                              }}
                              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-2 py-1 rounded-lg text-[10px] transition-all"
                            >
                              {isAr ? 'كشف الحساب' : 'Statement'}
                            </button>
                          )}

                          {acc.entityType === 'courier' && (
                            <button
                              onClick={() => {
                                setAuditedCourierId(acc.entityId);
                                setAccountingTab('courier_audit');
                              }}
                              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-2 py-1 rounded-lg text-[10px] transition-all"
                            >
                              {isAr ? 'كشف العهد' : 'Statement'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAccountsList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-16 text-center text-slate-500 font-bold font-mono text-[10px] uppercase select-none">
                        [ {isAr ? 'لا توجد حسابات مالية مطابقة' : 'no_financial_accounts_found'} ]
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RENDER TAB 4: CHART OF ACCOUNTS TREE */}
      {accountingTab === 'chart_of_accounts' && (
        <ChartOfAccounts
          isAr={isAr}
          settings={settings}
          vaultBalances={vaultBalances}
          financialTrialMetrics={financialTrialMetrics}
          vehiclesTotal={vehiclesTotal}
          scannersTotal={scannersTotal}
          officeAssetsTotal={officeAssetsTotal}
        />
      )}

      {/* RENDER TAB 5: PHYSICAL ASSETS PORTFOLIO & MAINTENANCE */}
      {accountingTab === 'assets_management' && (
        <AssetsPortfolio
          isAr={isAr}
          settings={settings}
          couriers={couriers}
        />
      )}

      {/* RENDER TAB 7: SALARY HISTORY & EMPLOYEE STATEMENTS */}
      {accountingTab === 'salary_history' && (() => {
        // ── Derived data ──
        const filteredSalaries = salaryHistory.filter(item => {
          const q = salarySearch.toLowerCase();
          const matchSearch = !q ||
            (item.employeeName || '').toLowerCase().includes(q) ||
            (item.voucherCode || '').toLowerCase().includes(q) ||
            (item.accountCode || '').toLowerCase().includes(q);
          const matchEmp = salaryEmployeeFilter === 'all' || item.employeeId === salaryEmployeeFilter;
          const matchMonth = !salaryMonthFilter || item.salaryMonth === salaryMonthFilter;
          return matchSearch && matchEmp && matchMonth;
        });

        const totalPaid = salaryHistory.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const uniqueStaff = new Set(salaryHistory.map(i => i.employeeId)).size;

        // Employee statement transactions
        const empStatementEmployee = employees.find(e => e.id === employeeStatementId);
        const empStatementTxns = accountTransactions
          .filter(tx => tx.entityId === employeeStatementId && tx.entityType === 'employee')
          .concat(
            salaryHistory
              .filter(s => s.employeeId === employeeStatementId)
              .map(s => ({
                id: `SAL-${s.id}`,
                createdAt: s.paidAt || s.createdAt,
                description: isAr ? `صرف راتب شهر ${s.salaryMonth}` : `Salary payment for ${s.salaryMonth}`,
                type: 'Credit',
                amount: parseFloat(s.amount) || 0,
                currency: s.currency || 'YER',
                module: 'salary',
                refNumber: s.voucherCode
              }))
          )
          .filter(tx => {
            if (empStmtDateFilter === '30days') {
              const d = new Date(tx.createdAt);
              return (Date.now() - d.getTime()) <= 30 * 24 * 60 * 60 * 1000;
            }
            if (empStmtDateFilter === 'custom' && empStmtStartDate && empStmtEndDate) {
              const d = new Date(tx.createdAt);
              return d >= new Date(empStmtStartDate) && d <= new Date(empStmtEndDate + 'T23:59:59');
            }
            return true;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const empStmtCredit = empStatementTxns.filter(t => t.type === 'Credit').reduce((s, t) => s + (t.amount || 0), 0);
        const empStmtDebit = empStatementTxns.filter(t => t.type === 'Debit').reduce((s, t) => s + (t.amount || 0), 0);
        const empStmtBalance = empStmtDebit - empStmtCredit;

        return (
          <div className="space-y-6 pb-10">
            {/* Print CSS */}
            <style dangerouslySetInnerHTML={{
              __html: `
              @media print {
                body * { visibility: hidden; }
                #salary-print-modal, #salary-print-modal * { visibility: visible; }
                #salary-print-modal { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; }
                .no-print { display: none !important; }
              }
            `}} />

            {/* ── Sub-navigation: Salary list vs Employee Statement ── */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setEmployeeStatementId(null)}
                className={`text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${!employeeStatementId
                  ? 'bg-[#d4af37]/15 border-[#d4af37]/40 text-[#d4af37]'
                  : 'bg-black/30 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                {isAr ? 'سجل الرواتب' : 'Salary History'}
              </button>
              <span className="text-slate-700 text-xs">|</span>
              <select
                value={employeeStatementId || ''}
                onChange={e => setEmployeeStatementId(e.target.value || null)}
                className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-[11px] font-black text-slate-300 outline-none focus:border-[#d4af37]/50 cursor-pointer"
              >
                <option value="">{isAr ? '── كشف حساب موظف ──' : '── Employee Statement ──'}</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.fullName || emp.email}</option>
                ))}
              </select>
            </div>

            {/* ════════════════════════════════════════════════════════ */}
            {/* VIEW A: SALARY HISTORY LIST */}
            {/* ════════════════════════════════════════════════════════ */}
            {!employeeStatementId && (
              <div className="space-y-5">
                {/* Analytics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-5 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-550 block mb-1">{isAr ? 'إجمالي الرواتب المصروفة' : 'Total Salaries Paid'}</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-xl font-mono font-black text-[#d4af37]">
                        {totalPaid.toLocaleString()}
                        <span className="text-xs font-sans text-slate-500 font-normal ml-1.5">YER</span>
                      </span>
                      <Coins className="w-6 h-6 text-[#d4af37]/20 shrink-0" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-5 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-550 block mb-1">{isAr ? 'إجمالي سندات الصرف' : 'Total Salary Slips'}</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-xl font-mono font-black text-emerald-400">
                        {salaryHistory.length}
                        <span className="text-xs font-sans text-slate-500 font-normal ml-1.5">{isAr ? 'سند' : 'slips'}</span>
                      </span>
                      <Receipt className="w-6 h-6 text-emerald-500/20 shrink-0" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-5 rounded-2xl border border-slate-850 shadow-md flex flex-col justify-between">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-550 block mb-1">{isAr ? 'الموظفين المستلمين للرواتب' : 'Staff Members Settled'}</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-xl font-mono font-black text-cyan-400">
                        {uniqueStaff}
                        <span className="text-xs font-sans text-slate-500 font-normal ml-1.5">{isAr ? 'موظف' : 'staff'}</span>
                      </span>
                      <UserCheck className="w-6 h-6 text-cyan-500/20 shrink-0" />
                    </div>
                  </div>
                </div>

                {/* Filter Belt */}
                <div className="bg-[#121215] border border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                      type="text"
                      placeholder={isAr ? 'ابحث باسم الموظف أو رقم السند...' : 'Search employee, voucher ID...'}
                      value={salarySearch}
                      onChange={e => setSalarySearch(e.target.value)}
                      className="w-full bg-black/50 border border-slate-850 rounded-xl py-2.5 pr-10 pl-4 text-xs font-bold text-white focus:border-[#d4af37]/50 outline-none"
                    />
                  </div>
                  <div className="relative min-w-[180px]">
                    <select
                      value={salaryEmployeeFilter}
                      onChange={e => setSalaryEmployeeFilter(e.target.value)}
                      className="w-full bg-black/50 border border-slate-850 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-300 outline-none focus:border-[#d4af37]/50 cursor-pointer"
                    >
                      <option value="all">{isAr ? 'كل الموظفين' : 'All Staff'}</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.fullName || emp.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative min-w-[140px]">
                    <input
                      type="month"
                      value={salaryMonthFilter}
                      onChange={e => setSalaryMonthFilter(e.target.value)}
                      className="w-full bg-black/50 border border-slate-850 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-300 outline-none focus:border-[#d4af37]/50 font-mono text-center cursor-pointer"
                    />
                  </div>
                  {salaryMonthFilter && (
                    <button
                      onClick={() => setSalaryMonthFilter('')}
                      className="bg-slate-900 hover:bg-slate-850 text-slate-400 px-3 py-2.5 rounded-xl border border-slate-850 text-xs font-black transition-all"
                    >
                      {isAr ? 'إلغاء الفلتر' : 'Clear'}
                    </button>
                  )}
                </div>

                {/* Salary History Table */}
                <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-850">
                        <tr>
                          <th className="p-4 text-start">{isAr ? 'تاريخ الصرف' : 'Payment Date'}</th>
                          <th className="p-4 text-start">{isAr ? 'الموظف المستلم' : 'Staff Member'}</th>
                          <th className="p-4 text-start">{isAr ? 'رقم الحساب' : 'Account Code'}</th>
                          <th className="p-4 text-center">{isAr ? 'الشهر المستحق' : 'Salary Month'}</th>
                          <th className="p-4 text-start">{isAr ? 'رقم السند' : 'Voucher ID'}</th>
                          <th className="p-4 text-start">{isAr ? 'البيان' : 'Notes'}</th>
                          <th className="p-4 text-center">{isAr ? 'المبلغ المصروف' : 'Amount Paid'}</th>
                          <th className="p-4 text-left">{isAr ? 'إجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 bg-black/10">
                        {filteredSalaries.map(item => (
                          <tr key={item.id} className="hover:bg-slate-950/40 transition-colors">
                            <td className="p-4 font-mono font-bold text-slate-400 text-start" dir="ltr">
                              {new Date(item.paidAt || item.createdAt).toLocaleString(isAr ? 'ar-YE' : 'en-US', {
                                year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                              })}
                            </td>
                            <td className="p-4 text-start">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-850 flex items-center justify-center font-black text-[10px] text-[#d4af37] shrink-0">
                                  {(item.employeeName || '?').substring(0, 1)}
                                </div>
                                <div>
                                  <span className="font-extrabold text-white block">{item.employeeName}</span>
                                  <button
                                    onClick={() => setEmployeeStatementId(item.employeeId)}
                                    className="text-[9px] text-[#d4af37]/70 hover:text-[#d4af37] font-bold underline underline-offset-2 transition"
                                  >
                                    {isAr ? 'عرض كشف الحساب' : 'View Statement'}
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-start">
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-900/60 border border-slate-850 px-2 py-0.5 rounded-md">
                                {item.accountCode || '—'}
                              </span>
                            </td>
                            <td className="p-4 text-center font-mono font-black text-slate-300">
                              <span className="bg-amber-950/20 text-amber-500 border border-amber-900/20 px-2 py-0.5 rounded-lg text-[10px]">
                                {item.salaryMonth}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-xs font-black text-[#d4af37] text-start">{item.voucherCode}</td>
                            <td className="p-4 text-slate-400 max-w-xs truncate text-start">{item.notes || '—'}</td>
                            <td className="p-4 text-center font-mono font-black text-xs text-emerald-400">
                              {(item.amount || 0).toLocaleString()} {item.currency || 'YER'}
                            </td>
                            <td className="p-4 text-left">
                              <button
                                onClick={() => setSelectedSalaryVoucher(item)}
                                className="text-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/15 border border-[#d4af37]/15 p-2 rounded-xl transition flex items-center gap-1.5 font-bold"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="text-[10px]">{isAr ? 'معاينة' : 'View'}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredSalaries.length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-16 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-[10px]">
                              {isAr ? '[ لم يتم العثور على قيود صرف رواتب ]' : '[ NO SALARY PAYOUT RECORDS FOUND ]'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════ */}
            {/* VIEW B: EMPLOYEE ACCOUNT STATEMENT */}
            {/* ════════════════════════════════════════════════════════ */}
            {employeeStatementId && (
              <div className="space-y-5">
                {/* Employee header card */}
                <div className="bg-gradient-to-r from-[#121215] to-[#0a0a0d] border border-[#d4af37]/20 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/25 flex items-center justify-center font-black text-2xl text-[#d4af37]">
                      {(empStatementEmployee?.fullName || empStatementEmployee?.email || '?')[0]}
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white">{empStatementEmployee?.fullName || empStatementEmployee?.email || employeeStatementId}</h2>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {isAr ? 'كشف حساب الموظف' : 'Employee Account Statement'}
                      </p>
                      {empStatementEmployee?.monthlySalary && (
                        <p className="text-xs font-mono text-[#d4af37] mt-0.5">
                          {isAr ? 'الراتب الشهري:' : 'Monthly Salary:'} {empStatementEmployee.monthlySalary?.toLocaleString()} {empStatementEmployee.currency || 'YER'}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Summary metrics */}
                  <div className="flex gap-4 flex-wrap">
                    <div className="bg-black/40 border border-slate-850 rounded-2xl px-4 py-3 text-center min-w-[110px]">
                      <span className="text-[9px] font-black uppercase text-slate-500 block">{isAr ? 'إجمالي المصروف' : 'Total Paid Out'}</span>
                      <span className="text-base font-mono font-black text-rose-400">{empStmtCredit.toLocaleString()}</span>
                    </div>
                    <div className="bg-black/40 border border-slate-850 rounded-2xl px-4 py-3 text-center min-w-[110px]">
                      <span className="text-[9px] font-black uppercase text-slate-500 block">{isAr ? 'إجمالي الوارد' : 'Total Received'}</span>
                      <span className="text-base font-mono font-black text-emerald-400">{empStmtDebit.toLocaleString()}</span>
                    </div>
                    <div className="bg-black/40 border border-slate-850 rounded-2xl px-4 py-3 text-center min-w-[110px]">
                      <span className="text-[9px] font-black uppercase text-slate-500 block">{isAr ? 'الرصيد الصافي' : 'Net Balance'}</span>
                      <span className={`text-base font-mono font-black ${empStmtBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {empStmtBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Statement Filters */}
                <div className="bg-[#121215] border border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{isAr ? 'تصفية حسب الفترة:' : 'Filter by Period:'}</span>
                  {(['all', '30days', 'custom'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setEmpStmtDateFilter(opt)}
                      className={`text-[11px] font-black px-3 py-1.5 rounded-lg border transition-all ${empStmtDateFilter === opt
                        ? 'bg-[#d4af37]/15 border-[#d4af37]/40 text-[#d4af37]'
                        : 'bg-black/30 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                    >
                      {opt === 'all' ? (isAr ? 'الكل' : 'All Time') : opt === '30days' ? (isAr ? 'آخر 30 يوم' : 'Last 30 Days') : (isAr ? 'نطاق مخصص' : 'Custom Range')}
                    </button>
                  ))}
                  {empStmtDateFilter === 'custom' && (
                    <>
                      <input type="date" value={empStmtStartDate} onChange={e => setEmpStmtStartDate(e.target.value)}
                        className="bg-black/50 border border-slate-850 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-300 outline-none focus:border-[#d4af37]/50" />
                      <span className="text-slate-600 text-xs">—</span>
                      <input type="date" value={empStmtEndDate} onChange={e => setEmpStmtEndDate(e.target.value)}
                        className="bg-black/50 border border-slate-850 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-300 outline-none focus:border-[#d4af37]/50" />
                    </>
                  )}
                  <button
                    onClick={() => window.print()}
                    className="mr-auto bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/25 text-[#d4af37] px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all no-print"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {isAr ? 'طباعة الكشف' : 'Print Statement'}
                  </button>
                </div>

                {/* Statement Table */}
                <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl" id="emp-statement-print">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-850">
                        <tr>
                          <th className="p-4 text-start">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                          <th className="p-4 text-start">{isAr ? 'البيان' : 'Description'}</th>
                          <th className="p-4 text-start">{isAr ? 'المرجع' : 'Reference'}</th>
                          <th className="p-4 text-start">{isAr ? 'نوع العملية' : 'Module'}</th>
                          <th className="p-4 text-center">{isAr ? 'مدين (وارد)' : 'Debit (In)'}</th>
                          <th className="p-4 text-center">{isAr ? 'دائن (صادر)' : 'Credit (Out)'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 bg-black/10">
                        {empStatementTxns.map(tx => (
                          <tr key={tx.id} className="hover:bg-slate-950/40 transition-colors">
                            <td className="p-4 font-mono text-slate-400 text-start" dir="ltr">
                              {new Date(tx.createdAt).toLocaleString(isAr ? 'ar-YE' : 'en-US', {
                                year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                              })}
                            </td>
                            <td className="p-4 text-start text-slate-300 font-bold max-w-xs truncate">{tx.description}</td>
                            <td className="p-4 text-start">
                              <span className="font-mono text-[10px] text-[#d4af37] bg-amber-950/20 border border-amber-900/20 px-2 py-0.5 rounded-md">
                                {tx.refNumber || '—'}
                              </span>
                            </td>
                            <td className="p-4 text-start">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${tx.module === 'salary'
                                ? 'bg-purple-950/30 text-purple-400 border-purple-900/30'
                                : tx.module === 'order'
                                  ? 'bg-blue-950/30 text-blue-400 border-blue-900/30'
                                  : 'bg-slate-900 text-slate-500 border-slate-800'
                                }`}>
                                {tx.module === 'salary' ? (isAr ? 'راتب' : 'Salary') :
                                  tx.module === 'order' ? (isAr ? 'طلب' : 'Order') :
                                    tx.module === 'expenses' ? (isAr ? 'مصروف' : 'Expense') :
                                      tx.module || '—'}
                              </span>
                            </td>
                            <td className="p-4 text-center font-mono font-black text-emerald-400">
                              {tx.type === 'Debit' ? (
                                <div className="flex flex-col">
                                  <span>{(tx.amountOriginal || tx.amount || 0).toLocaleString()} {tx.currencyOriginal || 'YER'}</span>
                                  {tx.amountOriginal !== tx.amount && <span className="text-[9px] text-slate-500 font-bold tracking-tighter">({(tx.amount || 0).toLocaleString()} YER)</span>}
                                </div>
                              ) : '—'}
                            </td>
                            <td className="p-4 text-center font-mono font-black text-rose-400">
                              {tx.type === 'Credit' ? (
                                <div className="flex flex-col">
                                  <span>{(tx.amountOriginal || tx.amount || 0).toLocaleString()} {tx.currencyOriginal || 'YER'}</span>
                                  {tx.amountOriginal !== tx.amount && <span className="text-[9px] text-slate-500 font-bold tracking-tighter">({(tx.amount || 0).toLocaleString()} YER)</span>}
                                </div>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                        {empStatementTxns.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-16 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-[10px]">
                              {isAr ? '[ لا توجد حركات مسجلة لهذا الموظف ]' : '[ NO TRANSACTIONS FOUND FOR THIS EMPLOYEE ]'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {empStatementTxns.length > 0 && (
                        <tfoot className="bg-[#0a0a0d] border-t border-slate-850">
                          <tr>
                            <td colSpan={4} className="p-4 text-start font-black text-slate-400 text-[10px] uppercase tracking-wider">
                              {isAr ? 'المجموع الإجمالي للفترة' : 'Period Grand Totals'}
                            </td>
                            <td className="p-4 text-center font-mono font-black text-emerald-400">{empStmtDebit.toLocaleString()}</td>
                            <td className="p-4 text-center font-mono font-black text-rose-400">{empStmtCredit.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {accountingTab === 'auto_voucher_rules' && (
        <OrderStatusManagementTab isAr={isAr} initialSubTab="entries" hideStatusManagement />
      )}

      {/* ════════════ SALARY SLIP VOUCHER MODAL ════════════ */}
      {selectedSalaryVoucher && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-[#0c0c0f] border border-[#d4af37]/25 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col font-sans" id="salary-print-modal">
            <div className="bg-black/40 p-5 border-b border-slate-850 flex justify-between items-center shrink-0 no-print">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'سند صرف راتب شهري رسمي' : 'Official Salary Slip Voucher'}
              </h3>
              <button onClick={() => setSelectedSalaryVoucher(null)} className="text-slate-500 hover:text-white p-1 bg-slate-900 border border-slate-800 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-8 space-y-6 text-start flex-1 overflow-y-auto bg-white text-black font-sans leading-relaxed select-all">
              <div className="text-center pb-6 border-b border-slate-300">
                <h2 className="text-lg font-black tracking-wider text-slate-800">{settings.systemName || settings.companyName || 'alx'}</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{isAr ? 'سند صرف رواتب الموظفين' : 'Salary Payout Receipt'}</p>
                <p className="text-[9px] font-mono text-slate-400 mt-0.5">{selectedSalaryVoucher.voucherCode}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">{isAr ? 'الموظف المستلم' : 'Staff Member'}</span>
                  <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">{selectedSalaryVoucher.employeeName}</span>
                  <span className="text-[10px] font-mono text-slate-600 block mt-0.5">{isAr ? 'حساب: ' : 'A/C: '}{selectedSalaryVoucher.accountCode}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">{isAr ? 'تاريخ الصرف' : 'Payment Date'}</span>
                  <span className="font-bold text-slate-700 mt-0.5 block font-mono">
                    {new Date(selectedSalaryVoucher.paidAt || selectedSalaryVoucher.createdAt).toLocaleString(isAr ? 'ar-YE' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">{isAr ? 'الشهر المستحق' : 'Salary Period'}</span>
                  <span className="font-mono font-black text-slate-800 bg-slate-200 px-2 py-0.5 rounded">{selectedSalaryVoucher.salaryMonth}</span>
                </div>
                <div className="border-t border-slate-200/80 my-2 pt-2 flex justify-between items-center text-sm font-black">
                  <span className="text-slate-800">{isAr ? 'المبلغ الصافي المصروف' : 'Net Amount Disbursed'}</span>
                  <span className="font-mono text-lg text-emerald-600">{(selectedSalaryVoucher.amount || 0).toLocaleString()} {selectedSalaryVoucher.currency || 'YER'}</span>
                </div>
              </div>
              <div className="text-xs">
                <span className="text-slate-500 block text-[9px] uppercase font-bold mb-1">{isAr ? 'البيان' : 'Narrative'}</span>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 italic font-bold">
                  {selectedSalaryVoucher.notes || (isAr ? `صرف راتب شهر ${selectedSalaryVoucher.salaryMonth}` : `Salary paid for ${selectedSalaryVoucher.salaryMonth}`)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center pt-8 border-t border-slate-200/80 text-[10px] font-bold text-slate-600">
                <div className="space-y-8"><span>{isAr ? 'توقيع أمين الصندوق' : 'Cashier'}</span><div className="border-b border-slate-300 w-3/4 mx-auto"></div></div>
                <div className="space-y-8"><span>{isAr ? 'توقيع المحاسب' : 'Accountant'}</span><div className="border-b border-slate-300 w-3/4 mx-auto"></div></div>
                <div className="space-y-8"><span>{isAr ? 'توقيع المستلم' : 'Recipient'}</span><div className="border-b border-slate-300 w-3/4 mx-auto"></div></div>
              </div>
            </div>
            <div className="p-4 bg-black/40 border-t border-slate-850 flex justify-end gap-3 shrink-0 no-print">
              <button type="button" onClick={() => setSelectedSalaryVoucher(null)} className="px-5 py-2.5 text-slate-400 font-bold hover:bg-slate-850/40 rounded-xl transition">
                {isAr ? 'إغلاق' : 'Close'}
              </button>
              <button onClick={() => window.print()} className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl shadow-lg transition flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> {isAr ? 'طباعة السند' : 'Print Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 1: PRECISE MANUAL JOURNAL ENTRY ADJUSTMENT ADJUSTMENT */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-start">
          <form onSubmit={handleAddAdjustment} className="bg-[#121215] border border-slate-850 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] font-sans">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Scale className="w-4 h-4 text-[#d4af37]" />
                  {isAr ? 'تسجيل إقرار مالي وقيد تسوية خزينة' : 'Add Ledger Journal Adjustment Voucher'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                  {isAr ? 'لتسوية أرصدة العملات أو عوائد غير تشغيلية.' : 'Manually adjust cash balance for capital assets or currency offsets.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* SOURCE/CREDIT ACCOUNT SELECTOR */}
              <div className="relative">
                <label className="block text-[9.5px] font-black text-rose-400 mb-1.5 uppercase">
                  {isAr ? 'حساب المصدر (الدائن)  *' : 'Source Account (Credit - From) *'}
                </label>

                {/* Account Selection Trigger */}
                <div
                  onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer flex justify-between items-center"
                >
                  <span className="truncate">
                    {sourceAccountId ? (
                      (() => {
                        const acc = financialAccounts.find(a => a.id === sourceAccountId || a.entityId === sourceAccountId);
                        if (!acc) return isAr ? '-- اختر حساب المصدر (الدائن) --' : '-- Choose Source Account --';
                        return `[${acc.code || acc.accountCode || 'Sys'}] - ${isAr ? acc.nameAr || acc.entityName : acc.nameEn || acc.entityName} ${acc.balance !== undefined ? `(${acc.balance.toLocaleString()} ${acc.currency || 'YER'})` : ''}`;
                      })()
                    ) : (
                      <span className="text-slate-500">{isAr ? '-- اختر حساب المصدر (الدائن) --' : '-- Choose Source Account --'}</span>
                    )}
                  </span>
                  <svg className={`w-4 h-4 text-slate-500 transition-transform ${isSourceDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>

                {/* Custom Dropdown Content */}
                {isSourceDropdownOpen && (
                  <div className="absolute z-55 mt-2 w-full bg-[#121215] border border-slate-850 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-64">
                    {/* Account Search Input */}
                    <div className="p-2 border-b border-slate-850 bg-black/40 sticky top-0">
                      <input
                        type="text"
                        placeholder={isAr ? "🔎 ابحث بالاسم أو الكود..." : "🔎 Search by name or code..."}
                        value={sourceSearchQuery}
                        onChange={(e) => setSourceSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-black/50 border border-slate-800 text-white rounded-lg p-2 outline-none text-xs font-bold focus:border-[#d4af37]/50"
                        autoFocus
                      />
                    </div>

                    <div className="overflow-y-auto p-1 custom-scrollbar">
                      {(() => {
                        const filteredAccounts = financialAccounts.filter(acc => {
                          const q = sourceSearchQuery.toLowerCase().trim();
                          if (!q) return true;
                          return (
                            (acc.accountCode && String(acc.accountCode).toLowerCase().includes(q)) ||
                            (acc.code && String(acc.code).toLowerCase().includes(q)) ||
                            (acc.nameAr && String(acc.nameAr).toLowerCase().includes(q)) ||
                            (acc.nameEn && String(acc.nameEn).toLowerCase().includes(q)) ||
                            (acc.entityName && String(acc.entityName).toLowerCase().includes(q))
                          );
                        });

                        const grouped: Record<string, any[]> = {};
                        filteredAccounts.forEach(acc => {
                          const type = acc.type || 'Other';
                          const entityType = acc.entityType || 'system';
                          let groupKey = type;
                          if (entityType === 'customer') groupKey = isAr ? 'العملاء (Customer)' : 'Customer';
                          else if (entityType === 'courier') groupKey = isAr ? 'المناديب (Courier)' : 'Courier';
                          else if (entityType === 'employee') groupKey = isAr ? 'الموظفين (Employee)' : 'Employee';
                          if (!grouped[groupKey]) grouped[groupKey] = [];
                          grouped[groupKey].push(acc);
                        });

                        return Object.entries(grouped).map(([type, accs]) => (
                          <div key={type} className="mb-2">
                            <span className="text-[10px] font-black text-slate-400 px-2 py-1 uppercase">{type}</span>
                            {accs.map(a => (
                              <div
                                key={a.id}
                                onClick={() => {
                                  setSourceAccountId(a.id);
                                  setIsSourceDropdownOpen(false);
                                  setSourceSearchQuery('');
                                }}
                                className={`px-2 py-1.5 hover:bg-white/5 cursor-pointer rounded-lg flex justify-between items-center ${sourceAccountId === a.id ? 'bg-[#d4af37]/15 text-[#d4af37]' : ''}`}
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-200">
                                    {isAr ? a.nameAr || a.entityName : a.nameEn || a.entityName}
                                  </span>
                                  <span className="font-mono text-[9px] text-slate-500">{a.accountCode || a.code || 'Sys'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* TARGET/DEBIT ACCOUNT SELECTOR */}
              <div className="relative">
                <label className="block text-[9.5px] font-black text-emerald-400 mb-1.5 uppercase">
                  {isAr ? 'الحساب المستهدف (المدين) *' : 'Target Account (Debit - To) *'}
                </label>

                {/* Account Selection Trigger */}
                <div
                  onClick={() => setIsTargetDropdownOpen(!isTargetDropdownOpen)}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer flex justify-between items-center"
                >
                  <span className="truncate">
                    {targetAccountId ? (
                      (() => {
                        const acc = financialAccounts.find(a => a.id === targetAccountId || a.entityId === targetAccountId);
                        if (!acc) return isAr ? '-- اختر الحساب المستهدف --' : '-- Choose Target Account --';
                        return `[${acc.code || acc.accountCode || 'Sys'}] - ${isAr ? acc.nameAr || acc.entityName : acc.nameEn || acc.entityName} ${acc.balance !== undefined ? `(${acc.balance.toLocaleString()} ${acc.currency || 'YER'})` : ''}`;
                      })()
                    ) : (
                      <span className="text-slate-500">{isAr ? '-- اختر الحساب المستهدف (المدين) --' : '-- Choose Target Account --'}</span>
                    )}
                  </span>
                  <svg className={`w-4 h-4 text-slate-500 transition-transform ${isTargetDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>

                {/* Custom Dropdown Content */}
                {isTargetDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-[#121215] border border-slate-850 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-64">
                    {/* Account Search Input */}
                    <div className="p-2 border-b border-slate-850 bg-black/40 sticky top-0">
                      <input
                        type="text"
                        placeholder={isAr ? "🔎 ابحث بالاسم أو الكود..." : "🔎 Search by name or code..."}
                        value={targetSearchQuery}
                        onChange={(e) => setTargetSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-black/50 border border-slate-800 text-white rounded-lg p-2 outline-none text-xs font-bold focus:border-[#d4af37]/50"
                        autoFocus
                      />
                    </div>

                    <div className="overflow-y-auto p-1 custom-scrollbar">
                      {(() => {
                        const filteredAccounts = financialAccounts.filter(acc => {
                          const q = targetSearchQuery.toLowerCase().trim();
                          if (!q) return true;
                          return (
                            (acc.accountCode && String(acc.accountCode).toLowerCase().includes(q)) ||
                            (acc.code && String(acc.code).toLowerCase().includes(q)) ||
                            (acc.nameAr && String(acc.nameAr).toLowerCase().includes(q)) ||
                            (acc.nameEn && String(acc.nameEn).toLowerCase().includes(q)) ||
                            (acc.entityName && String(acc.entityName).toLowerCase().includes(q))
                          );
                        });

                        const grouped: Record<string, any[]> = {};
                        filteredAccounts.forEach(acc => {
                          const type = acc.type || 'Other';
                          const entityType = acc.entityType || 'system';
                          let groupKey = type;
                          if (entityType === 'customer') groupKey = 'Customer (عملاء)';
                          else if (entityType === 'courier') groupKey = 'Courier (مناديب)';
                          else if (entityType === 'employee') groupKey = 'Employee (موظفين)';
                          if (!grouped[groupKey]) grouped[groupKey] = [];
                          grouped[groupKey].push(acc);
                        });

                        if (Object.keys(grouped).length === 0) {
                          return <div className="p-4 text-center text-slate-500 text-xs font-bold">{isAr ? 'لا توجد نتائج' : 'No results found'}</div>;
                        }

                        return Object.entries(grouped).map(([type, accs]) => {
                          let iconColor = 'text-slate-400 font-black';
                          let iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>;

                          if (type.includes('Asset')) {
                            iconColor = 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
                            iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
                          } else if (type.includes('Liability')) {
                            iconColor = 'text-rose-400 bg-rose-500/10 border border-rose-500/20';
                            iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
                          } else if (type.includes('Equity')) {
                            iconColor = 'text-purple-400 bg-purple-500/10 border border-purple-500/20';
                            iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>;
                          } else if (type.includes('Revenue')) {
                            iconColor = 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
                            iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
                          } else if (type.includes('Expense')) {
                            iconColor = 'text-orange-400 bg-orange-500/10 border border-orange-500/20';
                            iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>;
                          }

                          let label = type === 'Asset' ? (isAr ? 'أصول (Asset)' : 'Asset') :
                            type === 'Liability' ? (isAr ? 'خصوم (Liability)' : 'Liability') :
                              type === 'Equity' ? (isAr ? 'حقوق ملكية (Equity)' : 'Equity') :
                                type === 'Revenue' ? (isAr ? 'إيرادات (Revenue)' : 'Revenue') :
                                  type === 'Expense' ? (isAr ? 'مصروفات (Expense)' : 'Expense') : type;

                          return (
                            <div key={type} className="mb-2">
                              <div className="px-2 py-1.5 flex items-center gap-1.5">
                                <div className={`p-1 rounded-md ${iconColor}`}>
                                  {iconSvg}
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
                              </div>
                              {accs.sort((a, b) => (a.code || a.accountCode || '').localeCompare(b.code || b.accountCode || '')).map(a => (
                                <div
                                  key={a.id}
                                  onClick={() => {
                                    setTargetAccountId(a.id);
                                    setTargetType(a.entityType || 'system');
                                    setAdjustData(prev => ({
                                      ...prev,
                                      recipientName: a.nameAr || a.entityName || ''
                                    }));
                                    setIsTargetDropdownOpen(false);
                                    setTargetSearchQuery('');
                                  }}
                                  className={`px-3 py-2.5 mx-1 mb-0.5 mt-0 hover:bg-white/5 cursor-pointer rounded-lg flex justify-between items-center transition-colors ${targetAccountId === a.id ? 'bg-[#d4af37]/10 border border-[#d4af37]/30' : ''}`}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <span className={`text-xs font-bold ${targetAccountId === a.id ? 'text-[#d4af37]' : 'text-slate-200'}`}>
                                      {isAr ? a.nameAr || a.entityName : a.nameEn || a.entityName}
                                    </span>
                                    <span className="font-mono text-[9px] text-slate-500">{a.code || a.accountCode || 'Sys'}</span>
                                  </div>
                                  {a.balance !== undefined && (
                                    <span className="font-mono text-[10px] font-black tracking-tighter text-slate-400 bg-black/40 px-1.5 py-0.5 rounded border border-slate-800">
                                      {a.balance.toLocaleString()} {a.currency || 'YER'}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {targetAccountId && (
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {(() => {
                      const targetAcc = financialAccounts.find(a => a.id === targetAccountId || a.entityId === targetAccountId);
                      const adjustAmt = parseFloat(adjustData.amount) || 0;
                      if (targetAcc && typeof targetAcc.balance === 'number' && adjustAmt > 0) {
                        // Convert transaction amount to account currency
                        const convertedAdjustAmt = financialAccountService.convertToTargetCurrency(
                          adjustAmt,
                          adjustData.currency,
                          targetAcc.currency || settings.currency || 'SAR',
                          { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
                        );

                        // Target Account is being DEBITED
                        const firstChar = (targetAcc.accountCode || targetAcc.code || '1').trim().toUpperCase();
                        const isCreditNormal = firstChar.startsWith('2') || firstChar.startsWith('3') || firstChar.startsWith('4') || firstChar.startsWith('REV') || firstChar.startsWith('LIAB') || firstChar.startsWith('EQU');

                        // If it's a Credit-Normal account (Liability/Equity/Revenue), Debiting reduces balance
                        // Add a small epsilon (0.01) to avoid warnings on floating point imprecision
                        if (isCreditNormal && targetAcc.balance - convertedAdjustAmt < -0.01) {
                          return (
                            <div className="w-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] p-2 rounded-lg flex items-start gap-1.5 animate-pulse">
                              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              <span>{isAr ? 'تنبيه: هذا القيد سيؤدي لتجاوز الرصيد الحالي للحساب المستهدف وسيصبح بالسالب.' : 'Alert: This entry will exceed the current balance of the target account.'}</span>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}

                    {(() => {
                      const sourceAcc = financialAccounts.find(a => a.id === sourceAccountId || a.entityId === sourceAccountId);
                      const adjustAmt = parseFloat(adjustData.amount) || 0;
                      if (sourceAcc && typeof sourceAcc.balance === 'number' && adjustAmt > 0) {
                        // Convert transaction amount to account currency
                        const convertedAdjustAmt = financialAccountService.convertToTargetCurrency(
                          adjustAmt,
                          adjustData.currency,
                          sourceAcc.currency || settings.currency || 'SAR',
                          { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
                        );

                        // Source Account is being CREDITED
                        const firstChar = (sourceAcc.accountCode || sourceAcc.code || '1').trim().toUpperCase();
                        const isDebitNormal = firstChar.startsWith('1') || firstChar.startsWith('5') || firstChar.startsWith('EXP') || firstChar.startsWith('AST') || firstChar.startsWith('ASS');

                        // If it's a Debit-Normal account (Asset/Expense), Crediting reduces balance
                        // Add a small epsilon (0.01) to avoid warnings on floating point imprecision
                        if (isDebitNormal && sourceAcc.balance - convertedAdjustAmt < -0.01) {
                          return (
                            <div className="w-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] p-2 rounded-lg flex items-start gap-1.5 animate-pulse">
                              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              <span>{isAr ? 'تنبيه: هذا القيد سيؤدي لتجاوز الرصيد الحالي لحساب المصدر وسيصبح بالسالب.' : 'Alert: This entry will exceed the current balance of the source account.'}</span>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>

              {/* If targetType is employee, show option for Salary Payment */}
              {targetType === 'employee' && targetAccountId && (
                <div className="bg-black/30 border border-slate-850 rounded-xl p-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSalaryPayment}
                      onChange={e => {
                        const checked = e.target.checked;
                        setIsSalaryPayment(checked);
                        const acc = financialAccounts.find(a => a.id === targetAccountId || a.entityId === targetAccountId);
                        if (checked && acc && acc.monthlySalary) {
                          setAdjustData(prev => ({ ...prev, amount: String(acc.monthlySalary) }));
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-[#d4af37] focus:ring-0 cursor-pointer accent-[#d4af37]"
                    />
                    <span className="text-xs font-black text-white">
                      {isAr ? 'صرف كراتب شهري رسمي' : 'File as Official Monthly Salary'}
                    </span>
                  </label>

                  {isSalaryPayment && (
                    <div className="animate-fade-in">
                      <label className="block text-[9px] font-black text-slate-500 mb-1.5 uppercase">{isAr ? 'الشهر المستحق للراتب *' : 'Salary Month *'}</label>
                      <input
                        type="month"
                        required
                        value={adjustSalaryMonth}
                        onChange={e => setAdjustSalaryMonth(e.target.value)}
                        className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-2.5 text-xs font-bold font-mono text-center outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Amount && Original Currency */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'قيمة القيد المالي والصلابة' : 'Voucher amount'}</label>
                  <input
                    type="number"
                    required
                    value={adjustData.amount}
                    onChange={e => setAdjustData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3.5 py-2 text-xs font-black outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'العملة' : 'Rate Original'}</label>
                  <select
                    value={adjustData.currency}
                    onChange={e => setAdjustData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-black outline-none focus:border-[#d4af37] cursor-pointer"
                  >
                    {activeCurrencies.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title / Particulars */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'البيان وعنوان التعديل المالي' : 'Transaction description (Particulars)'}</label>
                <input
                  type="text"
                  required
                  value={adjustData.title}
                  onChange={e => setAdjustData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={isAr ? "مثال: تسوية رأس المال، بيع كاش موازي" : "Remittance correction / Asset Adjustment"}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3.5 py-2 text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Counterparty / Recipient Name */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الجهة المستلمة / المخصصة' : 'Party counterpart'}</label>
                <input
                  type="text"
                  value={adjustData.recipientName}
                  onChange={e => setAdjustData(prev => ({ ...prev, recipientName: e.target.value }))}
                  placeholder={isAr ? "اختياري: الخزينة، بنك الكريمي، إلخ" : "Al Kuraimi Bank, Office Vault, etc."}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3.5 py-2 text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'شرح وتأكيدات إضافية' : 'Supplementary audits details'}</label>
                <textarea
                  value={adjustData.notes}
                  onChange={e => setAdjustData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3.5 py-2 text-xs font-normal outline-none focus:border-[#d4af37] h-16 resize-none"
                  placeholder={isAr ? "أية مستندات أو شروحات مرافقة للقيد..." : "Provide internal notes about this treasury adjustment..."}
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="w-1/2 bg-slate-900 hover:bg-slate-800 text-slate-350 py-2.5 rounded-xl text-xs font-bold transition-all"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={adjustLoading}
                className="w-1/2 bg-[#d4af37] hover:bg-[#bfa032] active:bg-[#aa8e2b] text-black py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {adjustLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {isAr ? 'تنزيل التسجيل' : 'Commit Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: CUSTOMER BILATERAL DEBT Settle PAYMENT (FIFO chronological Queue) */}
      {isPayModalOpen && customerLedgerDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-start">
          <div className="bg-[#121215] border border-slate-850 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative animate-fade-in">
            <button
              onClick={() => setIsPayModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white transition-all pointer-events-auto cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 border-b border-slate-850">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                {isAr ? 'توريد وسداد دفعة في مستند مستقل' : 'Apply Balance Payment FIFO'}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                {isAr ? `تطبيق دفعة مالية بقيمة معقولة على ديون العميل: ${customerLedgerDetails.customer.fullName}.` : `Settle outstanding payments of client ${customerLedgerDetails.customer.fullName} chronologically.`}
              </p>
            </div>

            <form onSubmit={handleCustomerFIFOPayment} className="p-6 space-y-4">

              {/* Debt Warning Box */}
              <div className="bg-[#d4af37]/5 border border-[#d4af37]/15 p-3.5 rounded-2xl flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500 block text-[9.5px] uppercase">{isAr ? 'المديونية العالقة الإجمالية YER' : 'Outstanding Liability'}</span>
                  <span className="text-amber-500 font-mono font-black text-sm">{customerLedgerDetails.currentOutstandingBalance.toLocaleString()} YER</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[9.5px] uppercase">{isAr ? 'الفواتير المطالبة' : 'Unpaid Cargo'}</span>
                  <span className="text-white font-mono font-black text-sm">
                    {orders.filter(o => o.customerId === auditedCustomerId && parseFloat(o.amountRemaining || 0) > 0).length}
                  </span>
                </div>
              </div>

              {/* Paid Cash Input */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'قيمة تحصيل السداد المقبوض YER' : 'Amount Billed Payment YER'}</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-black/40 border border-slate-850 text-[#d4af37] rounded-xl px-3.5 py-2.5 text-sm font-black outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Settle Details */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'البيان وملاحظات السند' : 'Payment descriptions / Receipts'}</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder={isAr ? "تفاصيل إضافية: سداد عبر الكريمي، تحصيلات حية" : "Under account transfer via Al-Kuraimi"}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3.5 py-2 text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="pt-3 border-t border-slate-850 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="w-1/2 bg-slate-900 hover:bg-slate-800 text-slate-350 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="w-1/2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {payLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {isAr ? 'توريد وسداد بالخزينة' : 'Settle Chronology'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DETAIL PREVIEW OF INDIVIDUAL LEDGER JOURNAL */}
      {selectedLedgerEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-start font-sans">
          <div className="bg-[#121215] border border-slate-850 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="p-5 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-[#d4af37]" />
                  {isAr ? 'معاينة القيد المالي والترحيل الدفتري' : 'Financial Journal Entry Preview'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                  {isAr ? `رمز المستند المالي المرجعي: ${selectedLedgerEntry.refNumber}` : `Voucher Ref Node: ${selectedLedgerEntry.refNumber}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLedgerEntry(null)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-200">
              <div className="bg-black/40 border border-slate-850/60 p-6 rounded-2xl space-y-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 border-2 border-dashed border-[#d4af37]/20 rounded-full px-3 py-1 font-mono text-[9px] text-[#d4af37]/20 uppercase tracking-widest font-black rotate-12 select-none pointer-events-none">
                  {isAr ? 'مُقيد ومُرّحَل' : 'POSTED & VERIFIED'}
                </div>

                <div className="flex justify-between items-start border-b border-slate-805 pb-4">
                  <div>
                    <h4 className="text-sm font-black text-white">{isAr ? 'ألكس للخدمات اللوجستية' : 'alx Logistics'}</h4>
                    <p className="text-[10px] text-slate-500 font-medium">{isAr ? 'قسم الشؤون المالية والحسابات' : 'Finance & Accounts Division'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 text-[9px] uppercase block font-black">{isAr ? 'نوع المستند' : 'Voucher Type'}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${selectedLedgerEntry.type === 'Debit'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-452 border border-rose-500/20 text-rose-400'
                      }`}>
                      {selectedLedgerEntry.type === 'Debit'
                        ? (isAr ? 'سند قبض / مدين' : 'Receipt / Debit')
                        : (isAr ? 'سند صرف / دائن' : 'Payment / Credit')
                      }
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block font-medium mb-1">{isAr ? 'رمز المعاملة المالي' : 'Transaction Ref No.'}</span>
                    <span className="text-[#d4af37] font-mono font-bold bg-[#1a1a1e] px-2.5 py-1 rounded-lg border border-slate-800 inline-block">{selectedLedgerEntry.refNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block font-medium mb-1">{isAr ? 'تاريخ الترحيل الدفتري' : 'Posting Timestamp'}</span>
                    <span className="text-white font-mono font-bold block mt-1">
                      {selectedLedgerEntry.date.toLocaleDateString()} {selectedLedgerEntry.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-slate-500 text-[10px] uppercase block font-medium mb-1">{isAr ? 'البيان وعنوان قيد اليومية' : 'Particulars / Journal Title'}</span>
                    <span className="text-slate-100 font-extrabold text-xs block bg-slate-900/60 p-3 rounded-xl border border-slate-805">{selectedLedgerEntry.title}</span>
                  </div>

                  {selectedLedgerEntry.notes && (
                    <div className="col-span-2">
                      <span className="text-slate-500 text-[10px] uppercase block font-medium mb-1">{isAr ? 'التفاصيل والملاحظات' : 'Detailed Narrative'}</span>
                      <span className="text-slate-350 font-medium block bg-slate-900/40 p-3 rounded-xl border border-slate-855 text-[11px] whitespace-pre-wrap">{selectedLedgerEntry.notes}</span>
                    </div>
                  )}

                  {/* Balanced Double-Entry Accounts representation */}
                  <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/40 p-4 rounded-2xl border border-slate-850/80">
                    <div className="bg-emerald-950/20 border border-emerald-800/30 p-3 rounded-xl">
                      <span className="text-emerald-400 text-[10px] uppercase block font-black mb-1 tracking-wider flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                        {isAr ? 'الطرف المدين (من حـ/)' : 'Debit Account (Dr.)'}
                      </span>
                      <span className="text-white font-bold text-xs block mt-1">
                        {selectedLedgerEntry.debitPartyName || (isAr ? 'الخزينة العامة' : 'General Treasury')}
                      </span>
                      <span className="text-emerald-400 font-mono font-black text-xs block mt-1">
                        +{selectedLedgerEntry.amountOriginal.toLocaleString()} {selectedLedgerEntry.currencyOriginal}
                      </span>
                    </div>

                    <div className="bg-rose-950/20 border border-rose-800/30 p-3 rounded-xl">
                      <span className="text-rose-400 text-[10px] uppercase block font-black mb-1 tracking-wider flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
                        {isAr ? 'الطرف الدائن (إلى حـ/)' : 'Credit Account (Cr.)'}
                      </span>
                      <span className="text-white font-bold text-xs block mt-1">
                        {selectedLedgerEntry.creditPartyName || (isAr ? 'الخزينة العامة' : 'General Treasury')}
                      </span>
                      <span className="text-rose-400 font-mono font-black text-xs block mt-1">
                        -{selectedLedgerEntry.amountOriginal.toLocaleString()} {selectedLedgerEntry.currencyOriginal}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block font-medium mb-1">{isAr ? 'نوع ومجال الترحيل' : 'Posting Origin / Domain'}</span>
                    <span className="text-slate-350 font-mono text-[10px] uppercase bg-slate-900 px-2 py-0.5 border border-slate-850 rounded-md inline-block">{selectedLedgerEntry.module}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block font-medium mb-1">{isAr ? 'حالة التوازن المحاسبي' : 'Balanced Status'}</span>
                    <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      {isAr ? 'متوازن ومقبوض (قيد مزدوج)' : 'Balanced Double Entry'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="text-slate-500 text-[9px] uppercase block font-black mb-0.5">{isAr ? 'إجمالي مبلغ القيد المتوازن' : 'Net Book Value'}</span>
                    <span className="text-lg font-mono font-black text-[#d4af37]">
                      {selectedLedgerEntry.amountOriginal.toLocaleString()} {selectedLedgerEntry.currencyOriginal}
                    </span>
                  </div>
                  {selectedLedgerEntry.currencyOriginal !== 'YER' && (
                    <div className="text-right border-l border-slate-850 pl-4">
                      <span className="text-slate-500 text-[9px] uppercase block font-black mb-0.5">{isAr ? 'المعادل بالعملة اليمنية YER' : 'Yemeni Rial FX Equivalent'}</span>
                      <span className="text-white font-mono font-black text-sm">
                        ≈ {selectedLedgerEntry.amount.toLocaleString()} YER
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-4 text-center text-[9px] text-slate-500 border-t border-slate-805 leading-relaxed">
                  <div>
                    <span className="block font-black uppercase mb-1">{isAr ? 'المُعدّ / المحاسب' : 'Prepared Accountant'}</span>
                    <span className="block border-b border-dashed border-slate-800 py-3"></span>
                  </div>
                  <div>
                    <span className="block font-black uppercase mb-1">{isAr ? 'توقيع المستلم' : 'Recipient Handover'}</span>
                    <span className="block border-b border-dashed border-slate-800 py-3"></span>
                  </div>
                  <div>
                    <span className="block font-black uppercase mb-1">{isAr ? 'المصادقة المالية' : 'Controller Sanction'}</span>
                    <span className="block border-b border-dashed border-slate-800 py-3"></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-[#0a0a0d] border-t border-slate-850 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedLedgerEntry(null)}
                className="w-1/3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-350 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerPrint(
                    isAr ? `سند قيد مالي ${selectedLedgerEntry.refNumber}` : `Financial Voucher ${selectedLedgerEntry.refNumber}`,
                    'single-voucher-print-wrapper'
                  );
                }}
                className="w-2/3 bg-gradient-to-r from-[#d4af37] to-[#f3e3a0] hover:scale-[1.01] hover:brightness-110 active:scale-100 text-black py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                {isAr ? 'طباعة القيد بتنسيق رسمي' : 'Print Voucher Document'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* HIDDEN PRINT WRAPPER FOR SINGLE JOURNAL VOUCHER */}
      <div id="single-voucher-print-wrapper" style={{ display: 'none' }}>
        {selectedLedgerEntry && (
          <div style={{ padding: '20px', direction: isAr ? 'rtl' : 'ltr', fontFamily: 'Cairo, system-ui, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px double #d4af37', paddingBottom: '15px', marginBottom: '20px' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                  {isAr ? 'ألكس للخدمات اللوجستية وتوصيل الطرود' : 'alx Cargo & Logistics Co.'}
                </h1>
                <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#555' }}>
                  {isAr ? 'الجمهورية اليمنية - صنعاء | مستند مقيد آلياً' : 'Republic of Yemen - Sanaa | Electronically Posted Document'}
                </p>
              </div>
              <div style={{ textAlign: isAr ? 'left' : 'right' }}>
                <h2 style={{ margin: 0, fontSize: '16px', color: '#d4af37', fontWeight: '900' }}>
                  {isAr ? 'سند قيد مالي مزدوج متوازن' : 'BALANCED JOURNAL VOUCHER'}
                </h2>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#111' }}>
                  {isAr ? 'رقم المستند: ' : 'Voucher No: '} {selectedLedgerEntry.refNumber}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '12px', marginBottom: '20px', borderBottom: '1px solid #ddd', paddingBottom: '15px' }}>
              <div>
                <strong>{isAr ? 'البيان الإجمالي:' : 'Particulars:'}</strong> {selectedLedgerEntry.title}
              </div>
              <div>
                <strong>{isAr ? 'تاريخ المعاملة:' : 'Transaction Date:'}</strong> {selectedLedgerEntry.date.toLocaleDateString()} {selectedLedgerEntry.date.toLocaleTimeString()}
              </div>
              <div>
                <strong>{isAr ? 'الطرف المدين:' : 'Debit Party:'}</strong> {selectedLedgerEntry.debitPartyName || '—'}
              </div>
              <div>
                <strong>{isAr ? 'الطرف الدائن:' : 'Credit Party:'}</strong> {selectedLedgerEntry.creditPartyName || '—'}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f7' }}>
                  <th style={{ border: '1px solid #ccc', padding: '10px', textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'الجانب المحاسبي' : 'Ledger Leg Side'}</th>
                  <th style={{ border: '1px solid #ccc', padding: '10px', textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'اسم الحساب والجهة' : 'Account Name'}</th>
                  <th style={{ border: '1px solid #ccc', padding: '10px', textAlign: isAr ? 'left' : 'right' }}>{isAr ? 'المبلغ' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #eee', padding: '10px', color: '#059669', fontWeight: 'bold' }}>
                    {isAr ? 'من حـ/ (الطرف المدين)' : 'Debit Leg (Dr.)'}
                  </td>
                  <td style={{ border: '1px solid #eee', padding: '10px' }}>
                    {selectedLedgerEntry.debitPartyName || '—'}
                  </td>
                  <td style={{ border: '1px solid #eee', padding: '10px', textAlign: isAr ? 'left' : 'right', fontWeight: 'bold', color: '#059669' }}>
                    +{selectedLedgerEntry.amountOriginal.toLocaleString()} {selectedLedgerEntry.currencyOriginal}
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #eee', padding: '10px', color: '#dc2626', fontWeight: 'bold' }}>
                    {isAr ? 'إلى حـ/ (الطرف الدائن)' : 'Credit Leg (Cr.)'}
                  </td>
                  <td style={{ border: '1px solid #eee', padding: '10px' }}>
                    {selectedLedgerEntry.creditPartyName || '—'}
                  </td>
                  <td style={{ border: '1px solid #eee', padding: '10px', textAlign: isAr ? 'left' : 'right', fontWeight: 'bold', color: '#dc2626' }}>
                    -{selectedLedgerEntry.amountOriginal.toLocaleString()} {selectedLedgerEntry.currencyOriginal}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '25px', padding: '12px', border: '1px solid #e3cc9a', borderRadius: '8px', backgroundColor: '#fffdf6', fontSize: '12px', fontWeight: 'bold' }}>
              <span>{isAr ? 'صافي القيمة الدفترية: ' : 'Net Amount: '}</span>
              <span>{selectedLedgerEntry.amountOriginal.toLocaleString()} {selectedLedgerEntry.currencyOriginal} (≈ {selectedLedgerEntry.amount.toLocaleString()} YER)</span>
            </div>

            <div style={{ marginTop: '50px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', fontSize: '11px', textAlign: 'center' }}>
              <div>
                <p style={{ fontWeight: 'bold', margin: '0 0 40px 0' }}>{isAr ? 'توقيع المحاسب والمُعدّ' : 'Prepared By'}</p>
                <div style={{ borderBottom: '1px dashed #aaa', width: '80%', margin: '0 auto' }}></div>
              </div>
              <div>
                <p style={{ fontWeight: 'bold', margin: '0 0 40px 0' }}>{isAr ? 'توقيع المستلم / العميل' : 'Received By'}</p>
                <div style={{ borderBottom: '1px dashed #aaa', width: '80%', margin: '0 auto' }}></div>
              </div>
              <div>
                <p style={{ fontWeight: 'bold', margin: '0 0 40px 0' }}>{isAr ? 'الاعتماد المالي / الإدارة' : 'Financial Controller'}</p>
                <div style={{ borderBottom: '1px dashed #aaa', width: '80%', margin: '0 auto' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

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
