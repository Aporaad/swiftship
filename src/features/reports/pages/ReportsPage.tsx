import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection, onSnapshot, query, orderBy, getDocs, doc, setDoc, getDoc, where, addDoc, deleteDoc
} from '../../../lib/supabase-adapter';
import { db } from '../../../lib/supabase-adapter';
import { useSettings } from '../../../context/SettingsContext';
import { useRole } from '../../../hooks/useRole';
import {
  FileText, TrendingUp, DollarSign, Users, Truck, Package,
  Search, Filter, Download as DownloadIcon, Printer,
  Calendar, ArrowUpRight, ArrowDownLeft, ChevronRight,
  Settings as SettingsIcon, AlertCircle, RefreshCw, Layers, Layout,
  Save, CheckCircle2, ChevronDown, Check, Coins, Eye, ShoppingCart, UserCheck,
  Bookmark, Trash2, Palette, Sparkles, BarChart
} from 'lucide-react';
import { printContent } from '../../../lib/printUtils';
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import * as XLSX from 'xlsx';
import { notificationService } from '../../../services/notificationService';
import { useExpenseCategories } from '../../../hooks/useExpenseCategories';
import { financialAccountService } from '../../../services/financialAccountService';
import { useExchangeRates } from '../../../hooks/useExchangeRates';

// Sub-report & Component Imports
import AccountLedgerReport from './reports/AccountLedgerReport';
import CouriersReport from './reports/CouriersReport';
import CustomersReport from './reports/CustomersReport';
import ExpensesReport from './reports/ExpensesReport';
import FinancialOverviewReport from './reports/FinancialOverviewReport';
import OrdersCostReport from './reports/OrdersCostReport';
import PackagingReport from './reports/PackagingReport';
import ShippingCompaniesReport from './reports/ShippingCompaniesReport';
import UsersReport from './reports/UsersReport';

import { PrintTemplateDesignerTab, PrintTemplateSettings } from '../components/PrintTemplateDesignerTab';
import { PrintDesignerPageTab } from './tabs';
import { SavePresetModal } from '../components/SavePresetModal';
import { ReportPrintPreviewModal } from '../components/ReportPrintPreviewModal';
import MultiAccountSelector from '../components/MultiAccountSelector';

// Interfaces
interface ReportFilter {
  startDate: string;
  endDate: string;
  type: string;
  accountId?: string;
  categoryId?: string;
  entityId?: string;
}

interface SavedReportTemplate {
  id: string;
  name: string;
  activeReport: string;
  filters: ReportFilter;
  createdAt: string;
}

const DEFAULT_PRINT_SETTINGS: PrintTemplateSettings = {
  headerTitleAr: 'شركة ألكس للخدمات اللوجستية والشحن المالي',
  headerTitleEn: 'ALX LOGISTICS & FREIGHT MANAGEMENT',
  subtitleAr: 'تقرير مالي وتدقيقي مصادق وموجّه',
  subtitleEn: 'Official Certified Financial Audit Statement',
  footerTextAr: 'هذا المستند صادر من النظام الآلي الموحد ويعتبر وثيقة مراجعة مالية رسمية.',
  footerTextEn: 'System-generated official accounting document valid for internal and external audits.',
  logoUrl: '',
  showLogo: true,
  paperSize: 'A4',
  margins: 'default',
  fontSize: 'sm',
  primaryColor: '#000000',
  taxNumber: 'TRN-9048201-ALX',
  showBarcode: true,
  showSignatures: true,
  signature1Ar: 'توقيع وتعميد الترحيل',
  signature1En: 'Authorized Operations Sign',
  signature2Ar: 'التدقيق المحاسبي المالي',
  signature2En: 'Financial Auditor',
  signature3Ar: 'اعتماد المدير العام',
  signature3En: 'General Manager'
};

