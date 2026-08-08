import React, { useState, useMemo, useEffect } from 'react';
import {
  FolderTree, Folder, FolderOpen, ChevronRight, ChevronDown, PlusCircle, Trash2,
  Search, Scale, X, Activity, ShieldCheck, RefreshCw, Edit2, FileText, FileSpreadsheet, Printer,
  TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import ConfirmModal from './ConfirmModal';
import { db } from '../lib/supabase-firebase-adapter';
import { collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot, query, where, getDocs, orderBy } from '../lib/supabase-firebase-adapter';
import { notificationService } from '../services/notificationService';
import { useAccountBalances, computeAccountBalance, guessAccountTypeFromCode, AccountType } from '../hooks/useAccountBalances';
import { financialAccountService } from '../services/financialAccountService';

interface ChartOfAccountsProps {
  isAr: boolean;
  settings: any;
  vaultBalances: {
    totalIn_YER: number;
    totalOut_YER: number;
    yer: { balance: number };
    usd: { balance: number };
    sar: { balance: number };
  };
  financialTrialMetrics: {
    totalCustomerRevenue: number;
    totalAdjustInflows: number;
    netOperatingCosts: number;
    activeCustodyLiabilities: number;
    netReceivables: number;
    netProfit: number;
  };
  vehiclesTotal: number;
  scannersTotal: number;
  officeAssetsTotal: number;
}

export interface AccountNode {
  code: string;
  nameAr: string;
  nameEn: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  parentCode: string | null;
  balance?: number;
  isSystem?: boolean;
  currency?: string;
  id?: string;
  // Extra fields from DB records (custom accounts from Supabase)
  accountCode?: string;
  entityType?: string;
  accountPrefix?: string;
  entityName?: string;
}

export default function ChartOfAccounts({
  isAr,
  settings,
  vaultBalances,
  financialTrialMetrics,
  vehiclesTotal,
  scannersTotal,
  officeAssetsTotal
}: ChartOfAccountsProps) {
  const [customAccounts, setCustomAccounts] = useState<AccountNode[]>([]);

  // ── Live transaction-based balances (real-time from Supabase) ──────────────
  const liveBalances = useAccountBalances();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportAccount, setReportAccount] = useState<AccountNode | null>(null);
  const [reportTransactions, setReportTransactions] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  const [editingNode, setEditingNode] = useState<AccountNode | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Currency converter — everything rolls up to YER for the tree
  const convertToYER = (amount: number, currency: string): number => {
    const amt = parseFloat(String(amount || 0));
    if (currency === 'USD') return amt * (settings.exchangeRateUSD || 535);
    if (currency === 'SAR') return amt * (settings.exchangeRateSAR || 140);
    return amt;
  };

  // Form states
  const [newAccount, setNewAccount] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    type: 'Asset' as 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense',
    parentCode: '',
    balance: '',
    currency: 'YER'
  });

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    '1000': true,
    '1100': true,
    '1110': true,
    '1120': true,
    '1130': true,
    '1200': true,
    '1210': true,
    '2000': true,
    '2100': true,
    '2110': true,
    '2120': true,
    '2130': true,
    '3000': true,
    '3100': true,
    '3200': true,
    '4000': true,
    '4100': true,
    '4200': true,
    '5000': true,
    '5100': true,
    '5300': true,
  });

  // Sync custom accounts from DB (Supabase real-time via adapter)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'accounts'), (snap: any) => {
      setCustomAccounts(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as any)));
    }, (error: any) => {
      console.error("Error loading custom accounts:", error);
    });
    return () => unsub();
  }, []);



  // ─────────────────────────────────────────────────────────────────────────────
  // Static/Dynamic System-default accounts — built from live props
  // ─────────────────────────────────────────────────────────────────────────────
  const systemAccounts = useMemo<AccountNode[]>(() => {
    const cashBalance = vaultBalances.totalIn_YER - vaultBalances.totalOut_YER;

    return [
      // ── 1000: ASSETS ────────────────────────────────────────────────────────
      { code: '1000', nameAr: 'الأصول الدفترية الكلية', nameEn: 'Total Assets Base', type: 'Asset', parentCode: null, isSystem: true },

      { code: '1100', nameAr: 'الأصول المتداولة والسيولة', nameEn: 'Current Assets & Liquidity', type: 'Asset', parentCode: '1000', isSystem: true },
      { code: '1110', nameAr: 'نقدية الصناديق والخزائن الحية', nameEn: 'Safe-Box Cash Accounts (Live)', type: 'Asset', parentCode: '1100', isSystem: true, balance: cashBalance, currency: 'YER' },
      // 1111-0 is a custom account created in DB; it will be picked up automatically
      { code: '1120', nameAr: 'ذمم وشحنات العملاء المعلقة المدينة', nameEn: 'Accounts Receivable (Pending Cargo)', type: 'Asset', parentCode: '1100', isSystem: true, balance: 0, currency: 'YER' },
      { code: '1130', nameAr: 'حسابات العملاء الماليين الكلية', nameEn: 'Customers Financial Accounts Ledger', type: 'Asset', parentCode: '1120', isSystem: true },

      { code: '1200', nameAr: 'الأصول الثابتة والعهد العينية', nameEn: 'Fixed Capital Assets Portfolio', type: 'Asset', parentCode: '1000', isSystem: true },
      { code: '1210', nameAr: 'سيارات نقل وشحن ومعدات لوجستية', nameEn: 'Logistic Truck Fleet & Vehicles (Active)', type: 'Asset', parentCode: '1200', isSystem: true, balance: vehiclesTotal, currency: 'YER' },
      { code: '1220', nameAr: 'أجهزة تفتيش فنية وأدوات مستودعات', nameEn: 'Package Scanners & Inspection Hardware', type: 'Asset', parentCode: '1200', isSystem: true, balance: scannersTotal, currency: 'YER' },
      { code: '1230', nameAr: 'المكاتب والمباني والتجهيزات العينية', nameEn: 'Fixed Office Furniture & Facilities', type: 'Asset', parentCode: '1200', isSystem: true, balance: officeAssetsTotal, currency: 'YER' },

      // ── 2000: LIABILITIES ────────────────────────────────────────────────────
      { code: '2000', nameAr: 'الخصوم والالتزامات الكلية للغير', nameEn: 'Total Financial Liabilities', type: 'Liability', parentCode: null, isSystem: true },
      { code: '2100', nameAr: 'الالتزامات التشغيلية المتداولة', nameEn: 'Current Operating Liabilities', type: 'Liability', parentCode: '2000', isSystem: true },
      { code: '2110', nameAr: 'العهد المالية المفتوحة بذمة المناديب', nameEn: 'Couriers Pending Custody Liabilities', type: 'Liability', parentCode: '2100', isSystem: true, balance: 0, currency: 'YER' },
      { code: '2120', nameAr: 'ذمم وحسابات المناديب المالية الكلية', nameEn: 'Couriers Financial Accounts Ledger', type: 'Liability', parentCode: '2110', isSystem: true },
      { code: '2130', nameAr: 'ذمم وحسابات الموظفين المالية الكلية', nameEn: 'Employees Financial Accounts Ledger', type: 'Liability', parentCode: '2100', isSystem: true },

      // ── 3000: EQUITY ─────────────────────────────────────────────────────────
      { code: '3000', nameAr: 'حقوق الملكية والشركاء المؤسسين', nameEn: 'Gross Shareholders Equity', type: 'Equity', parentCode: null, isSystem: true },
      { code: '3100', nameAr: 'رأس مال المجموعة والشركاء الأساسي', nameEn: 'Paid-in Capital Share Equity', type: 'Equity', parentCode: '3000', isSystem: true, balance: 0, currency: 'YER' },
      { code: '3200', nameAr: 'أرباح وخسائر السنة التراكمية (الصافي)', nameEn: 'Retained Earnings & Net Profit', type: 'Equity', parentCode: '3000', isSystem: true, balance: financialTrialMetrics.netProfit, currency: 'YER' },

      // ── 4000: REVENUES ────────────────────────────────────────────────────────
      { code: '4000', nameAr: 'الإيرادات والعائدات التشغيلية والمالية', nameEn: 'Total Operating Revenues', type: 'Revenue', parentCode: null, isSystem: true },
      { code: '4100', nameAr: 'إيرادات نقل الطرود وخدمات شحن البضائع', nameEn: 'Shipping Services Cargo Freight Revenue', type: 'Revenue', parentCode: '4000', isSystem: true, balance: financialTrialMetrics.totalCustomerRevenue, currency: 'YER' },
      { code: '4200', nameAr: 'قبوضات وحركات تعديل وتصحيح الخزن', nameEn: 'Internal Capital & Audit Adjustments', type: 'Revenue', parentCode: '4000', isSystem: true, balance: financialTrialMetrics.totalAdjustInflows, currency: 'YER' },

      // ── 5000: EXPENSES ────────────────────────────────────────────────────────
      { code: '5000', nameAr: 'المصروفات والتكاليف التشغيلية والإدارية', nameEn: 'Operating Overhead Expenses Base', type: 'Expense', parentCode: null, isSystem: true },
      { code: '5100', nameAr: 'المصروفات والمشتريات وتكاليف التشغيل القياسية', nameEn: 'Corporate Operating & Safe Expenses', type: 'Expense', parentCode: '5000', isSystem: true, balance: financialTrialMetrics.netOperatingCosts, currency: 'YER' },
      { code: '5300', nameAr: 'تكاليف الشحن الدولي والجمارك', nameEn: 'International Freight & Customs Expenses', type: 'Expense', parentCode: '5000', isSystem: true },
    ];
  }, [vaultBalances, financialTrialMetrics, vehiclesTotal, scannersTotal, officeAssetsTotal]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Merge system + custom accounts; compute nested balances recursively
  // ─────────────────────────────────────────────────────────────────────────────
  const allAccounts = useMemo<AccountNode[]>(() => {
    const combined = [...systemAccounts];

    // Merge custom accounts (skip duplicates by code)
    customAccounts.forEach(ca => {
      const code = ca.accountCode || ca.code;
      if (!code) return;
      if (combined.some(sa => sa.code === code)) return; // already present

      let type: AccountType = ca.type || 'Asset';
      if (ca.entityType === 'customer') type = 'Asset';
      else if (ca.entityType === 'courier' || ca.entityType === 'employee') type = 'Liability';
      else if (ca.entityType === 'system') {
        const pfx = ca.accountPrefix || '';
        if (pfx.startsWith('4')) type = 'Revenue';
        else if (pfx.startsWith('5')) type = 'Expense';
        else if (pfx.startsWith('3')) type = 'Equity';
        else if (pfx.startsWith('2')) type = 'Liability';
        else type = 'Asset';
      }

      const parentCode = ca.accountPrefix || ca.parentCode || null;

      // ── Live balance from account_transactions ───────────────────────────
      // Priority: liveBalances.byCode → liveBalances.byId → stored balance
      const liveByCode = liveBalances.byCode[code];
      const liveById = ca.id ? liveBalances.byId[ca.id] : undefined;
      let computedBalance: number;

      if (liveByCode !== undefined) {
        // Use live transaction balance — already computed with correct accounting sign
        computedBalance = liveByCode;
      } else if (liveById !== undefined) {
        // Use live balance by account ID, apply proper sign for account type
        const rawNet = liveById; // raw = debit - credit
        const normalSide = (type === 'Asset' || type === 'Expense') ? 1 : -1;
        computedBalance = normalSide === 1 ? rawNet : -rawNet;
      } else {
        // Fallback to stored balance (no transactions yet)
        computedBalance = ca.balance || 0;
      }

      combined.push({
        id: ca.id,
        code,
        nameAr: ca.entityName || ca.nameAr || '',
        nameEn: ca.entityName || ca.nameEn || '',
        type: type as any,
        parentCode: parentCode || null,
        balance: computedBalance,
        currency: ca.currency || 'YER',
        isSystem: false
      });
    });

    // Sort by code (natural parent-first order)
    combined.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

    // ── Recursive balance rollup ──────────────────────────────────────────────
    // Leaf account: use live computed balance (already set above for custom accounts)
    //               or the system prop-based value (for system accounts).
    // Branch/parent account: always sum children recursively — never use a fixed value.
    const calculateBalance = (nodeCode: string): number => {
      const node = combined.find(a => a.code === nodeCode);
      if (!node) return 0;

      const children = combined.filter(a => a.parentCode === nodeCode);
      if (children.length === 0) {
        // ── Leaf node ──
        // If a live transaction balance exists for this code, use it (signed correctly)
        const liveVal = liveBalances.byCode[nodeCode];
        if (liveVal !== undefined) {
          node.balance = liveVal;
        }
        // Convert to YER for rollup
        const rawBal = node.balance || 0;
        return node.currency && node.currency !== 'YER'
          ? convertToYER(rawBal, node.currency)
          : rawBal;
      }

      // ── Branch node: always sum children (ignores any stored/prop balance) ──
      let sum = 0;
      children.forEach(child => {
        sum += calculateBalance(child.code);
      });
      node.balance = sum;
      return sum;
    };

    // Trigger rollup from root nodes
    combined.forEach(a => {
      if (a.parentCode === null) calculateBalance(a.code);
    });

    return combined;
  }, [systemAccounts, customAccounts, settings, liveBalances]);

  // Filtered list for search
  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allAccounts;
    return allAccounts.filter(acc =>
      acc.code.toLowerCase().includes(q) ||
      acc.nameAr.toLowerCase().includes(q) ||
      acc.nameEn.toLowerCase().includes(q)
    );
  }, [allAccounts, searchQuery]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Trial Balance — full accounting equation
  // Assets = Liabilities + Equity + (Revenues − Expenses)
  // ─────────────────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const assets = allAccounts.find(a => a.code === '1000')?.balance || 0;
    const liab = allAccounts.find(a => a.code === '2000')?.balance || 0;
    const equity = allAccounts.find(a => a.code === '3000')?.balance || 0;
    const capital = allAccounts.find(a => a.code === '3100')?.balance || 0;
    const revenues = allAccounts.find(a => a.code === '4000')?.balance || 0;
    const expenses = allAccounts.find(a => a.code === '5000')?.balance || 0;

    // Net income is added to equity side for balance check
    const netIncome = revenues - expenses;
    const rightSide = liab + capital + netIncome;
    const gap = Math.abs(assets - rightSide);
    const isBalanced = gap < 500; // live-system floating tolerance

    return { assets, liab, equity, capital, revenues, expenses, netIncome, rightSide, gap, isBalanced };
  }, [allAccounts]);

  // ─────────────────────────────────────────────────────────────────────────────
  // UI helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const toggleNode = (code: string) =>
    setExpandedNodes(prev => ({ ...prev, [code]: !prev[code] }));

  const isNodeVisible = (node: AccountNode): boolean => {
    if (!node.parentCode) return true;
    let pCode = node.parentCode;
    while (pCode) {
      if (expandedNodes[pCode] === false) return false;
      const parent = allAccounts.find(a => a.code === pCode);
      pCode = parent?.parentCode || '';
    }
    return true;
  };

  // Indent level for visual tree
  const getDepth = (code: string): number => {
    let depth = 0;
    let curr = allAccounts.find(a => a.code === code);
    while (curr?.parentCode) {
      depth++;
      curr = allAccounts.find(a => a.code === curr!.parentCode);
    }
    return depth;
  };

  const getRowStyle = (code: string): string => {
    const depth = getDepth(code);
    if (depth === 0) return 'border-l-4 border-[#d4af37] bg-slate-900/50 p-3.5 mb-2 rounded-2xl';
    if (depth === 1) return isAr
      ? 'mr-6 border-r border-slate-700 pr-3 pl-2 py-2 mb-1 text-slate-200 rounded-xl bg-slate-900/20'
      : 'ml-6 border-l border-slate-700 pl-3 pr-2 py-2 mb-1 text-slate-200 rounded-xl bg-slate-900/20';
    return isAr
      ? 'mr-12 border-r-2 border-slate-800 pr-4 pl-2 py-1.5 mb-0.5 text-slate-400 bg-black/10 rounded-lg'
      : 'ml-12 border-l-2 border-slate-800 pl-4 pr-2 py-1.5 mb-0.5 text-slate-400 bg-black/10 rounded-lg';
  };

  // Balance formatting — show in native currency + YER equivalent for non-YER
  const formatBalance = (node: AccountNode): string => {
    const bal = node.balance ?? 0;
    if (!node.currency || node.currency === 'YER') {
      return `${Math.round(bal).toLocaleString()} YER`;
    }
    // For display in tree, show native + YER equiv
    return `${bal.toLocaleString()} ${node.currency}  ≈ ${Math.round(convertToYER(bal, node.currency)).toLocaleString()} YER`;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CRUD handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.code || !newAccount.nameAr || !newAccount.nameEn) {
      notificationService.notify({ title: isAr ? 'حقول فارغة' : 'Fields Required', message: isAr ? 'يرجى ملء جميع الحقول المطلوبة.' : 'Please fill all required fields.', type: 'error' });
      return;
    }
    if (allAccounts.some(a => a.code === newAccount.code)) {
      notificationService.notify({ title: isAr ? 'الرمز مكرر' : 'Duplicate Code', message: isAr ? 'هذا الرمز المحاسبي موجود بالفعل.' : 'An account with this code already exists.', type: 'error' });
      return;
    }
    setAccountLoading(true);
    const newId = 'acc_' + newAccount.code;
    try {
      await addDoc(
        newId,
        collection(db, 'accounts'),
        {
          code: newAccount.code,
          accountCode: newAccount.code,
          accountNumber: newAccount.code.split('-')[1].trim(),
          nameAr: newAccount.nameAr,
          nameEn: newAccount.nameEn,
          entityName: newAccount.nameAr,
          type: newAccount.type,
          entityType: 'system',
          isActive: true,
          parentCode: newAccount.parentCode || null,
          accountPrefix: newAccount.parentCode || null,
          balance: parseFloat(newAccount.balance) || 0,
          currency: newAccount.currency,
          createdAt: format(Date.now(), 'yyyy-MM-dd_hh-mm-ss'),
          //createdAt: new Intl.DateTimeFormat('ar-EG', { dateStyle: 'full' }).format(Date.now()),
        }
      );
      notificationService.notify({ title: isAr ? 'تم إضافة الحساب' : 'Account Created', message: isAr ? `تم إضافة الحساب [${newAccount.nameAr}] للشجرة.` : `Account [${newAccount.nameEn}] created.`, type: 'success' });
      setIsAddOpen(false);
      setNewAccount({ code: '', nameAr: '', nameEn: '', type: 'Asset', parentCode: '', balance: '', currency: 'YER' });
    } catch (err: any) {
      notificationService.notify({ title: 'Firestore Error', message: err.message, type: 'error' });
    } finally {
      setAccountLoading(false);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode?.id) return;
    if (editingNode.code !== newAccount.code && allAccounts.some(a => a.code === newAccount.code)) {
      notificationService.notify({ title: isAr ? 'الرمز مكرر' : 'Duplicate Code', message: isAr ? 'هذا الرمز موجود بالفعل.' : 'Code already exists.', type: 'error' });
      return;
    }
    setAccountLoading(true);
    try {
      await updateDoc(doc(db, 'accounts', editingNode.id), {
        code: newAccount.code,
        accountCode: newAccount.code,
        nameAr: newAccount.nameAr,
        nameEn: newAccount.nameEn,
        entityName: newAccount.nameAr,
        type: newAccount.type,
        parentCode: newAccount.parentCode || null,
        accountPrefix: newAccount.parentCode || null,
        balance: parseFloat(newAccount.balance) || 0,
        currency: newAccount.currency,
        updatedAt: Date.now()
      });
      notificationService.notify({ title: isAr ? 'تم التعديل' : 'Updated', message: isAr ? 'تم تعديل بيانات الحساب.' : 'Account updated.', type: 'success' });
      setIsEditOpen(false);
      setEditingNode(null);
    } catch (err: any) {
      notificationService.notify({ title: 'Error', message: err.message, type: 'error' });
    } finally {
      setAccountLoading(false);
    }
  };

  const openReport = async (node: AccountNode) => {
    setReportAccount(node);
    setIsReportOpen(true);
    setReportLoading(true);
    setReportTransactions([]);
    try {
      const qCode = query(collection(db, 'account_transactions'), where('accountCode', '==', node.code), orderBy('createdAt', 'desc'));
      const snapCode = await getDocs(qCode);
      let txs = snapCode.docs.map(d => ({ id: d.id, ...d.data() }));

      if (node.id) {
        const qId = query(collection(db, 'account_transactions'), where('accountId', '==', node.id), orderBy('createdAt', 'desc'));
        const snapId = await getDocs(qId);
        snapId.docs.forEach(d => {
          if (!txs.some((t: any) => t.id === d.id)) txs.push({ id: d.id, ...d.data() });
        });
        txs.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      }
      setReportTransactions(txs);
    } catch (err) {
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!showDeleteConfirm) return;
    try {
      await deleteDoc(doc(db, 'accounts', showDeleteConfirm.id));
      notificationService.notify({ title: isAr ? 'تم الحذف' : 'Deleted', message: isAr ? 'تم إزالة الحساب.' : 'Account removed.', type: 'success' });
    } catch (err: any) {
      notificationService.notify({ title: 'Error', message: err.message, type: 'error' });
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  const typeColors: Record<string, string> = {
    Asset: 'bg-indigo-950/40 text-indigo-400 border-indigo-900/20',
    Liability: 'bg-amber-950/40 text-amber-400 border-amber-900/20',
    Equity: 'bg-teal-950/40 text-[#d4af37] border-[#d4af37]/10',
    Revenue: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/20',
    Expense: 'bg-rose-950/40 text-rose-400 border-rose-900/20',
  };

  const typeLabel: Record<string, string> = {
    Asset: isAr ? 'أصول' : 'Asset',
    Liability: isAr ? 'خصوم' : 'Liability',
    Equity: isAr ? 'ملكية' : 'Equity',
    Revenue: isAr ? 'إيراد' : 'Revenue',
    Expense: isAr ? 'مصروف' : 'Expense',
  };

  return (
    <div className="space-y-5 pt-2 animate-fade-in">

      {/* ── Trial Balance KPI Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

        {/* Assets */}
        <div className="bg-black/40 border border-indigo-900/30 p-4 rounded-2xl">
          <span className="block text-[9px] text-indigo-400 font-black uppercase tracking-wider mb-1">
            {isAr ? 'الأصول (1000)' : 'Total Assets (1000)'}
          </span>
          <span className="text-base font-mono font-black text-white">
            {Math.round(totals.assets).toLocaleString()}
          </span>
          <span className="text-[9px] text-slate-500 ml-1">{settings.currency || 'YER'}</span>
        </div>

        {/* Liabilities */}
        <div className="bg-black/40 border border-amber-900/30 p-4 rounded-2xl">
          <span className="block text-[9px] text-amber-400 font-black uppercase tracking-wider mb-1">
            {isAr ? 'الخصوم (2000)' : 'Liabilities (2000)'}
          </span>
          <span className="text-base font-mono font-black text-white">
            {Math.round(totals.liab).toLocaleString()}
          </span>
          <span className="text-[9px] text-slate-500 ml-1">{settings.currency || 'YER'}</span>
        </div>

        {/* Equity */}
        <div className="bg-black/40 border border-[#d4af37]/20 p-4 rounded-2xl">
          <span className="block text-[9px] text-[#d4af37] font-black uppercase tracking-wider mb-1">
            {isAr ? 'حقوق الملكية (3000)' : 'Equity (3000)'}
          </span>
          <span className="text-base font-mono font-black text-white">
            {Math.round(totals.equity).toLocaleString()}
          </span>
          <span className="text-[9px] text-slate-500 ml-1">{settings.currency || 'YER'}</span>
        </div>

        {/* Net Income */}
        <div className={`bg-black/40 border p-4 rounded-2xl ${totals.netIncome >= 0 ? 'border-emerald-900/30' : 'border-rose-900/30'}`}>
          <span className={`block text-[9px] font-black uppercase tracking-wider mb-1 ${totals.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isAr ? 'صافي الدخل (4000-5000)' : 'Net Income'}
          </span>
          <span className={`text-base font-mono font-black ${totals.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totals.netIncome >= 0 ? '+' : ''}{Math.round(totals.netIncome).toLocaleString()}
          </span>
          <span className="text-[9px] text-slate-500 ml-1">{settings.currency || 'YER'}</span>
        </div>

        {/* Balance Status */}
        <div className={`bg-black/40 border p-4 rounded-2xl flex flex-col justify-between ${totals.isBalanced ? 'border-emerald-800/30' : 'border-rose-800/30'}`}>
          <span className="block text-[9px] text-slate-500 font-black uppercase tracking-wider mb-1">
            {isAr ? 'حالة الميزانية' : 'Trial Balance'}
          </span>
          {totals.isBalanced ? (
            <span className="text-[10px] bg-emerald-950/50 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-lg font-black flex items-center gap-1 w-fit">
              <ShieldCheck className="w-3 h-3" />
              {isAr ? 'متوازنة ✓' : 'Balanced ✓'}
            </span>
          ) : (
            <span className="text-[9px] bg-rose-950/40 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-lg font-bold">
              {isAr ? `فارق: ${Math.round(totals.gap).toLocaleString()} ${settings.currency || 'YER'}` : `Gap: ${Math.round(totals.gap).toLocaleString()} ${settings.currency || 'YER'}`}
            </span>
          )}
          <span className="text-[8px] text-slate-600 mt-1 font-mono">
            A = L + CAP + NI
          </span>
        </div>
      </div>

      {/* ── Accounting Equation Visual ───────────────────────────────────── */}
      <div className="bg-black/20 border border-slate-850 rounded-2xl p-3 flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400 justify-center">
        <span className="text-indigo-400 font-black">{isAr ? 'أصول' : 'Assets'} {Math.round(totals.assets).toLocaleString()}</span>
        <span className="text-slate-600 font-black">=</span>
        <span className="text-amber-400">{isAr ? 'خصوم' : 'Liab'} {Math.round(totals.liab).toLocaleString()}</span>
        <span className="text-slate-700">+</span>
        <span className="text-[#d4af37]">{isAr ? 'رأس المال' : 'Capital'} {Math.round(totals.capital).toLocaleString()}</span>
        <span className="text-slate-700">+</span>
        <span className={totals.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {isAr ? 'صافي الدخل' : 'NetIncome'} {totals.netIncome >= 0 ? '+' : ''}{Math.round(totals.netIncome).toLocaleString()}
        </span>
        <span className="text-slate-600">=</span>
        <span className={`font-black ${totals.isBalanced ? 'text-emerald-400' : 'text-rose-400'}`}>
          {Math.round(totals.rightSide).toLocaleString()} {settings.currency || 'YER'} {totals.isBalanced ? '✓' : '✗'}
        </span>
      </div>

      {/* ── Chart of Accounts Tree ───────────────────────────────────────── */}
      <div className="bg-[#0d0d10] border border-slate-850 rounded-3xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              {isAr ? 'مستكشف الدليل والشجرة المحاسبية الرسمية' : 'Corporate Chart of Accounts Navigator'}
              {/* Live balance indicator */}
              {liveBalances.loading ? (
                <span className="flex items-center gap-1 text-[8px] bg-amber-950/40 text-amber-400 border border-amber-800/30 px-1.5 py-0.5 rounded font-normal">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  {isAr ? 'تحميل الأرصدة...' : 'Loading balances...'}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[8px] bg-emerald-950/40 text-emerald-500 border border-emerald-800/30 px-1.5 py-0.5 rounded font-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  {isAr ? 'أرصدة حية من القيود' : 'Live from Transactions'}
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-550 font-medium">
              {isAr
                ? `الأرصدة تُحتسب تلقائياً من حركة القيود (مدين − دائن) وتتجمع للأعلى بـ${settings.currency || 'YER'}.`
                : `Balances computed live from account_transactions (Debit−Credit) and rolled up to ${settings.currency || 'YER'}.`}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder={isAr ? 'بحث...' : 'Search code, name...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-black/40 border border-slate-800 text-white placeholder-slate-600 text-xs rounded-xl pl-8 pr-3 py-2 w-52 outline-none focus:border-[#d4af37]"
              />
            </div>
            <button
              onClick={async () => {
                try {
                  await financialAccountService.recalculateAllBalances();
                  notificationService.notify({
                    title: isAr ? 'تم التحديث' : 'Balances Updated',
                    message: isAr
                      ? 'تمت إعادة احتساب ومطابقة جميع أرصدة الحسابات والكيانات بنجاح'
                      : 'All account balances and entity ledgers recalculated and matched successfully',
                    type: 'success'
                  });
                } catch (err) {
                  console.error("Manual recalculation failed:", err);
                }
              }}
              title={isAr ? 'إعادة احتساب كافة الأرصدة والعهد وتصفيتها' : 'Recalculate all ledger balances & custodies'}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {isAr ? 'تحديث ومطابقة الأرصدة' : 'Recalculate & Sync'}
            </button>

            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1.5 bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/30 text-[#d4af37] px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              {isAr ? 'حساب جديد' : 'New Account'}
            </button>
          </div>
        </div>


        {/* Tree table */}
        <div className="border border-slate-850 rounded-2xl overflow-x-auto bg-black/10">
          <div className="min-w-[720px] p-3">
            {/* Header */}
            <div className="grid grid-cols-12 text-[9px] text-slate-500 font-black uppercase tracking-wider pb-2 border-b border-slate-850 mb-2 px-2">
              <div className="col-span-3">{isAr ? 'رمز الحساب' : 'Account Code'}</div>
              <div className="col-span-4">{isAr ? 'اسم الحساب' : 'Account Name'}</div>
              <div className="col-span-2 text-center">{isAr ? 'النوع' : 'Type'}</div>
              <div className="col-span-3 text-right">{isAr ? 'الرصيد المجمع' : 'Aggregated Balance'}</div>
            </div>

            {/* Tree rows */}
            {filteredAccounts.map(node => {
              if (!isNodeVisible(node)) return null;
              const depth = getDepth(node.code);
              const isRoot = depth === 0;
              const isSub1 = depth === 1;
              const hasChildren = allAccounts.some(a => a.parentCode === node.code);
              const isExpanded = expandedNodes[node.code] !== false;
              const balYER = allAccounts.find(a => a.code === node.code)?.balance ?? 0;

              return (
                <div
                  key={node.code}
                  className={`grid grid-cols-12 items-center text-xs px-2 font-semibold transition-all hover:bg-slate-900/20 group py-0.5 ${getRowStyle(node.code)}`}
                >
                  {/* Code + expand button */}
                  <div className="col-span-3 flex items-center gap-1.5 font-mono">
                    {hasChildren ? (
                      <button onClick={() => toggleNode(node.code)} className="p-0.5 rounded bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white shrink-0">
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                    ) : <span className="w-4 shrink-0" />}
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${isRoot ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/20' : 'bg-black/30 text-slate-400 border-slate-800'}`}>
                      {node.code}
                    </span>
                  </div>

                  {/* Name */}
                  <div className="col-span-4 flex items-center gap-1.5 overflow-hidden">
                    {isRoot ? <FolderTree className="w-3.5 h-3.5 text-[#d4af37] shrink-0" /> :
                      isSub1 ? (isExpanded ? <FolderOpen className="w-3.5 h-3.5 text-[#d4af37]/60 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-[#d4af37]/60 shrink-0" />) :
                        <Activity className="w-3 h-3 text-slate-600 shrink-0" />}
                    <div className="min-w-0">
                      <span className={`block truncate ${isRoot ? 'text-white font-extrabold' : isSub1 ? 'text-slate-200 font-bold' : 'text-slate-400'}`}>
                        {isAr ? node.nameAr : node.nameEn}
                      </span>
                      {(isRoot || isSub1) && (
                        <span className="text-[8px] text-slate-600 block truncate -mt-0.5 font-normal">
                          {isAr ? node.nameEn : node.nameAr}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Type badge */}
                  <div className="col-span-2 flex items-center justify-center gap-1">
                    <span className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded border ${typeColors[node.type]}`}>
                      {typeLabel[node.type]}
                    </span>
                    {node.isSystem && (
                      <span className="text-[7px] bg-slate-900 text-slate-600 border border-slate-800 px-1 py-0.5 rounded">SYS</span>
                    )}
                  </div>

                  {/* Balance + actions */}
                  <div className="col-span-3 flex items-center justify-end gap-2">
                    <div className="text-right">
                      {node.currency && node.currency !== (settings.currency || 'YER') ? (
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-black text-[11px] text-white">
                            {(node.balance || 0).toLocaleString()} <span className="text-[8px] text-slate-500 font-normal ml-0.5">{node.currency}</span>
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            ≈ {Math.round(balYER).toLocaleString()} {settings.currency || 'YER'}
                          </span>
                        </div>
                      ) : (
                        <span className={`font-mono font-black text-[11px] ${isRoot ? 'text-[#d4af37]' : balYER < 0 ? 'text-rose-400' : 'text-white'}`}>
                          {Math.round(balYER).toLocaleString()}
                          <span className="text-[8px] text-slate-500 font-normal ml-0.5">{settings.currency || 'YER'}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openReport(node)} className="p-1 rounded bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 hover:bg-[#d4af37]/20" title={isAr ? 'تقرير' : 'Report'}>
                        <FileText className="w-3 h-3" />
                      </button>
                      {!node.isSystem && node.id && (
                        <>
                          <button onClick={() => {
                            setEditingNode(node);
                            setNewAccount({ code: node.code, nameAr: node.nameAr, nameEn: node.nameEn, type: node.type, parentCode: node.parentCode || '', balance: node.balance?.toString() || '', currency: node.currency || 'YER' });
                            setIsEditOpen(true);
                          }} className="p-1 rounded bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button onClick={() => setShowDeleteConfirm({ id: node.id!, name: isAr ? node.nameAr : node.nameEn })} className="p-1 rounded bg-rose-950/30 text-rose-400 border border-rose-900/25 hover:bg-rose-900/60">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredAccounts.length === 0 && (
              <div className="py-16 text-center text-slate-600 font-mono text-[10px] uppercase">
                [ {isAr ? 'لا توجد حسابات مطابقة' : 'No accounts matched'} ]
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL: Delete Confirm ─────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={confirmDeleteAccount}
        title={isAr ? 'تأكيد حذف الحساب' : 'Confirm Account Deletion'}
        message={isAr ? `هل أنت متأكد من حذف الحساب (${showDeleteConfirm?.name}) نهائياً؟` : `Permanently delete account (${showDeleteConfirm?.name})?`}
        confirmText={isAr ? 'حذف نهائياً' : 'Delete'}
      />

      {/* ── MODAL: Add Account ────────────────────────────────────────────── */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111114] border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-5 border-b border-slate-850 flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'إضافة حساب فرعي جديد' : 'Add New Account'}
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1.5 rounded-xl bg-slate-900 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreateAccount} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'رمز الحساب' : 'Account Code'}</label>
                  <input required type="text" value={newAccount.code} onChange={e => setNewAccount(p => ({ ...p, code: e.target.value }))} placeholder="1140" className="w-full bg-black/40 border border-slate-800 text-[#d4af37] rounded-xl px-3 py-2 text-xs font-mono font-black outline-none focus:border-[#d4af37]" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'العملة' : 'Currency'}</label>
                  <select value={newAccount.currency} onChange={e => setNewAccount(p => ({ ...p, currency: e.target.value }))} className="w-full bg-black/40 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-black outline-none focus:border-[#d4af37]">
                    <option value="YER">YER — ريال يمني</option>
                    <option value="SAR">SAR — ريال سعودي</option>
                    <option value="USD">USD — دولار</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الحساب الأب' : 'Parent Account'}</label>
                <select value={newAccount.parentCode} onChange={e => setNewAccount(p => ({ ...p, parentCode: e.target.value }))} className="w-full bg-black/40 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-black outline-none focus:border-[#d4af37]">
                  <option value="">{isAr ? '-- جذري (بلا أب) --' : '-- Root (no parent) --'}</option>
                  {allAccounts.filter(a => getDepth(a.code) <= 1).map(p => (
                    <option key={p.code} value={p.code}>{p.code} — {isAr ? p.nameAr : p.nameEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'اسم الحساب (عربي)' : 'Name (Arabic)'}</label>
                <input required type="text" value={newAccount.nameAr} onChange={e => setNewAccount(p => ({ ...p, nameAr: e.target.value }))} className="w-full bg-black/40 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]" />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'اسم الحساب (إنجليزي)' : 'Name (English)'}</label>
                <input required type="text" value={newAccount.nameEn} onChange={e => setNewAccount(p => ({ ...p, nameEn: e.target.value }))} className="w-full bg-black/40 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'نوع الحساب' : 'Account Type'}</label>
                  <select value={newAccount.type} onChange={e => setNewAccount(p => ({ ...p, type: e.target.value as any }))} className="w-full bg-black/40 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-black outline-none focus:border-[#d4af37]">
                    <option value="Asset">Asset — أصول</option>
                    <option value="Liability">Liability — خصوم</option>
                    <option value="Equity">Equity — ملكية</option>
                    <option value="Revenue">Revenue — إيرادات</option>
                    <option value="Expense">Expense — مصروفات</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الرصيد الافتتاحي' : 'Opening Balance'}</label>
                  <input type="number" value={newAccount.balance} onChange={e => setNewAccount(p => ({ ...p, balance: e.target.value }))} placeholder="0" className="w-full bg-black/40 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-[#d4af37]" />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-850 flex gap-2">
                <button type="button" onClick={() => setIsAddOpen(false)} className="w-1/2 bg-slate-900 border border-slate-800 text-slate-400 py-2.5 rounded-xl text-xs font-bold hover:text-white transition-all">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={accountLoading} className="w-1/2 bg-[#d4af37] text-black py-2.5 rounded-xl text-xs font-black hover:bg-[#c9a22e] transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                  {accountLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                  {isAr ? 'قيد الحساب' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Edit Account ───────────────────────────────────────────── */}
      {isEditOpen && editingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111114] border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-5 border-b border-slate-850 flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تعديل الحساب' : 'Edit Account'}
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="p-1.5 rounded-xl bg-slate-900 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleUpdateAccount} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'رمز الحساب' : 'Code'}</label>
                  <input required type="text" value={newAccount.code} onChange={e => setNewAccount(p => ({ ...p, code: e.target.value }))} className="w-full bg-black/40 border border-slate-800 text-[#d4af37] rounded-xl px-3 py-2 text-xs font-mono font-black outline-none focus:border-[#d4af37]" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'العملة' : 'Currency'}</label>
                  <select value={newAccount.currency} onChange={e => setNewAccount(p => ({ ...p, currency: e.target.value }))} className="w-full bg-black/40 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-black outline-none focus:border-[#d4af37]">
                    <option value="YER">YER</option>
                    <option value="SAR">SAR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الحساب الأب' : 'Parent Code'}</label>
                <input type="text" value={newAccount.parentCode} onChange={e => setNewAccount(p => ({ ...p, parentCode: e.target.value }))} className="w-full bg-black/40 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-[#d4af37]" />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الاسم (عربي)' : 'Name (Arabic)'}</label>
                <input required type="text" value={newAccount.nameAr} onChange={e => setNewAccount(p => ({ ...p, nameAr: e.target.value }))} className="w-full bg-black/40 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]" />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الاسم (إنجليزي)' : 'Name (English)'}</label>
                <input required type="text" value={newAccount.nameEn} onChange={e => setNewAccount(p => ({ ...p, nameEn: e.target.value }))} className="w-full bg-black/40 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'نوع الحساب' : 'Type'}</label>
                  <select value={newAccount.type} onChange={e => setNewAccount(p => ({ ...p, type: e.target.value as any }))} className="w-full bg-black/40 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-black outline-none focus:border-[#d4af37]">
                    <option value="Asset">Asset</option>
                    <option value="Liability">Liability</option>
                    <option value="Equity">Equity</option>
                    <option value="Revenue">Revenue</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الرصيد' : 'Balance'}</label>
                  <input type="number" value={newAccount.balance} onChange={e => setNewAccount(p => ({ ...p, balance: e.target.value }))} className="w-full bg-black/40 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-[#d4af37]" />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-850 flex gap-2">
                <button type="button" onClick={() => setIsEditOpen(false)} className="w-1/2 bg-slate-900 border border-slate-800 text-slate-400 py-2.5 rounded-xl text-xs font-bold hover:text-white">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={accountLoading} className="w-1/2 bg-[#d4af37] text-black py-2.5 rounded-xl text-xs font-black hover:bg-[#c9a22e] flex items-center justify-center gap-1 disabled:opacity-50">
                  {accountLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                  {isAr ? 'حفظ التعديلات' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Account Report / Statement ────────────────────────────── */}
      {isReportOpen && reportAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-[#0d0d10] border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-850 shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#d4af37]" />
                    {isAr ? 'كشف حساب تفصيلي' : 'Account Statement'}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] font-mono bg-black/40 border border-slate-800 px-2 py-0.5 rounded text-[#d4af37]">[{reportAccount.code}]</span>
                    <span className="text-xs font-bold text-white">{isAr ? reportAccount.nameAr : reportAccount.nameEn}</span>
                    <span className={`text-[8px] uppercase font-black px-2 py-0.5 rounded border ${typeColors[reportAccount.type]}`}>{typeLabel[reportAccount.type]}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-[9px] text-slate-500 uppercase font-black">{isAr ? 'الرصيد الإجمالي' : 'Balance'}</span>
                  <span className="text-lg font-mono font-black text-[#d4af37]">
                    {reportAccount.currency && reportAccount.currency !== (settings.currency || 'YER') ? (
                      <div className="flex flex-col items-end">
                        <span>{(reportAccount.balance || 0).toLocaleString()} {reportAccount.currency}</span>
                        <span className="text-[10px] text-slate-500 font-normal">≈ {Math.round(reportAccount.balance || 0).toLocaleString()} {settings.currency || 'YER'}</span>
                      </div>
                    ) : (
                      `${Math.round(reportAccount.balance || 0).toLocaleString()} ${settings.currency || 'YER'}`
                    )}
                  </span>
                </div>
              </div>
              {/* Debit / Credit summary from transactions */}
              {reportTransactions.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="bg-emerald-950/20 border border-emerald-900/20 rounded-xl p-2 text-center">
                    <span className="block text-[8px] text-emerald-400 font-black uppercase">{isAr ? 'إجمالي المدين' : 'Total Debit'}</span>
                    <span className="text-xs font-mono font-black text-emerald-400">
                      {reportTransactions.filter(t => t.type === 'Debit').reduce((s, t) => s + (t.amount || 0), 0).toLocaleString()} {settings.currency || 'YER'}
                    </span>
                  </div>
                  <div className="bg-rose-950/20 border border-rose-900/20 rounded-xl p-2 text-center">
                    <span className="block text-[8px] text-rose-400 font-black uppercase">{isAr ? 'إجمالي الدائن' : 'Total Credit'}</span>
                    <span className="text-xs font-mono font-black text-rose-400">
                      {reportTransactions.filter(t => t.type === 'Credit').reduce((s, t) => s + (t.amount || 0), 0).toLocaleString()} {settings.currency || 'YER'}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-2 text-center">
                    <span className="block text-[8px] text-slate-400 font-black uppercase">{isAr ? 'عدد القيود' : 'Entries'}</span>
                    <span className="text-xs font-mono font-black text-white">{reportTransactions.length}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-4 min-h-0">
              {reportLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="bg-black/40 border-b border-slate-800 sticky top-0">
                    <tr className="text-[9px] text-slate-500 font-black uppercase tracking-wider">
                      <th className="p-2">{isAr ? 'التاريخ' : 'Date'}</th>
                      <th className="p-2">{isAr ? 'رقم القيد' : 'Ref No.'}</th>
                      <th className="p-2">{isAr ? 'البيان' : 'Particulars'}</th>
                      <th className="p-2">{isAr ? 'الوحدة' : 'Module'}</th>
                      <th className="p-2 text-right text-emerald-500">{isAr ? 'مدين ↑' : 'Debit ↑'}</th>
                      <th className="p-2 text-right text-rose-500">{isAr ? 'دائن ↓' : 'Credit ↓'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/40">
                    {reportTransactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-900/20 transition-colors">
                        <td className="p-2 text-[10px] font-mono text-slate-500">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('ar-YE') : '—'}
                        </td>
                        <td className="p-2 text-[9px] font-mono text-[#d4af37]">{tx.refNumber || '—'}</td>
                        <td className="p-2 text-[10px] text-slate-300 max-w-[200px] break-words">{tx.description || '—'}</td>
                        <td className="p-2">
                          <span className="text-[8px] bg-slate-900 text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded uppercase font-black">{tx.module || '—'}</span>
                        </td>
                        <td className="p-2 text-right text-[10px] font-mono text-emerald-400 font-black">
                          {tx.type === 'Debit' ? (
                            <div className="flex flex-col items-end">
                              <span>{(tx.amountOriginal || tx.amount || 0).toLocaleString()} {tx.currencyOriginal || (settings.currency || 'YER')}</span>
                              {tx.currencyOriginal && tx.currencyOriginal !== (settings.currency || 'YER') && (
                                <span className="text-[8px] text-slate-500 font-normal">≈ {(tx.amount || 0).toLocaleString()} {settings.currency || 'YER'}</span>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="p-2 text-right text-[10px] font-mono text-rose-400 font-black">
                          {tx.type === 'Credit' ? (
                            <div className="flex flex-col items-end">
                              <span>{(tx.amountOriginal || tx.amount || 0).toLocaleString()} {tx.currencyOriginal || (settings.currency || 'YER')}</span>
                              {tx.currencyOriginal && tx.currencyOriginal !== (settings.currency || 'YER') && (
                                <span className="text-[8px] text-slate-500 font-normal">≈ {(tx.amount || 0).toLocaleString()} {settings.currency || 'YER'}</span>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                    {reportTransactions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-600 font-mono text-[10px] uppercase">
                          [{isAr ? 'لا توجد حركات مسجلة على هذا الحساب' : 'No transactions recorded for this account'}]
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-slate-850 shrink-0 flex justify-end gap-2 bg-[#0a0a0d] rounded-b-2xl">
              <button onClick={() => setIsReportOpen(false)} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-colors">
                {isAr ? 'إغلاق' : 'Close'}
              </button>
              <button
                onClick={() => {
                  const win = window.open('', '_blank');
                  if (!win) return;
                  const rows = reportTransactions.map((tx: any) => `
                    <tr>
                      <td>${tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ''}</td>
                      <td>${tx.refNumber || ''}</td>
                      <td>${tx.description || ''}</td>
                      <td>${tx.module || ''}</td>
                      <td style="color:green">${tx.type === 'Debit' ? (tx.amountOriginal || tx.amount || 0).toLocaleString() + ' ' + (tx.currencyOriginal || 'YER') : ''}</td>
                      <td style="color:red">${tx.type === 'Credit' ? (tx.amountOriginal || tx.amount || 0).toLocaleString() + ' ' + (tx.currencyOriginal || 'YER') : ''}</td>
                    </tr>`).join('');
                  win.document.write(`<html dir="${isAr ? 'rtl' : 'ltr'}"><head><title>${reportAccount.code} — ${isAr ? reportAccount.nameAr : reportAccount.nameEn}</title>
                    <style>body{font-family:monospace;padding:20px;color:#000}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:11px}th{background:#f0f0f0;padding:6px 8px;border:1px solid #ddd;text-align:inherit}td{padding:5px 8px;border:1px solid #eee}h2{margin:0 0 4px}p{margin:0;color:#555;font-size:12px}.bal{font-size:16px;font-weight:bold;margin-top:8px}</style></head>
                    <body onload="window.print()">
                    <h2>[${reportAccount.code}] ${isAr ? reportAccount.nameAr : reportAccount.nameEn}</h2>
                    <p>${reportAccount.type} | ${new Date().toLocaleString()}</p>
                    <p class="bal">${isAr ? 'الرصيد:' : 'Balance:'} ${Math.round(reportAccount.balance || 0).toLocaleString()} ${settings.currency || 'YER'}</p>
                    <table><thead><tr><th>${isAr ? 'التاريخ' : 'Date'}</th><th>${isAr ? 'القيد' : 'Ref'}</th><th>${isAr ? 'البيان' : 'Desc'}</th><th>${isAr ? 'الوحدة' : 'Module'}</th><th style="color:green">${isAr ? 'مدين' : 'Debit'}</th><th style="color:red">${isAr ? 'دائن' : 'Credit'}</th></tr></thead><tbody>${rows}</tbody></table>
                    </body></html>`);
                  win.document.close();
                }}
                disabled={reportLoading}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#d4af37] to-yellow-600 text-black font-black text-xs rounded-xl shadow transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                {isAr ? 'طباعة الكشف' : 'Print Statement'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
