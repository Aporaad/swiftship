import React, { useState, useMemo, useEffect } from 'react';
import { 
  FolderTree, Folder, FolderOpen, ChevronRight, ChevronDown, PlusCircle, Trash2, 
  Search, Scale, X, HelpCircle, Activity, ShieldCheck, DollarSign, RefreshCw 
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { notificationService } from '../services/notificationService';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);

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
    '1200': true,
    '2000': true,
    '3000': true,
    '4000': true,
    '5000': true
  });

  // Sync custom accounts from DB
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'accounts'), (snap) => {
      setCustomAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountNode)));
    }, (error) => {
      console.error("Error loading custom accounts:", error);
    });
    return () => unsub();
  }, []);

  // 1. Static/Dynamic System default accounts
  const systemAccounts = useMemo<AccountNode[]>(() => {
    const cashTotal = vaultBalances.totalIn_YER - vaultBalances.totalOut_YER;
    return [
      { code: '1000', nameAr: 'الأصول الدفترية الكلية', nameEn: 'Total Assets Base', type: 'Asset', parentCode: null, isSystem: true },
      
      { code: '1100', nameAr: 'الأصول المتداولة والسيولة', nameEn: 'Current Assets & Liquidity', type: 'Asset', parentCode: '1000', isSystem: true },
      { code: '1110', nameAr: 'نقدية الصناديق والخزائن الحية', nameEn: 'Safe-Box Cash Accounts (Live)', type: 'Asset', parentCode: '1100', isSystem: true, balance: cashTotal, currency: 'YER' },
      { code: '1120', nameAr: 'ذمم وشحنات العملاء المعلقة المدينة', nameEn: 'Accounts Receivable (Pending Cargo)', type: 'Asset', parentCode: '1100', isSystem: true, balance: financialTrialMetrics.netReceivables, currency: 'YER' },
      
      { code: '1200', nameAr: 'الأصول الثابتة والعهد العينية', nameEn: 'Fixed Capital Assets Portfolio', type: 'Asset', parentCode: '1000', isSystem: true },
      { code: '1210', nameAr: 'سيارات نقل وشحن ومعدات لوجستية', nameEn: 'Logistic Truck Fleet & Vehicles (Active)', type: 'Asset', parentCode: '1200', isSystem: true, balance: vehiclesTotal, currency: 'YER' },
      { code: '1220', nameAr: 'أجهزة تفتيش فنية وأدوات مستودعات', nameEn: 'Package Scanners & Inspection Hardware', type: 'Asset', parentCode: '1200', isSystem: true, balance: scannersTotal, currency: 'YER' },
      { code: '1230', nameAr: 'المكاتب والمباني والتجهيزات العينية', nameEn: 'Fixed Office Furniture & Facilities', type: 'Asset', parentCode: '1200', isSystem: true, balance: officeAssetsTotal, currency: 'YER' },

      { code: '2000', nameAr: 'الخصوم والالتزامات الكلية للغير', nameEn: 'Total Financial Liabilities', type: 'Liability', parentCode: null, isSystem: true },
      { code: '2100', nameAr: 'الالتزامات التشغيلية المتداولة', nameEn: 'Current Operating Liabilities', type: 'Liability', parentCode: '2000', isSystem: true },
      { code: '2110', nameAr: 'العهد المالية المفتوحة بذمة المناديب', nameEn: 'Couriers Pending Custody Liabilities', type: 'Liability', parentCode: '2100', isSystem: true, balance: financialTrialMetrics.activeCustodyLiabilities, currency: 'YER' },

      { code: '3000', nameAr: 'حقوق الملكية والشركاء المؤسسين', nameEn: 'Gross Shareholders Equity', type: 'Equity', parentCode: null, isSystem: true },
      { code: '3100', nameAr: 'رأس مال المجموعة والشركاء الأساسي', nameEn: 'Paid-in Capital Share Equity', type: 'Equity', parentCode: '3000', isSystem: true, balance: 150000000, currency: 'YER' },
      { code: '3200', nameAr: 'أرباح وخسائر السنة التراكمية (الصافي)', nameEn: 'Retained Earnings & Reserves', type: 'Equity', parentCode: '3000', isSystem: true, balance: financialTrialMetrics.netProfit, currency: 'YER' },

      { code: '4000', nameAr: 'الإيرادات والعائدات التشغيلية والمالية', nameEn: 'Total Operating Revenues', type: 'Revenue', parentCode: null, isSystem: true },
      { code: '4100', nameAr: 'إيرادات نقل الطرود وخدمات شحن البضائع', nameEn: 'Shipping Services Cargo Freight Revenue', type: 'Revenue', parentCode: '4000', isSystem: true, balance: financialTrialMetrics.totalCustomerRevenue, currency: 'YER' },
      { code: '4200', nameAr: 'قبوضات وحركات تعديل وتصحيح الخزن', nameEn: 'Internal Capital & Audit Adjustments', type: 'Revenue', parentCode: '4000', isSystem: true, balance: financialTrialMetrics.totalAdjustInflows, currency: 'YER' },

      { code: '5000', nameAr: 'المصروفات والتكاليف التشغيلية والإدارية', nameEn: 'Operating Overhead Expenses Base', type: 'Expense', parentCode: null, isSystem: true },
      { code: '5100', nameAr: 'المصروفات والمشتريات وتكاليف التشغيل القياسية', nameEn: 'Corporate Operating & Safe Expenses', type: 'Expense', parentCode: '5000', isSystem: true, balance: financialTrialMetrics.netOperatingCosts, currency: 'YER' }
    ];
  }, [vaultBalances, financialTrialMetrics, vehiclesTotal, scannersTotal, officeAssetsTotal]);

  // Merge default + custom accounts & compute nested parent trial balances recursively
  const allAccounts = useMemo<AccountNode[]>(() => {
    const combined = [...systemAccounts];
    
    // Add custom accounts avoiding code duplicates
    customAccounts.forEach(ca => {
      if (!combined.some(sa => sa.code === ca.code)) {
        combined.push({
          id: ca.id,
          code: ca.code,
          nameAr: ca.nameAr,
          nameEn: ca.nameEn,
          type: ca.type,
          parentCode: ca.parentCode || null,
          balance: ca.balance || 0,
          currency: ca.currency || 'YER',
          isSystem: false
        });
      }
    });

    // Sort by code string which naturally lists them parent-first (1000, 1100, 1110)
    combined.sort((a, b) => a.code.localeCompare(b.code));

    // Dynamic recursive balance roll-up
    const calculateAccountBalance = (nodeCode: string): number => {
      const node = combined.find(a => a.code === nodeCode);
      if (!node) return 0;

      // Children accounts
      const children = combined.filter(a => a.parentCode === nodeCode);
      if (children.length === 0) {
        return node.balance || 0;
      }

      let kidsSum = 0;
      children.forEach(child => {
        kidsSum += calculateAccountBalance(child.code);
      });

      node.balance = kidsSum;
      return kidsSum;
    };

    // Recalculate top level roots (codes ending in '000' or with parentCode = null)
    combined.forEach(a => {
      if (a.parentCode === null) {
        calculateAccountBalance(a.code);
      }
    });

    return combined;
  }, [systemAccounts, customAccounts]);

  // Filtering based on search query
  const filteredAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allAccounts;

    return allAccounts.filter(acc => 
      acc.code.includes(query) || 
      acc.nameAr.toLowerCase().includes(query) || 
      acc.nameEn.toLowerCase().includes(query)
    );
  }, [allAccounts, searchQuery]);

  // Accounting double entry balance formulas check
  const totals = useMemo(() => {
    const assetsVal = allAccounts.find(a => a.code === '1000')?.balance || 0;
    const liabilitiesVal = allAccounts.find(a => a.code === '2000')?.balance || 0;
    const equityVal = allAccounts.find(a => a.code === '3000')?.balance || 0;
    
    // Net revenues - expenses also impacts equity overall
    const gap = Math.abs(assetsVal - (liabilitiesVal + equityVal));
    const isBalanced = gap < 100; // floating tolerance

    return {
      totalAssets: assetsVal,
      totalLiabilities: liabilitiesVal,
      totalEquity: equityVal,
      isBalanced,
      gap
    };
  }, [allAccounts]);

  const toggleNode = (code: string) => {
    setExpandedNodes(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.code || !newAccount.nameAr || !newAccount.nameEn) {
      notificationService.notify({
        title: isAr ? 'حقول فارغة' : 'Fields Required',
        message: isAr ? 'يرجى مراجعة إدخال الاسم والرمز.' : 'Please enter code and both names.',
        type: 'error'
      });
      return;
    }

    // Verify code uniqueness in the merged tree
    if (allAccounts.some(a => a.code === newAccount.code)) {
      notificationService.notify({
        title: isAr ? 'الرمز مكرر' : 'Duplicate Code',
        message: isAr ? 'هذا الرمز المحاسبي متواجد بالفعل في الشجرة.' : 'An account with this code already exists.',
        type: 'error'
      });
      return;
    }

    setAccountLoading(true);
    try {
      await addDoc(collection(db, 'accounts'), {
        code: newAccount.code,
        nameAr: newAccount.nameAr,
        nameEn: newAccount.nameEn,
        type: newAccount.type,
        parentCode: newAccount.parentCode || null,
        balance: parseFloat(newAccount.balance) || 0,
        currency: newAccount.currency,
        createdAt: Date.now()
      });

      notificationService.notify({
        title: isAr ? 'تم إضافة الحساب بنجاح' : 'Success',
        message: isAr ? `تم إضافة الحساب [${newAccount.nameAr}] لشجرة المحاسبة.` : `Account node [${newAccount.nameEn}] created.`,
        type: 'success'
      });

      setIsAddOpen(false);
      setNewAccount({
        code: '',
        nameAr: '',
        nameEn: '',
        type: 'Asset',
        parentCode: '',
        balance: '',
        currency: 'YER'
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: 'Firestore Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      setAccountLoading(false);
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!window.confirm(isAr 
      ? `هل أنت متأكد من حذف الحساب (${name}) نهائياً من الشجرة المحاسبية؟` 
      : `Verify deletion of custom account (${name})?`
    )) return;

    try {
      await deleteDoc(doc(db, 'accounts', id));
      notificationService.notify({
        title: isAr ? 'تم الحذف' : 'Deleted',
        message: isAr ? 'تم إزالة الحساب من النظام.' : 'Removed custom ledger account.',
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  // Check if a parent node is collapsed
  const isNodeVisible = (node: AccountNode): boolean => {
    if (!node.parentCode) return true;
    
    // Check if parent is expanded
    let pCode = node.parentCode;
    while (pCode) {
      if (expandedNodes[pCode] === false) {
        return false;
      }
      const parentNode = allAccounts.find(a => a.code === pCode);
      pCode = parentNode?.parentCode || '';
    }
    return true;
  };

  const getIndentStyle = (code: string) => {
    if (code.endsWith('000')) return 'border-l-4 border-[#d4af37] bg-slate-900/40 p-3.5 mb-2 rounded-2xl';
    if (code.endsWith('00')) return isAr ? 'mr-6 border-r border-slate-800 pr-3.5 pl-2 py-2 mb-1 text-slate-200' : 'ml-6 border-l border-slate-800 pl-3.5 pr-2 py-2 mb-1 text-slate-200';
    return isAr ? 'mr-12 border-r-2 border-slate-850 pr-4 pl-2 py-1.5 mb-1 text-slate-400 bg-black/10 rounded-lg' : 'ml-12 border-l-2 border-slate-850 pl-4 pr-2 py-1.5 mb-1 text-slate-400 bg-black/10 rounded-lg';
  };

  return (
    <div className="space-y-6 pt-2 select-none animate-fade-in">
      
      {/* Upper Dual Trial Balance KPI Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Assets Value Card */}
        <div className="bg-black/30 border border-slate-850 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="block text-[10px] text-slate-500 font-extrabold uppercase">{isAr ? 'إجمالي الأصول (Assets)' : 'Total Assets (1000)'}</span>
            <span className="text-xl font-mono font-black text-white">
              {(totals.totalAssets).toLocaleString()} YER
            </span>
          </div>
          <div className="p-2.5 bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Liabilities & Equity Value Card */}
        <div className="bg-black/30 border border-slate-850 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="block text-[10px] text-slate-500 font-extrabold uppercase">{isAr ? 'الخصوم وحقوق الملكية (L + EQ)' : 'Liabilities & Equity (2000+3000)'}</span>
            <span className="text-xl font-mono font-black text-white">
              {(totals.totalLiabilities + totals.totalEquity).toLocaleString()} YER
            </span>
          </div>
          <div className="p-2.5 bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] rounded-xl font-bold">
            =
          </div>
        </div>

        {/* Balance Status Card */}
        <div className="bg-[#121215] border border-slate-850 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="block text-[10px] text-slate-500 font-extrabold uppercase">{isAr ? 'حالة ميزان المراجعة والمطابقة' : 'Dual Trial Book Status'}</span>
            <div className="flex items-center gap-1.5 mt-1">
              {totals.isBalanced ? (
                <span className="text-xs bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {isAr ? 'الميزانية حية ومتوازنة' : 'Balanced & Valid'}
                </span>
              ) : (
                <span className="text-xs bg-rose-950/40 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-lg font-bold">
                  {isAr ? `تغيير الفارق: ${totals.gap.toLocaleString()} YER` : `Drift: ${totals.gap.toLocaleString()} YER`}
                </span>
              )}
            </div>
          </div>
          <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
            <Scale className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Control Panel */}
      <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1">
              {isAr ? 'مستكشف الدليل والشجرة المحاسبية الرسمية' : 'Corporate Chart of Accounts Navigator'}
            </h3>
            <p className="text-[10px] text-slate-550 font-medium">
              {isAr ? 'استعرض وقيد حساباتك التشغيلية والأصول الثابتة تزامناً مع ميزان المراجعة التراكمي.' : 'Manage, audit and append corporate branches of capital flows.'}
            </p>
          </div>

          <div className="flex gap-2">
            {/* Search inputs */}
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={isAr ? "البحث بالرمز أو الحساب..." : "Find by code, name..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-black/45 border border-slate-850 text-white placeholder-slate-550 text-xs rounded-xl pl-9 pr-4 py-2 w-full outline-none focus:border-[#d4af37]"
              />
            </div>

            {/* Account Addition trigger */}
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1.5 bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/35 text-[#d4af37] px-4 py-2 rounded-xl text-xs font-black transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              {isAr ? 'حساب فرعي جديد' : 'New Account Row'}
            </button>
          </div>
        </div>

        {/* Flat and collapsible tree lists */}
        <div className="border border-slate-850 rounded-2xl bg-black/10 p-4 space-y-1 overflow-x-auto min-w-[700px]">
          
          {/* Header titles */}
          <div className="grid grid-cols-12 text-[9px] text-slate-500 font-black uppercase tracking-wider pb-2.5 border-b border-slate-850 mb-3 px-3">
            <div className="col-span-3">{isAr ? 'رمز الحساب / التصنيف' : 'Account Code / Class'}</div>
            <div className="col-span-5">{isAr ? 'اسم الحساب المحاسبي' : 'Ledger Node Nomenclature'}</div>
            <div className="col-span-2 text-right">{isAr ? 'حالة الحساب' : 'Type'}</div>
            <div className="col-span-2 text-left">{isAr ? 'الرصيد الكلي المجمع' : 'Aggregated Balance YER'}</div>
          </div>

          {filteredAccounts.map((node) => {
            const isVisible = isNodeVisible(node);
            if (!isVisible) return null;

            const isRoot = node.code.endsWith('000');
            const isSubGroup = node.code.endsWith('00') && !isRoot;
            const hasChildren = allAccounts.some(a => a.parentCode === node.code);
            const isExpanded = expandedNodes[node.code] !== false;

            return (
              <div 
                key={node.code}
                className={`grid grid-cols-12 items-center text-xs px-3 font-semibold transition-all hover:bg-slate-900/20 group py-1 ${getIndentStyle(node.code)}`}
              >
                {/* Code & folder expansions */}
                <div className="col-span-3 flex items-center gap-2 font-mono font-black text-slate-300">
                  {hasChildren ? (
                    <button 
                      onClick={() => toggleNode(node.code)}
                      className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-white"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  ) : (
                    <span className="w-5.5"></span>
                  )}
                  
                  <span className="text-[10px] text-slate-500 font-black px-1.5 py-0.5 bg-black/30 rounded border border-slate-850">
                    {node.code}
                  </span>
                </div>

                {/* Account Name */}
                <div className="col-span-5 flex items-center gap-2">
                  {isRoot ? (
                    <FolderTree className="w-4 h-4 text-[#d4af37]" />
                  ) : isSubGroup ? (
                    isExpanded ? <FolderOpen className="w-4 h-4 text-[#d4af37]/70" /> : <Folder className="w-4 h-4 text-[#d4af37]/70" />
                  ) : (
                    <Activity className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  
                  <div>
                    <span className={`block transition-all ${isRoot ? 'text-white font-extrabold text-xs' : isSubGroup ? 'text-slate-200 font-bold' : 'text-slate-350'}`}>
                      {isAr ? node.nameAr : node.nameEn}
                    </span>
                    <span className="text-[8.5px] text-slate-500 block font-normal -mt-0.5">
                      {isAr ? node.nameEn : node.nameAr}
                    </span>
                  </div>
                </div>

                {/* Account Type and system flags */}
                <div className="col-span-2 flex items-center justify-end gap-2 pr-4">
                  <span className={`text-[8px] uppercase font-black px-2 py-0.5 rounded ${
                    node.type === 'Asset' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/20' :
                    node.type === 'Liability' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/20' :
                    node.type === 'Equity' ? 'bg-teal-950/40 text-[#d4af37] border border-[#d4af37]/10' :
                    node.type === 'Revenue' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20' :
                    'bg-rose-950/40 text-rose-400 border border-rose-900/20'
                  }`}>
                    {node.type}
                  </span>

                  {node.isSystem ? (
                    <span className="text-[8px] bg-slate-900 text-slate-550 border border-slate-800 px-1 py-0.5 rounded text-center">
                      SYS
                    </span>
                  ) : (
                    node.id && (
                      <button 
                        onClick={() => handleDeleteAccount(node.id!, isAr ? node.nameAr : node.nameEn)}
                        className="p-1 rounded bg-rose-950/30 text-rose-400 border border-rose-900/25 opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:bg-rose-900/60"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )
                  )}
                </div>

                {/* Balanced output */}
                <div className="col-span-2 text-left font-mono font-black text-white text-xs">
                  {node.balance !== undefined ? `${node.balance.toLocaleString()} YER` : '0 YER'}
                  {node.currency && node.currency !== 'YER' && (
                    <span className="text-[7.5px] font-bold block text-slate-550">
                      (Billed: {node.currency})
                    </span>
                  )}
                </div>

              </div>
            );
          })}

          {filteredAccounts.length === 0 && (
            <div className="p-16 text-center text-slate-500 font-semibold font-mono text-[10px] uppercase">
              [ empty_tree_or_query_not_found ]
            </div>
          )}

        </div>
      </div>

      {/* MODAL: ADD CUSTOM SUB-ACCOUNT */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-start">
          <div className="bg-[#121215] border border-slate-850 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative animate-fade-in">
            
            <button 
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 border-b border-slate-850">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                <FolderTree className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'قيد وتأسيس حساب فرعي جديد' : 'Establish Custody Ledger Account'}
              </h3>
              <p className="text-[9.5px] text-slate-550 mt-1">
                {isAr ? 'سيتم ربط هذا الحساب مع الفئة وتضمينه تلقائياً في ميزان المراجعة.' : 'This node will automatically rollup balances for accurate corporate trial spreadsheets.'}
              </p>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                {/* Code input */}
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'رمز الحساب الفرعي (مثل 1130)' : 'Sub-Account unique Code'}</label>
                  <input
                    type="text"
                    required
                    value={newAccount.code}
                    onChange={e => setNewAccount(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="1125"
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-mono font-black outline-none focus:border-[#d4af37]"
                  />
                </div>

                {/* Parent account node selector */}
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الحساب الرئيسي الوالد' : 'Parent Reference Node'}</label>
                  <select
                    value={newAccount.parentCode}
                    onChange={e => setNewAccount(prev => ({ ...prev, parentCode: e.target.value }))}
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-black cursor-pointer outline-none focus:border-[#d4af37]"
                  >
                    <option value="">{isAr ? '-- بلا والد (حساب جذري) --' : '-- Root account --'}</option>
                    {allAccounts
                      .filter(a => a.code.endsWith('000') || a.code.endsWith('00'))
                      .map(p => (
                        <option key={p.code} value={p.code}>
                          {p.code} - {isAr ? p.nameAr : p.nameEn}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Names Input */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'اسم الحساب بالعربية' : 'Account Name (Arabic)'}</label>
                <input
                  type="text"
                  required
                  value={newAccount.nameAr}
                  onChange={e => setNewAccount(prev => ({ ...prev, nameAr: e.target.value }))}
                  placeholder={isAr ? "مثال: مبيعات البضائع، مصاريف الصيانة" : "Sales, repairs..."}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الاسم بالإنجليزية' : 'Account Name (English)'}</label>
                <input
                  type="text"
                  required
                  value={newAccount.nameEn}
                  onChange={e => setNewAccount(prev => ({ ...prev, nameEn: e.target.value }))}
                  placeholder="Sales Ledger, Repairs Overhead"
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Group Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الفئة المحاسبية' : 'Account Type'}</label>
                  <select
                    value={newAccount.type}
                    onChange={e => setNewAccount(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-black cursor-pointer outline-none focus:border-[#d4af37]"
                  >
                    <option value="Asset">Asset (أصول)</option>
                    <option value="Liability">Liability (خصوم)</option>
                    <option value="Equity">Equity (حقوق ملكية)</option>
                    <option value="Revenue">Revenue (إيرادات)</option>
                    <option value="Expense">Expense (مصروفات)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الرصيد الافتتاحي المقدر' : 'Opening balance'}</label>
                  <input
                    type="number"
                    value={newAccount.balance}
                    onChange={e => setNewAccount(prev => ({ ...prev, balance: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-mono font-black outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-850 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="w-1/2 bg-slate-900 border border-slate-800 text-slate-400 py-2.5 rounded-xl text-xs font-bold hover:text-white transition-all"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={accountLoading}
                  className="w-1/2 bg-[#d4af37] text-black py-2.5 rounded-xl text-xs font-black hover:bg-[#bfa032] transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {accountLoading && <RefreshCw className="w-3 animate-spin" />}
                  {isAr ? 'قيد الحساب' : 'Register Account'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