const REPORT_TYPES = [
  { id: 'financial_overview', labelAr: 'الملخص المالي الشامل والأرباح', labelEn: 'Financial Overview & P&L', icon: TrendingUp },
  { id: 'orders_cost', labelAr: 'تقرير تكاليف وأرباح الطلبات', labelEn: 'Orders & Freight Profitability', icon: ShoppingCart },
  { id: 'customers', labelAr: 'كشف حسابات مديونيات العملاء', labelEn: 'Customer Receivables Ledger', icon: Users },
  { id: 'couriers', labelAr: 'تقرير عهد وتصفية المندوبين', labelEn: 'Couriers Custody & Clearance', icon: Truck },
  { id: 'shipping_companies', labelAr: 'حسابات شركات الشحن والناقلين', labelEn: 'Shipping Partners Audit', icon: Package },
  { id: 'users', labelAr: 'رواتب وعمولات واستحقاقات الموظفين', labelEn: 'Staff Payroll & Overage', icon: UserCheck },
  { id: 'expenses', labelAr: 'تقرير النفقات والمصروفات التشغيلية', labelEn: 'Operational Expenses Analysis', icon: DollarSign },
  { id: 'packaging', labelAr: 'رسوم التغليف والتعبئة والتكاليف', labelEn: 'Packaging & Local Fees Statement', icon: Layers },
  { id: 'account_ledger', labelAr: 'كشف الحساب التفصيلي (Ledger Audit)', labelEn: 'Unified Chart Account Ledger', icon: Coins }
];

