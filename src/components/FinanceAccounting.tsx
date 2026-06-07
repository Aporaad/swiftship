import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, Search, CreditCard, ShieldAlert, CheckCircle, Wallet, ArrowUpRight, 
  ArrowDownLeft, HelpCircle, User, Truck, Calendar, Printer, Download, Star, ExternalLink,
  DollarSign, Activity, FileSpreadsheet, PlusCircle, Scale, Receipt, Sparkles, TrendingUp, RefreshCw, X,
  FolderTree, Wrench, Users, Coins, UserCheck, Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, writeBatch, onSnapshot, query, orderBy } from 'firebase/firestore';
import { notificationService } from '../services/notificationService';
import ChartOfAccounts from './ChartOfAccounts';
import AssetsPortfolio from './AssetsPortfolio';
import { EXPENSE_CATEGORIES } from '../pages/Expenses';
import { financialAccountService } from '../services/financialAccountService';

interface FinanceAccountingProps {
  orders: any[];
  expenses: any[];
  couriers: any[];
  customers: any[];
  isAr: boolean;
  settings: any;
  initialTab?: string;
}

export default function FinanceAccounting({ orders, expenses, couriers, customers, isAr, settings, initialTab }: FinanceAccountingProps) {
  // Navigation tabs for accounting
  const [accountingTab, setAccountingTab] = useState<'general_ledger' | 'courier_audit' | 'customer_audit' | 'chart_of_accounts' | 'assets_management' | 'financial_accounts' | 'salary_history'>('general_ledger');

  // Auto-switch to a requested tab when mounted via deep-link (e.g. sidebar ?subtab=salary)
  useEffect(() => {
    if (initialTab === 'salary') setAccountingTab('salary_history');
  }, [initialTab]);
  
  // Real-time assets sync for dynamic pricing in Chart of Accounts
  const [assets, setAssets] = useState<any[]>([]);
  // Real-time financial accounts sync
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'assets'), (snap) => {
      setAssets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error loading assets for balance list:", error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'accounts'), (snap) => {
      setFinancialAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'customer' | 'courier' | 'employee'>('all');
  const [searchAccountQuery, setSearchAccountQuery] = useState('');

  // Filtering ledger states
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Debit' | 'Credit'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'YER' | 'USD' | 'SAR'>('all');
  
  // Target sub-account selection state for manual adjustment modal
  const [targetType, setTargetType] = useState<'general' | 'customer' | 'courier' | 'employee'>('general');
  const [selectedAccountId, setSelectedAccountId] = useState('');

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
  const [empStmtDateFilter, setEmpStmtDateFilter] = useState<'all'|'30days'|'custom'>('all');
  const [empStmtStartDate, setEmpStmtStartDate] = useState('');
  const [empStmtEndDate, setEmpStmtEndDate] = useState('');

  useEffect(() => {
    // Default adjustSalaryMonth to current month YYYY-MM
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    setAdjustSalaryMonth(`${YYYY}-${MM}`);

    // Snapshot listener for account transactions
    const unsub = onSnapshot(collection(db, 'account_transactions'), (snap) => {
      setAccountTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error loading account transactions:", error);
    });
    return () => unsub();
  }, []);

  // Load salary history & employees for the Salary History tab
  useEffect(() => {
    const qHist = query(collection(db, 'salary_history'), orderBy('createdAt', 'desc'));
    const unsubH = onSnapshot(qHist, (snap) => {
      setSalaryHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('[SalaryTab] salary_history error:', err));

    const unsubE = onSnapshot(collection(db, 'users'), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
    if (currency === 'USD') return amt * (settings.exchangeRateUSD || 535);
    if (currency === 'SAR') return amt * (settings.exchangeRateSAR || 140);
    return amt;
  };

  // Convert YER to original currency if needed for display
  const getDisplayEquivalent = (amtYER: number, currency: string) => {
    if (currency === 'USD') return amtYER / (settings.exchangeRateUSD || 535);
    if (currency === 'SAR') return amtYER / (settings.exchangeRateSAR || 140);
    return amtYER;
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

  // 1. Double-Entry General Chronology Ledger (Unified from account_transactions and unlinked expenses)
  const ledgerEntries = useMemo(() => {
    const entries: any[] = [];

    // A. Push all transactions from account_transactions
    accountTransactions.forEach(tx => {
      const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
      entries.push({
        id: tx.id || `TX-${Math.random()}`,
        refNumber: tx.refNumber || 'TX-REF',
        date,
        title: tx.description || `${tx.entityName} - ${tx.type}`,
        notes: tx.description || '',
        party: tx.entityName,
        entityId: tx.entityId,
        entityType: tx.entityType,
        type: tx.type, // 'Debit' | 'Credit'
        amount: tx.amount || 0,
        currency: settings.currency || 'YER',
        amountOriginal: tx.amountOriginal || tx.amount || 0,
        currencyOriginal: tx.currencyOriginal || 'YER',
        module: tx.module || 'adjustment'
      });
    });

    // B. Push unlinked expenses (general safebox outflows / inflows)
    expenses.forEach(exp => {
      // Skip if it is linked to a financial account
      if (exp.linkedAccountId || exp.financialAccountId) return;

      const date = exp.createdAt ? new Date(exp.createdAt) : new Date();
      const convertedAmt = convertToYER(exp.amount || 0, exp.currency);
      const isManualDebit = exp.notes && (exp.notes.includes('[MANUAL-DEBIT]') || exp.notes.includes('قيد تسوية مدين'));

      if (isManualDebit) {
        entries.push({
          id: `EXP-UNLINKED-${exp.id}`,
          refNumber: exp.expenseNumber || 'EXP-UNLINKED',
          date,
          title: exp.notes.replace('[MANUAL-DEBIT]', '').trim(),
          notes: isAr ? 'تسوية حسابية يدوية داخلية للأصول' : 'Bilateral manual treasury entry',
          party: exp.recipientName || (isAr ? 'الخزينة العامة' : 'Central Treasury'),
          entityId: null,
          entityType: null,
          type: 'Debit',
          amount: convertedAmt,
          currency: 'YER',
          amountOriginal: exp.amount,
          currencyOriginal: exp.currency,
          module: 'adjustment'
        });
      } else {
        const catObj = EXPENSE_CATEGORIES.find(c => c.id === exp.category) || EXPENSE_CATEGORIES.find(c => c.id === 'other');
        const catLabel = catObj ? (isAr ? catObj.labelAr : catObj.labelEn) : (isAr ? 'مصروف تشغيلي' : 'Operational Expense');
        entries.push({
          id: `EXP-UNLINKED-${exp.id}`,
          refNumber: exp.expenseNumber || 'EXP-UNLINKED',
          date,
          title: isAr ? `سند صرف [${catLabel}]: ${exp.notes}` : `Expense voucher [${catLabel}]: ${exp.notes}`,
          notes: isAr ? 'خصم المصروف من الخزينة مباشرة (غير مرتبط بحساب)' : 'Direct expense safe outflow (unlinked)',
          party: exp.recipientName || (isAr ? 'خزينة المكتب' : 'Office Safe'),
          entityId: null,
          entityType: null,
          type: 'Credit',
          amount: convertedAmt,
          currency: 'YER',
          amountOriginal: exp.amount,
          currencyOriginal: exp.currency,
          module: 'expenses'
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
      } else {
        currentBalance -= entry.amount;
      }
      return {
        ...entry,
        runningBalance: currentBalance
      };
    });

    // Return reversed (newest first for feed view)
    return computed.reverse();
  }, [accountTransactions, expenses, isAr, settings]);

  // Apply filters to ledger
  const filteredLedgerEntries = useMemo(() => {
    return ledgerEntries.filter(e => {
      // 1. Text Search
      const qr = searchLedgerQuery.toLowerCase();
      if (qr) {
        const matchesText = (
          (e.refNumber || '').toLowerCase().includes(qr) ||
          (e.title || '').toLowerCase().includes(qr) ||
          (e.party || '').toLowerCase().includes(qr) ||
          (e.notes || '').toLowerCase().includes(qr)
        );
        if (!matchesText) return false;
      }

      // 2. Type Filter
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;

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
    let yerIn = 0, yerOut = 0;
    let usdIn = 0, usdOut = 0;
    let sarIn = 0, sarOut = 0;

    // Direct sum parsing of native original currencies in ledger
    ledgerEntries.forEach(e => {
      const cur = e.currencyOriginal || 'YER';
      const amt = parseFloat(e.amountOriginal || e.amount || 0);

      let isSafeBoxInflow = false;
      let isSafeBoxOutflow = false;

      if (e.id.toString().startsWith('EXP-UNLINKED')) {
        if (e.type === 'Debit') isSafeBoxInflow = true;
        if (e.type === 'Credit') isSafeBoxOutflow = true;
      } else {
        // Linked account transactions
        if (e.module === 'payment') {
           if (e.type === 'Credit') isSafeBoxInflow = true; // Customer paid us
           else isSafeBoxOutflow = true; // We refunded customer
        } else if (e.module === 'custody') {
           // Custody granted (Debit to courier account): Courier collects from customer. Cash box is UNTOUCHED.
           // Custody settled (Credit to courier account): Courier hands cash to cashier => Cash Inflow
           if (e.type === 'Credit') {
               isSafeBoxInflow = true;
           }
        } else if (e.module === 'expense' && e.refNumber?.startsWith('EXP-')) {
           // Manual expense from expenses page
           if (e.type === 'Credit') isSafeBoxOutflow = true;
           else if (e.type === 'Debit') isSafeBoxInflow = true;
        } else if (e.module === 'adjustment') {
           // Manual adjustment from Accounting page
           if (e.type === 'Debit') isSafeBoxInflow = true;
           else if (e.type === 'Credit') isSafeBoxOutflow = true;
        } else if (e.entityId === 'sys_sourcing_cost') {
           if (e.type === 'Debit') {
             isSafeBoxOutflow = true;
           }
        }
        // order, wage, auto-commission (COM-*) do NOT affect safe box directly.
      }

      if (cur === 'YER') {
        if (isSafeBoxInflow) yerIn += amt;
        if (isSafeBoxOutflow) yerOut += amt;
      } else if (cur === 'USD') {
        if (isSafeBoxInflow) usdIn += amt;
        if (isSafeBoxOutflow) usdOut += amt;
      } else if (cur === 'SAR') {
        if (isSafeBoxInflow) sarIn += amt;
        if (isSafeBoxOutflow) sarOut += amt;
      }
    });

    return {
      yer: { in: yerIn, out: yerOut, balance: yerIn - yerOut },
      usd: { in: usdIn, out: usdOut, balance: usdIn - usdOut },
      sar: { in: sarIn, out: sarOut, balance: sarIn - sarOut },
      totalIn_YER: yerIn + convertToYER(usdIn, 'USD') + convertToYER(sarIn, 'SAR'),
      totalOut_YER: yerOut + convertToYER(usdOut, 'USD') + convertToYER(sarOut, 'SAR')
    };
  }, [ledgerEntries, settings]);

  // Dynamic P&L Trial Balance Summary metrics (All values converted to YER for consistent financial scope)
  const financialTrialMetrics = useMemo(() => {
    let totalCustomerRevenue = 0;
    let totalAdjustInflows = 0;
    let operatingExpenses = 0;
    let chinaRemittance = 0;
    let custodyOutstanding_YER = 0;

    ledgerEntries.forEach(e => {
      const amtYER = e.amount;
      if (e.type === 'Debit') {
        if (e.module === 'order') totalCustomerRevenue += amtYER;
        else if (e.module === 'adjustment') totalAdjustInflows += amtYER;
      } else {
        if (e.module === 'expense' && e.refNumber?.startsWith('EXP-')) operatingExpenses += amtYER;
        else if (e.module === 'custody') custodyOutstanding_YER += amtYER; // initial outflow
      }
    });

    const netOperatingCosts = operatingExpenses;
    const netReceivables = orders.reduce((sum, o) => sum + parseFloat(o.amountRemaining || 0), 0);
    const activeCustodyLiabilities = expenses
      .filter(e => e.type === 'Custody' && e.status === 'Pending')
      .reduce((sum, e) => sum + convertToYER(e.amount, e.currency), 0);

    // Properly compute net profit from orders explicit profit margins
    let accumulatedOrdersProfitYER = 0;
    orders.forEach(o => {
      const profitSAR = parseFloat(o.profitCompanySAR || 0);
      if (profitSAR > 0) {
        // approximate YER conversion based on order's rate or general default
        const rate = parseFloat(o.exchangeRateYER || settings.exchangeRateYER || 390);
        accumulatedOrdersProfitYER += (profitSAR * rate);
      }
    });

    const netProfit = (accumulatedOrdersProfitYER + totalAdjustInflows) - netOperatingCosts;

    return {
      totalCustomerRevenue,
      totalAdjustInflows,
      netOperatingCosts,
      activeCustodyLiabilities,
      netReceivables,
      netProfit,
      operatingMargin: totalCustomerRevenue > 0 ? Math.round((netProfit / totalCustomerRevenue) * 100) : 0
    };
  }, [ledgerEntries, orders, expenses, settings]);

  // Handle addition of quick accounting adjustment voucher
  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustData.amount || parseFloat(adjustData.amount) <= 0 || (!adjustData.title && !isSalaryPayment)) {
      notificationService.notify({
        title: isAr ? 'خطأ بالبيانات' : 'Invalid Entry',
        message: isAr ? 'يرجى ملء تفاصيل القيد والمبلغ المالي الصحيح.' : 'Provide precise title and positive currency amount.',
        type: 'error'
      });
      return;
    }

    if (targetType !== 'general' && !selectedAccountId) {
      notificationService.notify({
        title: isAr ? 'الحساب غير محدد' : 'Account Required',
        message: isAr ? 'يرجى تحديد الحساب المالي المستهدف للتسوية.' : 'Please select the target financial account.',
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
        { USD: settings.exchangeRateUSD || 535, SAR: settings.exchangeRateSAR || 140 }
      );

      const timestamp = Date.now();
      const randStr = Math.floor(1000 + Math.random() * 9000);
      const targetAccount = targetType !== 'general' 
        ? financialAccounts.find(a => a.id === selectedAccountId) 
        : null;

      // 1. If it is a Salary Payment, invoke the atomic recordSalaryPayment service
      if (isSalaryPayment && targetType === 'employee' && targetAccount) {
        if (!adjustSalaryMonth) {
          notificationService.notify({
            title: isAr ? 'الشهر غير محدد' : 'Month Required',
            message: isAr ? 'يرجى تحديد شهر صرف الراتب.' : 'Please select the salary month.',
            type: 'error'
          });
          setAdjustLoading(false);
          return;
        }

        const voucherCode = await financialAccountService.recordSalaryPayment({
          employeeId: targetAccount.entityId,
          employeeName: targetAccount.entityName,
          accountId: selectedAccountId,
          accountCode: targetAccount.accountCode,
          amount: convertedAmt,
          currency: adjustData.currency,
          salaryMonth: adjustSalaryMonth,
          notes: adjustData.notes || (isAr ? `صرف راتب شهر ${adjustSalaryMonth}` : `Salary payment for ${adjustSalaryMonth}`),
          createdByUid: auth.currentUser?.uid || 'system',
          createdByName: auth.currentUser?.email?.split('@')[0] || 'Finance Auditor'
        });

        // Insert safebox / expense entry to display in general daily ledger
        const payload = {
          expenseNumber: voucherCode,
          category: 'salary',
          type: 'Salary',
          amount: amountVal,
          currency: adjustData.currency,
          amountInDefaultCurrency: convertedAmt,
          recipientId: targetAccount.entityId,
          recipientEntityId: targetAccount.entityId,
          recipientEntityType: 'employee',
          recipientName: targetAccount.entityName,
          notes: `صرف راتب شهر ${adjustSalaryMonth} — ${targetAccount.entityName}`,
          remarks: adjustData.notes || '',
          status: 'Completed',
          createdByUid: auth.currentUser?.uid || 'system',
          createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
          createdByName: auth.currentUser?.email?.split('@')[0] || 'Finance Auditor',
          createdAt: timestamp,
          financialAccountId: selectedAccountId,
          financialAccountCode: targetAccount.accountCode,
          salaryMonth: adjustSalaryMonth
        };

        await addDoc(collection(db, 'expenses'), payload);

      } else {
        // 2. Regular adjustment double entry
        const voucherCode = `ADJ-${new Date().getFullYear().toString().slice(-2)}-${randStr}`;

        if (targetAccount) {
          await financialAccountService.recordTransaction(selectedAccountId, {
            accountId: selectedAccountId,
            accountCode: targetAccount.accountCode,
            entityType: targetAccount.entityType,
            entityId: targetAccount.entityId,
            entityName: targetAccount.entityName,
            type: adjustData.type as 'Debit' | 'Credit',
            amount: convertedAmt,
            amountOriginal: amountVal,
            currencyOriginal: adjustData.currency,
            description: adjustData.title,
            refNumber: voucherCode,
            module: 'adjustment',
            createdAt: timestamp,
            createdByUid: auth.currentUser?.uid || 'system',
            createdByName: auth.currentUser?.email?.split('@')[0] || 'Finance Auditor'
          });
        }

        // Insert safe box / expense entry so it shows in the general daily ledger
        const typeLabel = adjustData.type === 'Debit' ? '[MANUAL-DEBIT]' : '[MANUAL-CREDIT]';
        const accountInfo = targetAccount ? ` (الحساب المالي: ${targetAccount.accountCode} - ${targetAccount.entityName})` : '';
        const notesLabel = `${typeLabel} ${adjustData.title}${accountInfo}`;

        const payload = {
          expenseNumber: voucherCode,
          type: 'General',
          amount: amountVal,
          currency: adjustData.currency,
          recipientId: targetAccount ? targetAccount.entityId : 'adjustment',
          recipientName: adjustData.recipientName || (isAr ? 'التعديلات المحاسبية' : 'Ledger Adjustments'),
          notes: notesLabel + (adjustData.notes ? ` : ${adjustData.notes}` : ''),
          status: 'Completed',
          createdByUid: auth.currentUser?.uid || 'system',
          createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
          createdByName: auth.currentUser?.email?.split('@')[0] || 'Finance Auditor',
          createdAt: timestamp,
          financialAccountId: selectedAccountId || null,
          financialAccountCode: targetAccount ? targetAccount.accountCode : null
        };

        await addDoc(collection(db, 'expenses'), payload);
      }

      notificationService.notify({
        title: isAr ? 'تم تقييد القيد بنجاح' : 'Adjustment Logged',
        message: isAr ? 'تم حفظ قيد تسويقي وترحيله بنجاح' : 'Journal voucher registered and ledger synchronized.',
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
      setSelectedAccountId('');
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

    const totalCustodyIssued = courierExpenses.reduce((sum, exp) => sum + convertToYER(exp.amount || 0, exp.currency), 0);
    const totalCustodySettled = courierExpenses.filter(e => e.status === 'Settled').reduce((sum, exp) => sum + convertToYER(exp.amount || 0, exp.currency), 0);
    const netLiableBalance = totalCustodyIssued - totalCustodySettled;

    // Calculation for dynamic physical COD cash holdings
    const currentUnremittedCargoCash = orders
      .filter(o => o.deliveryCourierId === auditedCourierId && (o.orderStatus === 'تم التسليم' || o.orderStatus === 'Delivered') && parseFloat(o.amountRemaining || 0) > 0);

    const totalUnremittedCashValue = currentUnremittedCargoCash.reduce((sum, o) => sum + parseFloat(o.amountRemaining || 0), 0);

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
      totalOrdersDelivered,
      successRate
    };
  }, [auditedCourierId, couriers, expenses, orders, settings]);

  // Courier transactions list
  const courierTransactions = useMemo(() => {
    if (!auditedCourierId) return [];
    return accountTransactions
      .filter(tx => tx.entityType === 'courier' && tx.entityId === auditedCourierId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [auditedCourierId, accountTransactions]);

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

      // 1. Reconcile current financial balance if not zero
      if (currentBalance !== 0) {
        const linkedAccountId = cour.financialAccountId;
        const linkedAccountCode = cour.financialAccountCode;

        if (linkedAccountId) {
          const type = currentBalance > 0 ? 'Credit' : 'Debit'; // Credit to reduce balance, Debit to increase it
          const amount = Math.abs(currentBalance);

          await financialAccountService.recordTransaction(linkedAccountId, {
            accountId: linkedAccountId,
            accountCode: linkedAccountCode || '',
            entityType: 'courier',
            entityId: cour.id,
            entityName: cour.fullName,
            type,
            amount,
            amountOriginal: amount,
            currencyOriginal: 'YER',
            description: isAr 
              ? `قيد تسوية لمطابقة وتصفير الحساب المالي للمندوب — قيد إقفال` 
              : `Offsetting adjustment to zero out courier account balance`,
            refNumber: mainVoucherCode,
            module: 'adjustment',
            createdByUid: auth.currentUser?.uid || 'system',
            createdByName: 'Finance Auditor',
            createdAt: timestamp
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
            { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
          );
          await financialAccountService.recordTransaction(exp.linkedAccountId, {
            accountId: exp.linkedAccountId,
            accountCode: exp.linkedAccountCode || '',
            entityType: 'courier',
            entityId: cour.id,
            entityName: cour.fullName,
            type: 'Debit', // Reversal
            amount: settledAmount,
            amountOriginal: parseFloat(exp.amount || 0),
            currencyOriginal: exp.currency || 'YER',
            description: isAr ? `تسوية عهدة تلقائية: ${exp.expenseNumber}` : `Auto custody settlement: ${exp.expenseNumber}`,
            refNumber: `${exp.expenseNumber}-SET`,
            module: 'custody',
            createdByUid: auth.currentUser?.uid || 'system',
            createdByName: 'Finance Auditor',
            createdAt: timestamp
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
      await addDoc(expensesRef, {
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
    
    if (!window.confirm(isAr 
      ? `هل تريد تصفية كافة مستحقات الشحن المحصلة بذمة المندوب (${courierAuditSheet.totalUnremittedCashValue.toLocaleString()} YER) وتوريدها للخزينة؟` 
      : `Confirm remittance of ${courierAuditSheet.totalUnremittedCashValue.toLocaleString()} YER held by ${courierAuditSheet.courier.fullName}?`
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
          paymentStatus: isAr ? 'خالص' : 'Fully Paid',
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
        currency: 'YER',
        recipientId: courierAuditSheet.courier.id,
        recipientName: courierAuditSheet.courier.fullName,
        notes: `[MANUAL-DEBIT] توريد تحصيلات شحنات المندوب ${courierAuditSheet.courier.fullName}`,
        status: 'Completed',
        createdByUid: auth.currentUser?.uid || 'system',
        createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
        createdByName: 'Finance Auditor',
        createdAt: Date.now()
      };

      await addDoc(remitsRef, payload);
      await batch.commit();

      notificationService.notify({
        title: isAr ? 'تم توريد التحصيلات وتصفير الذمة' : 'Cargo Cash Remitted',
        message: isAr 
          ? `تم تصفير ذمة المندوب وتوريد مبلغ ${courierAuditSheet.totalUnremittedCashValue.toLocaleString()} YER للخزينة بنجاح!` 
          : `Remittance logged: safely deposited ${courierAuditSheet.totalUnremittedCashValue.toLocaleString()} YER from Courier collections.`,
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
        balance: cumulativeBalance
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
        createdAt: Date.now()
      };

      await addDoc(adjustmentsRef, payload);

      // --- Register Credit in Customer's Financial Account ---
      const customerRecord = customerLedgerDetails.customer;
      const linkedAccountId = customerRecord.financialAccountId;
      const linkedAccountCode = customerRecord.financialAccountCode;

      if (linkedAccountId) {
        const convertedPaid = financialAccountService.convertToDefaultCurrency(
          amountVal,
          'YER',
          settings.currency || 'YER',
          { USD: settings.exchangeRateUSD || 535, SAR: settings.exchangeRateSAR || 140 }
        );

        await financialAccountService.recordTransaction(linkedAccountId, {
          accountId: linkedAccountId,
          accountCode: linkedAccountCode || '',
          entityType: 'customer',
          entityId: auditedCustomerId,
          entityName: customerRecord.fullName,
          type: 'Credit', // Credit transaction to reflect cash received
          amount: convertedPaid,
          amountOriginal: amountVal,
          currencyOriginal: 'YER',
          description: isAr 
            ? `دفعة نقدية مستلمة على الحساب كشف حساب: ${payNotes || ''}` 
            : `Cash payment received on account statement: ${payNotes || ''}`,
          refNumber: voucherNum,
          module: 'payment',
          createdByUid: auth.currentUser?.uid || 'system',
          createdByName: 'Finance Auditor',
          createdAt: Date.now()
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
          e.date.toISOString().replace(/T/, ' ').replace(/\..+/, ''),
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
      link.setAttribute("download", `General_Ledger_Export_${new Date().toISOString().slice(0, 10)}.csv`);
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
              <span class="meta-label">${isAr ? 'تاريخ التصدير:' : 'Date Issued:'}</span> ${new Date().toLocaleString()}
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
    <div className="space-y-6 pt-2 animate-fade-in text-start select-none">
      
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
              <span>USD Box:</span>
              <span className="text-white">${vaultBalances.usd.balance.toLocaleString()}</span>
            </p>
            <p className="flex justify-between">
              <span>SAR Box:</span>
              <span className="text-white">SR {vaultBalances.sar.balance.toLocaleString()}</span>
            </p>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-slate-850/60 flex justify-between text-[9px] text-[#d4af37] font-bold">
            <span>{isAr ? 'إجمالي الموازي لليمني:' : 'Total Equivalent:'}</span>
            <span>{(vaultBalances.totalIn_YER - vaultBalances.totalOut_YER).toLocaleString()} YER</span>
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
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${
            accountingTab === 'general_ledger' 
              ? 'border-[#d4af37] text-white' 
              : 'border-transparent text-slate-500 hover:text-slate-350'
          }`}
        >
          <Scale className="w-3.5 h-3.5 animate-pulse" />
          {isAr ? '⚖️ الدفتر اليومي والمقاصة' : 'Daily Double-Entry Ledger'}
        </button>
        <button
          onClick={() => setAccountingTab('courier_audit')}
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${
            accountingTab === 'courier_audit' 
              ? 'border-[#d4af37] text-white' 
              : 'border-transparent text-slate-500 hover:text-slate-350'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          {isAr ? '🔑 كاشف ومطابقة حسابات المناديب' : 'Courier Custody Statement'}
        </button>
        <button
          onClick={() => setAccountingTab('customer_audit')}
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${
            accountingTab === 'customer_audit' 
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
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${
            accountingTab === 'chart_of_accounts' 
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
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${
            accountingTab === 'financial_accounts' 
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
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${
            accountingTab === 'assets_management' 
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
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${
            accountingTab === 'salary_history' 
              ? 'border-[#d4af37] text-white' 
              : 'border-transparent text-slate-500 hover:text-slate-350'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-[#d4af37]" />
          {isAr ? '💼 سجل الرواتب وكشف حساب الموظفين' : 'Salary History & Staff Statements'}
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
                  <option value="YER">{isAr ? 'ريال يمني YER' : 'Yemeni Rial'}</option>
                  <option value="USD">{isAr ? 'دولار أمريكي USD' : 'US Dollar'}</option>
                  <option value="SAR">{isAr ? 'ريال سعودي SAR' : 'Saudi Riyal'}</option>
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
              <br/>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start">
                <thead className="bg-[#0a0a0d] text-slate-500 text-[9.5px] font-black uppercase tracking-wider border-b border-slate-850">
                  <tr>
                    <th className="p-4">{isAr ? 'التاريخ الفعلي' : 'Effective Date'}</th>
                    <th className="p-4">{isAr ? 'سند مرجعي / رمز القيد' : 'Voucher Node'}</th>
                    <th className="p-4">{isAr ? 'الوصف والتسويات' : 'Particulars / Annotations'}</th>
                    <th className="p-4">{isAr ? 'الطرف الآخر / الحساب المساعد' : 'Counterparty'}</th>
                    <th className="p-4">{isAr ? 'مدين مقبوض (+)' : 'Inflow (Debit +)'}</th>
                    <th className="p-4">{isAr ? 'دائن مصروف (-)' : 'Outflow (Credit -)'}</th>
                    <th className="p-4 text-left">{isAr ? 'رصيد الصندوق YER' : 'Balance YER'}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-805 bg-black/10 font-bold">
                  {filteredLedgerEntries.map((e) => {
                    const isDebit = e.type === 'Debit';
                    return (
                      <tr key={e.id} className="hover:bg-slate-950/40 transition-colors">
                        <td className="p-4 text-slate-500 text-[10px] whitespace-nowrap">
                          {e.date.toLocaleDateString()} <span className="text-[9px] block text-slate-600 font-normal">{e.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="p-4">
                          <span className={`bg-slate-900 border border-slate-800 text-[#d4af37] px-2.5 py-1 rounded-lg text-[9.5px] font-mono whitespace-nowrap`}>
                            {e.refNumber}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-slate-200 block text-xs font-black">{e.title}</span>
                          <span className="text-[9px] text-slate-500 block font-normal">{e.notes}</span>
                        </td>
                        <td className="p-4 text-slate-350">
                          <span 
                            onClick={() => {
                              if (e.entityId && (e.entityType === 'customer' || e.entityType === 'courier')) {
                                window.dispatchEvent(new CustomEvent('open-entity-ledger', { 
                                  detail: { entityId: e.entityId, entityType: e.entityType } 
                                }));
                              }
                            }}
                            className={
                              e.entityId && (e.entityType === 'customer' || e.entityType === 'courier')
                                ? 'hover:text-[#d4af37] cursor-pointer underline decoration-dotted decoration-[#d4af37]/40 transition-colors'
                                : ''
                            }
                          >
                            {e.party || '—'}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-black text-emerald-400">
                          {isDebit ? `+${e.amount.toLocaleString()} YER` : '—'}
                          {isDebit && e.amountOriginal && e.currencyOriginal !== 'YER' && (
                            <span className="text-[9px] text-slate-500 block font-normal">({e.amountOriginal} {e.currencyOriginal})</span>
                          )}
                        </td>
                        <td className="p-4 font-mono font-black text-rose-500">
                          {!isDebit ? `-${e.amount.toLocaleString()} YER` : '—'}
                          {!isDebit && e.amountOriginal && e.currencyOriginal !== 'YER' && (
                            <span className="text-[9px] text-slate-500 block font-normal">({e.amountOriginal} {e.currencyOriginal})</span>
                          )}
                        </td>
                        <td className="p-4 text-left font-mono font-black text-slate-300">
                          {e.runningBalance.toLocaleString()} YER
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
                    <span className="text-base font-mono font-black text-white">{courierAuditSheet.totalCustodyIssued.toLocaleString()} YER</span>
                  </div>
                  
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-black">{isAr ? 'العهد المصفاة والمسلمة' : 'Reconciled & Settled'}</span>
                    <span className="text-base font-mono font-black text-emerald-400">{courierAuditSheet.totalCustodySettled.toLocaleString()} YER</span>
                  </div>

                  {/* Active liability trust */}
                  <div className="bg-[#ef4444]/5 p-3 rounded-2xl border border-[#ef4444]/15">
                    <span className="text-[10px] text-rose-400 uppercase block font-black">{isAr ? 'ذمة العهد التشغيلية العالقة' : 'Locked Liable Custody'}</span>
                    <span className="text-lg font-mono font-black text-rose-500">{courierAuditSheet.netLiableBalance.toLocaleString()} YER</span>
                    <span className="text-[8.5px] text-slate-500 block mt-1 leading-snug">{isAr ? 'عهد نقدية مفتوحة مخصصة لتصاريف العمل لم تصف بعد.' : 'Outstanding custody needing administrative settlement receipts.'}</span>
                  </div>

                  {/* Delivery Cargo COD Cash holding - HUGE Logistics-finance highlight! */}
                  <div className="bg-cyan-500/5 p-4 rounded-3xl border border-cyan-500/15 space-y-3">
                    <div>
                      <span className="text-[10px] text-cyan-400 uppercase block font-black">{isAr ? 'التحصيلات النقدية للشحنات المسلمة بذمته' : 'Cargo Cash Held (COD)'}</span>
                      <span className="text-lg font-mono font-black text-cyan-400">{courierAuditSheet.totalUnremittedCashValue.toLocaleString()} YER</span>
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
                              <span className="text-[#d4af37] font-mono font-black block">{cust.amount?.toLocaleString()} {cust.currency}</span>
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
                      const isDebit = tx.type === 'Debit';
                      return (
                        <div key={tx.id} className="pt-2 flex items-center justify-between text-xs">
                          <div>
                            <span className="bg-slate-900 border border-slate-800 text-[#d4af37] px-2 py-0.5 rounded text-[9px] font-mono mr-2">
                              {tx.refNumber}
                            </span>
                            <span className="text-slate-305 text-slate-300 font-bold">{tx.description || tx.module}</span>
                            <span className="text-[9px] text-slate-550 block font-normal">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ''}
                            </span>
                          </div>
                          
                          <div className="text-right">
                            <span className={`font-mono font-black ${isDebit ? 'text-emerald-400' : 'text-rose-500'}`}>
                              {isDebit ? '+' : '-'}{tx.amount?.toLocaleString()} {tx.currencyOriginal}
                            </span>
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
                              {parseFloat(ord.amountRemaining || 0).toLocaleString()} YER
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
                    <span className="text-base font-mono font-black text-white">{customerLedgerDetails.grossFreightValuation.toLocaleString()} YER</span>
                  </div>
                  
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-black">{isAr ? 'المبالغ المسددة والمقيدة كداين' : 'Settle Paid Revenues'}</span>
                    <span className="text-base font-mono font-black text-emerald-400">{customerLedgerDetails.netPaidRevenues.toLocaleString()} YER</span>
                  </div>

                  {/* Cumulative Ledger Net balance */}
                  <div className="bg-amber-500/5 p-4 rounded-3xl border border-amber-500/10">
                    <span className="text-[10px] text-amber-500 uppercase block font-black">{isAr ? 'رصيد الحساب المتبقي بذمته (مطالبة مالية)' : 'Actual Outstanding Debit Balance'}</span>
                    <span className="text-xl font-mono font-black text-amber-500">{customerLedgerDetails.currentOutstandingBalance.toLocaleString()} YER</span>
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
                            {row.debit > 0 ? `+${row.debit.toLocaleString()}` : '—'}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-400">
                            {row.credit > 0 ? `-${row.credit.toLocaleString()}` : '—'}
                          </td>
                          <td className="p-3 text-left font-mono font-black text-slate-200">
                            {row.balance.toLocaleString()} YER
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
              [ {isAr ? 'يرجى اختيار العميل من القائمة أعلاه لسحب ومطابقة كشوفات ذمته التفصيلية' : 'select_buyer_from_selector_to_render_standing_account' } ]
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
                    setSelectedAccountId('');
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
                    {financialAccounts.filter(a => a.entityType === 'customer').reduce((sum, a) => sum + (a.balance || 0), 0).toLocaleString()} YER
                  </span>
                </div>
                <div className="text-center border-l border-r border-slate-850 px-3">
                  <span className="block text-[8px] text-slate-500 font-black">{isAr ? 'إجمالي المناديب' : 'Courier Bal'}</span>
                  <span className="font-mono text-[10px] font-bold text-amber-500 block">
                    {financialAccounts.filter(a => a.entityType === 'courier').reduce((sum, a) => sum + (a.balance || 0), 0).toLocaleString()} YER
                  </span>
                </div>
                <div className="text-center">
                  <span className="block text-[8px] text-slate-500 font-black">{isAr ? 'إجمالي الموظفين' : 'Staff Bal'}</span>
                  <span className="font-mono text-[10px] font-bold text-indigo-400 block">
                    {financialAccounts.filter(a => a.entityType === 'employee').reduce((sum, a) => sum + (a.balance || 0), 0).toLocaleString()} YER
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
                  {filteredAccountsList.map((acc) => {
                    const balanceInUSD = getDisplayEquivalent(acc.balance || 0, 'USD');
                    const balanceInSAR = getDisplayEquivalent(acc.balance || 0, 'SAR');
                    
                    return (
                      <tr key={acc.id} className="hover:bg-slate-950/40 transition-colors">
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
                          <span className={`text-[8px] uppercase font-black px-2 py-0.5 rounded ${
                            acc.entityType === 'customer' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/20' :
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
                        <td className={`p-4 font-mono font-black ${
                          (acc.balance || 0) >= 0 ? 'text-emerald-400' : 'text-rose-500'
                        }`}>
                          {acc.balance?.toLocaleString()} YER
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
                              setSelectedAccountId(acc.id);
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
                currency: s.currency || settings.currency || 'YER',
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
            <style dangerouslySetInnerHTML={{__html: `
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
                className={`text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${
                  !employeeStatementId
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
                        <span className="text-xs font-sans text-slate-500 font-normal ml-1.5">{settings.currency || 'YER'}</span>
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
                              {(item.amount || 0).toLocaleString()} {item.currency || settings.currency}
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
                          {isAr ? 'الراتب الشهري:' : 'Monthly Salary:'} {empStatementEmployee.monthlySalary?.toLocaleString()} {empStatementEmployee.currency || settings.currency}
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
                      className={`text-[11px] font-black px-3 py-1.5 rounded-lg border transition-all ${
                        empStmtDateFilter === opt
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
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                                tx.module === 'salary'
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
                              {tx.type === 'Debit' ? `${(tx.amount || 0).toLocaleString()} ${tx.currency || ''}` : '—'}
                            </td>
                            <td className="p-4 text-center font-mono font-black text-rose-400">
                              {tx.type === 'Credit' ? `${(tx.amount || 0).toLocaleString()} ${tx.currency || ''}` : '—'}
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
                      <h2 className="text-lg font-black tracking-wider text-slate-800">{settings.systemName || settings.companyName || 'SwiftShip'}</h2>
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
                        <span className="font-mono text-lg text-emerald-600">{(selectedSalaryVoucher.amount || 0).toLocaleString()} {selectedSalaryVoucher.currency || settings.currency}</span>
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
          </div>
        );
      })()}

      {/* MODAL 1: PRECISE MANUAL JOURNAL ENTRY ADJUSTMENT ADJUSTMENT */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-start">
          <div className="bg-[#121215] border border-slate-850 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative animate-fade-in">
            <button 
              onClick={() => setIsAdjustmentModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 border-b border-slate-850">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Scale className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تسجيل إقرار مالي وقيد تسوية خزينة' : 'Add Ledger Journal Adjustment Voucher'}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                {isAr ? 'لتسوية أرصدة العملات أو عوائد غير تشغيلية.' : 'Manually adjust cash balance for capital assets or currency offsets.'}
              </p>
            </div>

            <form onSubmit={handleAddAdjustment} className="p-6 space-y-4">
              
              {/* Type Select */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'اتجاه حركة النقدية' : 'Accounting safe action'}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustData(prev => ({ ...prev, type: 'Debit' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                      adjustData.type === 'Debit'
                        ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                        : 'bg-black/20 border-slate-850 text-slate-450'
                    }`}
                  >
                    {isAr ? 'وارد / مدين (+)' : 'Receipt (Debit Inflow +)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustData(prev => ({ ...prev, type: 'Credit' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                      adjustData.type === 'Credit'
                        ? 'bg-rose-500/15 border-rose-500/25 text-rose-452 text-rose-400'
                        : 'bg-black/20 border-slate-850 text-slate-450'
                    }`}
                  >
                    {isAr ? 'صادر / دائن (-)' : 'Payment (Credit Outflow -)'}
                  </button>
                </div>
              </div>

              {/* Target Entity Type */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">
                  {isAr ? 'نوع الحساب المستهدف للتسوية' : 'Target Account Type'}
                </label>
                <select
                  value={targetType}
                  onChange={e => {
                    const val = e.target.value as any;
                    setTargetType(val);
                    setSelectedAccountId('');
                  }}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-black cursor-pointer outline-none focus:border-[#d4af37]"
                >
                  <option value="general">{isAr ? 'حساب النظام العام / الخزينة' : 'General System Treasury'}</option>
                  <option value="customer">{isAr ? 'حساب مالي لعميل' : 'Customer Financial Account'}</option>
                  <option value="courier">{isAr ? 'حساب مالي لمندوب' : 'Courier Financial Account'}</option>
                  <option value="employee">{isAr ? 'حساب مالي لموظف' : 'Employee Financial Account'}</option>
                </select>
              </div>

              {/* Target Account Selection (only if targetType is not general) */}
              {targetType !== 'general' && (
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">
                    {isAr ? 'اختر الحساب المستهدف' : 'Select Target Financial Account'}
                  </label>
                  <select
                    required
                    value={selectedAccountId}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedAccountId(val);
                      const acc = financialAccounts.find(a => a.id === val);
                      if (acc) {
                        setAdjustData(prev => ({
                          ...prev,
                          recipientName: acc.entityName
                        }));
                      }
                    }}
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-black cursor-pointer outline-none focus:border-[#d4af37]"
                  >
                    <option value="">{isAr ? '-- اختر الحساب --' : '-- Choose Account --'}</option>
                    {financialAccounts
                      .filter(a => a.entityType === targetType)
                      .map(a => (
                        <option key={a.id} value={a.id}>
                          {a.accountCode} - {a.entityName}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* If targetType is employee, show option for Salary Payment */}
              {targetType === 'employee' && selectedAccountId && (
                <div className="bg-black/30 border border-slate-850 rounded-xl p-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={isSalaryPayment}
                      onChange={e => {
                        const checked = e.target.checked;
                        setIsSalaryPayment(checked);
                        const acc = financialAccounts.find(a => a.id === selectedAccountId);
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
                    <option value="YER">YER</option>
                    <option value="USD">USD</option>
                    <option value="SAR">SAR</option>
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

              <div className="pt-3 border-t border-slate-850 flex gap-2">
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

    </div>
  );
}