export default function ReportsPage() {
  const { settings } = useSettings();
  const isAr = settings.language === 'ar';
  const { role, hasPermission } = useRole();
  const { rates: dbRates } = useExchangeRates();
  const convertToYER = (amount: number, currency: string) => {
    const amt = parseFloat(String(amount || 0));
    if (!currency || currency === 'YER') return amt;
    const rate = dbRates[currency] || 1;
    return amt * rate;
  };
  const EXPENSE_CATEGORIES_DYNAMIC = useExpenseCategories();

  const [activeTab, setActiveTab] = useState<'reports' | 'templates'>('reports');
  const [activeReport, setActiveReport] = useState<string>('financial_overview');

  const [filters, setFilters] = useState<ReportFilter>({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    type: 'all'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Print Template Settings State
  const [printSettings, setPrintSettings] = useState<PrintTemplateSettings>(DEFAULT_PRINT_SETTINGS);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Saved Filter Templates State
  const [savedReportTemplates, setSavedReportTemplates] = useState<SavedReportTemplate[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);

  // Specific Entity Selectors for Reports
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string | null>(null);

  // Accounts filter selections
  const [selectedOrdersCostAccountIds, setSelectedOrdersCostAccountIds] = useState<string[]>([]);
  const [selectedPackagingAccountIds, setSelectedPackagingAccountIds] = useState<string[]>([]);
  const [selectedShippingCompaniesAccountIds, setSelectedShippingCompaniesAccountIds] = useState<string[]>([]);

  // Raw Database Collections State
  const [expenses, setExpenses] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);

  // Load Saved Print Settings from LocalStorage / Firestore
  useEffect(() => {
    const saved = localStorage.getItem('swiftship_print_settings');
    if (saved) {
      try {
        setPrintSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved print settings');
      }
    }
  }, []);

  // Fetch Accounts
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'accounts'), (snap: any) => {
      setAccounts(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch Saved Filter Templates
  useEffect(() => {
    const q = query(collection(db, 'report_filter_presets'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const presets: SavedReportTemplate[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SavedReportTemplate));
      setSavedReportTemplates(presets);
    });
    return () => unsub();
  }, []);

  // Main Firestore Listeners
  useEffect(() => {
    const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), orderBy('createdAt', 'desc')), snap => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubCustomers = onSnapshot(collection(db, 'customers'), snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubCouriers = onSnapshot(collection(db, 'couriers'), snap => {
      setCouriers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubShipping = onSnapshot(collection(db, 'shipping_companies'), snap => {
      setShippingCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTransactions = onSnapshot(query(collection(db, 'account_transactions'), orderBy('createdAt', 'desc')), snap => {
      setAccountTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubExpenses();
      unsubOrders();
      unsubCustomers();
      unsubCouriers();
      unsubShipping();
      unsubUsers();
      unsubTransactions();
    };
  }, []);

  // Currency converter helper
  const convertCurrency = (amount: number, fromCurrency: string = 'SAR', toCurrency: string = 'SAR'): number => {
    const amountInYER = convertToYER(amount, fromCurrency);
    if (toCurrency === 'YER') return amountInYER;
    if (toCurrency === 'SAR') return amountInYER / 400;
    if (toCurrency === 'USD') return amountInYER / 1500;
    return amount;
  };

  // Saved Filter Templates Handlers
  const handleSaveFilterTemplate = async () => {
    if (!newPresetName.trim()) return;
    try {
      await addDoc(Math.random().toString(36).substring(2, 9), collection(db, 'report_filter_presets'), {
        name: newPresetName.trim(),
        activeReport,
        filters,
        createdAt: new Date().toISOString()
      });
      setNewPresetName('');
      setIsSavePresetModalOpen(false);
      notificationService.notify({
        title: isAr ? 'تم الحفظ' : 'Preset Saved',
        message: isAr ? 'تم حفظ قالب الفلترة المخصص بنجاح' : 'Filter template saved successfully',
        type: 'success'
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteFilterTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'report_filter_presets', id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplyFilterTemplate = (preset: SavedReportTemplate) => {
    setActiveReport(preset.activeReport);
    setFilters(preset.filters);
  };

  const handleSavePrintSettings = async () => {
    setSavingTemplate(true);
    try {
      localStorage.setItem('swiftship_print_settings', JSON.stringify(printSettings));
      await setDoc(doc(db, 'system_settings', 'print_template_config'), printSettings);
      notificationService.notify({
        title: isAr ? 'تم حفظ الإعدادات' : 'Config Saved',
        message: isAr ? 'تم حفظ إعدادات وثيقة قوالب الطباعة بنجاح' : 'Print layout config stored successfully',
        type: 'success'
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleResetPrintSettings = () => {
    setPrintSettings(DEFAULT_PRINT_SETTINGS);
    localStorage.removeItem('swiftship_print_settings');
  };

  // Search filter helper
  const searchMatchList = (list: any[], keyField: string) => {
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(item => {
      const val = item[keyField] || item.fullName || item.name || item.recipientName || '';
      return String(val).toLowerCase().includes(term);
    });
  };

  // Account selection saving helper
  const handleSaveAccountSelection = (type: string) => {
    notificationService.notify({
      title: isAr ? 'تم حفظ التحديد' : 'Accounts Linked',
      message: isAr ? 'تم ربط الحسابات المحددة بالتقرير بنجاح' : 'Selected accounts saved for report',
      type: 'success'
    });
  };

  // Filtered dataset calculations
  const filteredData = useMemo(() => {
    const start = startOfDay(new Date(filters.startDate));
    const end = endOfDay(new Date(filters.endDate));

    const isDateMatch = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return isWithinInterval(d, { start, end });
    };

    return {
      expenses: expenses.filter(e => isDateMatch(e.createdAt || e.date)),
      orders: orders.filter(o => isDateMatch(o.createdAt || o.orderDate)),
      customers,
      couriers,
      shippingCompanies,
      users
    };
  }, [expenses, orders, customers, couriers, shippingCompanies, users, filters]);

  // Overall Financial Metrics Summary
  const reportMetrics = useMemo(() => {
    let revenue = 0;
    let costs = 0;
    let packagingCosts = 0;
    let operationalCosts = 0;
    let shippingCosts = 0;
    let salaryCosts = 0;

    filteredData.orders.forEach(o => {
      revenue += convertToYER(parseFloat(o.totalPrice) || 0, o.currency || 'YER');
    });

    filteredData.expenses.forEach(e => {
      const amt = convertToYER(parseFloat(e.amount) || 0, e.currency || 'YER');
      costs += amt;
      if (e.category === 'تغليف وتعبئة' || e.category === 'packaging') packagingCosts += amt;
      else if (e.category === 'مصاريف شحن' || e.category === 'shipping') shippingCosts += amt;
      else if (e.category === 'رواتب وأجور' || e.category === 'salaries') salaryCosts += amt;
      else operationalCosts += amt;
    });

    return {
      revenue,
      costs,
      profit: revenue - costs,
      packagingCosts,
      operationalCosts,
      shippingCosts,
      salaryCosts
    };
  }, [filteredData, convertToYER]);

  // Treasury balances calculations
  const treasuryBalances = useMemo(() => {
    let yerIn = 0, yerOut = 0;
    let usdIn = 0, usdOut = 0;
    let sarIn = 0, sarOut = 0;

    accountTransactions.forEach(tx => {
      const amt = parseFloat(tx.amount) || 0;
      const curr = tx.currencyOriginal || 'YER';
      if (curr === 'YER') {
        if (tx.type === 'Credit') yerIn += amt;
        else yerOut += amt;
      } else if (curr === 'USD') {
        if (tx.type === 'Credit') usdIn += amt;
        else usdOut += amt;
      } else if (curr === 'SAR') {
        if (tx.type === 'Credit') sarIn += amt;
        else sarOut += amt;
      }
    });

    return {
      yer: { in: yerIn, out: yerOut, balance: yerIn - yerOut },
      usd: { in: usdIn, out: usdOut, balance: usdIn - usdOut },
      sar: { in: sarIn, out: sarOut, balance: sarIn - sarOut },
      combinedTotalYER: (yerIn - yerOut) + ((usdIn - usdOut) * 1500) + ((sarIn - sarOut) * 400)
    };
  }, [accountTransactions]);

  // P&L Breakdown chart data
  const pnlData = useMemo(() => [
    { name: isAr ? 'المصروفات التشغيلية' : 'OpEx', value: reportMetrics.operationalCosts },
    { name: isAr ? 'تكاليف التغليف' : 'Packaging', value: reportMetrics.packagingCosts },
    { name: isAr ? 'تكاليف الشحن' : 'Shipping', value: reportMetrics.shippingCosts },
    { name: isAr ? 'الرواتب والأجور' : 'Salaries', value: reportMetrics.salaryCosts },
  ], [reportMetrics, isAr]);

  // Ledger calculation for account_ledger
  const ledgerMetrics = useMemo(() => {
    if (activeReport !== 'account_ledger' || !filters.accountId) return null;
    const acc = accounts.find(a => a.id === filters.accountId);
    const txs = accountTransactions.filter(t => t.accountId === filters.accountId);
    let totalDebit = 0;
    let totalCredit = 0;
    txs.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'Debit') totalDebit += amt;
      else totalCredit += amt;
    });
    return {
      account: acc,
      transactions: txs,
      totalDebit,
      totalCredit,
      balance: totalCredit - totalDebit
    };
  }, [activeReport, filters.accountId, accounts, accountTransactions]);

  // Export Excel action
  const handleExportExcel = () => {
    let exportData: any[] = [];
    if (activeReport === 'expenses') {
      exportData = filteredData.expenses.map(e => ({
        ID: e.expenseNumber,
        Category: e.category,
        Recipient: e.recipientName,
        Amount: e.amount,
        Currency: e.currency,
        Date: e.createdAt
      }));
    } else {
      exportData = filteredData.orders.map(o => ({
        OrderNo: o.orderNumber,
        Customer: o.customerName,
        Status: o.orderStatus,
        Price: o.totalPrice,
        Currency: o.currency,
        Date: o.createdAt
      }));
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ReportData');
    XLSX.writeFile(wb, `report_${activeReport}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const triggerNativePrint = () => {
    printContent(isAr ? 'تقرير النظام' : 'System Report', 'print-report-canvas', isAr);
  };

  return (
    <div className="space-y-6 pb-12 font-sans dir-rtl">

      {/* Top Header & Main Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111114] border border-slate-850 p-6 rounded-3xl no-print">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-3">
            <FileText className="w-6 h-6 text-[#d4af37]" />
            {isAr ? 'مركز التقارير والتدقيق المحاسبي الموحد' : 'Unified Audit & Analytics Hub'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isAr ? 'استخراج المؤشرات المالية، مديونيات الجهات، وقوالب الطباعة المصادقة' : 'Comprehensive financial ledgers, audit statements, and custom templates'}
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-850 shrink-0">
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${activeTab === 'reports' ? 'bg-[#d4af37] text-black' : 'text-slate-400 hover:text-white'}`}
          >
            <BarChart className="w-4 h-4" />
            {isAr ? 'تقارير وسجلات النظام' : 'Ledgers & Analytics'}
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${activeTab === 'templates' ? 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20' : 'text-slate-400 hover:text-white'}`}
          >
            <Palette className="w-4 h-4" />
            {isAr ? 'تصميم قوالب الطباعة' : 'Print Templates'}
          </button>
        </div>
      </div>

      {activeTab === 'reports' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start no-print">

          {/* LEFT: Reports Tree Menu Navigation Sidebar */}
          <div className="lg:col-span-4 bg-[#111114] border border-slate-850 p-3 rounded-3xl space-y-1 block">
            <h3 className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-850/40 mb-2">
              {isAr ? 'سجلات النظام المحاسبية والتقريرية' : 'Ledger Categories'}
            </h3>
            <div className="space-y-1">
              {REPORT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setActiveReport(type.id);
                    setFilters(prev => ({ ...prev, accountId: undefined, entityId: undefined }));
                    setSearchTerm('');
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl transition-all border text-right ${activeReport === type.id
                    ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/30 shadow-md font-bold'
                    : 'text-slate-400 hover:bg-slate-900/50 hover:text-white border-transparent'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <type.icon className={`w-4 h-4 shrink-0 ${activeReport === type.id ? 'text-[#d4af37]' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold leading-tight">{isAr ? type.labelAr : type.labelEn}</span>
                  </div>
                  {activeReport === type.id && <div className="w-1.5 h-1.5 bg-[#d4af37] rounded-full shrink-0" />}
                </button>
              ))}
            </div>

            {/* Saved Custom templates list */}
            <div className="pt-4 mt-4 border-t border-slate-850 p-3 space-y-2 text-xs">
              <span className="text-[10px] font-black text-slate-500 block uppercase flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-[#d4af37]" />
                {isAr ? 'التقارير المخصصة والفلترات المحفوظة' : 'Saved Custom Views'}
              </span>
              {savedReportTemplates.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic mt-1.5">{isAr ? 'لا توجد فلترات مخصصة محفوظة حالياً.' : 'No saved presets available.'}</p>
              ) : (
                <div className="space-y-1.5 mt-2 max-h-[220px] overflow-y-auto pr-1">
                  {savedReportTemplates.map((tpl) => {
                    const rType = REPORT_TYPES.find(r => r.id === tpl.activeReport);
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleApplyFilterTemplate(tpl)}
                        className="group flex items-center justify-between p-2 rounded-xl bg-slate-950/80 hover:bg-[#d4af37]/5 border border-slate-900 hover:border-[#d4af37]/20 cursor-pointer transition text-right"
                      >
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <span className="font-bold text-[11px] text-white truncate">{tpl.name}</span>
                          <span className="text-[9px] text-slate-500 font-bold truncate">
                            {isAr ? rType?.labelAr : rType?.labelEn}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteFilterTemplate(tpl.id, e)}
                          className="p-1 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition shrink-0 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Analytical Content & Filters Deck */}
          <div className="lg:col-span-8 space-y-6">

            {/* Filter controls deck */}
            <div className="bg-[#111114] border border-slate-850 p-5 rounded-3xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-black text-[#d4af37] uppercase flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  {isAr ? 'مصفاة البيانات الاحترافية' : 'Professional Filter Deck'}
                </span>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setIsSavePresetModalOpen(true)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-[#d4af37]" />
                    {isAr ? 'حفظ الفلتر الحالي' : 'Save Filter Preset'}
                  </button>

                  <button
                    onClick={handleExportExcel}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <DownloadIcon className="w-3.5 h-3.5 text-emerald-400" />
                    {isAr ? 'تصدير Excel' : 'Export Excel'}
                  </button>

                  <button
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="px-3.5 py-1.5 bg-[#d4af37] hover:bg-yellow-600 text-black rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {isAr ? 'طباعة الكشف' : 'Print PDF'}
                  </button>
                </div>
              </div>

              {/* Date pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 px-1 uppercase block">{isAr ? 'تاريخ البداية' : 'From Date'}</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 px-1 uppercase block">{isAr ? 'تاريخ النهاية' : 'To Date'}</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 px-1 uppercase block">{isAr ? 'بحث سريع' : 'Quick Search'}</label>
                  <input
                    type="text"
                    placeholder={isAr ? 'ابحث عن اسم، رقم، أو بيان...' : 'Search...'}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
                  />
                </div>
              </div>
            </div>

            {/* LIVE DISPLAY AREA: DELEGATE TO SUB-REPORT COMPONENTS */}
            <div className="bg-[#111114] border border-slate-850 rounded-3xl p-6 min-h-[450px]">
              {activeReport === 'financial_overview' && (
                <FinancialOverviewReport
                  isAr={isAr}
                  reportMetrics={reportMetrics}
                  treasuryBalances={treasuryBalances}
                  pnlData={pnlData}
                  filteredData={filteredData}
                />
              )}

              {activeReport === 'orders_cost' && (
                <OrdersCostReport
                  isAr={isAr}
                  filteredData={filteredData}
                  accounts={accounts}
                  accountTransactions={accountTransactions}
                  selectedOrdersCostAccountIds={selectedOrdersCostAccountIds}
                  setSelectedOrdersCostAccountIds={setSelectedOrdersCostAccountIds}
                  selectedOrderId={selectedOrderId}
                  setSelectedOrderId={setSelectedOrderId}
                  handleSaveAccountSelection={handleSaveAccountSelection}
                  convertCurrency={convertCurrency}
                  convertToYER={convertToYER}
                  MultiAccountSelectorComponent={MultiAccountSelector}
                />
              )}

              {activeReport === 'customers' && (
                <CustomersReport
                  isAr={isAr}
                  filteredData={filteredData}
                  accounts={accounts}
                  accountTransactions={accountTransactions}
                  selectedCustomerId={selectedCustomerId}
                  setSelectedCustomerId={setSelectedCustomerId}
                  searchMatchList={searchMatchList}
                  convertToYER={convertToYER}
                />
              )}

              {activeReport === 'couriers' && (
                <CouriersReport
                  isAr={isAr}
                  filteredData={filteredData}
                  accounts={accounts}
                  accountTransactions={accountTransactions}
                  selectedCourierId={selectedCourierId}
                  setSelectedCourierId={setSelectedCourierId}
                  searchMatchList={searchMatchList}
                  convertToYER={convertToYER}
                />
              )}

              {activeReport === 'shipping_companies' && (
                <ShippingCompaniesReport
                  isAr={isAr}
                  filteredData={filteredData}
                  accounts={accounts}
                  accountTransactions={accountTransactions}
                  selectedShippingCompaniesAccountIds={selectedShippingCompaniesAccountIds}
                  setSelectedShippingCompaniesAccountIds={setSelectedShippingCompaniesAccountIds}
                  selectedCompanyId={selectedCompanyId}
                  setSelectedCompanyId={setSelectedCompanyId}
                  handleSaveAccountSelection={handleSaveAccountSelection}
                  convertCurrency={convertCurrency}
                  convertToYER={convertToYER}
                  searchMatchList={searchMatchList}
                  MultiAccountSelectorComponent={MultiAccountSelector}
                />
              )}

              {activeReport === 'users' && (
                <UsersReport
                  isAr={isAr}
                  filteredData={filteredData}
                  accounts={accounts}
                  accountTransactions={accountTransactions}
                  selectedUserId={selectedUserId}
                  setSelectedUserId={setSelectedUserId}
                  searchMatchList={searchMatchList}
                  convertToYER={convertToYER}
                />
              )}

              {activeReport === 'expenses' && (
                <ExpensesReport
                  isAr={isAr}
                  filteredData={filteredData}
                  selectedExpenseCategory={selectedExpenseCategory}
                  setSelectedExpenseCategory={setSelectedExpenseCategory}
                  EXPENSE_CATEGORIES_DYNAMIC={EXPENSE_CATEGORIES_DYNAMIC}
                  reportMetrics={reportMetrics}
                  accountTransactions={accountTransactions}
                  accounts={accounts}
                  searchMatchList={searchMatchList}
                  convertToYER={convertToYER}
                />
              )}

              {activeReport === 'packaging' && (
                <PackagingReport
                  isAr={isAr}
                  filteredData={filteredData}
                  accounts={accounts}
                  accountTransactions={accountTransactions}
                  selectedPackagingAccountIds={selectedPackagingAccountIds}
                  setSelectedPackagingAccountIds={setSelectedPackagingAccountIds}
                  handleSaveAccountSelection={handleSaveAccountSelection}
                  convertCurrency={convertCurrency}
                  convertToYER={convertToYER}
                  MultiAccountSelectorComponent={MultiAccountSelector}
                />
              )}

              {activeReport === 'account_ledger' && (
                <AccountLedgerReport
                  isAr={isAr}
                  accounts={accounts}
                  filters={filters}
                  accountTransactions={accountTransactions}
                  ledgerMetrics={ledgerMetrics}
                  handleExportExcel={handleExportExcel}
                  triggerNativePrint={triggerNativePrint}
                  isPreviewModalOpen={isPreviewModalOpen}
                  setIsPreviewModalOpen={setIsPreviewModalOpen}
                />
              )}
            </div>

          </div>

        </div>
      ) : (
        /* TEMPLATE SETTINGS & DESIGNER VIEW */
        <PrintDesignerPageTab
          isAr={isAr}
          printSettings={printSettings}
          setPrintSettings={setPrintSettings}
          savingTemplate={savingTemplate}
          handleSavePrintSettings={handleSavePrintSettings}
          handleResetPrintSettings={handleResetPrintSettings}
        />
      )}

      {/* PRINT PREVIEW OVERLAY MODAL */}
      <ReportPrintPreviewModal
        isPreviewModalOpen={isPreviewModalOpen}
        setIsPreviewModalOpen={setIsPreviewModalOpen}
        isAr={isAr}
        printSettings={printSettings}
        activeReport={activeReport}
        selectedOrderId={selectedOrderId}
        selectedCustomerId={selectedCustomerId}
        selectedCourierId={selectedCourierId}
        selectedCompanyId={selectedCompanyId}
        selectedUserId={selectedUserId}
        selectedExpenseCategory={selectedExpenseCategory}
        filters={filters}
        orders={orders}
        customers={customers}
        couriers={couriers}
        shippingCompanies={shippingCompanies}
        users={users}
        expenses={expenses}
        filteredData={filteredData}
        reportMetrics={reportMetrics}
        accountTransactions={accountTransactions}
        triggerNativePrint={triggerNativePrint}
        convertToYER={convertToYER}
      />

      {/* Save Preset Modal */}
      <SavePresetModal
        isOpen={isSavePresetModalOpen}
        onClose={() => setIsSavePresetModalOpen(false)}
        isAr={isAr}
        newPresetName={newPresetName}
        setNewPresetName={setNewPresetName}
        handleSaveFilterTemplate={handleSaveFilterTemplate}
      />


    </div>
  );
}
