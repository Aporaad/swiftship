import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection, onSnapshot, query, orderBy, getDocs, doc, setDoc, getDoc, where, addDoc, deleteDoc
} from '../lib/firebase';
import { db } from '../lib/firebase';
import { useSettings } from '../context/SettingsContext';
import { useRole } from '../hooks/useRole';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
  FileText, TrendingUp, DollarSign, Users, Truck, Package,
  Search, Filter, Download as DownloadIcon, Printer,
  Calendar, ArrowUpRight, ArrowDownLeft, ChevronRight,
  Settings as SettingsIcon, AlertCircle, RefreshCw, Layers, Layout,
  Save, CheckCircle2, ChevronDown, Check, Coins, Eye, ShoppingCart, UserCheck,
  Bookmark, Trash2, Palette, Sparkles
} from 'lucide-react';
import { printContent } from '../lib/printUtils';
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import * as XLSX from 'xlsx';
import { notificationService } from '../services/notificationService';
import { useExpenseCategories } from '../hooks/useExpenseCategories';
import { financialAccountService } from '../services/financialAccountService';
import { useExchangeRates } from '../hooks/useExchangeRates';

// Interfaces
interface ReportFilter {
  startDate: string;
  endDate: string;
  type: string;
  accountId?: string;
  categoryId?: string;
  entityId?: string;
}

interface PrintTemplateSettings {
  headerTitleAr: string;
  headerTitleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  footerTextAr: string;
  footerTextEn: string;
  logoUrl: string;
  showLogo: boolean;
  paperSize: 'A4' | 'A4_Landscape' | '80mm' | '58mm';
  margins: 'none' | 'minimal' | 'default';
  fontSize: 'xs' | 'sm' | 'md' | 'lg';
  showBarcode: boolean;
  showSignatures: boolean;
  showDateTime: boolean;
  showTaxId: boolean;
  taxNumber: string;
  primaryColor: string;
  fontFamily?: 'Cairo' | 'Inter' | 'JetBrains Mono' | 'Segoe UI';
  signature1Ar?: string;
  signature1En?: string;
  signature2Ar?: string;
  signature2En?: string;
  signature3Ar?: string;
  signature3En?: string;
  tableStyle?: 'solid' | 'dashed' | 'minimal';
}

const DEFAULT_PRINT_SETTINGS: PrintTemplateSettings = {
  headerTitleAr: 'سويفت شيب للخدمات اللوجستية ش.م.م',
  headerTitleEn: 'alx Logistics L.L.C',
  subtitleAr: 'الشحن السريع • النقل البري • التجميع الذكي',
  subtitleEn: 'Express Cargo & Procurement Services',
  footerTextAr: 'يسرنا خدمتكم دائماً. يرجى مراجعة محتويات السند والتوقيع فور الاستلام.',
  footerTextEn: 'Pleasure serving you. Please verify item details and sign upon reception.',
  logoUrl: '',
  showLogo: true,
  paperSize: 'A4',
  margins: 'default',
  fontSize: 'sm',
  showBarcode: true,
  showSignatures: true,
  showDateTime: true,
  showTaxId: true,
  taxNumber: 'TR-10049539-X03',
  primaryColor: '#d4af37',
  fontFamily: 'Cairo',
  signature1Ar: 'توقيع المستلم والعميل',
  signature1En: 'Recipient Signature',
  signature2Ar: 'اعتماد المحاسب المسؤول والتدقيق',
  signature2En: 'Auditor Acknowledgment',
  signature3Ar: 'المدير العام والختم',
  signature3En: 'General Director Stamp',
  tableStyle: 'solid'
};

const COLORS = ['#d4af37', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#f59e0b'];

const REPORT_TYPES = [
  { id: 'financial_overview', labelAr: 'التحليل المالي والأرباح العام', labelEn: 'Financial Overview & Profits', icon: TrendingUp },
  { id: 'expenses', labelAr: 'تقرير المصروفات التفصيلي', labelEn: 'Detailed Expenses', icon: FileText },
  { id: 'packaging', labelAr: 'تقرير رسوم التغليف وتكاليف شحن محلي', labelEn: 'Packaging & Other Costs', icon: Package },
  { id: 'orders_cost', labelAr: 'تقرير تكاليف الطلبات والشحنات', labelEn: 'Orders Cost Analysis', icon: ShoppingCart },
  { id: 'shipping_companies', labelAr: 'تقرير شركات الشحن والعمولات', labelEn: 'Shipping Companies Report', icon: Truck },
  { id: 'customers', labelAr: 'تقرير كشف العملاء والذمم والمديونيات', labelEn: 'Customers Ledger & Balances', icon: Users },
  { id: 'couriers', labelAr: 'تقرير المناديب والتحصيلات والعهدة المعلقة', labelEn: 'Couriers Registry & Custodies', icon: Truck },
  { id: 'users', labelAr: 'تقرير حسابات المستخدمين والرواتب', labelEn: 'Users & Staff Salaries', icon: UserCheck },
  { id: 'account_ledger', labelAr: 'تقرير تفصيلي لأي حساب (شجرة الحسابات)', labelEn: 'Detailed Account Ledger', icon: Layers },
];

interface MultiAccountSelectorProps {
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  labelAr: string;
  labelEn: string;
  accounts: any[];
  isAr: boolean;
  onSave?: () => void;
}

const MultiAccountSelector: React.FC<MultiAccountSelectorProps> = ({
  selectedIds,
  setSelectedIds,
  labelAr,
  labelEn,
  accounts,
  isAr,
  onSave
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredAccounts = accounts.filter(acc =>
    (acc.name || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (acc.accountCode || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (acc.entityName || '').toLowerCase().includes(filterQuery.toLowerCase())
  );

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const allFilteredIds = filteredAccounts.map(a => a.id);
    setSelectedIds(prev => {
      const otherSelected = prev.filter(id => !allFilteredIds.includes(id));
      return [...otherSelected, ...allFilteredIds];
    });
  };

  const deselectAll = () => {
    const allFilteredIds = filteredAccounts.map(a => a.id);
    setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
  };

  const selectedAccounts = accounts.filter(acc => selectedIds.includes(acc.id));

  return (
    <div className="relative" ref={containerRef}>
      <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1.5 tracking-wider">
        {isAr ? labelAr : labelEn}
      </span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-950 border rounded-2xl px-4 py-3 text-start flex justify-between items-center transition-all cursor-pointer shadow-inner relative focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20 ${isOpen ? 'border-[#d4af37] ring-2 ring-[#d4af37]/10' : 'border-slate-800 hover:border-slate-700'
          }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 overflow-hidden flex-1 select-none">
          {selectedAccounts.length === 0 ? (
            <span className="text-xs text-slate-500 font-bold italic">
              {isAr ? 'اضغط لتحديد الحسابات من الشجرة ماليًا...' : 'Click to select accounts...'}
            </span>
          ) : (
            <>
              <span className="bg-[#d4af37]/25 text-[#d4af37] text-[10px] px-2 py-0.5 rounded-full font-black font-mono shrink-0">
                {selectedAccounts.length}
              </span>
              <div className="flex flex-wrap gap-1">
                {selectedAccounts.slice(0, 4).map(acc => (
                  <span key={acc.id} className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 px-2 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-1">
                    {acc.entityName || acc.name}
                    <span className="text-slate-500 text-[8px] font-mono">[{acc.accountCode}]</span>
                  </span>
                ))}
                {selectedAccounts.length > 4 && (
                  <span className="bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded-lg text-[8.5px] font-black">
                    +{selectedAccounts.length - 4} {isAr ? 'حسابات إضافية' : 'others'}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-[#d4af37]' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-[100] left-0 right-0 mt-2 bg-slate-950/98 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-3.5 space-y-3"
          >
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={isAr ? 'البحث باسم الحساب أو كود الدليل...' : 'Search by account name or code...'}
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-[11px] text-white outline-none focus:border-[#d4af37]/45 focus:bg-slate-900 transition-all font-bold placeholder:text-slate-550"
              />
            </div>

            <div className="flex justify-between items-center text-[10px] border-b border-slate-900 pb-2 px-1">
              <span className="text-slate-500 font-bold">
                {isAr ? `${filteredAccounts.length} حساب متاح` : `${filteredAccounts.length} accounts available`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[#d4af37] hover:text-[#e4cf67] font-black transition-colors"
                >
                  {isAr ? 'تحديد الكل' : 'Select All'}
                </button>
                <span className="text-slate-800">|</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-slate-400 hover:text-slate-300 font-black transition-colors"
                >
                  {isAr ? 'إلغاء التحديد' : 'Clear All'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1 max-h-[190px] overflow-y-auto pr-1">
              {filteredAccounts.map(acc => {
                const isSelected = selectedIds.includes(acc.id);
                return (
                  <div
                    key={acc.id}
                    onClick={() => toggleSelection(acc.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-all select-none ${isSelected
                      ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/35'
                      : 'bg-slate-900/10 text-slate-400 border-transparent hover:bg-slate-900/40 hover:text-white'
                      }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-[#d4af37] border-[#d4af37] text-black animate-scale-in' : 'border-slate-800 bg-slate-950'
                      }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3.5]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{acc.entityName || acc.name}</span>
                        <span className="font-mono text-[9px] text-[#d4af37] shrink-0 font-black">[{acc.accountCode}]</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-500 mt-0.5 font-mono">
                        <span>{isAr ? 'الرصيد الحالي:' : 'Current Balance:'} {(acc.balance || 0).toLocaleString()} {acc.currency || 'SAR'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredAccounts.length === 0 && (
                <p className="text-[10px] text-slate-500 italic text-center py-4">{isAr ? 'لا توجد حسابات مطابقة للبحث' : 'No matching accounts found.'}</p>
              )}
            </div>

            {onSave && (
              <div className="pt-2 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    onSave();
                    setIsOpen(false);
                  }}
                  className="w-full bg-[#d4af37] hover:bg-[#c49f27] text-black text-[11px] font-black py-2 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 group"
                >
                  <Save className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  {isAr ? 'حفظ التغييرات ومزامنة البيانات' : 'Save & Sync Changes'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function Reports() {
  const { settings } = useSettings();
  const { rates: dbRates } = useExchangeRates();
  const EXPENSE_CATEGORIES_DYNAMIC = useExpenseCategories();
  const { role, hasPermission, loading: roleLoading } = useRole();
  const isAr = settings.language === 'ar';

  // Core Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]);
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);
  const [allAccountTransactions, setAllAccountTransactions] = useState<any[]>([]);
  const [allTimeTransactions, setAllTimeTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs layout
  const [activeTab, setActiveTab] = useState<'reports' | 'templates'>('reports');

  // Print Template State
  const [printSettings, setPrintSettings] = useState<PrintTemplateSettings>(DEFAULT_PRINT_SETTINGS);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Custom Saved Report Filter Templates System
  const [savedReportTemplates, setSavedReportTemplates] = useState<any[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
  const [isSavingFilterTemplate, setIsSavingFilterTemplate] = useState(false);

  // Filter States
  const [activeReport, setActiveReport] = useState('financial_overview');
  const [filters, setFilters] = useState<ReportFilter>({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    type: 'all'
  });
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  // Multi-account selection state variables for the reports requested
  const [selectedPackagingAccountIds, setSelectedPackagingAccountIds] = useState<string[]>([]);
  const [selectedOrdersCostAccountIds, setSelectedOrdersCostAccountIds] = useState<string[]>([]);
  const [selectedShippingCompaniesAccountIds, setSelectedShippingCompaniesAccountIds] = useState<string[]>([]);
  const [reportSettingsLoaded, setReportSettingsLoaded] = useState(false);

  // Load saved account selections from database (Real-time sync)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'report_accounts'), snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.packaging) setSelectedPackagingAccountIds(data.packaging || []);
        if (data.orders_cost) setSelectedOrdersCostAccountIds(data.orders_cost || []);
        if (data.shipping_companies) setSelectedShippingCompaniesAccountIds(data.shipping_companies || []);
      }
    });

    // Set loaded flag after a brief delay to allow snapshots to arrive
    const timer = setTimeout(() => setReportSettingsLoaded(true), 1000);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  // Automatically initialize defaults ONLY if nothing is loaded from DB and reportSettingsLoaded is true
  useEffect(() => {
    if (accounts.length > 0 && reportSettingsLoaded) {
      if (selectedPackagingAccountIds.length === 0) {
        const pkgAcc = accounts.find(a => a.entityId === 'sys_packaging_fees' || a.accountCode === '5100-7355' || (a.name || '').includes('تغليف'));
        if (pkgAcc) {
          setSelectedPackagingAccountIds([pkgAcc.id]);
        }
      }
      if (selectedOrdersCostAccountIds.length === 0) {
        const defaults = accounts
          .filter(a => ['sys_sourcing_cost', 'sys_shipping_costs', 'sys_delivery_cost'].includes(a.entityId || '') ||
            ['5100-4483', '5000-1122', '5300-7118', '5000-2788'].includes(a.accountCode || '') ||
            (a.name || '').includes('تجميع') || (a.name || '').includes('شحن') || (a.name || '').includes('توصيل'))
          .map(a => a.id);
        if (defaults.length > 0) {
          setSelectedOrdersCostAccountIds(defaults);
        }
      }
      if (selectedShippingCompaniesAccountIds.length === 0) {
        const defaults = accounts
          .filter(a => a.entityType === 'shipping_company' ||
            (a.name || '').includes('عمول') || (a.name || '').includes('شحن') || (a.accountCode || '').startsWith('5300'))
          .map(a => a.id);
        if (defaults.length > 0) {
          setSelectedShippingCompaniesAccountIds(defaults);
        }
      }
    }
  }, [accounts, reportSettingsLoaded]);

  const handleSaveAccountSelection = async (reportType: string) => {
    try {
      let selectedIds: string[] = [];
      if (reportType === 'packaging') selectedIds = selectedPackagingAccountIds;
      else if (reportType === 'orders_cost') selectedIds = selectedOrdersCostAccountIds;
      else if (reportType === 'shipping_companies') selectedIds = selectedShippingCompaniesAccountIds;

      // Use a single document in 'settings' collection for all report account selections
      const docRef = doc(db, 'settings', 'report_accounts');
      const snap = await getDoc(docRef);
      const existingData = snap.exists() ? snap.data() : {};

      await setDoc(docRef, {
        ...existingData,
        [reportType]: selectedIds,
        updatedAt: Date.now()
      });

      notificationService.notify({
        title: isAr ? 'تم الحفظ والمزامنة' : 'Saved & Synced',
        message: isAr ? 'تم حفظ ومزامنة الحسابات المحددة في جدول الإعدادات بنجاح' : 'Selected accounts saved and synced to settings table successfully',
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ في المزامنة' : 'Sync Error',
        message: err.message,
        type: 'error'
      });
    }
  };

  // Active Print Slips Preview Modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [printZoomScale, setPrintZoomScale] = useState(0.8);

  // Drilldown Selected States
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string | null>(null);

  const convertToYER = (amount: number, currency: string) => {
    return financialAccountService.convertToDefaultCurrency(
      amount,
      currency,
      settings.currency || 'YER',
      dbRates
    );
  };

  const convertCurrency = (amount: number, from: string, to: string) => {
    return financialAccountService.convertToTargetCurrency(
      amount,
      from,
      to,
      dbRates
    );
  };

  // Fetch ALL account transactions for general financial metrics calculation
  useEffect(() => {
    const qAllTxs = query(
      collection(db, 'account_transactions'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(qAllTxs, (snap) => {
      const allTxs = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as any[];
      setAllTimeTransactions(allTxs);
      // Filter by active start/end date range
      const filtered = allTxs.filter((tx: any) => {
        const txDate = new Date(tx.createdAt);
        const start = startOfDay(new Date(filters.startDate));
        const end = endOfDay(new Date(filters.endDate));
        return isWithinInterval(txDate, { start, end });
      });
      setAllAccountTransactions(filtered);
    });

    return () => unsub();
  }, [filters.startDate, filters.endDate]);

  // Custom presets handlers
  const handleSaveFilterTemplate = async () => {
    if (!newTemplateName.trim()) {
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'يرجى إدخال اسم للقالب المحفوظ' : 'Please provide a name for the saved template',
        type: 'error'
      });
      return;
    }
    setIsSavingFilterTemplate(true);
    try {
      await addDoc(null, collection(db, 'report_templates'), {
        name: newTemplateName.trim(),
        activeReport,
        filters,
        sortBy,
        sortOrder,
        searchTerm,
        selectedOrderId,
        selectedCustomerId,
        selectedCourierId,
        selectedCompanyId,
        selectedUserId,
        selectedExpenseCategory,
        createdAt: Date.now()
      });
      notificationService.notify({
        title: isAr ? 'تم الحفظ' : 'Saved',
        message: isAr ? 'تم حفظ قالب الفلترة بنجاح' : 'Filter configuration saved successfully',
        type: 'success'
      });
      setNewTemplateName('');
      setShowSaveTemplateForm(false);
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ في الحفظ' : 'Save Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      setIsSavingFilterTemplate(false);
    }
  };

  const handleDeleteFilterTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا القالب الذكي؟' : 'Are you sure you want to delete this custom template?')) return;
    try {
      await deleteDoc(doc(db, 'report_templates', templateId));
      notificationService.notify({
        title: isAr ? 'تم الحذف' : 'Deleted',
        message: isAr ? 'تمت إزالة قالب الفلترة بنجاح' : 'Custom filter template layout deleted successfully',
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ في الحذف' : 'Delete Error',
        message: err.message,
        type: 'error'
      });
    }
  };

  const handleApplyFilterTemplate = (template: any) => {
    setActiveReport(template.activeReport);
    if (template.filters) {
      setFilters(template.filters);
    }
    if (template.sortBy) setSortBy(template.sortBy);
    if (template.sortOrder) setSortOrder(template.sortOrder);
    if (template.searchTerm !== undefined) setSearchTerm(template.searchTerm);

    setSelectedOrderId(template.selectedOrderId || null);
    setSelectedCustomerId(template.selectedCustomerId || null);
    setSelectedCourierId(template.selectedCourierId || null);
    setSelectedCompanyId(template.selectedCompanyId || null);
    setSelectedUserId(template.selectedUserId || null);
    setSelectedExpenseCategory(template.selectedExpenseCategory || null);

    notificationService.notify({
      title: isAr ? 'تم تطبيق القالب' : 'Template Applied',
      message: isAr ? `تم تنشيط الفلترة والترتيب بناءً على القالب: ${template.name}` : `Active filters applied for ${template.name}`,
      type: 'success'
    });
  };

  // Reset drilldowns when active report tab changes to avoid state pollution
  useEffect(() => {
    setSelectedOrderId(null);
    setSelectedCustomerId(null);
    setSelectedCourierId(null);
    setSelectedCompanyId(null);
    setSelectedUserId(null);
    setSelectedExpenseCategory(null);
  }, [activeReport]);

  // Fetch Core collections from db
  useEffect(() => {
    if (roleLoading) return;

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap: any) => {
      setOrders(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubExp = onSnapshot(collection(db, 'expenses'), (snap: any) => {
      setExpenses(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubCouriers = onSnapshot(collection(db, 'couriers'), (snap: any) => {
      setCouriers(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap: any) => {
      setCustomers(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubSources = onSnapshot(collection(db, 'sources'), (snap: any) => {
      setSources(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap: any) => {
      setUsers(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAccounts = onSnapshot(collection(db, 'accounts'), (snap: any) => {
      setAccounts(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubShipping = onSnapshot(collection(db, 'shipping_companies'), (snap: any) => {
      setShippingCompanies(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch custom report templates
    const unsubReportTemplates = onSnapshot(collection(db, 'report_templates'), (snap: any) => {
      setSavedReportTemplates(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Print Settings
    onSnapshot(doc(db, 'settings', 'print_template'), (snap) => {
      if (snap.exists()) {
        setPrintSettings(prev => ({ ...prev, ...snap.data() }));
      }
    });

    setLoading(false);

    return () => {
      unsubOrders();
      unsubExp();
      unsubCouriers();
      unsubCustomers();
      unsubSources();
      unsubUsers();
      unsubAccounts();
      unsubShipping();
      unsubReportTemplates();
    };
  }, [roleLoading]);

  // Fetch detailed account transactions when account ID is selected or packaging/orders_cost/shipping_companies report is active
  useEffect(() => {
    const isPackagingReport = activeReport === 'packaging';
    const isOrdersCostReport = activeReport === 'orders_cost';
    const isShippingCompaniesReport = activeReport === 'shipping_companies';
    const isAccountLedgerReport = activeReport === 'account_ledger';
    const hasActiveDrilldown = !!(selectedCustomerId || selectedCourierId || selectedUserId || selectedOrderId || selectedExpenseCategory);

    if (!filters.accountId && !filters.entityId && !isPackagingReport && !isOrdersCostReport && !isShippingCompaniesReport && !hasActiveDrilldown) {
      setAccountTransactions([]);
      return;
    }

    const packagingAccountId = accounts.find(a => a.entityId === 'sys_packaging_fees')?.id;
    const targetAccountId = filters.accountId ||
      (filters.entityId && isAccountLedgerReport ? accounts.find(a => a.entityId === filters.entityId)?.id : null) ||
      (isPackagingReport ? packagingAccountId : null);

    const qTx = query(
      collection(db, 'account_transactions'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(qTx, (snap) => {
      const allTxs = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as any[];
      const filtered = allTxs.filter((tx: any) => {
        const txDate = new Date(tx.createdAt);
        const start = startOfDay(new Date(filters.startDate));
        const end = endOfDay(new Date(filters.endDate));
        const dateInRange = isWithinInterval(txDate, { start, end });
        if (!dateInRange) return false;

        const selectedAccount = targetAccountId ? accounts.find(a => a.id === targetAccountId) : null;
        if (targetAccountId) {
          if (selectedAccount) {
            const isTargetPackaging = selectedAccount.entityId === 'sys_packaging_fees' || selectedAccount.accountCode === '5100-7355';

            const matchesIdOrCode = tx.accountId === targetAccountId || tx.accountCode === selectedAccount.accountCode;
            const matchesEntity = selectedAccount.entityId && (tx.entityId === selectedAccount.entityId || tx.accountId === selectedAccount.entityId);
            const matchesPackaging = isTargetPackaging && (tx.accountId === 'sys_packaging_fees' || tx.entityId === 'sys_packaging_fees');

            if (matchesIdOrCode || matchesEntity || matchesPackaging) {
              return true;
            }
          }
          if (isAccountLedgerReport) return false;
        }

        const activeEntityId = filters.entityId || selectedCustomerId || selectedCourierId || selectedUserId;
        const activeEntityAccIds = accounts.filter(a => a.entityId === activeEntityId || a.id === activeEntityId).map(a => a.id);
        if (activeEntityId && (
          tx.entityId === activeEntityId ||
          tx.accountId === activeEntityId ||
          activeEntityAccIds.includes(tx.accountId)
        )) return true;

        if (selectedOrderId) {
          const o = orders.find(ord => ord.id === selectedOrderId || ord.orderNumber === selectedOrderId);
          if (tx.refNumber === selectedOrderId || tx.description?.includes(selectedOrderId) || (o && (tx.refNumber === o.orderNumber || tx.description?.includes(o.orderNumber)))) {
            return true;
          }
        }

        if (selectedCustomerId) {
          const cust = customers.find(c => c.id === selectedCustomerId);
          const custAccIds = accounts.filter(a => a.entityType === 'customer' && a.entityId === selectedCustomerId).map(a => a.id);
          if (cust && (
            tx.entityId === selectedCustomerId ||
            custAccIds.includes(tx.accountId) ||
            tx.description?.includes(cust.fullName) ||
            (cust.phone && tx.description?.includes(cust.phone))
          )) return true;
        }

        if (selectedCourierId) {
          const cour = couriers.find(c => c.id === selectedCourierId);
          const courAccIds = accounts.filter(a => a.entityType === 'courier' && a.entityId === selectedCourierId).map(a => a.id);
          if (cour && (
            tx.entityId === selectedCourierId ||
            courAccIds.includes(tx.accountId) ||
            tx.description?.includes(cour.fullName) ||
            (cour.phone && tx.description?.includes(cour.phone))
          )) return true;
        }

        if (selectedUserId) {
          const u = users.find(usr => usr.id === selectedUserId);
          const userAccIds = accounts.filter(a => a.entityType === 'employee' && a.entityId === selectedUserId).map(a => a.id);
          if (u && (
            tx.entityId === selectedUserId ||
            userAccIds.includes(tx.accountId) ||
            tx.description?.includes(u.fullName) ||
            tx.description?.includes(u.displayName)
          )) return true;
        }

        if (selectedExpenseCategory) {
          const catObj = EXPENSE_CATEGORIES_DYNAMIC.find(c => c.id === selectedExpenseCategory);
          const linkedAccount = accounts.find(a =>
            (catObj?.accountId && (a.id === catObj.accountId || a.entityId === catObj.accountId)) ||
            (catObj?.accountCode && a.accountCode === catObj.accountCode)
          );
          if (linkedAccount && (tx.accountId === linkedAccount.id || tx.entityId === linkedAccount.entityId || tx.accountId === linkedAccount.entityId)) {
            return true;
          }
        }

        if (isPackagingReport && (
          selectedPackagingAccountIds.includes(tx.accountId) ||
          tx.accountId === packagingAccountId ||
          tx.accountId === 'sys_packaging_fees' ||
          tx.entityId === 'sys_packaging_fees' ||
          tx.accountCode === '5100-7355'
        )) return true;

        if (isOrdersCostReport && (
          selectedOrdersCostAccountIds.includes(tx.accountId)
        )) return true;

        if (isShippingCompaniesReport && (
          selectedShippingCompaniesAccountIds.includes(tx.accountId)
        )) return true;

        return false;
      });
      setAccountTransactions(filtered);
    });

    return () => unsub();
  }, [filters.accountId, filters.entityId, filters.startDate, filters.endDate, accounts, activeReport, selectedCustomerId, selectedCourierId, selectedUserId, selectedOrderId, selectedExpenseCategory, orders, customers, users, EXPENSE_CATEGORIES_DYNAMIC, selectedPackagingAccountIds, selectedOrdersCostAccountIds, selectedShippingCompaniesAccountIds]);

  // Save changes to print settings template in Firestore 
  const handleSavePrintSettings = async () => {
    setSavingTemplate(true);
    try {
      await setDoc(doc(db, 'settings', 'print_template'), printSettings);
      notificationService.notify({
        title: isAr ? 'تم الحفظ بنجاح' : 'Settings Saved',
        message: isAr ? 'تم تحديث قالب الطباعة وإعدادات الفواتير بنجاح' : 'Print templates updated successfully.',
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ في الحفظ' : 'Save Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  // Process data matching filters
  const filteredData = useMemo(() => {
    const start = startOfDay(new Date(filters.startDate));
    const end = endOfDay(new Date(filters.endDate));

    const checkInterval = (timestamp: number) => {
      if (!timestamp) return false;
      return isWithinInterval(new Date(timestamp), { start, end });
    };

    let fOrders = orders.filter(o => checkInterval(o.createdAt || 0));
    let fExpenses = expenses.filter(e => checkInterval(e.createdAt || 0));

    // Custom Category / Type expense filter
    if (activeReport === 'expenses') {
      if (filters.type && filters.type !== 'all') {
        fExpenses = fExpenses.filter(e => e.category === filters.type);
      }
    }

    // Secondary filters depending on report
    let fCustomers = customers;
    if (activeReport === 'customers' && filters.entityId) {
      fCustomers = customers.filter(c => c.id === filters.entityId);
    }

    let fCouriers = couriers;
    if (activeReport === 'couriers' && filters.entityId) {
      fCouriers = couriers.filter(co => co.id === filters.entityId);
    }

    let fUsers = users;
    if (activeReport === 'users' && filters.entityId) {
      fUsers = users.filter(u => u.id === filters.entityId);
    }

    // Apply Sorting
    const sortFn = (a: any, b: any) => {
      let valA = a.createdAt || 0;
      let valB = b.createdAt || 0;
      if (sortBy === 'amount') {
        valA = parseFloat(a.amount || a.totalPrice || 0);
        valB = parseFloat(b.amount || b.totalPrice || 0);
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    };

    return {
      orders: fOrders.sort(sortFn),
      expenses: fExpenses.sort(sortFn),
      couriers: fCouriers,
      customers: fCustomers,
      users: fUsers,
      shippingCompanies
    };
  }, [orders, expenses, couriers, customers, users, shippingCompanies, filters, sortOrder, sortBy, activeReport]);

  const reportMetrics = useMemo(() => {
    // 1. Identify specific system account IDs and codes
    const profitAcc = accounts.find(a => a.entityId === 'sys_profit_account');
    const pkgAcc = accounts.find(a => a.entityId === 'sys_packaging_fees');
    const sourcingAcc = accounts.find(a => a.entityId === 'sys_sourcing_cost');
    const shippingAcc = accounts.find(a => a.entityId === 'sys_shipping_costs');
    const deliveryAcc = accounts.find(a => a.entityId === 'sys_delivery_cost');

    const profitAccId = profitAcc?.id || 'sys_profit_account';
    const pkgAccId = pkgAcc?.id || 'sys_packaging_fees';
    const sourcingAccId = sourcingAcc?.id || 'sys_sourcing_cost';
    const shippingAccId = shippingAcc?.id || 'sys_shipping_costs';
    const deliveryAccId = deliveryAcc?.id || 'sys_delivery_cost';

    // 2. Compute Revenue (Credit - Debit on Revenue accounts)
    const revenue = allAccountTransactions
      .filter(tx => tx.accountCode?.startsWith('4') || tx.accountCode?.startsWith('REV'))
      .reduce((sum, tx) => sum + (tx.type === 'Credit' ? convertToYER(parseFloat(tx.amountOriginal) || 0, tx.currencyOriginal || 'YER') : -convertToYER(parseFloat(tx.amountOriginal) || 0, tx.currencyOriginal || 'YER')), 0);

    // 3. Compute Costs (Debit - Credit on Expense accounts)
    const costs = allAccountTransactions
      .filter(tx => tx.accountCode?.startsWith('5') || tx.accountCode?.startsWith('EXP'))
      .reduce((sum, tx) => sum + (tx.type === 'Debit' ? convertToYER(parseFloat(tx.amountOriginal) || 0, tx.currencyOriginal || 'YER') : -convertToYER(parseFloat(tx.amountOriginal) || 0, tx.currencyOriginal || 'YER')), 0);

    /* const costs = allAccountTransactions
       .filter(a => a.accountCode?.startsWith('5') || a.accountCode?.startsWith('EXP'))
       .reduce((sum, a) => {
         const balance = parseFloat(a.balance as any) || 0;
         const converted = financialAccountService.convertToDefaultCurrency(
           balance,
           a.currency || 'YER',
           settings.currency || 'YER',
           { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
         );
         return sum + converted;
       }, 0);*/

    const profit = revenue - costs;

    // 4. Compute specific sub-costs for charts with proper fallbacks
    const sourcingCosts = allAccountTransactions
      .filter(tx => tx.accountId === sourcingAccId || tx.accountCode === '5100-4483')
      .reduce((sum, tx) => sum + (tx.type === 'Debit' ? convertToYER(parseFloat(tx.amount) || 0, tx.currencyOriginal || tx.currency || 'YER') : -convertToYER(parseFloat(tx.amount) || 0, tx.currencyOriginal || tx.currency || 'YER')), 0);

    const shippingCosts = allAccountTransactions
      .filter(tx => tx.accountId === shippingAccId || tx.accountCode === '5000-1122' || tx.accountCode === '5300-7118')
      .reduce((sum, tx) => sum + (tx.type === 'Debit' ? convertToYER(parseFloat(tx.amount) || 0, tx.currencyOriginal || tx.currency || 'YER') : -convertToYER(parseFloat(tx.amount) || 0, tx.currencyOriginal || tx.currency || 'YER')), 0);

    const deliveryCosts = allAccountTransactions
      .filter(tx => tx.accountId === deliveryAccId || tx.accountCode === '5000-2788')
      .reduce((sum, tx) => sum + (tx.type === 'Debit' ? convertToYER(parseFloat(tx.amount) || 0, tx.currencyOriginal || tx.currency || 'YER') : -convertToYER(parseFloat(tx.amount) || 0, tx.currencyOriginal || tx.currency || 'YER')), 0);

    const packagingCosts = allAccountTransactions
      .filter(tx => tx.accountId === pkgAccId || tx.accountCode === '5100-7355')
      .reduce((sum, tx) => sum + (tx.type === 'Credit' ? convertToYER(parseFloat(tx.amount) || 0, tx.currencyOriginal || tx.currency || 'YER') : -convertToYER(parseFloat(tx.amount) || 0, tx.currencyOriginal || tx.currency || 'YER')), 0); // Treated as collected revenue offset

    const salaryCosts = allAccountTransactions
      .filter(tx => tx.accountCode?.startsWith('2130') || tx.module === 'salary')
      .reduce((sum, tx) => sum + (tx.type === 'Debit' ? convertToYER(parseFloat(tx.amountOriginal) || 0, tx.currencyOriginal || 'YER') : -convertToYER(parseFloat(tx.amountOriginal) || 0, tx.currencyOriginal || 'YER')), 0);

    const operationalCosts = Math.max(0, costs - (sourcingCosts + shippingCosts + deliveryCosts + salaryCosts));

    return {
      revenue,
      costs,
      profit,
      packagingCosts,
      operationalCosts,
      shippingCosts,
      salaryCosts
    };
  }, [allAccountTransactions, accounts]);

  const treasuryBalances = useMemo(() => {
    let yerIn = 0, yerOut = 0;
    let usdIn = 0, usdOut = 0;
    let sarIn = 0, sarOut = 0;

    /*const cashAccount = accounts.find(a => a.entityId === 'sys_cash_account');
    if (cashAccount) {
      allTimeTransactions.forEach(tx => {
        if (tx.accountId === cashAccount.id) {
          const amt = parseFloat(tx.amountOriginal || tx.amount || 0);
          const cur = tx.currencyOriginal || tx.currency || 'YER';

          if (cur === 'YER') {
            if (tx.type === 'Debit') yerIn += amt;
            if (tx.type === 'Credit') yerOut += amt;
          } else if (cur === 'USD') {
            if (tx.type === 'Debit') usdIn += amt;
            if (tx.type === 'Credit') usdOut += amt;
          } else if (cur === 'SAR') {
            if (tx.type === 'Debit') sarIn += amt;
            if (tx.type === 'Credit') sarOut += amt;
          }
        }
      });
    }*/
    const cashAccountYER = accounts.find(a => a.accountCode === '1111-0');
    const cashAccountusd = accounts.find(a => a.accountCode === '1110-1');
    const cashAccountSAR = accounts.find(a => a.accountCode === '1110-2');
    if (cashAccountYER && cashAccountusd && cashAccountSAR) {
      allTimeTransactions.forEach(tx => {
        if (tx.accountCode === cashAccountYER.accountCode) {
          const amtyer = parseFloat(tx.amount || 0);
          const cur = tx.currency || 'YER'
          if (tx.type === 'Debit') yerIn += amtyer;
          if (tx.type === 'Credit') yerOut += amtyer;
        }
        else if (tx.accountCode === cashAccountusd.accountCode) {
          const amtusd = parseFloat(tx.amount || 0);
          const cur = tx.currency || 'USD'
          if (tx.type === 'Debit') usdIn += amtusd;
          if (tx.type === 'Credit') usdOut += amtusd;
        }
        else if (tx.accountCode === cashAccountSAR.accountCode) {
          const amtsar = parseFloat(tx.amount || 0);
          const cur = tx.currency || 'SAR';
          if (tx.type === 'Debit') sarIn += amtsar;
          if (tx.type === 'Credit') sarOut += amtsar;

        }
      });
    };
    const yerBalance = yerIn - yerOut;
    const usdBalance = usdIn - usdOut;
    const sarBalance = sarIn - sarOut;

    const usdToYer = usdBalance * (dbRates.USD || 1);
    const sarToYer = sarBalance * (dbRates.SAR || 1);
    const combinedTotalYER = yerBalance + usdToYer + sarToYer;

    return {
      yer: { in: yerIn, out: yerOut, balance: yerBalance },
      usd: { in: usdIn, out: usdOut, balance: usdBalance },
      sar: { in: sarIn, out: sarOut, balance: sarBalance },
      combinedTotalYER
    };
  }, [allTimeTransactions, accounts, settings]);

  const ledgerMetrics = useMemo(() => {
    if (activeReport !== 'account_ledger' || !filters.accountId) return null;
    const selectedAccount = accounts.find(a => a.id === filters.accountId);
    if (!selectedAccount) return null;

    const start = startOfDay(new Date(filters.startDate));
    const end = endOfDay(new Date(filters.endDate));

    const isDebitNormal = (code: string) => {
      const cleanCode = (code || '').trim().toUpperCase();
      if (cleanCode.startsWith('1') || cleanCode.startsWith('5') || cleanCode.startsWith('AST') || cleanCode.startsWith('EXP')) return true;
      return false;
    };
    const debitNormal = isDebitNormal(selectedAccount.accountCode);

    // Get all transactions of all time for this account
    const myAllTimeTxs = allTimeTransactions.filter((tx: any) => {
      const matchesIdOrCode = tx.accountId === selectedAccount.id || tx.accountCode === selectedAccount.accountCode;
      const matchesEntity = selectedAccount.entityId && (tx.entityId === selectedAccount.entityId || tx.accountId === selectedAccount.entityId);
      const isTargetPackaging = selectedAccount.entityId === 'sys_packaging_fees' || selectedAccount.accountCode === '5100-7355';
      const matchesPackaging = isTargetPackaging && (tx.accountId === 'sys_packaging_fees' || tx.entityId === 'sys_packaging_fees');
      return matchesIdOrCode || matchesEntity || matchesPackaging;
    });

    // Sort chronologically (oldest first) to compute running balance
    const sortedAllTime = [...myAllTimeTxs].sort((a, b) => a.createdAt - b.createdAt);

    let openingBalance = 0;
    let periodDebits = 0;
    let periodCredits = 0;

    sortedAllTime.forEach(tx => {
      const txDate = new Date(tx.createdAt);
      const amt = parseFloat(tx.amount) || 0;
      if (txDate < start) {
        if (tx.type === 'Debit') {
          openingBalance += debitNormal ? amt : -amt;
        } else {
          openingBalance += debitNormal ? -amt : amt;
        }
      } else if (isWithinInterval(txDate, { start, end })) {
        if (tx.type === 'Debit') {
          periodDebits += amt;
        } else {
          periodCredits += amt;
        }
      }
    });

    const closingBalance = openingBalance + (debitNormal ? (periodDebits - periodCredits) : (periodCredits - periodDebits));

    let currentRunning = openingBalance;
    const rowsWithRunningBalance = sortedAllTime
      .filter(tx => {
        const txDate = new Date(tx.createdAt);
        return isWithinInterval(txDate, { start, end });
      })
      .map(tx => {
        const amt = parseFloat(tx.amount) || 0;
        if (tx.type === 'Debit') {
          currentRunning += debitNormal ? amt : -amt;
        } else {
          currentRunning += debitNormal ? -amt : amt;
        }
        return {
          ...tx,
          runningBalance: currentRunning
        };
      });

    // reverse for display (newest first)
    const displayRows = [...rowsWithRunningBalance].reverse();

    return {
      selectedAccount,
      debitNormal,
      openingBalance,
      periodDebits,
      periodCredits,
      closingBalance,
      displayRows
    };
  }, [activeReport, filters.accountId, filters.startDate, filters.endDate, accounts, allTimeTransactions]);

  // Derived charts and tables lists based on search parameter 
  const searchMatchList = (list: any[], keyField: string) => {
    if (!searchTerm) return list;
    return list.filter(item =>
      String(item[keyField] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.companyName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Recharts representation config
  const pnlData = useMemo(() => {
    return [
      { name: isAr ? 'المبيعات اللوجستية' : 'Gross Revenue', value: reportMetrics.revenue },
      { name: isAr ? 'المصروفات والأجور' : 'Operating Cost', value: reportMetrics.costs },
      { name: isAr ? 'صافي الأرباح' : 'Corporate Profit', value: Math.max(0, reportMetrics.profit) },
    ];
  }, [reportMetrics, isAr]);

  // Export Report to XLSX natively (fully supports Arabic because of modern XML sheet representation)
  const handleExportExcel = async () => {
    let dataToExport: any[] = [];
    let title = activeReport;

    if (activeReport === 'expenses') {
      dataToExport = filteredData.expenses.map(e => ({
        [isAr ? 'رقم السند' : 'ID']: e.expenseNumber || '-',
        [isAr ? 'التاريخ' : 'Date']: format(new Date(e.createdAt || Date.now()), 'yyyy-MM-dd'),
        [isAr ? 'التصنيف' : 'Category']: e.category || '-',
        [isAr ? 'المستلم' : 'Recipient']: e.recipientName || '-',
        [isAr ? 'البيان' : 'Notes']: e.notes || '-',
        [isAr ? 'المبلغ' : 'Amount']: e.amount || 0,
        [isAr ? 'العملة' : 'Currency']: e.currency || 'SAR'
      }));
    } else if (activeReport === 'account_ledger' && ledgerMetrics) {
      dataToExport = [...ledgerMetrics.displayRows].reverse().map((tx) => {
        const amt = parseFloat(tx.amount) || 0;
        return {
          [isAr ? 'التاريخ' : 'Date']: format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm'),
          [isAr ? 'رقم القيد' : 'Ref']: tx.refNumber || '-',
          [isAr ? 'النوع' : 'Type']: tx.type === 'Debit' ? (isAr ? 'مدين / صادر' : 'Debit') : (isAr ? 'دائن / وارد' : 'Credit'),
          [isAr ? 'البيان الوصفي' : 'Description']: tx.description || '-',
          [isAr ? 'مدين (+)' : 'Debit']: tx.type === 'Debit' ? amt : 0,
          [isAr ? 'دائن (-)' : 'Credit']: tx.type === 'Credit' ? amt : 0,
          [isAr ? 'الرصيد التراكمي' : 'Running Balance']: tx.runningBalance
        };
      });
    } else if (activeReport === 'customers') {
      dataToExport = filteredData.customers.map(c => ({
        [isAr ? 'اسم العميل' : 'Customer']: c.fullName,
        [isAr ? 'الهاتف' : 'Phone']: c.phone || '-',
        [isAr ? 'العنوان' : 'Address']: c.address || '-',
        [isAr ? 'العملة المفضلة' : 'Currency']: c.financialCurrency || 'SAR',
        [isAr ? 'رصيد الحساب المالي' : 'Balance']: c.financialBalance || 0
      }));
    } else if (activeReport === 'couriers') {
      dataToExport = filteredData.couriers.map(c => ({
        [isAr ? 'اسم المندوب' : 'Courier Name']: c.fullName,
        [isAr ? 'الهاتف' : 'Phone']: c.phone || '-',
        [isAr ? 'طريقة الحساب' : 'Type']: c.courierType === 'sourcing' ? (isAr ? 'تجميع (سعودي)' : 'Sourcing') : (isAr ? 'توزيع (محلي)' : 'Local'),
        [isAr ? 'الرصيد المالي الحالي' : 'Financial Balance']: c.financialBalance || 0,
        [isAr ? 'رصيد العهدة المعلقة' : 'Outstanding Custody']: c.outstandingCustody || 0,
        [isAr ? 'العملة' : 'Currency']: c.financialCurrency || 'SAR'
      }));
    } else if (activeReport === 'shipping_companies') {
      dataToExport = filteredData.shippingCompanies.map(sc => ({
        [isAr ? 'شركة الشحن' : 'Shipping Co']: sc.name,
        [isAr ? 'الهاتف' : 'Phone']: sc.phone || '-',
        [isAr ? 'الموقع' : 'Type']: sc.type || '-'
      }));
    } else if (activeReport === 'users') {
      dataToExport = filteredData.users.map(u => ({
        [isAr ? 'الاسم الكامل' : 'Staff Name']: u.fullName || u.displayName || '-',
        [isAr ? 'البريد الإلكتروني' : 'Email']: u.email || '-',
        [isAr ? 'الصلاحية وظيفة' : 'Role']: u.role || '-',
        [isAr ? 'الراتب الشهري الأساسي' : 'Basic Monthly Salary']: u.monthlySalary || 0
      }));
    } else if (activeReport === 'packaging') {
      const expensesPart = filteredData.expenses.filter(e => e.category === 'PACKAGING').map(e => ({
        [isAr ? 'النوع المالي' : 'Fin Type']: isAr ? 'مصروف / خرج' : 'Expense',
        [isAr ? 'السند/رقم الطلب' : 'ID']: e.expenseNumber,
        [isAr ? 'التاريخ' : 'Date']: format(new Date(e.createdAt || Date.now()), 'yyyy-MM-dd'),
        [isAr ? 'البيان / الشرح' : 'Notes']: e.notes || '-',
        [isAr ? 'الجهة المستلمة' : 'Recipient']: e.recipientName || '-',
        [isAr ? 'المبلغ الفعلي' : 'Amount']: e.amount || 0,
        [isAr ? 'العملة' : 'Currency']: e.currency
      }));

      const ordersPart = filteredData.orders.filter(o => o.orderStatus !== 'Cancelled' && (parseFloat(o.packagingFee) || 0) > 0).map(o => ({
        [isAr ? 'النوع المالي' : 'Fin Type']: isAr ? 'إيراد / رسوم محصلة' : 'Income',
        [isAr ? 'السند/رقم الطلب' : 'ID']: o.orderNumber,
        [isAr ? 'التاريخ' : 'Date']: format(new Date(o.createdAt || Date.now()), 'yyyy-MM-dd'),
        [isAr ? 'البيان / الشرح' : 'Notes']: isAr ? `رسوم تغليف شحنة للعميل` : `Order packaging fee`,
        [isAr ? 'الجهة المستلمة' : 'Recipient']: o.customerName || '-',
        [isAr ? 'المبلغ الفعلي' : 'Amount']: o.packagingFee || 0,
        [isAr ? 'العملة' : 'Currency']: 'SAR'
      }));

      dataToExport = [...expensesPart, ...ordersPart];
    } else {
      // default orders report
      dataToExport = filteredData.orders.map(o => ({
        [isAr ? 'رقم الطلب' : 'Order Num']: o.orderNumber,
        [isAr ? 'التاريخ' : 'Date']: format(new Date(o.createdAt || Date.now()), 'yyyy-MM-dd'),
        [isAr ? 'اسم العميل' : 'Customer']: o.customerName,
        [isAr ? 'حالة الطلب' : 'Status']: o.orderStatus,
        [isAr ? 'تكلفة الطلب الصافي' : 'Total']: o.totalPrice || 0,
        [isAr ? 'قيمة التغليف' : 'Packaging']: o.packagingFee || 0,
        [isAr ? 'المبلغ المستلم' : 'Paid']: o.amountPaid || 0,
        [isAr ? 'المتبقي ذمة' : 'Remaining']: o.amountRemaining || 0
      }));
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    // Ensure sheet correctly aligns right-to-left for Arabic 
    if (isAr) {
      ws['!dir'] = 'rtl';
    }

    const fileName = `alx_Report_${title}_${filters.startDate}.xlsx`;

    // ─── Electron: use native Save dialog ──────────────────────────────
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.saveFile) {
      try {
        // XLSX.write returns a Uint8Array buffer
        const buffer: Uint8Array = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        const result = await electronAPI.saveFile({
          defaultName: fileName,
          filters: [
            { name: 'Excel Files', extensions: ['xlsx'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          buffer: Array.from(buffer)  // Transfer as plain array via IPC
        });

        if (!result.success) {
          if (result.reason !== 'canceled') {
            notificationService.notify({
              title: isAr ? 'خطأ في الحفظ' : 'Save Error',
              message: result.reason || (isAr ? 'فشل حفظ الملف' : 'Failed to save file'),
              type: 'error'
            });
          }
          return;
        }

        notificationService.notify({
          title: isAr ? 'تم تصدير الدفتر بنجاح' : 'Export Successful',
          message: isAr
            ? `تم إنشاء كشوف السجلات وحفظها بنجاح في: ${result.filePath}`
            : `Financial spreadsheet saved to: ${result.filePath}`,
          type: 'success'
        });
        return;
      } catch (ipcErr: any) {
        console.warn('[Export] Electron IPC save failed, falling back to browser download:', ipcErr);
      }
    }

    // ─── Browser fallback (web / dev mode) ─────────────────────────────
    XLSX.writeFile(wb, fileName);

    notificationService.notify({
      title: isAr ? 'تم تصدير الدفتر بنجاح' : 'Success',
      message: isAr ? 'تم إنشاء كشوف السجلات وتنزيلها بصيغة XLSX احترافية' : 'Financial Spreadsheet compiled and downloaded.',
      type: 'success'
    });
  };

  // Modern Native Print implementation — Electron aware
  const triggerNativePrint = async () => {
    const electronAPI = (window as any).electronAPI;

    // ─── Electron: use WebContents print API ───────────────────────────
    if (electronAPI?.printPage) {
      try {
        // Determine page settings from printSettings
        const isLandscape = (printSettings.paperSize as string) === 'A4_Landscape';
        const isReceipt = printSettings.paperSize === '80mm' || printSettings.paperSize === '58mm';
        const result = await electronAPI.printPage({
          silent: false,
          printBackground: true,
          pageSize: isReceipt ? 'A5' : 'A4',
          landscape: isLandscape,
          marginTop: printSettings.margins === 'none' ? 0 : printSettings.margins === 'minimal' ? 5 : 10,
          marginBottom: printSettings.margins === 'none' ? 0 : printSettings.margins === 'minimal' ? 5 : 10,
          marginLeft: printSettings.margins === 'none' ? 0 : printSettings.margins === 'minimal' ? 5 : 10,
          marginRight: printSettings.margins === 'none' ? 0 : printSettings.margins === 'minimal' ? 5 : 10,
        });
        if (!result.success) {
          console.warn('[Print] Electron print failed:', result.reason);
          // Fallback to window.print()
          window.print();
        }
        return;
      } catch (err) {
        console.warn('[Print] Electron IPC print failed, fallback:', err);
      }
    }

    // ─── Browser fallback ───────────────────────────────────────────────
    const reportTitle = isAr ? 'تقرير نظام ALX' : 'ALX System Report';
    printContent(reportTitle, 'print-invoice-canvas', isAr);
  };

  if (loading || roleLoading) {
    return (
      <div className="flex bg-[#0a0a0c] text-white h-[85vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d4af37]/10 border-t-[#d4af37]"></div>
          <span className="text-xs font-bold text-slate-500 animate-pulse">{isAr ? 'مستودع السجلات والمزامنة قيد التحميل...' : 'Synchronizing Vault Nodes...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 text-start font-sans relative w-full max-w-full overflow-hidden">

      {/* Arabic Print-Friendly Stylesheet overrides browser default layout during printing */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          /* Hide everything except the print canvas wrapper */
          body * {
            visibility: hidden;
            background: transparent !important;
          }
          #print-invoice-canvas, #print-invoice-canvas * {
            visibility: visible;
          }
          #print-invoice-canvas {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: white !important;
            color: black !important;
            font-family: "${printSettings.fontFamily || 'Cairo'}", sans-serif !important;
            padding: ${printSettings.margins === 'none' ? '0mm' : printSettings.margins === 'minimal' ? '5mm' : '12mm'} !important;
            box-shadow: none !important;
            border: none !important;
            direction: rtl !important;
            font-size: ${printSettings.fontSize === 'xs' ? '10px' : printSettings.fontSize === 'sm' ? '12px' : printSettings.fontSize === 'md' ? '14px' : '16px'} !important;
          }
          /* Custom sizes overrides */
          ${printSettings.paperSize === '80mm' ? `
            @page { size: 80mm auto; margin: 0; }
            #print-invoice-canvas { width: 80mm !important; }
          ` : printSettings.paperSize === '58mm' ? `
            @page { size: 58mm auto; margin: 0; }
            #print-invoice-canvas { width: 58mm !important; }
          ` : printSettings.paperSize === 'A4_Landscape' ? `
            @page { size: A4 landscape; margin: 10mm; }
          ` : `
            @page { size: A4; margin: 10mm; }
          `}
          .no-print {
            display: none !important;
          }
        }
      ` }} />

      {/* Modern Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-6 rounded-3xl shadow-lg relative overflow-hidden gap-4 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-3 rounded-2xl text-[#d4af37]">
            <Layers className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white leading-none mb-1">
              {isAr ? 'الإدارة المالية والقوالب الذكية' : 'Financial Hub & Templates'}
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">
              {isAr ? 'كشوف عهد ذمم مستقلة • مصادقة القيود • محرر تصاميم الفواتير والحراريات' : 'Enterprise Ledgering • Dynamic Print Templates'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs between Reports View and Report Settings Template Edit */}
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-900 self-stretch md:self-auto justify-stretch">
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${activeTab === 'reports' ? 'bg-[#d4af37] text-black' : 'text-slate-400 hover:text-white'}`}
          >
            <Layers className="w-4 h-4" />
            {isAr ? 'السجلات والتقارير' : 'Analytical Reports'}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${activeTab === 'templates' ? 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20' : 'text-slate-400 hover:text-white'}`}
          >
            <SettingsIcon className="w-4 h-4" />
            {isAr ? 'إعدادات قوالب الطباعة' : 'Templates Config'}
          </button>
        </div>
      </div>

      {activeTab === 'reports' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start no-print">

          {/* LEFT: Reports Tree Menu Navigation Sidebar */}
          <div className="lg:col-span-4 bg-[#111114] border border-slate-850 p-3 rounded-3xl space-y-1 block">
            <h3 className="px-4 py-2 text-[10px] font-black text-slate-550 uppercase tracking-widest border-b border-slate-850/40 mb-2">
              {isAr ? 'سجلات النظام المحاسبية والتقريرية' : 'Ledger Categories'}
            </h3>
            <div className="space-y-1">
              {REPORT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setActiveReport(type.id);
                    // Reset selected filters corresponding to switch
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

            {/* Micro summary */}
            <div className="pt-4 mt-2 border-t border-slate-850 p-3 space-y-2 text-xs">
              <span className="text-[10px] font-black text-slate-550 block uppercase">{isAr ? 'مستخلص التدقيق الحالي' : 'Live Sync Health'}</span>
              <div className="flex justify-between text-slate-400">
                <span>{isAr ? 'إجمالي فواتير الطلبات:' : 'Total Orders:'}</span>
                <span className="font-mono font-bold text-white">{orders.length}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{isAr ? 'إجمالي سندات الصرف:' : 'Total Receipts:'}</span>
                <span className="font-mono font-bold text-white">{expenses.length}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{isAr ? 'شجرة الحسابات النشطة:' : 'Chart Nodes:'}</span>
                <span className="font-mono font-bold text-[#d4af37]">{accounts.length}</span>
              </div>
            </div>

            {/* Saved Custom templates list */}
            <div className="pt-4 mt-4 border-t border-slate-850 p-3 space-y-2 text-xs">
              <span className="text-[10px] font-black text-slate-550 block uppercase flex items-center gap-1.5">
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

          {/* RIGHT: Analytical content panels */}
          <div className="lg:col-span-8 space-y-6">

            {/* Context Filters */}
            <div className="bg-[#111114] border border-slate-850 p-5 rounded-3xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-black text-[#d4af37] uppercase flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  {isAr ? 'مصفاة البيانات الاحترافية' : 'Professional Filter Deck'}
                </span>

                {/* Export/Template controls */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowSaveTemplateForm(!showSaveTemplateForm)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${showSaveTemplateForm
                      ? 'bg-rose-500/10 border-rose-500/35 text-rose-400'
                      : 'bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400'
                      }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    {isAr ? 'حفظ الفلترة الحالية كقالب' : 'Save Preset'}
                  </button>
                  <button
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/35 text-[#d4af37] rounded-xl text-xs font-black transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {isAr ? 'معاينة وطباعة القالب' : 'Paper Config'}
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 text-emerald-400 rounded-xl text-xs font-black transition-all"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    {isAr ? 'تصدير Excel' : 'Excel'}
                  </button>
                </div>
              </div>

              {/* Saved Configuration Inline Form */}
              {showSaveTemplateForm && (
                <div className="bg-slate-950/60 border border-[#d4af37]/25 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center gap-3 animate-fade-slide-in">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-black text-[#d4af37] uppercase block">{isAr ? 'اسم القالب المخصص للطلب الحالي' : 'Custom Template Name'}</label>
                    <input
                      type="text"
                      placeholder={isAr ? 'مثال: تقرير مبيعات الربع الأول للمندوب رائد' : 'e.g. Q1 Sales Report for Courier Raed'}
                      value={newTemplateName}
                      onChange={e => setNewTemplateName(e.target.value)}
                      className="w-full bg-[#111114] border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]"
                    />
                  </div>
                  <div className="flex items-end gap-2 shrink-0 self-end md:self-auto pt-3 md:pt-0">
                    <button
                      onClick={handleSaveFilterTemplate}
                      disabled={isSavingFilterTemplate}
                      className="px-4 py-2 bg-[#d4af37] hover:bg-yellow-600 disabled:opacity-50 text-black text-xs font-black rounded-xl transition flex items-center gap-1.5"
                    >
                      {isSavingFilterTemplate ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {isAr ? 'حفظ بـ Cloud' : 'Save to Cloud'}
                    </button>
                    <button
                      onClick={() => { setShowSaveTemplateForm(false); setNewTemplateName(''); }}
                      className="px-4 py-2 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date range picker - Start */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 px-1 uppercase block">{isAr ? 'تاريخ البدء' : 'Date range start'}</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
                    />
                  </div>
                </div>

                {/* Date range picker - End */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-550 px-1 uppercase block">{isAr ? 'تاريخ نهاية المدى' : 'Date range end'}</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
                    />
                  </div>
                </div>

                {/* Conditional configuration based on active sidebar selected report */}
                {activeReport === 'expenses' ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 px-1 uppercase block">{isAr ? 'التصنيف المحاسبي' : 'Accounting Class'}</label>
                    <select
                      value={filters.type}
                      onChange={e => setFilters(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
                    >
                      <option value="all">{isAr ? 'جميع التصنيفات' : 'All Categories'}</option>
                      {EXPENSE_CATEGORIES_DYNAMIC.map(cat => (
                        <option key={cat.id} value={cat.id}>{isAr ? cat.labelAr : cat.labelEn}</option>
                      ))}
                    </select>
                  </div>
                ) : activeReport === 'account_ledger' ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-550 px-1 uppercase block">{isAr ? 'تحديد الحساب المالي المباشر' : 'Select Chart Ledger'}</label>
                    <select
                      value={filters.accountId || ''}
                      onChange={e => setFilters(prev => ({ ...prev, accountId: e.target.value }))}
                      className="w-full bg-rose-500/10 border border-rose-500/20 text-[#d4af37] rounded-xl px-3 py-2 text-xs font-black outline-none focus:border-[#d4af37]/40"
                    >
                      <option value="" className="text-black">-- {isAr ? 'اختر حساب للتدقيق' : 'Select Ledger Account'} --</option>
                      {accounts
                        .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
                        .map(acc => (
                          <option key={acc.id} value={acc.id} className="text-black">
                            [{acc.accountCode}] - {acc.entityName || acc.name} ({acc.currency || 'SAR'})
                          </option>
                        ))
                      }
                    </select>
                  </div>
                ) : ['customers', 'couriers', 'users'].includes(activeReport) ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-550 px-1 uppercase block">
                      {activeReport === 'customers' ? (isAr ? 'فلترة حسب العميل المحدد' : 'Filter by Customer') :
                        activeReport === 'couriers' ? (isAr ? 'فلترة حسب المندوب المحدد' : 'Filter by Courier') :
                          (isAr ? 'فلترة حسب الموظف' : 'Filter by User')}
                    </label>
                    <select
                      value={filters.entityId || ''}
                      onChange={e => setFilters(prev => ({ ...prev, entityId: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
                    >
                      <option value="">{isAr ? 'جميع الجهات السجلية (الكل)' : 'Show All'}</option>
                      {(activeReport === 'customers' ? customers : activeReport === 'couriers' ? couriers : users).map(entity => (
                        <option key={entity.id} value={entity.id} className="text-black">
                          {entity.fullName || entity.displayName || entity.email}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  // default search bar inside reports context
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-550 px-1 uppercase block">{isAr ? 'بحث سريع وعام' : 'Global searching match'}</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder={isAr ? 'ابحث هنا الاسم، رقم الهاتف، البيان' : 'Search keyword...'}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Sorting control */}
              {!['account_ledger'].includes(activeReport) && (
                <div className="flex items-center gap-3 pt-2 text-xs text-slate-400">
                  <span>{isAr ? 'ترتيب النتائج حسب:' : 'Sort results by:'}</span>
                  <button
                    onClick={() => setSortBy('date')}
                    className={`px-3 py-1 rounded-lg border transition-all ${sortBy === 'date' ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/35 font-bold' : 'border-slate-850 hover:text-white'}`}
                  >
                    {isAr ? 'التاريخ الفعلي' : 'Submission Date'}
                  </button>
                  <button
                    onClick={() => setSortBy('amount')}
                    className={`px-3 py-1 rounded-lg border transition-all ${sortBy === 'amount' ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/35 font-bold' : 'border-slate-850 hover:text-white'}`}
                  >
                    {isAr ? 'المقدار / السعر' : 'Monetary Value'}
                  </button>
                  <span className="text-slate-700">|</span>
                  <button
                    onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}
                    className="hover:text-white border border-slate-850 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1"
                  >
                    {sortOrder === 'desc' ? (isAr ? 'تنازلي (الأحدث/الأعلى)' : 'Descending') : (isAr ? 'تصاعدي (الأقدم/الأقل)' : 'Ascending')}
                  </button>
                </div>
              )}
            </div>

            {/* LIVE DISPLAY AREA */}
            <div className="bg-[#111114] border border-slate-850 rounded-3xl p-6 min-h-[450px]">

              {/* Financial Dashboard and Profit Metrics */}
              {activeReport === 'financial_overview' && (
                <div className="space-y-6">
                  {/* KPI card decks */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-gradient-to-br from-blue-950/20 to-slate-950 border border-blue-900/30 rounded-2xl relative">
                      <span className="text-[10px] text-slate-500 font-black block uppercase mb-1">{isAr ? 'إجمالي الايرادات' : 'Gross Revenue'}</span>
                      <span className="text-lg font-mono font-black text-blue-400">{reportMetrics.revenue.toLocaleString()} <span className="text-[9px] text-slate-500">YER</span></span>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 mt-2">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                        <span>{isAr ? 'سجل الإيرادات المؤكدة' : 'Audit aggregate'}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-rose-950/20 to-slate-950 border border-rose-900/30 rounded-2xl relative">
                      <span className="text-[10px] text-slate-500 font-black block uppercase mb-1">{isAr ? 'إجمالي المصاريف والمستندات' : 'Expenditures'}</span>
                      <span className="text-lg font-mono font-black text-rose-400">{reportMetrics.costs.toLocaleString()} <span className="text-[9px] text-slate-550">YER</span></span>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-500 mt-2">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
                        <span>{isAr ? 'سندات صرف تشغيلية ورواتب' : 'OpEx aggregate'}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-amber-950/10 to-slate-950 border border-amber-900/30 rounded-2xl relative">
                      <span className="text-[10px] text-slate-500 font-black block uppercase mb-1">{isAr ? 'صافي أرباح الشركة' : 'Net Corporate Profits'}</span>
                      <span className="text-lg font-mono font-black text-[#d4af37]">{reportMetrics.profit.toLocaleString()} <span className="text-[9px] text-slate-550">YER</span></span>
                      <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 mt-2">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isAr ? 'عائد السيولة الصافي' : 'Net liquidity'}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-[#121215] border border-slate-850 rounded-2xl">
                      <span className="text-[10px] text-slate-500 font-black block uppercase mb-1">{isAr ? 'هامش الأمان الربحي' : 'Profit Margin %'}</span>
                      <span className="text-lg font-mono font-black text-emerald-400">
                        {reportMetrics.revenue > 0 ? ((reportMetrics.profit / reportMetrics.revenue) * 100).toFixed(1) : '0'}%
                      </span>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-500 mt-2">
                        <span>{isAr ? 'الكفاءة الهامشية' : 'Corporate performance'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Currency Treasuries and Exchange conversion live status */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1">
                    <div className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">{isAr ? 'صندوق الريال اليمني YER' : 'YER Cash Box'}</span>
                        <span className="text-base font-mono font-black text-emerald-400">{(treasuryBalances.yer.balance || 0).toLocaleString()} <span className="text-[9px] text-slate-500">YER</span></span>
                      </div>
                      <div className="text-[9px] text-slate-500 font-medium mt-2 flex justify-between border-t border-slate-850 pt-1.5">
                        <span>{isAr ? 'المقبوضات: ' : 'Inflow: '}{(treasuryBalances.yer.in || 0).toLocaleString()}</span>
                        <span>{isAr ? 'المدفوعات: ' : 'Outflow: '}{(treasuryBalances.yer.out || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">{isAr ? 'صندوق الدولار الأمريكي USD' : 'USD Cash Box'}</span>
                        <span className="text-base font-mono font-black text-blue-400">{(treasuryBalances.usd.balance || 0).toLocaleString()} <span className="text-[9px] text-slate-550">USD</span></span>
                      </div>
                      <div className="text-[9px] text-slate-500 font-medium mt-2 flex justify-between border-t border-slate-850 pt-1.5">
                        <span>{isAr ? 'المقبوضات: ' : 'Inflow: '}{(treasuryBalances.usd.in || 0).toLocaleString()}</span>
                        <span>{isAr ? 'المدفوعات: ' : 'Outflow: '}{(treasuryBalances.usd.out || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">{isAr ? 'صندوق الريال السعودي SAR' : 'SAR Cash Box'}</span>
                        <span className="text-base font-mono font-black text-[#d4af37]">{(treasuryBalances.sar.balance || 0).toLocaleString()} <span className="text-[9px] text-slate-550">SAR</span></span>
                      </div>
                      <div className="text-[9px] text-slate-500 font-medium mt-2 flex justify-between border-t border-slate-850 pt-1.5">
                        <span>{isAr ? 'المقبوضات: ' : 'Inflow: '}{(treasuryBalances.sar.in || 0).toLocaleString()}</span>
                        <span>{isAr ? 'المدفوعات: ' : 'Outflow: '}{(treasuryBalances.sar.out || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-2xl flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-amber-500 font-extrabold uppercase tracking-wider block mb-1">{isAr ? 'السيولة الموحدة بالريال اليمني' : 'Combined Vault Equiv.'}</span>
                        <span className="text-base font-mono font-black text-[#d4af37]">{(treasuryBalances.combinedTotalYER || 0).toLocaleString()} <span className="text-[9px]">YER</span></span>
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium mt-2 leading-snug border-t border-slate-850/50 pt-1.5">
                        {isAr ? 'إجمالي الأصول النقدية الموحدة بالأسعار المحددة في النظام.' : 'Consolidated hard-cash balances across all currencies.'}
                      </p>
                    </div>
                  </div>

                  {/* Profit detail and sub-breakdown items */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="p-5 bg-black/25 border border-slate-850 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold">{isAr ? 'رواتب الموظفين:' : 'Staff salaries:'}</span>
                        <span className="font-mono font-black text-rose-400">-{reportMetrics.salaryCosts.toLocaleString()} YER</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold">{isAr ? 'مصاريف التشغيل والمحروقات:' : 'OpEx & Fuels:'}</span>
                        <span className="font-mono font-black text-rose-400">-{reportMetrics.operationalCosts.toLocaleString()} YER</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold">{isAr ? 'تكاليف شركات الشحن تجميع:' : 'Sourcing shipping fees:'}</span>
                        <span className="font-mono font-black text-rose-400">-{reportMetrics.shippingCosts.toLocaleString()} YER</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-850">
                        <span className="text-slate-300 font-black">{isAr ? 'مجموع ميزانية النفقات:' : 'Opex Budget Sum:'}</span>
                        <span className="font-mono font-black text-rose-500">-{reportMetrics.costs.toLocaleString()} YER</span>
                      </div>
                    </div>

                    {/* Chart visualizers */}
                    <div className="md:col-span-2 h-[220px] bg-black/25 border border-slate-850 rounded-2xl p-4">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block mb-3">{isAr ? 'نبض التدفق المالي للسيولة والربحية' : 'Profit Stream Dynamics'}</span>
                      <ResponsiveContainer width="100%" height="90%">
                        <PieChart>
                          <Pie
                            data={pnlData}
                            cx="50%"
                            cy="45%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {pnlData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#09090b', border: '1px solid #d4af3720', borderRadius: '12px', fontSize: '10px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Financial overview ledger table */}
                  <div className="pt-4">
                    <span className="text-xs font-black text-white block mb-3">{isAr ? 'آخر فواتير التوريد والصادر المحاسبي' : 'Latest Financial Inflow Logs'}</span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-start border-collapse">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-850 font-bold">
                            <th className="py-2.5 px-3">{isAr ? 'الرقم المرجعي' : 'Ref Key'}</th>
                            <th className="py-2.5 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                            <th className="py-2.5 px-3">{isAr ? 'البيان' : 'Statement'}</th>
                            <th className="py-2.5 px-3 text-right">{isAr ? 'القيمة' : 'Value'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/40">
                          {filteredData.orders.slice(0, 5).map(o => (
                            <tr key={o.id} className="hover:bg-slate-900/10">
                              <td className="py-2.5 px-3 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                              <td className="py-2.5 px-3 text-slate-500">{format(new Date(o.createdAt || Date.now()), 'yyyy-MM-dd')}</td>
                              <td className="py-2.5 px-3 text-slate-300 truncate max-w-[200px]">{o.customerName} - {isAr ? 'فاتورة شحن وتوريد بضاعة' : 'Cargo Invoice'}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-400">+{o.totalPrice?.toLocaleString()} YER</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Expenses Report */}
              {activeReport === 'expenses' && (
                <div className="space-y-6">
                  {selectedExpenseCategory === null ? (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                        <div>
                          <h4 className="text-sm font-black text-white">{isAr ? 'تصنيفات ومجموع المصروفات والتشغيل' : 'Operating Expenses & Category Breakdown'}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? 'اضغط على تظليل أي فئة لمراجعة حركتها المفصلة وسجلاتها المحاسبية' : 'Click any category to drill down raw registries.'}</p>
                        </div>
                        <span className="text-xs font-bold text-rose-400">{isAr ? 'إجمالي المنصرف الإجمالي:' : 'Total OpEx sum:'} <span className="font-mono font-black">{reportMetrics.costs.toLocaleString()} YER</span></span>
                      </div>

                      {/* Categories grid Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {EXPENSE_CATEGORIES_DYNAMIC.filter(cat => cat.id !== 'all').map(cat => {
                          const catExpenses = filteredData.expenses.filter(e => e.category === cat.id);
                          const catSum = catExpenses.reduce((sum, e) => sum + convertToYER(parseFloat(e.amount) || 0, e.currency || 'YER'), 0);
                          return (
                            <button
                              key={cat.id}
                              onClick={() => setSelectedExpenseCategory(cat.id)}
                              className="text-right p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-850/60 hover:border-[#d4af37]/30 rounded-2xl transition transform hover:-translate-y-1 block relative"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="bg-slate-950 border border-slate-800 text-slate-505 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">{cat.id}</span>
                                <div className="w-1.5 h-1.5 bg-[#d4af37] rounded-full" />
                              </div>
                              <span className="text-xs font-black text-white block truncate">{isAr ? cat.labelAr : cat.labelEn}</span>
                              <span className="text-md font-mono font-black text-rose-400 block mt-1">{catSum.toLocaleString()} YER</span>
                              <span className="text-[10px] text-slate-500 block mt-1">{catExpenses.length} {isAr ? 'سجل مصرف' : 'records'}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* General detailed Registry listing below */}
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-black text-white block">{isAr ? 'السجل العام المفصل للمصروفات والمسحوبات' : 'Detailed General Outflow Log'}</span>
                        <div className="overflow-x-auto w-full max-w-full pb-2">
                          <table className="w-full text-xs text-start border-separate border-spacing-y-1.5 min-w-[700px]">
                            <thead>
                              <tr className="text-slate-550 uppercase font-black">
                                <th className="py-2 px-3">{isAr ? 'كود السند' : 'Expense ID'}</th>
                                <th className="py-2 px-3">{isAr ? 'تاريخ المعاملة' : 'Date'}</th>
                                <th className="py-2 px-3 text-center">{isAr ? 'فئة المنصرف' : 'Category'}</th>
                                <th className="py-2 px-3">{isAr ? 'المستفيد' : 'Beneficiary'}</th>
                                <th className="py-2 px-3">{isAr ? 'شرح تفصيلي' : 'Narration'}</th>
                                <th className="py-2 px-3 text-right">{isAr ? 'المبلغ الفعلي' : 'Amount'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850/30">
                              {searchMatchList(filteredData.expenses.filter(e => EXPENSE_CATEGORIES_DYNAMIC.some(c => c.id === e.category)), 'recipientName').map((exp) => (
                                <tr key={exp.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl transition-all">
                                  <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{exp.expenseNumber || 'EXP-XXX'}</td>
                                  <td className="py-3 px-3 text-slate-500">{format(new Date(exp.createdAt || Date.now()), 'yyyy-MM-dd')}</td>
                                  <td className="py-3 px-3 text-center">
                                    <span className="bg-slate-950 border border-slate-800 text-slate-400 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase">{exp.category}</span>
                                  </td>
                                  <td className="py-3 px-3 font-bold text-white">{exp.recipientName}</td>
                                  <td className="py-3 px-3 text-slate-400 font-medium truncate max-w-xs">{exp.notes || '-'}</td>
                                  <td className="py-3 px-3 text-right font-mono font-black text-rose-400">{exp.amount?.toLocaleString()} <span className="text-[10px] text-slate-550 font-sans">{exp.currency}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // SELECTED EXPENSE CATEGORY DETAILED VIEW
                    <div className="space-y-6">
                      {(() => {
                        const catObj = EXPENSE_CATEGORIES_DYNAMIC.find(c => c.id === selectedExpenseCategory);
                        const catExpenses = filteredData.expenses.filter(e => e.category === selectedExpenseCategory);
                        const catSum = catExpenses.reduce((sum, e) => sum + convertToYER(parseFloat(e.amount) || 0, e.currency || 'YER'), 0);

                        const linkedAccount = accounts.find(a =>
                          (catObj?.accountId && (a.id === catObj.accountId || a.entityId === catObj.accountId)) ||
                          (catObj?.accountCode && a.accountCode === catObj.accountCode)
                        );

                        const matchedTxs = linkedAccount ? accountTransactions.filter(tx => tx.accountId === linkedAccount.id) : [];

                        return (
                          <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setSelectedExpenseCategory(null)}
                                  className="p-1.5 px-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black transition"
                                >
                                  {isAr ? '← عودة' : '← Back'}
                                </button>
                                <div>
                                  <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">{selectedExpenseCategory}</span>
                                  <h4 className="text-sm font-black text-white mt-1">
                                    {isAr ? `كشف حركة تفصيلي: ${catObj?.labelAr}` : `Category Statement: ${catObj?.labelEn}`}
                                  </h4>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-black text-slate-500 uppercase">SWIFTSHIP OPEX DECK</span>
                            </div>

                            {/* Category Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="p-4 bg-rose-500/5 border border-rose-500/15 rounded-2xl">
                                <span className="text-[10px] text-rose-400 font-bold block mb-1">{isAr ? 'إجمالي المنصرف لهذه الفئة' : 'Total Category Spending'}</span>
                                <span className="text-lg font-mono font-black text-rose-400">{catSum.toLocaleString()} YER</span>
                                <span className="text-[9px] text-slate-550 block mt-1">{isAr ? 'مسحوبة من النقد المتداول وصندوق الصرف' : 'Withdrawn from aggregate liquidity.'}</span>
                              </div>
                              <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'عدد السندات والفواتير' : 'Registries Count'}</span>
                                <span className="text-lg font-mono font-black text-white">{catExpenses.length} <span className="text-xs text-slate-500 font-sans">{isAr ? 'سند' : 'bills'}</span></span>
                                <span className="text-[9px] text-slate-550 block mt-1">{isAr ? 'سجل تحليلي كامل بفترة الفلترة' : 'Filtered inside your specified dates.'}</span>
                              </div>
                              <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl">
                                <span className="text-[10px] text-slate-550 font-bold block mb-1">{isAr ? 'معدل الحركة الواحدة' : 'Average value per ticket'}</span>
                                <span className="text-lg font-mono font-black text-[#d4af37]">
                                  {catExpenses.length > 0 ? Math.round(catSum / catExpenses.length).toLocaleString() : 0} YER
                                </span>
                                <span className="text-[9px] text-slate-550 block mt-1">{isAr ? 'متوسط قيمة المعاملة الواحدة المقدر' : 'Arithmetic mean value.'}</span>
                              </div>
                              {linkedAccount && (
                                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                                  <span className="text-[10px] text-emerald-400 font-bold block mb-1">{isAr ? 'رصيد الحساب المالي المرتبط' : 'Linked Account Balance'}</span>
                                  <span className="text-lg font-mono font-black text-emerald-400">
                                    {(parseFloat(linkedAccount.balance as any) || 0).toLocaleString()} {linkedAccount.currency || 'YER'}
                                  </span>
                                  <span className="text-[9px] text-slate-550 block mt-1 truncate">{linkedAccount.nameAr || linkedAccount.nameEn} ({linkedAccount.accountCode})</span>
                                </div>
                              )}
                            </div>

                            {/* Filtered category registry Table */}
                            <div className="space-y-3">
                              <span className="text-xs font-black text-white block">{isAr ? 'سجل الحركات المصرحة بالفئة المحددة' : 'Direct Category Expense Slips'}</span>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-start border-collapse">
                                  <thead>
                                    <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                      <th className="py-2.5 px-3 text-start">{isAr ? 'كود السند' : 'Slip ID'}</th>
                                      <th className="py-2.5 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                                      <th className="py-2.5 px-3">{isAr ? 'المستفيد' : 'Recipient'}</th>
                                      <th className="py-2.5 px-3">{isAr ? 'البيان وملاحظات مرافقة' : 'Narration & Details'}</th>
                                      <th className="py-2.5 px-3 text-right">{isAr ? 'المبلغ الفعلي' : 'Amount'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-850/30">
                                    {catExpenses.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="text-center py-10 text-slate-650 font-bold italic">
                                          {isAr ? 'لا توجد بيانات مصروفات لهذه الفئة بالفترة المحددة' : 'No expenses recorded in this category.'}
                                        </td>
                                      </tr>
                                    ) : (
                                      catExpenses.map(e => (
                                        <tr key={e.id} className="hover:bg-slate-950/20 font-medium">
                                          <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{e.expenseNumber}</td>
                                          <td className="py-3 px-3 text-slate-500">{format(new Date(e.createdAt || Date.now()), 'yyyy-MM-dd')}</td>
                                          <td className="py-3 px-3 text-white font-bold">{e.recipientName}</td>
                                          <td className="py-3 px-3 text-slate-400 max-w-xs truncate">{e.notes || '-'}</td>
                                          <td className="py-3 px-3 text-right font-mono font-black text-rose-400">{e.amount?.toLocaleString()} {e.currency}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Indirect Accounting journal matches */}
                            {matchedTxs.length > 0 && (
                              <div className="space-y-3 pt-4 border-t border-slate-900">
                                <span className="text-xs font-black text-[#d4af37] block">{isAr ? 'القيود المحاسبية المقابلة في شجرة الحسابات' : 'Corresponding Ledger Node Journal entries'}</span>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-start border-collapse">
                                    <thead>
                                      <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold">
                                        <th className="py-2 px-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                                        <th className="py-2 px-3">{isAr ? 'رقم القيد' : 'Tx Code'}</th>
                                        <th className="py-2 px-3">{isAr ? 'الشرح' : 'Description'}</th>
                                        <th className="py-2 px-3 text-right">{isAr ? 'القدر المالي' : 'Sum'}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-850/25">
                                      {matchedTxs.map(tx => (
                                        <tr key={tx.id} className="font-medium text-slate-400">
                                          <td className="py-2.5 px-3 text-slate-600">{format(new Date(tx.createdAt), 'yyyy-MM-dd')}</td>
                                          <td className="py-2.5 px-3 font-mono text-slate-350">{tx.refNumber || '-'}</td>
                                          <td className="py-2.5 px-3 text-slate-300">{tx.description}</td>
                                          <td className={`py-2.5 px-3 text-right font-mono font-bold ${tx.type === 'Debit' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {tx.type === 'Debit' ? '+' : '-'}{tx.amount?.toLocaleString()} {tx.currencyOriginal || 'SAR'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Packaging fee / other costs report */}
              {activeReport === 'packaging' && (
                <div className="space-y-6">
                  {(() => {
                    const selectedAccounts = accounts.filter(a => selectedPackagingAccountIds.includes(a.id));
                    const displayAccounts = selectedAccounts.length > 0 ? selectedAccounts : (accounts.find(a => a.entityId === 'sys_packaging_fees') ? [accounts.find(a => a.entityId === 'sys_packaging_fees')!] : []);

                    const displayCurrency = displayAccounts[0]?.currency || 'SAR';
                    const alternativeCurrency = displayCurrency === 'SAR' ? 'YER' : 'SAR';

                    const totalConsolidatedBalance = displayAccounts.reduce((sum, a) => sum + convertCurrency(parseFloat(a.balance as any) || 0, a.currency || 'SAR', displayCurrency), 0);

                    // 1. Calculate Income (Credit - Collected fees from orders)
                    // We sum up active orders packaging fees in SAR and convert to displayCurrency
                    const totalOrderPackagingFees = filteredData.orders
                      .filter(o => o.orderStatus !== 'Cancelled')
                      .reduce((sum, o) => sum + (parseFloat(o.packagingFee as any) || 0), 0);
                    const totalOrderPackagingFeesInDisplay = convertCurrency(totalOrderPackagingFees, 'SAR', displayCurrency);

                    // We sum up credit transactions on any of the selected Accounts
                    const selectedAccountIds = displayAccounts.map(a => a.id);
                    const pkgTxs = accountTransactions.filter(tx => selectedAccountIds.includes(tx.accountId) || selectedAccountIds.includes(tx.entityId));

                    const totalCreditTxs = pkgTxs
                      .filter(tx => tx.type === 'Credit')
                      .reduce((sum, tx) => {
                        const txAcc = accounts.find(a => a.id === tx.accountId);
                        const txCurrency = txAcc?.currency || tx.currency || 'SAR';
                        return sum + convertCurrency(parseFloat(tx.amount) || 0, txCurrency, displayCurrency);
                      }, 0);

                    const packagingIncome = totalCreditTxs > 0 ? totalCreditTxs : totalOrderPackagingFeesInDisplay;

                    // 2. Calculate Expenses (Debit - direct expenses or manual adjustments)
                    const directPackagingExpenses = filteredData.expenses
                      .filter(e => e.category === 'PACKAGING' || e.notes?.toLowerCase().includes('تغليف'))
                      .reduce((sum, e) => sum + convertCurrency(parseFloat(e.amount) || 0, e.currency || 'YER', displayCurrency), 0);

                    const totalDebitTxs = pkgTxs
                      .filter(tx => tx.type === 'Debit')
                      .reduce((sum, tx) => {
                        const txAcc = accounts.find(a => a.id === tx.accountId);
                        const txCurrency = txAcc?.currency || tx.currency || 'SAR';
                        return sum + convertCurrency(parseFloat(tx.amount) || 0, txCurrency, displayCurrency);
                      }, 0);

                    const packagingOutgoings = totalDebitTxs > 0 ? totalDebitTxs : directPackagingExpenses;

                    // 3. Difference
                    const packagingMargin = packagingIncome - packagingOutgoings;

                    const packagingIncomeAlternative = convertCurrency(packagingIncome, displayCurrency, alternativeCurrency);
                    const packagingOutgoingsAlternative = convertCurrency(packagingOutgoings, displayCurrency, alternativeCurrency);
                    const packagingMarginAlternative = convertCurrency(packagingMargin, displayCurrency, alternativeCurrency);

                    return (
                      <div className="space-y-6">
                        <MultiAccountSelector
                          selectedIds={selectedPackagingAccountIds}
                          setSelectedIds={setSelectedPackagingAccountIds}
                          labelAr="اختر حسابات رسوم التغليف والتكاليف المرتبطة لتضمينها في هذا التقرير وتوليد كشف مالي موحد تلقائياً"
                          labelEn="Select packaging fees and associated accounts to compile in this report"
                          accounts={accounts}
                          isAr={isAr}
                          onSave={() => handleSaveAccountSelection('packaging')}
                        />

                        {/* Financial Header linked to Chart of Accounts */}
                        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden space-y-4">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full blur-2xl pointer-events-none" />
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="space-y-1">
                              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider block w-fit">
                                {isAr ? 'الحسابات المالية المحددة من شجرة الحسابات' : 'Selected Chart of Accounts Nodes'}
                              </span>
                              <div className="flex flex-wrap gap-2 pt-1">
                                {displayAccounts.map(acc => (
                                  <span key={acc.id} className="bg-slate-950/80 border border-slate-850 px-3 py-1 rounded-xl text-xs font-black text-white flex items-center gap-1.5">
                                    <span className="text-[#d4af37]">[{acc.accountCode}]</span>
                                    {acc.entityName || acc.name}
                                    <span className="text-slate-500 text-[10px] font-mono">({(acc.balance || 0).toLocaleString()} {acc.currency})</span>
                                  </span>
                                ))}
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xl">
                                {isAr
                                  ? 'يتم دمج ومطابقة بيانات جميع هذه الحسابات المحددة تلقائياً في التقرير وكشف الحركة ومجموع المصروفات والواردات.'
                                  : 'This report aggregates and matches data from all selected accounts, including ledger balances, credits, and debits.'}
                              </p>
                            </div>
                            <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-xl text-end self-stretch md:self-auto min-w-[160px]">
                              <span className="text-[10px] text-slate-550 block font-bold mb-0.5 font-sans">
                                {isAr ? 'الرصيد التراكمي المدمج:' : 'Consolidated Balance:'}
                              </span>
                              <span className={`text-md font-mono font-black ${totalConsolidatedBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {totalConsolidatedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Income / Expense / Difference Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl">
                            <span className="text-[10px] text-emerald-400 font-bold block mb-1">
                              {isAr ? 'الوارد / الدخل من الرسوم المجمعة (+)' : 'Packaging Income (Credit)'}
                            </span>
                            <span className="text-lg font-mono font-black text-emerald-400">
                              {packagingIncome.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] font-sans">{displayCurrency}</span>
                            </span>
                            <p className="text-[10px] font-mono text-slate-400 font-bold mt-0.5">
                              ≈ {packagingIncomeAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                            </p>
                            <p className="text-[9px] text-slate-500 mt-1 font-bold">
                              {isAr
                                ? `مجموع قيم المبيعات المخصصة للتغليف بالفترة (${totalOrderPackagingFees.toLocaleString()} SAR)`
                                : `Sum of wrapping fees collected from shipments during this range.`}
                            </p>
                          </div>

                          <div className="p-4 bg-rose-500/5 border border-rose-500/15 rounded-2xl">
                            <span className="text-[10px] text-rose-400 font-bold block mb-1">
                              {isAr ? 'الخرج / النفقات ومشتريات الكرتون (-)' : 'Packaging OpEx (Debit)'}
                            </span>
                            <span className="text-lg font-mono font-black text-rose-400">
                              {packagingOutgoings.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] font-sans">{displayCurrency}</span>
                            </span>
                            <p className="text-[10px] font-mono text-slate-400 font-bold mt-0.5">
                              ≈ {packagingOutgoingsAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                            </p>
                            <p className="text-[9px] text-slate-500 mt-1 font-bold">
                              {isAr
                                ? 'تكلفة المواد المشتراة أو الحركات المدينة المصروفة للتغليف'
                                : 'Direct OpEx spent on bubble wrap, tape and cardboard supplies.'}
                            </p>
                          </div>

                          <div className={`p-4 rounded-2xl border ${packagingMargin >= 0 ? 'bg-[#d4af37]/5 border-[#d4af37]/20' : 'bg-rose-500/5 border-rose-500/15'}`}>
                            <span className="text-[10px] text-[#d4af37] font-bold block mb-1">
                              {isAr ? 'صافي الفارق والوفرة المالية (الفارق)' : 'Net Operating Variance'}
                            </span>
                            <span className={`text-lg font-mono font-black ${packagingMargin >= 0 ? 'text-[#d4af37]' : 'text-rose-400'}`}>
                              {packagingMargin.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] font-sans">{displayCurrency}</span>
                            </span>
                            <p className="text-[10px] font-mono text-slate-400 font-bold mt-0.5">
                              ≈ {packagingMarginAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                            </p>
                            <p className="text-[9px] text-slate-550 mt-1 font-bold">
                              {isAr
                                ? 'الفائض التشغيلي لقسم التعبئة والتغليف (الدخل - المصاريف)'
                                : 'Actual net yields of the packaging department (Revenue - Expense).'}
                            </p>
                          </div>
                        </div>

                        {/* Dual Tables for Inflow & Outflow */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-2">

                          {/* 1. Collected Fees orders Table (الدخل) */}
                          <div className="space-y-3 bg-slate-900/10 p-5 border border-slate-850/50 rounded-2xl">
                            <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                              <span className="text-xs font-black text-emerald-400">
                                {isAr ? '🟢 الدخل (حصيلة رسوم التغليف من الشحنات)' : 'Revenue logs (Orders Packaging Fees)'}
                              </span>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-black font-mono">
                                {totalOrderPackagingFees.toLocaleString()} SAR
                              </span>
                            </div>

                            <div className="overflow-x-auto w-full max-w-full pb-2">
                              <table className="w-full text-xs text-start border-separate border-spacing-y-1 min-w-[350px]">
                                <thead>
                                  <tr className="text-slate-550 font-black">
                                    <th className="py-1 px-2 text-start">{isAr ? 'الطلب' : 'Order'}</th>
                                    <th className="py-1 px-2 text-start">{isAr ? 'اسم العميل' : 'Customer'}</th>
                                    <th className="py-1 px-2 text-right">{isAr ? 'رسوم التغليف' : 'Packaging fee'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredData.orders.filter(o => o.orderStatus !== 'Cancelled' && (parseFloat(o.packagingFee) || 0) > 0).length === 0 ? (
                                    <tr>
                                      <td colSpan={3} className="text-center py-6 text-slate-600 font-bold italic">
                                        {isAr ? 'لا توجد شحنات مسجلة برسوم تغليف في هذه الفترة' : 'No shipments with wrapping charges.'}
                                      </td>
                                    </tr>
                                  ) : (
                                    filteredData.orders.filter(o => o.orderStatus !== 'Cancelled' && (parseFloat(o.packagingFee) || 0) > 0).slice(0, 100).map((o, idx) => (
                                      <tr key={`${o.id}-${idx}`} className="bg-slate-900/20 hover:bg-slate-900/40 rounded-lg">
                                        <td className="py-2.5 px-2 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                                        <td className="py-2.5 px-2 text-slate-300 font-bold max-w-[120px] truncate" title={o.customerName}>
                                          {o.customerName}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono text-emerald-400 font-extrabold">
                                          {(parseFloat(o.packagingFee) || 0).toLocaleString()} SAR
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* 2. Direct Packaging Expenses Table (الخرج) */}
                          <div className="space-y-3 bg-slate-900/10 p-5 border border-slate-850/50 rounded-2xl">
                            <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                              <span className="text-xs font-black text-rose-400">
                                {isAr ? '🔴 الخرج والمصاريف (سندات الصرف والمشتريات)' : 'OpEx Outflow (Packaging Expenses)'}
                              </span>
                              <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-black">
                                {directPackagingExpenses.toLocaleString()} YER
                              </span>
                            </div>

                            <div className="overflow-x-auto w-full max-w-full pb-2">
                              <table className="w-full text-xs text-start border-separate border-spacing-y-1 min-w-[350px]">
                                <thead>
                                  <tr className="text-slate-550 font-black">
                                    <th className="py-1 px-2 text-start">{isAr ? 'رقم السند' : 'ID'}</th>
                                    <th className="py-1 px-2 text-start">{isAr ? 'البيان الوصفي' : 'Statement'}</th>
                                    <th className="py-1 px-2 text-right">{isAr ? 'المقدار' : 'Amount'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredData.expenses.filter(e => e.category === 'PACKAGING').length === 0 ? (
                                    <tr>
                                      <td colSpan={3} className="text-center py-6 text-slate-600 font-bold italic">
                                        {isAr ? 'لم تسجل أي فواتير لشراء مواد تغليف كرتون كرتونية بالفترة' : 'No packaging expenses logged.'}
                                      </td>
                                    </tr>
                                  ) : (
                                    filteredData.expenses.filter(e => e.category === 'PACKAGING').map((e, idx) => (
                                      <tr key={`${e.id}-${idx}`} className="bg-slate-900/20 hover:bg-slate-900/40 rounded-lg">
                                        <td className="py-2.5 px-2 font-mono font-black text-[#d4af37]">{e.expenseNumber}</td>
                                        <td className="py-2.5 px-2 text-slate-300 max-w-[120px] truncate" title={e.notes || e.recipientName}>
                                          {e.notes || e.recipientName}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono text-rose-400 font-bold">
                                          {e.amount?.toLocaleString()} {e.currency}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* 3. Ledger Entries Table (قيود الحساب) */}
                        <div className="space-y-3 bg-slate-900/10 p-5 border border-slate-850/50 rounded-2xl">
                          <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                            <span className="text-xs font-black text-white">
                              {isAr ? 'سجل القيود المحاسبية التفصيلية (حساب التغليف)' : 'Packaging Account Detailed Ledger'}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-black">
                              {pkgTxs.length} {isAr ? 'حركات' : 'Entries'}
                            </span>
                          </div>

                          <div className="overflow-x-auto w-full max-w-full pb-2">
                            <table className="w-full text-xs text-start border-separate border-spacing-y-1 min-w-[600px]">
                              <thead>
                                <tr className="text-slate-550 font-black">
                                  <th className="py-1 px-2 text-start">{isAr ? 'رقم القيد' : 'Ref No'}</th>
                                  <th className="py-1 px-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                                  <th className="py-1 px-2 text-start">{isAr ? 'البيان والتفاصيل' : 'Description'}</th>
                                  <th className="py-1 px-2 text-right">{isAr ? 'مدين (Debit)' : 'Debit'}</th>
                                  <th className="py-1 px-2 text-right">{isAr ? 'دائن (Credit)' : 'Credit'}</th>
                                  <th className="py-1 px-2 text-right">{isAr ? 'رصيد القيد' : 'Balance'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pkgTxs.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="text-center py-6 text-slate-600 font-bold italic">
                                      {isAr ? 'لا توجد قيود مالية مسجلة في دفتر حساب التغليف لهذه الفترة' : 'No ledger entries recorded for packaging account in this period.'}
                                    </td>
                                  </tr>
                                ) : (
                                  pkgTxs.map((tx, idx) => (
                                    <tr key={`${tx.id}-${idx}`} className="bg-slate-900/20 hover:bg-slate-900/40 rounded-lg">
                                      <td className="py-2.5 px-2 font-mono font-black text-slate-400">{tx.refNumber || '-'}</td>
                                      <td className="py-2.5 px-2 text-slate-400 font-mono">{tx.createdAt ? format(new Date(tx.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                      <td className="py-2.5 px-2 text-slate-300 font-bold max-w-[200px] truncate" title={tx.description}>
                                        {tx.description}
                                      </td>
                                      <td className="py-2.5 px-2 text-right font-mono font-bold text-rose-400">
                                        {tx.type === 'Debit' ? `${(parseFloat(tx.amount) || 0).toLocaleString()} ${accounts.find(a => a.id === tx.accountId)?.currency || 'SAR'}` : '-'}
                                      </td>
                                      <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-400">
                                        {tx.type === 'Credit' ? `${(parseFloat(tx.amount) || 0).toLocaleString()} ${accounts.find(a => a.id === tx.accountId)?.currency || 'SAR'}` : '-'}
                                      </td>
                                      <td className="py-2.5 px-2 text-right font-mono font-black text-[#d4af37]">
                                        {tx.balanceAfter ? `${(parseFloat(tx.balanceAfter as any) || 0).toLocaleString()}` : '-'}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Detailed account ledger report (Select Account from شجرة الحسابات) */}
              {activeReport === 'account_ledger' && (
                <div className="space-y-6">
                  {!filters.accountId ? (
                    <div className="p-16 text-center flex flex-col items-center justify-center space-y-4">
                      <div className="bg-slate-900/40 p-5 rounded-full border border-slate-850">
                        <Layers className="w-12 h-12 text-[#d4af37]/35 animate-bounce" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">{isAr ? 'كشف الحساب التفصيلي لشجرة الحسابات جاهز' : 'Select Chart Node Ledger'}</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">{isAr ? 'رجاءً قم باختيار أي كود حساب من قائمة الفلاتر بالأعلى لعرض التدفقات والقيود المالية التراكمية بشكل لحظي ومستند سليم' : 'Pick a financial ledger account from the dropdown filter card above to retrieve detailed statement logs.'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">{/* Active Account specs Header */}
                      {/*
                      
                      {(() => {
                        const acc = accounts.find(a => a.id === filters.accountId);
                        let balanceTotal = 0;
                        accountTransactions.forEach(t => {
                          const amt = parseFloat(t.amount) || 0;
                          if (t.type === 'Debit') balanceTotal += amt;
                          else balanceTotal -= amt;
                        });

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-850 pb-5">
                            <div className="p-4 bg-slate-900/50 border border-slate-850 rounded-2xl">
                              <span className="text-[10px] text-slate-500 block font-bold mb-0.5">{isAr ? 'رقم الحساب الفرعي الكود:' : 'Ledger Node Code:'}</span>
                              <span className="text-md font-mono font-black text-[#d4af37]">{acc?.accountCode || 'N/A'}</span>
                            </div>
                            <div className="p-4 bg-slate-900/50 border border-slate-850 rounded-2xl">
                              <span className="text-[10px] text-slate-500 block font-bold mb-0.5">{isAr ? 'المسمى المحاسبي للحساب:' : 'Account Subtitle:'}</span>
                              <span className="text-md font-black text-white truncate block">{acc?.entityName || acc?.name}</span>
                            </div>
                            <div className="p-4 bg-emerald-500/5 border border-emerald-500/25 rounded-2xl">
                              <span className="text-[10px] text-emerald-400 block font-bold mb-0.5">{isAr ? 'الرصيد الكلي في الشجرة حالياً:' : 'Current Ledger Balance:'}</span>
                              <span className={`text-md font-mono font-black ${acc?.balance >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                {acc?.balance?.toLocaleString()} {acc?.currency || 'SAR'}
                              </span>
                            </div>
                          </div>
                        );
                      })()}*/}

                      {/* Transaction entries table */}
                      {/*div className="overflow-x-auto w-full max-w-full pb-2">
                        <table className="w-full text-xs text-start border-collapse min-w-[750px]">
                          <thead>
                            <tr className="text-slate-550 border-b border-slate-850 pb-2.5 font-bold uppercase">
                              <th className="py-2.5 px-3 text-start">{isAr ? 'التاريخ والوقت' : 'Datetime'}</th>
                              <th className="py-2.5 px-3">{isAr ? 'الرقم المرجعي للقيد' : 'Ref #'}</th>
                              <th className="py-2.5 px-3 text-center">{isAr ? 'نوع القيد' : 'Class'}</th>
                              <th className="py-2.5 px-3">{isAr ? 'البيان التفصيلي / الشرح' : 'Description/Notes'}</th>
                              <th className="py-2.5 px-3 text-right">{isAr ? 'مدين (+ / صادر)' : 'Debit (+)'}</th>
                              <th className="py-2.5 px-3 text-right">{isAr ? 'دائن (- / وارد)' : 'Credit (-)'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850/40">
                            {accountTransactions.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="text-center py-16 text-slate-600 font-bold italic">
                                  {isAr ? 'لم تسجل أي حركة قيود مالية لهذا الحساب في الفترة المعينة.' : 'Zero account transactions logged in selected range.'}
                                </td>
                              </tr>
                            ) : (
                              accountTransactions.map((tx, idx) => {
                                const acc = accounts.find(a => a.id === filters.accountId);
                                return (
                                  <tr key={`${tx.id}-${idx}`} className="hover:bg-slate-950/20 font-medium">
                                    <td className="py-3 px-3 text-slate-500">{format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm')}</td>
                                    <td className="py-3 px-3 font-mono font-bold text-slate-300">{tx.refNumber || '-'}</td>
                                    <td className="py-3 px-3 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${tx.type === 'Debit' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                        {tx.type === 'Debit' ? (isAr ? 'مدين / صادر' : 'DEBIT') : (isAr ? 'دائن / وارد' : 'CREDIT')}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-white max-w-xs truncate">{tx.description}</td>
                                    <td className="py-3 px-3 text-right font-mono font-black text-rose-400">
                                      {tx.type === 'Debit' ? (
                                        <div className="flex flex-col items-end">
                                          <span>{(parseFloat(tx.amountOriginal || tx.amount) || 0).toLocaleString()} {tx.currencyOriginal || 'SAR'}</span>
                                          {tx.currencyOriginal && tx.currencyOriginal !== (acc?.currency || 'SAR') && (
                                            <span className="text-[10px] text-slate-500 font-normal">≈ {(parseFloat(tx.amount) || 0).toLocaleString()} {acc?.currency || 'SAR'}</span>
                                          )}
                                        </div>
                                      ) : '-'}
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">
                                      {tx.type === 'Credit' ? (
                                        <div className="flex flex-col items-end">
                                          <span>{(parseFloat(tx.amountOriginal || tx.amount) || 0).toLocaleString()} {tx.currencyOriginal || 'SAR'}</span>
                                          {tx.currencyOriginal && tx.currencyOriginal !== (acc?.currency || 'SAR') && (
                                            <span className="text-[10px] text-slate-500 font-normal">≈ {(parseFloat(tx.amount) || 0).toLocaleString()} {acc?.currency || 'SAR'}</span>
                                          )}
                                        </div>
                                      ) : '-'}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>*/}
                    </div>
                  )}
                </div>
              )}

              {/* Order Cost report */}
              {activeReport === 'orders_cost' && (
                <div className="space-y-6">
                  {(() => {
                    const displayAccounts = accounts.filter(a => selectedOrdersCostAccountIds.includes(a.id));
                    const displayCurrency = displayAccounts[0]?.currency || 'SAR';
                    const alternativeCurrency = displayCurrency === 'SAR' ? 'YER' : 'SAR';

                    const totalConsolidatedBalance = displayAccounts.reduce(
                      (sum, a) => sum + convertCurrency(parseFloat(a.balance as any) || 0, a.currency || 'SAR', displayCurrency),
                      0
                    );

                    // Aggregation from active orders
                    const totalDirectShippingCostSAR = filteredData.orders
                      .filter(o => o.orderStatus !== 'Cancelled')
                      .reduce((sum, o) => sum + (parseFloat(o.shippingCostSAR as any) || 0), 0);
                    const totalDirectShippingCostDisplay = convertCurrency(totalDirectShippingCostSAR, 'SAR', displayCurrency);

                    const totalDirectPackagingFeeSAR = filteredData.orders
                      .filter(o => o.orderStatus !== 'Cancelled')
                      .reduce((sum, o) => sum + (parseFloat(o.packagingFee as any) || 0), 0);
                    const totalDirectPackagingFeeDisplay = convertCurrency(totalDirectPackagingFeeSAR, 'SAR', displayCurrency);

                    // Transactions on selected cost accounts
                    const costAccountIds = displayAccounts.map(a => a.id);
                    const costTxs = accountTransactions.filter(tx => costAccountIds.includes(tx.accountId) || costAccountIds.includes(tx.entityId));

                    const totalCostDebit = costTxs
                      .filter(tx => tx.type === 'Debit')
                      .reduce((sum, tx) => {
                        const txAcc = accounts.find(a => a.id === tx.accountId);
                        const txCurrency = txAcc?.currency || tx.currency || 'SAR';
                        return sum + convertCurrency(parseFloat(tx.amount) || 0, txCurrency, displayCurrency);
                      }, 0);

                    const totalCostCredit = costTxs
                      .filter(tx => tx.type === 'Credit')
                      .reduce((sum, tx) => {
                        const txAcc = accounts.find(a => a.id === tx.accountId);
                        const txCurrency = txAcc?.currency || tx.currency || 'SAR';
                        return sum + convertCurrency(parseFloat(tx.amount) || 0, txCurrency, displayCurrency);
                      }, 0);

                    const netCostFromLedger = totalCostDebit - totalCostCredit;

                    const totalDirectShippingCostAlternative = convertCurrency(totalDirectShippingCostDisplay, displayCurrency, alternativeCurrency);
                    const netCostFromLedgerAlternative = convertCurrency(netCostFromLedger, displayCurrency, alternativeCurrency);
                    const totalConsolidatedBalanceAlternative = convertCurrency(totalConsolidatedBalance, displayCurrency, alternativeCurrency);

                    return (
                      <div className="space-y-6">
                        <MultiAccountSelector
                          selectedIds={selectedOrdersCostAccountIds}
                          setSelectedIds={setSelectedOrdersCostAccountIds}
                          labelAr="حدد حسابات تكاليف الطلبات والشحن من شجرة الحسابات لعرض تفاصيلها والعمليات المرتبطة بها تلقائياً"
                          labelEn="Select orders and shipping costs accounts from the chart of accounts"
                          accounts={accounts}
                          isAr={isAr}
                          onSave={() => handleSaveAccountSelection('orders_cost')}
                        />

                        {/* Interactive Financial Card Header */}
                        {displayAccounts.length > 0 && (
                          <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden space-y-4">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full blur-2xl pointer-events-none" />
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div className="space-y-1">
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider block w-fit">
                                  {isAr ? 'الحسابات المالية المحددة لتكاليف الطلبات والشحن' : 'Selected Orders Cost Ledger Nodes'}
                                </span>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {displayAccounts.map(acc => (
                                    <span key={acc.id} className="bg-slate-950/80 border border-slate-850 px-3 py-1 rounded-xl text-xs font-black text-white flex items-center gap-1.5">
                                      <span className="text-[#d4af37]">[{acc.accountCode}]</span>
                                      {acc.entityName || acc.name}
                                      <span className="text-slate-500 text-[10px] font-mono">({(acc.balance || 0).toLocaleString()} {acc.currency})</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-xl text-end self-stretch md:self-auto min-w-[160px]">
                                <span className="text-[10px] text-slate-550 block font-bold mb-0.5">
                                  {isAr ? 'الرصيد التراكمي المدمج:' : 'Consolidated Balance:'}
                                </span>
                                <span className={`text-md font-mono font-black ${totalConsolidatedBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {totalConsolidatedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                                </span>
                                <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                                  ≈ {totalConsolidatedBalanceAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                                </p>
                              </div>
                            </div>

                            {/* Stats grids for costs */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                              <div className="p-3.5 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                                <span className="text-[10px] text-rose-400 font-bold block mb-1">
                                  {isAr ? 'تكاليف الشحن من الشحنات المباشرة (SAR)' : 'Direct Shipments Shipping Cost (SAR)'}
                                </span>
                                <span className="text-md font-mono font-black text-rose-400">
                                  {totalDirectShippingCostSAR.toLocaleString()} <span className="text-[10px]">SAR</span>
                                </span>
                                <p className="text-[9px] text-slate-500 mt-1">
                                  ≈ {totalDirectShippingCostDisplay.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                                </p>
                              </div>

                              <div className="p-3.5 bg-slate-900/60 border border-slate-850 rounded-xl">
                                <span className="text-[10px] text-slate-400 font-bold block mb-1">
                                  {isAr ? 'إجمالي المدفوعات المسجلة للناقلين (Ledger Debits)' : 'Total Carrier Ledger Debits'}
                                </span>
                                <span className="text-md font-mono font-black text-white">
                                  {totalCostDebit.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px]">{displayCurrency}</span>
                                </span>
                                <p className="text-[9px] text-slate-550 mt-1">
                                  {isAr ? `تتضمن دفعات شركات الشحن والتوصيل بالفترة` : `Payments registered on transport ledgers.`}
                                </p>
                              </div>

                              <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                                <span className="text-[10px] text-amber-400 font-bold block mb-1">
                                  {isAr ? 'صافي فارق تكاليف الشحن الدفتري' : 'Net Book Shipping Variance'}
                                </span>
                                <span className="text-md font-mono font-black text-amber-400">
                                  {netCostFromLedger.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px]">{displayCurrency}</span>
                                </span>
                                <p className="text-[9px] text-slate-550 mt-1">
                                  ≈ {netCostFromLedgerAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedOrderId === null ? (
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-black text-white">{isAr ? 'تكاليف الطلبات والشحنات اللوجستية' : 'Orders & Shipments Cost Report'}</h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? 'اختر أي شحنة للوصول الفوري لبيانات الدفاتر وحركات الذمم وسجل المندوبين المتكامل' : 'Select an order to analyze its financial journal, customers, and couriers.'}</p>
                            </div>

                            <div className="overflow-x-auto w-full max-w-full pb-2">
                              <table className="w-full text-xs text-start border-separate border-spacing-y-1 min-w-[700px]">
                                <thead>
                                  <tr className="text-slate-550 font-black">
                                    <th className="py-2 px-3">{isAr ? 'رقم الشحنة' : 'Order ID'}</th>
                                    <th className="py-2 px-3">{isAr ? 'العميل' : 'Customer'}</th>
                                    <th className="py-2 px-3">{isAr ? 'تاريخ الإنشاء' : 'Created At'}</th>
                                    <th className="py-2 px-3">{isAr ? 'حالة الشحن' : 'Status'}</th>
                                    <th className="py-2 px-3 text-right">{isAr ? 'رسوم الشحن' : 'Shipping Cost'}</th>
                                    <th className="py-2 px-3 text-right">{isAr ? 'رسوم التغليف' : 'Packaging'}</th>
                                    <th className="py-2 px-3 text-right">{isAr ? 'صافي القيمة المستحقة' : 'Net Price'}</th>
                                    <th className="py-2 px-3 text-center">{isAr ? 'الإجراء' : 'Actions'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {searchMatchList(filteredData.orders, 'customerName').map((o, idx) => (
                                    <tr key={`${o.id}-${idx}`} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl transition cursor-pointer" onClick={() => setSelectedOrderId(o.orderNumber || o.id)}>
                                      <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                                      <td className="py-3 px-3 font-bold text-white">{o.customerName}</td>
                                      <td className="py-3 px-3 text-slate-500 font-mono">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                      <td className="py-3 px-3">
                                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-slate-950 text-slate-400 border border-slate-850 font-bold">{o.orderStatus}</span>
                                      </td>
                                      <td className="py-3 px-3 text-right font-mono text-slate-500">{o.shippingCostSAR?.toLocaleString() || 0}</td>
                                      <td className="py-3 px-3 text-right font-mono text-slate-500">{o.packagingFee?.toLocaleString() || 0}</td>
                                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">{o.totalCostYER?.toLocaleString() || o.totalPrice?.toLocaleString()} YER</td>
                                      <td className="py-3 px-3 text-center">
                                        <button className="p-1 px-2.5 bg-[#d4af37]/10 border border-[#d4af37]/20 text-xs font-black text-[#d4af37] rounded-lg hover:bg-[#d4af37]/25 transition">
                                          {isAr ? 'تحليل السجل' : 'Analyze'}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          // SELECTED ORDER DRILL DOWN STATEMENT DETAIL REPORT
                          <div className="space-y-6">
                            {(() => {
                              const o = orders.find(ord => ord.id === selectedOrderId || ord.orderNumber === selectedOrderId);
                              if (!o) {
                                return (
                                  <div className="p-8 text-center text-slate-500">
                                    {isAr ? 'الشحنة غير متوفرة أو تم حذفها' : 'Order not found.'}
                                    <button onClick={() => setSelectedOrderId(null)} className="block mx-auto mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl">عودة</button>
                                  </div>
                                );
                              }

                              // Retrieve related financial transactions
                              const relatedTxs = accountTransactions.filter(tx => tx.refNumber === o.orderNumber || tx.description?.includes(o.orderNumber));
                              const shippingCourier = couriers.find(c => c.id === o.shippingCourierId);
                              const deliveryCourier = couriers.find(c => c.id === o.deliveryCourierId);

                              return (
                                <div className="space-y-6">
                                  {/* Detailed Subheader Header */}
                                  <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => setSelectedOrderId(null)}
                                        className="p-1.5 px-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black transition"
                                      >
                                        {isAr ? '← عودة للشحنات' : '← Back to List'}
                                      </button>
                                      <div>
                                        <span className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/25 px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase inline-block">{o.orderNumber}</span>
                                        <h4 className="text-sm font-black text-white mt-1">
                                          {isAr ? `التقرير الاستقصائي الموحد للشحنة والمحاسبة` : `Unified Investigation Order Report`}
                                        </h4>
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-mono font-black text-slate-550 uppercase">SWIFTSHIP AUDIT SYSTEM</span>
                                  </div>

                                  {/* Core Metadata Information */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    {/* Customer and phone */}
                                    <div className="p-5 bg-black/20 border border-slate-850 rounded-2xl space-y-2">
                                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">{isAr ? 'العميل والمستلم' : 'Customer Registry'}</span>
                                      <div className="space-y-1">
                                        <h5 className="text-xs font-black text-white">{o.customerName}</h5>
                                        <p className="text-[11px] text-slate-400 font-mono">{o.customerPhone || '-'}</p>
                                        <p className="text-[11px] text-slate-450">{isAr ? 'العنوان / الوجهة:' : 'Shipto Line:'} {o.destinationCity || o.destinationCountry || '-'}</p>
                                      </div>
                                    </div>

                                    {/* Shipping lines and couriers */}
                                    <div className="p-5 bg-black/20 border border-slate-850 rounded-2xl space-y-2">
                                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">{isAr ? 'خط الشحن واللوجستيات' : 'Shipping Partners'}</span>
                                      <div className="space-y-1 text-xs text-slate-350">
                                        <p>{isAr ? 'شركة الشحن المتعاقدة:' : 'Shipping Line:'} <strong className="text-white font-black">{o.shippingCompany || '-'}</strong></p>
                                        <p>{isAr ? 'رقم التتبع الدولي:' : 'Tracking Code:'} <strong className="text-[#d4af37] font-mono">{o.trackingNumber || '-'}</strong></p>
                                        <p className="text-[11px]">{isAr ? 'مندوب التجميع:' : 'Sourcing Courier:'} <span className="text-slate-400 font-bold">{shippingCourier?.fullName || '-'}</span></p>
                                        <p className="text-[11px]">{isAr ? 'مندوب التوصيل:' : 'Delivery Courier:'} <span className="text-slate-400 font-bold">{deliveryCourier?.fullName || '-'}</span></p>
                                      </div>
                                    </div>

                                    {/* Dates & Statuses */}
                                    <div className="p-5 bg-black/20 border border-slate-850 rounded-2xl space-y-2">
                                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">{isAr ? 'الحالات والزمن الفعلي' : 'Time stamps & statuses'}</span>
                                      <div className="space-y-1.5 text-xs">
                                        <p>{isAr ? 'تاريخ التوريد:' : 'Created Date:'} <span className="text-slate-400 font-mono font-bold">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd HH:mm') : '-'}</span></p>
                                        <p>{isAr ? 'تاريخ آخر نشاط لوجستي:' : 'Last Activity:'} <span className="text-slate-400 font-mono">{o.updatedAt ? format(new Date(o.updatedAt), 'yyyy-MM-dd HH:mm') : '-'}</span></p>
                                        <div className="flex gap-2 items-center">
                                          <span>{isAr ? 'الحالة اللوجيستية:' : 'Overall Status:'}</span>
                                          <span className="px-2 py-0.5 rounded text-[9.5px] bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 font-black">{o.orderStatus}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Financial breakdown Cards */}
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl">
                                      <span className="text-[10px] text-slate-500 font-black block uppercase mb-1">{isAr ? 'قيمة الشحنة والمبيعات' : 'Order Cargo Value'}</span>
                                      <span className="text-md font-mono font-black text-white">{((parseFloat(o.totalCostSAR) || 0) - (parseFloat(o.shippingCostSAR) || 0) - (parseFloat(o.packagingFee) || 0)).toLocaleString() || 0} <span className="text-[10px] text-slate-500">SAR</span></span>
                                      <p className="text-[9px] text-slate-550 mt-1">{isAr ? 'القيمة بدون احتساب الرسوم الإضافية' : 'Base inventory shipping value'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl">
                                      <span className="text-[10px] text-slate-500 font-black block uppercase mb-1">{isAr ? 'رسوم الشحن والتغليف المضافة' : 'Surcharges (Shipping & Pkg)'}</span>
                                      <span className="text-md font-mono font-black text-[#d4af37]">
                                        {((o.shippingCostSAR || 0) + (o.packagingFee || 0)).toLocaleString()} <span className="text-[10px]">SAR</span>
                                      </span>
                                      <p className="text-[9px] text-slate-550 mt-1">{isAr ? `شحن: ${o.shippingCostSAR || 0} / تغليف: ${o.packagingFee || 0}` : 'Aggregated surcharges sum'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl">
                                      <span className="text-[10px] text-slate-550 font-black block uppercase mb-1">{isAr ? 'مجموع المقدار المستحق الكلي' : 'Total Price (YER)'}</span>
                                      <span className="text-md font-mono font-black text-rose-400">{(o.totalCostYER || o.totalPrice)?.toLocaleString() || 0} <span className="text-[10px]">YER</span></span>
                                      <p className="text-[9px] text-slate-550 mt-1">{isAr ? 'بعد التحويل للصرف اليمني المحلي' : 'Calculated through active exchange rate.'}</p>
                                    </div>
                                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                                      <span className="text-[10px] text-emerald-400 font-black block mb-1">
                                        {isAr ? 'المدفوع من العميل والذمة المتبقية' : 'Paid vs Remaining Bal'}
                                      </span>
                                      <div className="space-y-0.5">
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-500">{isAr ? 'المدفوع:' : 'Paid:'}</span>
                                          <span className="font-mono text-emerald-400 font-bold">{(o.amountPaid || 0).toLocaleString()} YER</span>
                                        </div>
                                        <div className="flex justify-between text-xs border-t border-dashed border-slate-800 pt-0.5">
                                          <span className="text-slate-500">{isAr ? 'المتبقي:' : 'Owed:'}</span>
                                          <span className="font-mono text-rose-400 font-black">{(o.amountRemaining || 0).toLocaleString()} YER</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* ACCOUNTING JOURNAL DOUBLE ENTRY */}
                                  <div className="space-y-3 pt-2">
                                    <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                                      <span className="text-xs font-black text-[#d4af37] uppercase flex items-center gap-1.5Packed">
                                        <Layers className="w-4 h-4 text-[#d4af37]" />
                                        {isAr ? 'قيود المعاملة والسندات المالية المقيدة في شجرة الدفاتر' : 'Double Entry Journal Postings'}
                                      </span>
                                      <span className="text-[10px] text-slate-550 font-mono font-bold uppercase">{relatedTxs.length} entries registered</span>
                                    </div>

                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs text-start border-collapse">
                                        <thead>
                                          <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                            <th className="py-2.5 px-3 text-start">{isAr ? 'تاريخ المعاملة' : 'Datetime'}</th>
                                            <th className="py-2.5 px-3">{isAr ? 'الرقم المرجعي للسند' : 'Journal ID'}</th>
                                            <th className="py-2.5 px-3 text-center">{isAr ? 'الفئة المحاسبية' : 'Class'}</th>
                                            <th className="py-2.5 px-3">{isAr ? 'الشرح التفصيلي' : 'Narration'}</th>
                                            <th className="py-2.5 px-3 text-right">{isAr ? 'الحركة المدينة (+)' : 'Debit (+)'}</th>
                                            <th className="py-2.5 px-3 text-right">{isAr ? 'الحركة الدائنة (-)' : 'Credit (-)'}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-850/30">
                                          {relatedTxs.length === 0 ? (
                                            <tr>
                                              <td colSpan={6} className="text-center py-8 text-slate-650 font-bold italic">
                                                {isAr ? 'لم تتقاطع أي حركات قيود مالية مع كود شحنة هذا الطلب بعد' : 'No automatic or manual double-entry logs map against this order.'}
                                              </td>
                                            </tr>
                                          ) : (
                                            relatedTxs.map((tx) => (
                                              <tr key={tx.id} className="hover:bg-slate-950/15 font-medium">
                                                <td className="py-3 px-3 text-slate-550">{format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm')}</td>
                                                <td className="py-3 px-3 font-mono font-bold text-slate-350">{tx.refNumber}</td>
                                                <td className="py-3 px-3 text-center">
                                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${tx.type === 'Debit' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                    {tx.type === 'Debit' ? (isAr ? 'مدين / خرج' : 'DEBIT') : (isAr ? 'دائن / دخل' : 'CREDIT')}
                                                  </span>
                                                </td>
                                                <td className="py-3 px-3 text-white max-w-xs truncate">{tx.description}</td>
                                                <td className="py-3 px-3 text-right font-mono font-extrabold text-rose-400">
                                                  {tx.type === 'Debit' ? `${(parseFloat(tx.amount) || 0).toLocaleString()} ${tx.currencyOriginal || 'SAR'}` : '-'}
                                                </td>
                                                <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-400">
                                                  {tx.type === 'Credit' ? `${(parseFloat(tx.amount) || 0).toLocaleString()} ${tx.currencyOriginal || 'SAR'}` : '-'}
                                                </td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Shipping companies */}
              {activeReport === 'shipping_companies' && (
                <div className="space-y-6">
                  {(() => {
                    const displayAccounts = accounts.filter(a => selectedShippingCompaniesAccountIds.includes(a.id));
                    const displayCurrency = displayAccounts[0]?.currency || 'SAR';
                    const alternativeCurrency = displayCurrency === 'SAR' ? 'YER' : 'SAR';

                    const totalConsolidatedBalance = displayAccounts.reduce(
                      (sum, a) => sum + convertCurrency(parseFloat(a.balance as any) || 0, a.currency || 'SAR', displayCurrency),
                      0
                    );

                    const totalConsolidatedBalanceAlternative = convertCurrency(totalConsolidatedBalance, displayCurrency, alternativeCurrency);

                    return (
                      <div className="space-y-6">
                        <MultiAccountSelector
                          selectedIds={selectedShippingCompaniesAccountIds}
                          setSelectedIds={setSelectedShippingCompaniesAccountIds}
                          labelAr="حدد حسابات شركات الشحن والعمولات والذمم الدائنة/المدينة المرتبطة من شجرة الحسابات لعرض تفاصيلها"
                          labelEn="Select shipping companies, commissions, and payables accounts from the chart of accounts"
                          accounts={accounts}
                          isAr={isAr}
                          onSave={() => handleSaveAccountSelection('shipping_companies')}
                        />

                        {/* Interactive Financial Card Header */}
                        {displayAccounts.length > 0 && (
                          <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden space-y-4">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full blur-2xl pointer-events-none" />
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div className="space-y-1">
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider block w-fit">
                                  {isAr ? 'الحسابات المالية المحددة لشركات الشحن والعمولات والذمم' : 'Selected Shipping Accounts'}
                                </span>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {displayAccounts.map(acc => (
                                    <span key={acc.id} className="bg-slate-950/80 border border-slate-850 px-3 py-1 rounded-xl text-xs font-black text-white flex items-center gap-1.5">
                                      <span className="text-[#d4af37]">[{acc.accountCode}]</span>
                                      {acc.entityName || acc.name}
                                      <span className="text-slate-500 text-[10px] font-mono">({(acc.balance || 0).toLocaleString()} {acc.currency})</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-xl text-end self-stretch md:self-auto min-w-[160px]">
                                <span className="text-[10px] text-slate-550 block font-bold mb-0.5">
                                  {isAr ? 'الرصيد المدمج (الذمم المستحقة):' : 'Consolidated Payables Balance:'}
                                </span>
                                <span className={`text-md font-mono font-black ${totalConsolidatedBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {totalConsolidatedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                                </span>
                                <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                                  ≈ {totalConsolidatedBalanceAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedCompanyId === null ? (
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-black text-white">{isAr ? 'شركات الشحن والعمولات اللوجستية' : 'Partner Shipping Companies & Commissions'}</h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? 'اضغط على تظليل أي شركة شحن لعرض الشحنات المرتبطة والتكاليف المفصلة كليا' : 'Click on any shipping partner to display linked orders, cost schedules, and ledger transits.'}</p>
                            </div>

                            <div className="overflow-x-auto w-full max-w-full pb-2">
                              <table className="w-full text-xs text-start border-separate border-spacing-y-1 min-w-[650px]">
                                <thead>
                                  <tr className="text-slate-550 font-black">
                                    <th className="py-2 px-3 text-start">{isAr ? 'اسم الشركة الناقلة' : 'Shipping Co'}</th>
                                    <th className="py-2 px-3 text-center">{isAr ? 'نوع خط الشحن' : 'Shipline Route'}</th>
                                    <th className="py-2 px-3">{isAr ? 'هاتف الاتصال' : 'Phone'}</th>
                                    <th className="py-2 px-3 text-right">{isAr ? 'الرصيد والذمة المستحقة' : 'Outstanding Balance'}</th>
                                    <th className="py-2 px-3 text-center">{isAr ? 'الإجراء' : 'Action'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {searchMatchList(filteredData.shippingCompanies, 'name').map((sc) => (
                                    <tr key={sc.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl cursor-pointer transition" onClick={() => setSelectedCompanyId(sc.name || sc.id)}>
                                      <td className="py-3 px-3 font-bold text-white text-start">{sc.name}</td>
                                      <td className="py-3 px-3 text-center">
                                        <span className="bg-slate-950 border border-slate-800 text-[#d4af37] px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">{sc.type || 'INTERNATIONAL'}</span>
                                      </td>
                                      <td className="py-3 px-3 text-slate-400 font-mono">{sc.phone || '-'}</td>
                                      <td className="py-3 px-3 text-right font-mono font-black text-rose-400">-{sc.dueAmount?.toLocaleString() || 0} YER</td>
                                      <td className="py-3 px-3 text-center">
                                        <button className="p-1 px-2.5 bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 rounded-md text-[10px] font-bold">
                                          {isAr ? 'عرض الحساب' : 'View Ledger'}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          // SHIPPING CO DETAIL BLOCK DISPLAY
                          <div className="space-y-6">
                            {(() => {
                              const sc = shippingCompanies.find(c => c.name === selectedCompanyId || c.id === selectedCompanyId) || { name: selectedCompanyId, type: 'INTERNATIONAL', phone: '-', dueAmount: 0 };
                              const coOrders = filteredData.orders.filter(o => o.shippingCompany === sc.name || o.shippingCompanyId === sc.id);
                              const totalSum = coOrders.reduce((sum, o) => sum + convertCurrency(parseFloat(o.totalPrice) || 0, o.currency || 'YER', 'YER'), 0);
                              const paidSum = coOrders.reduce((sum, o) => sum + convertCurrency(parseFloat(o.amountPaid) || 0, o.currency || 'YER', 'YER'), 0);
                              const linkedTxs = accountTransactions.filter(tx => tx.description?.toLowerCase().includes((sc?.name || '').toLowerCase()) || tx.description?.includes(sc?.name || ''));

                              const scDueInDisplay = convertCurrency(sc.dueAmount || 0, 'YER', displayCurrency);
                              const totalSumInDisplay = convertCurrency(totalSum, 'YER', displayCurrency);
                              const paidSumInDisplay = convertCurrency(paidSum, 'YER', displayCurrency);

                              const scDueAlternative = convertCurrency(sc.dueAmount || 0, 'YER', alternativeCurrency);
                              const totalSumAlternative = convertCurrency(totalSum, 'YER', alternativeCurrency);
                              const paidSumAlternative = convertCurrency(paidSum, 'YER', alternativeCurrency);

                              return (
                                <div className="space-y-6">
                                  <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => setSelectedCompanyId(null)}
                                        className="p-1.5 px-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black transition"
                                      >
                                        {isAr ? '← تراجع' : '← Back'}
                                      </button>
                                      <div>
                                        <span className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/25 px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">{sc.type}</span>
                                        <h4 className="text-sm font-black text-white mt-1">
                                          {isAr ? `كشف أداء وحساب شحن: ${sc.name}` : `Performance & Statement: ${sc.name}`}
                                        </h4>
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-mono font-black text-slate-500">CARRIER SUB-DECK</span>
                                  </div>

                                  {/* stats widgets */}
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                      <span className="text-[10.5px] text-slate-500 font-bold block mb-1">{isAr ? 'المستحق الحسابي (الذمة للشركة)' : 'Outstanding Carrier due'}</span>
                                      <span className="text-md font-mono font-black text-rose-400">
                                        {scDueInDisplay.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                                      </span>
                                      <p className="text-[9px] font-mono text-slate-500 mt-1">
                                        ≈ {scDueAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                                      </p>
                                    </div>
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                      <span className="text-[10.5px] text-slate-500 font-bold block mb-1">{isAr ? 'حجم المبيعات الكلي' : 'Gross Volume'}</span>
                                      <span className="text-md font-mono font-black text-white">
                                        {totalSumInDisplay.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                                      </span>
                                      <p className="text-[9px] font-mono text-slate-500 mt-1">
                                        ≈ {totalSumAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                                      </p>
                                    </div>
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                      <span className="text-[10.5px] text-slate-500 font-bold block mb-1">{isAr ? 'المسدد فعليا' : 'Paid / Settled'}</span>
                                      <span className="text-md font-mono font-black text-emerald-400">
                                        {paidSumInDisplay.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                                      </span>
                                      <p className="text-[9px] font-mono text-slate-500 mt-1">
                                        ≈ {paidSumAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                                      </p>
                                    </div>
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                      <span className="text-[10.5px] text-slate-500 font-bold block mb-1">{isAr ? 'إجمالي الطلبات المنقولة' : 'Shipped orders count'}</span>
                                      <span className="text-md font-mono font-black text-[#d4af37]">{coOrders.length} <span className="text-xs font-sans text-slate-500">{isAr ? 'شحنة' : 'shumes'}</span></span>
                                    </div>
                                  </div>

                                  {/* company orders list */}
                                  <div className="space-y-3">
                                    <span className="text-xs font-black text-white block">{isAr ? 'الشحنات المستندة لهذا الناقل' : 'Linked orders on this carrier'}</span>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs text-start border-collapse">
                                        <thead>
                                          <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                            <th className="py-2 px-3 text-start">{isAr ? 'كود الطلب' : 'Order ID'}</th>
                                            <th className="py-2 px-3">{isAr ? 'تاريخ المعاملة' : 'Date'}</th>
                                            <th className="py-2 px-3">{isAr ? 'العميل المستلم' : 'Receiver'}</th>
                                            <th className="py-2 px-3 text-right">{isAr ? 'مجموع القيمة' : 'Gross aggregate'}</th>
                                            <th className="py-2 px-3 text-center">{isAr ? 'حالة الطلب' : 'Status'}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-850/30">
                                          {coOrders.length === 0 ? (
                                            <tr>
                                              <td colSpan={5} className="text-center py-6 text-slate-600 font-bold italic">
                                                {isAr ? 'لا توجد شحنات مسجلة على هذه الشركة بعد' : 'No shippings linked to this company.'}
                                              </td>
                                            </tr>
                                          ) : (
                                            coOrders.map(o => (
                                              <tr key={o.id} className="hover:bg-slate-950/20 font-medium">
                                                <td className="py-2.5 px-3 font-mono text-[#d4af37] font-black">{o.orderNumber || o.id}</td>
                                                <td className="py-2.5 px-3 text-slate-500">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                                <td className="py-2.5 px-3 text-white font-bold">{o.customerName}</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-black">{o.totalPrice?.toLocaleString()} YER</td>
                                                <td className="py-2.5 px-3 text-center">
                                                  <span className="text-[9.5px] px-2 py-0.5 bg-slate-950 text-slate-400 border border-slate-850 rounded-lg">{o.orderStatus}</span>
                                                </td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Customers report list */}
              {activeReport === 'customers' && (
                <div className="space-y-6">
                  {selectedCustomerId === null ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-white">{isAr ? 'كشف العملاء والذمم والمديونيات' : 'Customers Ledger & Dues Report'}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? 'اختر أي عميل من الجدول لإنشاء بيان ذمم تفصيلي وكشف كلي للشحنات والمدفوعات والمستندات' : 'Select any client to extract account statement, transactions and outstanding balances.'}</p>
                      </div>

                      <div className="overflow-x-auto w-full max-w-full pb-2">
                        <table className="w-full text-xs text-start border-separate border-spacing-y-1.5 min-w-[680px]">
                          <thead>
                            <tr className="text-slate-550 font-black">
                              <th className="py-2 px-3 text-start">{isAr ? 'اسم العميل' : 'Customer Name'}</th>
                              <th className="py-2 px-3">{isAr ? 'الهاتف التواصل' : 'Contact Phone'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'العملة الأساسية' : 'Currency'}</th>
                              <th className="py-2 px-3 text-right">{isAr ? 'الرصيد الختامي' : 'Terminal Balance'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'الإجراء' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {searchMatchList(filteredData.customers, 'fullName').map((c) => {
                              const acc = accounts.find(a => a.entityType === 'customer' && a.entityId === c.id);
                              const bal = acc ? acc.balance : (c.financialBalance || 0);
                              const cur = acc ? acc.currency : (c.financialCurrency || 'SAR');
                              return (
                                <tr key={c.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl cursor-pointer transition animate-fade-in" onClick={() => setSelectedCustomerId(c.id)}>
                                  <td className="py-3 px-3 font-bold text-white text-start">{c.fullName}</td>
                                  <td className="py-3 px-3 text-slate-450 font-mono font-bold">{c.phone || '-'}</td>
                                  <td className="py-3 px-3 text-[10px] text-center font-black text-slate-400 uppercase">{cur}</td>
                                  <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">{bal.toLocaleString()} {cur}</td>
                                  <td className="py-3 px-3 text-center">
                                    <button className="p-1 px-2.5 bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 rounded-md text-[10px] font-black">
                                      {isAr ? 'كشف حساب' : 'Extract'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    // CUSTOMER DRILLDOWN DETAIL STATEMENT WINDOW
                    <div className="space-y-6 animate-fade-in">
                      {(() => {
                        const cust = customers.find(c => c.id === selectedCustomerId);
                        if (!cust) return <p className="text-slate-500">Customer not found.</p>;

                        const custAcc = accounts.find(a => a.entityType === 'customer' && a.entityId === cust.id);
                        const custOrders = filteredData.orders.filter(o => o.customerId === cust.id || o.customerName === cust.fullName || o.customerPhone === cust.phone);
                        const grossSum = custOrders.reduce((sum, o) => sum + convertCurrency(parseFloat(o.totalPrice) || 0, o.currency || 'YER', 'YER'), 0);
                        const paidSum = custOrders.reduce((sum, o) => sum + convertCurrency(parseFloat(o.amountPaid) || 0, o.currency || 'YER', 'YER'), 0);
                        const remainDebt = custOrders.reduce((sum, o) => sum + convertCurrency(parseFloat(o.amountRemaining) || 0, o.currency || 'YER', 'YER'), 0);
                        const statementsTxs = accountTransactions.filter(tx =>
                          (custAcc && tx.accountId === custAcc.id) ||
                          tx.entityId === cust.id ||
                          tx.description?.includes(cust.fullName) ||
                          (cust.phone && tx.description?.includes(cust.phone))
                        );

                        const custBalance = custAcc ? custAcc.balance : (cust.financialBalance || 0);
                        const custCurrency = custAcc ? custAcc.currency : (cust.financialCurrency || 'SAR');

                        return (
                          <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setSelectedCustomerId(null)}
                                  className="p-1.5 px-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black transition"
                                >
                                  {isAr ? '← تراجع' : '← Back'}
                                </button>
                                <div>
                                  <span className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/25 px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">ACCOUNT CARD</span>
                                  <h4 className="text-sm font-black text-white mt-1">
                                    {isAr ? `كشف حساب العقد والذمة: ${cust.fullName}` : `Statement Log: ${cust.fullName}`}
                                  </h4>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-black text-slate-550 uppercase">RTL ACCOUNT STANDARDS</span>
                            </div>

                            {/* stats cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'الرصيد الدفتري الحالي' : 'Book Account Balance'}</span>
                                <span className="text-lg font-mono font-black text-emerald-400">{custBalance.toLocaleString()} {custCurrency}</span>
                                <p className="text-[9px] text-slate-550 mt-1">{isAr ? 'أرصدة جارية نشطة في الدفتر المركزي' : 'Active currency credit weight'}</p>
                              </div>
                              <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'إجمالي فواتير المشتريات' : 'Gross Purchases Volume'}</span>
                                <span className="text-lg font-mono font-black text-white">{grossSum.toLocaleString()} YER</span>
                                <p className="text-[9px] text-slate-550 mt-1">{isAr ? 'مجموع أسعار الشحنات النقدية الكلية' : 'Total pricing sum from shipping logs'}</p>
                              </div>
                              <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'المسدد الفعلي من العميل' : 'Total settled by customer'}</span>
                                <span className="text-lg font-mono font-black text-teal-400">{paidSum.toLocaleString()} YER</span>
                              </div>
                              <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'المديونية المتبقية (ذمة معلقة)' : 'Pending cargo unpaid debt'}</span>
                                <span className="text-lg font-mono font-black text-rose-450">{remainDebt.toLocaleString()} YER</span>
                              </div>
                            </div>

                            {/* related client transactions/orders */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <span className="text-xs font-black text-white block">{isAr ? 'سجل فواتير شحنات العميل التفصيلية' : 'Comprehensive order history statement'}</span>
                                <div className="overflow-x-auto bg-slate-900/10 rounded-2xl border border-slate-850/50">
                                  <table className="w-full text-xs text-start border-separate border-spacing-y-1 p-2">
                                    <thead>
                                      <tr className="text-slate-550 font-bold border-b border-slate-800 pb-1.5 uppercase">
                                        <th className="py-2 px-3 text-start">{isAr ? 'رقم الشحنة' : 'Order ID'}</th>
                                        <th className="py-2 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                                        <th className="py-2 px-3 text-right">{isAr ? 'القيمة' : 'Cost'}</th>
                                        <th className="py-2 px-3 text-right">{isAr ? 'المسدد' : 'Paid'}</th>
                                        <th className="py-2 px-3 text-right">{isAr ? 'المتبقي' : 'Bal'}</th>
                                        <th className="py-2 px-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {custOrders.length === 0 ? (
                                        <tr>
                                          <td colSpan={6} className="text-center py-6 text-slate-650 italic font-bold">
                                            {isAr ? 'لا توجد أي شحنات مسجلة لهذا العميل في قواعد البيانات' : 'No order logs recorded for this client.'}
                                          </td>
                                        </tr>
                                      ) : (
                                        custOrders.map(o => (
                                          <tr key={o.id} className="bg-slate-900/20 hover:bg-slate-900/50 rounded-xl">
                                            <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                                            <td className="py-3 px-3 text-slate-500 font-mono">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                            <td className="py-3 px-3 text-right font-mono font-bold text-white">{o.totalPrice?.toLocaleString()} YER</td>
                                            <td className="py-3 px-3 text-right font-mono text-emerald-400 font-bold">{(o.amountPaid || 0).toLocaleString()} YER</td>
                                            <td className="py-3 px-3 text-right font-mono text-rose-400 font-bold">{(o.amountRemaining || 0).toLocaleString()} YER</td>
                                            <td className="py-3 px-3 text-center">
                                              <span className="px-2 py-0.5 rounded text-[9.5px] bg-slate-950 text-slate-400 border border-slate-850 font-bold truncate max-w-[80px] inline-block">{o.orderStatus}</span>
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <span className="text-xs font-black text-white block">{isAr ? 'سجل الحركات والقيود المحاسبية للعميل' : 'Customer Accounting Ledger'}</span>
                                <div className="overflow-x-auto bg-slate-900/10 rounded-2xl border border-slate-850/50">
                                  <table className="w-full text-xs text-start border-separate border-spacing-y-1 p-2">
                                    <thead>
                                      <tr className="text-slate-550 font-bold border-b border-slate-800 pb-1.5 uppercase">
                                        <th className="py-2 px-3 text-start">{isAr ? 'رقم القيد' : 'Ref'}</th>
                                        <th className="py-2 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                                        <th className="py-2 px-3">{isAr ? 'الشرح' : 'Description'}</th>
                                        <th className="py-2 px-3 text-right">{isAr ? 'القيمة' : 'Amount'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {statementsTxs.length === 0 ? (
                                        <tr>
                                          <td colSpan={4} className="text-center py-6 text-slate-650 italic font-bold">
                                            {isAr ? 'لا توجد قيود مالية مسجلة' : 'No financial ledger entries found.'}
                                          </td>
                                        </tr>
                                      ) : (
                                        statementsTxs.map(tx => (
                                          <tr key={tx.id} className="bg-slate-900/20 hover:bg-slate-900/50 rounded-xl">
                                            <td className="py-3 px-3 font-mono text-slate-400">{tx.refNumber || '-'}</td>
                                            <td className="py-3 px-3 text-slate-500 font-mono">{tx.createdAt ? format(new Date(tx.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                            <td className="py-3 px-3 text-slate-300 max-w-[150px] truncate">{tx.description}</td>
                                            <td className={`py-3 px-3 text-right font-mono font-bold ${tx.type === 'Debit' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                              {tx.type === 'Debit' ? '+' : '-'}{(parseFloat(tx.amount) || 0).toLocaleString()} {tx.currencyOriginal || 'SAR'}
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Couriers report list */}
              {activeReport === 'couriers' && (
                <div className="space-y-6">
                  {selectedCourierId === null ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-white">{isAr ? 'تقرير تصفية عهد وأداء المندوبين' : 'Couriers Ledger & Outstanding Custodies'}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? 'اختر أي مندوب لمراجعة نسب التسليم وأرصدة العهد النقدية والشحنات الموكلة لمسؤوليته بالكامل' : 'Select a courier to drill into delivery KPIs, dynamic outstanding cassiers and cash custody journals.'}</p>
                      </div>

                      <div className="overflow-x-auto w-full max-w-full pb-2">
                        <table className="w-full text-xs text-start border-separate border-spacing-y-1.5 min-w-[700px]">
                          <thead>
                            <tr className="text-slate-550 font-black text-center">
                              <th className="py-2 px-3 text-start">{isAr ? 'اسم المندوب' : 'Courier Name'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'مسؤولية النطاق' : 'Domain Role'}</th>
                              <th className="py-2 px-3">{isAr ? 'العهد المتبقية معلقة بذمته' : 'Outstanding Custody'}</th>
                              <th className="py-2 px-3 text-right">{isAr ? 'أرصد الحساب المالي' : 'Account Balance'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'الإجراء التفصيلي' : 'Action'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {searchMatchList(filteredData.couriers, 'fullName').map((c) => {
                              const acc = accounts.find(a => a.entityType === 'courier' && a.entityId === c.id);
                              const bal = acc ? acc.balance : (c.financialBalance || 0);
                              const cur = acc ? acc.currency : (c.financialCurrency || 'SAR');
                              const pendingCustody = expenses
                                .filter(e => e.recipientEntityId === c.id && e.type === 'Custody' && e.status === 'Pending')
                                .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                              return (
                                <tr key={c.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl text-center cursor-pointer transition" onClick={() => setSelectedCourierId(c.id)}>
                                  <td className="py-3 px-3 font-bold text-white text-start">{c.fullName}</td>
                                  <td className="py-3 px-3 text-center">
                                    <span className="px-2 py-0.5 bg-blue-500/5 text-blue-400 border border-blue-500/20 rounded-md text-[9.5px] font-extrabold uppercase">
                                      {c.courierType === 'sourcing' ? (isAr ? 'مندوب تجميع خارجي' : 'External Sourcing') : (isAr ? 'تحديث وتوزيع داخلي' : 'Local Delivery')}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 font-mono font-black text-amber-500">
                                    {pendingCustody.toLocaleString()} {cur}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">
                                    {bal.toLocaleString()} {cur}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <button className="p-1 px-2.5 bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 rounded-md text-[10px] font-black">
                                      {isAr ? 'تحليل الأداء' : 'Stat analysis'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    // SELECTED COURIER DETAIL DISPLAY SECTION
                    <div className="space-y-6 animate-fade-in">
                      {(() => {
                        const courier = couriers.find(c => c.id === selectedCourierId);
                        if (!courier) return <p className="text-slate-500">Courier not found.</p>;

                        const coOrders = filteredData.orders.filter(o => o.shippingCourierId === courier.id || o.deliveryCourierId === courier.id || o.courierId === courier.id);
                        const totalAssigned = coOrders.length;
                        const deliveredCo = coOrders.filter(o => ['Completed', 'Delivered', 'تم التسليم'].includes(o.orderStatus));
                        const successRate = totalAssigned > 0 ? Math.round((deliveredCo.length / totalAssigned) * 105) : 0;
                        const pendingCustody = expenses
                          .filter(e => e.recipientEntityId === courier.id && e.type === 'Custody' && e.status === 'Pending')
                          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

                        return (
                          <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setSelectedCourierId(null)}
                                  className="p-1.5 px-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black transition"
                                >
                                  {isAr ? '← تراجع' : '← Back'}
                                </button>
                                <div>
                                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">{courier.courierType}</span>
                                  <h4 className="text-sm font-black text-white mt-1">
                                    {isAr ? `تصفية عهد وملف مندوب: ${courier.fullName}` : `Courier statement dashboard: ${courier.fullName}`}
                                  </h4>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-black text-slate-500 uppercase">COURIER SYSTEM FILE</span>
                            </div>

                            {/* stats widgets */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl">
                                <span className="text-[10px] text-amber-500 font-bold block mb-1">{isAr ? 'العهدة المالية المعلقة بذمته' : 'Pending Custody Owed'}</span>
                                <span className="text-lg font-mono font-black text-amber-500">{pendingCustody.toLocaleString()} {(() => { const acc = accounts.find(a => a.entityType === 'courier' && a.entityId === courier.id); return acc ? acc.currency : (courier.financialCurrency || 'SAR'); })()}</span>
                                <p className="text-[9px] text-slate-655 mt-1">{isAr ? 'مبالغ تحت التسوية والمحاسبة اليومية' : 'Unsettled cash from deliveries'}</p>
                              </div>
                              <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl">
                                <span className="text-[10px] text-emerald-400 font-bold block mb-1">{isAr ? 'الرصيد الجاري المستحق' : 'Aggregate Account Balance'}</span>
                                <span className="text-lg font-mono font-black text-emerald-400">{(() => {
                                  const acc = accounts.find(a => a.entityType === 'courier' && a.entityId === courier.id);
                                  const bal = acc ? acc.balance : (courier.financialBalance || 0);
                                  const cur = acc ? acc.currency : (courier.financialCurrency || 'SAR');
                                  return `${bal.toLocaleString()} ${cur}`;
                                })()}</span>
                              </div>
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'معدل نجاح الشحنات الموكلة' : 'Successful Delivery Rate'}</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-lg font-mono font-black text-[#d4af37]">{successRate > 100 ? 100 : successRate}%</span>
                                  <span className="text-[10px] text-slate-500 font-mono">({deliveredCo.length}/{totalAssigned})</span>
                                </div>
                              </div>
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'عدد الشحنات الكلي المسندة' : 'Total Assigned Tasks'}</span>
                                <span className="text-lg font-mono font-black text-white">{coOrders.length} <span className="text-xs font-sans text-slate-550">{isAr ? 'شحنة' : 'orders'}</span></span>
                              </div>
                            </div>

                            {/* linked courier orders log */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <span className="text-xs font-black text-white block">{isAr ? 'سجل حركات شحنات المندوب المقترنة' : 'Assigned order manifest log'}</span>
                                <div className="overflow-x-auto bg-slate-900/10 rounded-2xl border border-slate-850/50">
                                  <table className="w-full text-xs text-start border-separate border-spacing-y-1 p-2">
                                    <thead>
                                      <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                        <th className="py-2.5 px-3 text-start">{isAr ? 'رقم الشحنة' : 'Order ID'}</th>
                                        <th className="py-2.5 px-3">{isAr ? 'المستلم' : 'Customer'}</th>
                                        <th className="py-2.5 px-3 text-right">{isAr ? 'المطلوب تحصيله' : 'Required'}</th>
                                        <th className="py-2.5 px-3 text-center">{isAr ? 'حالتها' : 'Status'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {coOrders.length === 0 ? (
                                        <tr>
                                          <td colSpan={4} className="text-center py-6 text-slate-650 italic font-bold">
                                            {isAr ? 'لا توجد شحنات مرتبطة بهذا المندوب حاليا' : 'No orders linked against this courier.'}
                                          </td>
                                        </tr>
                                      ) : (
                                        coOrders.map(o => (
                                          <tr key={o.id} className="bg-slate-900/20 hover:bg-slate-900/50 rounded-xl">
                                            <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                                            <td className="py-3 px-3 font-bold text-white max-w-[120px] truncate">{o.customerName}</td>
                                            <td className="py-3 px-3 text-right font-mono text-emerald-450 font-black">{o.totalPrice?.toLocaleString()} YER</td>
                                            <td className="py-3 px-3 text-center">
                                              <span className="px-2 py-0.5 rounded text-[9.5px] bg-slate-950 text-slate-400 border border-slate-850 font-bold truncate max-w-[80px] inline-block">{o.orderStatus}</span>
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <span className="text-xs font-black text-white block">{isAr ? 'سجل الحركات والقيود المحاسبية للمندوب' : 'Courier Accounting Ledger'}</span>
                                <div className="overflow-x-auto bg-slate-900/10 rounded-2xl border border-slate-850/50">
                                  <table className="w-full text-xs text-start border-separate border-spacing-y-1 p-2">
                                    <thead>
                                      <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                        <th className="py-2.5 px-3 text-start">{isAr ? 'رقم القيد' : 'Ref'}</th>
                                        <th className="py-2.5 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                                        <th className="py-2.5 px-3">{isAr ? 'الشرح' : 'Description'}</th>
                                        <th className="py-2.5 px-3 text-right">{isAr ? 'القيمة' : 'Amount'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        const staffTxs = accountTransactions.filter(tx =>
                                          (courier.financialAccountId && tx.accountId === courier.financialAccountId) ||
                                          tx.description?.includes(courier.fullName) ||
                                          tx.description?.includes(courier.displayName || '---')
                                        );

                                        if (staffTxs.length === 0) {
                                          return (
                                            <tr>
                                              <td colSpan={4} className="text-center py-6 text-slate-650 italic font-bold">
                                                {isAr ? 'لا توجد قيود مالية مسجلة' : 'No financial ledger entries found.'}
                                              </td>
                                            </tr>
                                          );
                                        }

                                        return staffTxs.map(tx => (
                                          <tr key={tx.id} className="bg-slate-900/20 hover:bg-slate-900/50 rounded-xl">
                                            <td className="py-3 px-3 font-mono text-slate-400">{tx.refNumber || '-'}</td>
                                            <td className="py-3 px-3 text-slate-500 font-mono">{tx.createdAt ? format(new Date(tx.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                            <td className="py-3 px-3 text-slate-300 max-w-[150px] truncate">{tx.description}</td>
                                            <td className={`py-3 px-3 text-right font-mono font-bold ${tx.type === 'Debit' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                              {tx.type === 'Debit' ? '+' : '-'}{(parseFloat(tx.amount) || 0).toLocaleString()} {tx.currencyOriginal || 'SAR'}
                                            </td>
                                          </tr>
                                        ));
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Users list with monthly salaries */}
              {activeReport === 'users' && (
                <div className="space-y-6">
                  {selectedUserId === null ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-white">{isAr ? 'دفتر الموظفين وتدقيق كشوفات الرواتب' : 'Corporate Payroll & Staff Salaries'}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? 'اختر أي موظف لمراجعة استمارات المرتبات والسندات المالية التابعة لحسابه في الدفاتر المركزية' : 'Understands corporate staffing and wage slips. Select employee to drill down into payments.'}</p>
                      </div>

                      <div className="overflow-x-auto w-full max-w-full pb-2">
                        <table className="w-full text-xs text-start border-separate border-spacing-y-1.5 min-w-[650px]">
                          <thead>
                            <tr className="text-slate-550 font-black">
                              <th className="py-2 px-3 text-start">{isAr ? 'الاسم بالكامل' : 'Staff Name'}</th>
                              <th className="py-2 px-3">{isAr ? 'البريد المهني الرسمي' : 'Work Email'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'الصلاحيات الوظيفية' : 'Permission Role'}</th>
                              <th className="py-2 px-3 text-right">{isAr ? 'الراتب المعتمد أساسيا' : 'Approved Wage'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'الإجراء' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {searchMatchList(filteredData.users, 'fullName').map((u) => (
                              <tr key={u.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl cursor-pointer transition animate-fade-in" onClick={() => setSelectedUserId(u.id)}>
                                <td className="py-3 px-3 font-bold text-white text-start">{u.fullName || u.displayName}</td>
                                <td className="py-3 px-3 text-slate-500 font-mono font-bold">{u.email || '-'}</td>
                                <td className="py-3 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded text-[8.5px] uppercase font-black bg-purple-500/5 text-purple-400 border border-purple-500/20">{u.role || 'COURIER'}</span>
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-black text-[#d4af37]">{(u.monthlySalary || 0).toLocaleString()} YER</td>
                                <td className="py-3 px-3 text-center animate-fade-in">
                                  <button className="p-1 px-2.5 bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 rounded-md text-[10px] font-black">
                                    {isAr ? 'دفتر المستحقات' : 'Edit Wage Card'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    // SELECTED STAFF/USER ID DRILLDOWN DETAILED DISPLAY
                    <div className="space-y-6 animate-fade-in">
                      {(() => {
                        const u = users.find(usr => usr.id === selectedUserId);
                        if (!u) return <p className="text-slate-500">Staff record not found.</p>;

                        // Filter direct ledger payroll actions relating to their name in description
                        const staffTxs = accountTransactions.filter(tx => tx.accountId === u.accountId);

                        return (
                          <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setSelectedUserId(null)}
                                  className="p-1.5 px-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black transition"
                                >
                                  {isAr ? '← تراجع' : '← Back'}
                                </button>
                                <div>
                                  <span className="bg-purple-500/10 text-purple-400 border border-purple-500/15 px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">STAFF FILE</span>
                                  <h4 className="text-sm font-black text-white mt-1">
                                    {isAr ? `تصفية الرواتب واستمارة شجرة الدفاتر: ${u.fullName || u.displayName}` : `Corporate Position Folder: ${u.fullName || u.displayName}`}
                                  </h4>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-black text-slate-550">OFFICIAL PAYROLL DECK</span>
                            </div>

                            {/* stats panels */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'الراتب الأساسي الصافي' : 'Approved Basic Stipend'}</span>
                                <span className="text-lg font-mono font-black text-[#d4af37]">{(u.monthlySalary || 0).toLocaleString()} YER</span>
                                <p className="text-[9px] text-slate-550 mt-1">{isAr ? 'الراتب الشهري المقر بقائمتها المركزية' : 'Monthly wage cleared in workspace registries.'}</p>
                              </div>
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? ' الرصيد المالي' : 'balance'}</span>
                                <span className="text-lg font-mono font-black text-white">{staffTxs.reduce((acc, t) => (t.type === 'Credit') ? acc + t.amount : acc - t.amount, 0).toLocaleString()} <span className="text-xs font-sans text-slate-550">{isAr ? 'رصيد' : 'entries'}</span></span>
                              </div>
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'الصلاحيات والوصول' : 'Enterprise Access Scope'}</span>
                                <span className="text-md font-black text-purple-400 block mt-1 uppercase tracking-wider">{u.role || 'COURIER'}</span>
                                <p className="text-[9px] text-slate-550 mt-1 font-mono">{u.email || '-'}</p>
                              </div>
                            </div>

                            {/* matching historical journal entries */}
                            <div className="space-y-3">
                              <span className="text-xs font-black text-white block">{isAr ? 'السجل التاريخي لرواتب المنصرفة والعهود المستقطعة' : 'Direct payroll & ledger entries linked'}</span>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-start border-collapse">
                                  <thead>
                                    <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                      <th className="py-2.5 px-3 text-start">{isAr ? 'التاريخ' : 'Datetime'}</th>
                                      <th className="py-2.5 px-3">{isAr ? 'رقم القيد' : 'Journal ID'}</th>
                                      <th className="py-2.5 px-3">{isAr ? 'الشرح ' : 'Narration'}</th>
                                      <th className="py-2.5 px-3 text-right">{isAr ? 'دائن ' : 'Credit'}</th>
                                      <th className="py-2.5 px-3 text-right">{isAr ? 'مدين' : 'Debit'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-850/30">
                                    {staffTxs.length === 0 ? (
                                      <tr>
                                        <td colSpan={4} className="text-center py-6 text-slate-650 italic font-bold">
                                          {isAr ? 'لا توجد دفعات مصادق عليها مقيدة تحت اسم هذا الموظف بعد' : 'No cash vouchers generated against this employee.'}
                                        </td>
                                      </tr>
                                    ) : (
                                      staffTxs.map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-950/20 font-medium text-slate-400">
                                          <td className="py-3 px-3 text-slate-500">{format(new Date(tx.createdAt), 'yyyy-MM-dd')}</td>
                                          <td className="py-3 px-3 font-mono font-bold text-slate-350">{tx.refNumber || tx.refId}</td>
                                          <td className="py-3 px-3 text-white">{tx.description}</td>
                                          <td className="py-3 px-3 text-right font-mono font-black text-green-400">{tx.type === 'Credit' ? `+${tx.amount?.toLocaleString()} '${tx.currencyOriginal || 'SAR'}` : '-----'} </td>
                                          <td className="py-3 px-3 text-right font-mono font-black text-rose-400">{tx.type === 'Debit' ? `-${tx.amount?.toLocaleString()} '${tx.currencyOriginal || 'SAR'}` : '-----'} </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Detailed Account Ledger (شجرة الحسابات) */}
              {activeReport === 'account_ledger' && (
                <div className="space-y-6 animate-fade-in">
                  {ledgerMetrics === null ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                      <div className="p-4 bg-slate-900 border border-slate-800 text-slate-500 rounded-full">
                        <Layers className="w-10 h-10" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-white">
                          {isAr ? 'لم يتم تحديد حساب مالي بعد' : 'No account selected'}
                        </h4>
                        <p className="text-xs text-slate-500 max-w-sm">
                          {isAr
                            ? 'يرجى اختيار الحساب المطلوب من القائمة المنسدلة في شريط الفلترة بالأعلى لعرض كشف الحركة التفصيلي ومطابقة الأرصدة.'
                            : 'Please select a financial account from the filter dropdown above to load dynamic ledger sheets.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Account Summary header */}
                      <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden space-y-4">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full blur-2xl pointer-events-none" />
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="space-y-1">
                            <span className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/25 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider block w-fit">
                              {isAr ? 'كشف الحساب المالي المحدد' : 'Selected Ledger Account Profile'}
                            </span>
                            <h3 className="text-md font-black text-white pt-1">
                              [{ledgerMetrics.selectedAccount.accountCode}] — {ledgerMetrics.selectedAccount.entityName || ledgerMetrics.selectedAccount.name}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              {isAr
                                ? `حالة الحساب: نشط • طبيعة الحساب: ${ledgerMetrics.debitNormal ? 'مدين (الأصول/المصاريف)' : 'دائن (الالتزامات/الإيرادات/الملكية)'}`
                                : `Account status: Active • Type: ${ledgerMetrics.debitNormal ? 'Debit-Normal (Asset/Expense)' : 'Credit-Normal (Liability/Equity/Revenue)'}`}
                            </p>
                          </div>

                          <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-xl text-end self-stretch md:self-auto min-w-[180px]">
                            <span className="text-[10px] text-slate-550 block font-bold mb-0.5">
                              {isAr ? 'رصيد الحساب المالي الإجمالي:' : 'Current Book Balance:'}
                            </span>
                            <span className={`text-md font-mono font-black ${ledgerMetrics.selectedAccount.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {(ledgerMetrics.selectedAccount.balance || 0).toLocaleString()} {ledgerMetrics.selectedAccount.currency || 'YER'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Period balances dashboard */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl text-start">
                          <span className="text-[10px] text-slate-500 font-bold block mb-1">
                            {isAr ? 'الرصيد الافتتاحي (بداية المدة)' : 'Opening Balance'}
                          </span>
                          <span className={`text-base font-mono font-black ${ledgerMetrics.openingBalance >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
                            {ledgerMetrics.openingBalance.toLocaleString()} <span className="text-[10px] font-sans text-slate-500">{ledgerMetrics.selectedAccount.currency}</span>
                          </span>
                          <p className="text-[9px] text-slate-550 mt-1">
                            {isAr ? 'الرصيد التراكمي قبل تاريخ البداية' : 'Balance before start date.'}
                          </p>
                        </div>

                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl text-start">
                          <span className="text-[10px] text-emerald-400 font-bold block mb-1">
                            {isAr ? 'إجمالي الحركات المدينة (+)' : 'Total Period Debits'}
                          </span>
                          <span className="text-base font-mono font-black text-emerald-400">
                            +{ledgerMetrics.periodDebits.toLocaleString()} <span className="text-[10px] font-sans text-slate-500">{ledgerMetrics.selectedAccount.currency}</span>
                          </span>
                          <p className="text-[9px] text-slate-550 mt-1">
                            {isAr ? 'سحب/صرف/زيادة الأصول بالمدة' : 'Total debited within range.'}
                          </p>
                        </div>

                        <div className="p-4 bg-rose-500/5 border border-rose-500/15 rounded-2xl text-start">
                          <span className="text-[10px] text-rose-400 font-bold block mb-1">
                            {isAr ? 'إجمالي الحركات الدائنة (-)' : 'Total Period Credits'}
                          </span>
                          <span className="text-base font-mono font-black text-rose-400">
                            -{ledgerMetrics.periodCredits.toLocaleString()} <span className="text-[10px] font-sans text-slate-500">{ledgerMetrics.selectedAccount.currency}</span>
                          </span>
                          <p className="text-[9px] text-slate-550 mt-1">
                            {isAr ? 'توريد/دخل/زيادة الالتزامات بالمدة' : 'Total credited within range.'}
                          </p>
                        </div>

                        <div className="p-4 bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-2xl text-start">
                          <span className="text-[10px] text-[#d4af37] font-bold block mb-1">
                            {isAr ? 'الرصيد الختامي (نهاية المدة)' : 'Closing Balance'}
                          </span>
                          <span className={`text-base font-mono font-black ${ledgerMetrics.closingBalance >= 0 ? 'text-[#d4af37]' : 'text-rose-400'}`}>
                            {ledgerMetrics.closingBalance.toLocaleString()} <span className="text-[10px] font-sans text-slate-500">{ledgerMetrics.selectedAccount.currency}</span>
                          </span>
                          <p className="text-[9px] text-slate-550 mt-1">
                            {isAr ? 'الرصيد الصافي المتبقي بنهاية المدة' : 'Remaining balance at range end.'}
                          </p>
                        </div>
                      </div>

                      {/* Ledger rows table */}
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-black text-white block">
                          {isAr ? 'حركات القيود والدفاتر التفصيلية خلال الفترة' : 'Statement Period Postings'}
                        </span>
                        <div className="overflow-x-auto w-full max-w-full pb-2">
                          <table className="w-full text-xs text-start border-separate border-spacing-y-1.5 min-w-[750px]">
                            <thead>
                              <tr className="text-slate-550 uppercase font-black">
                                <th className="py-2 px-3 text-start">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                                <th className="py-2 px-3">{isAr ? 'الرقم المرجعي للقيد' : 'Voucher Ref'}</th>
                                <th className="py-2 px-3">{isAr ? 'البيان التفصيلي والشرح' : 'Description / Narration'}</th>
                                <th className="py-2 px-3 text-right">{isAr ? 'مدين (Debit)' : 'Debit'}</th>
                                <th className="py-2 px-3 text-right">{isAr ? 'دائن (Credit)' : 'Credit'}</th>
                                <th className="py-2 px-3 text-right">{isAr ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ledgerMetrics.displayRows.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="text-center py-12 text-slate-500 font-bold italic">
                                    {isAr ? 'لا توجد حركات قيود مسجلة لهذا الحساب بالفترة المحددة' : 'No transactions recorded for this account in the specified period.'}
                                  </td>
                                </tr>
                              ) : (
                                ledgerMetrics.displayRows.map((tx) => {
                                  const amt = parseFloat(tx.amount) || 0;
                                  return (
                                    <tr key={tx.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl transition-all">
                                      <td className="py-3 px-3 text-slate-500 font-mono">
                                        {format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm')}
                                      </td>
                                      <td className="py-3 px-3 font-mono font-black text-slate-350">
                                        {tx.refNumber || '-'}
                                      </td>
                                      <td className="py-3 px-3 font-bold text-white truncate max-w-xs" title={tx.description}>
                                        {tx.description}
                                      </td>
                                      <td className="py-3 px-3 text-right font-mono font-black text-rose-400">
                                        {tx.type === 'Debit' ? `+${amt.toLocaleString()}` : '-'}
                                      </td>
                                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">
                                        {tx.type === 'Credit' ? `-${amt.toLocaleString()}` : '-'}
                                      </td>
                                      <td className={`py-3 px-3 text-right font-mono font-black ${tx.runningBalance >= 0 ? 'text-[#d4af37]' : 'text-rose-400'}`}>
                                        {tx.runningBalance.toLocaleString()} {tx.currencyOriginal || tx.currency || 'SAR'}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}


            </div>

            {/* Smart PDF export advice panel to prevent garbled letters error */}
            <div className="bg-[#121215] border border-[#d4af37]/25 p-5 rounded-3xl flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-[#d4af37] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider mb-1">
                  {isAr ? 'ملاحظة بخصوص جودة طباعة وتصدير التقارير العربية' : 'Pristine Vector Printing & PDF Export Guide'}
                </h4>
                <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
                  {isAr
                    ? 'لتجنب تشوه الخطوط العربية وظهور الرموز العشوائية في ملفات PDF الناتجة بصورة تقليدية، نقوم بتطبيق نظام الطباعة المعياري عالي الكفاءة. اضغط على زر "معاينة وطباعة القالب" ثم اختر "حفظ بتنسيق PDF" من نافذة طباعة النظام المتطورة. يضمن هذا الإجراء تحويل المستند بالكامل بنظام المتجهات النحيف (Vector Form) وبجميع خطوط الطراز العربي الأصيلة والمحاذاة التامة RTL.'
                    : 'To ensure 100% accurate Arabic rendering without encoding corruption, we highly recommend utilizing the browser Standard Printing dialog. Click "Save as PDF" directly from the browser window after initiating live printing to capture pristine vector scripts and RTL alignment.'
                  }
                </p>
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* TEMPLATE SETTINGS AND PRINT FORMS VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in no-print">

          {/* LEFT: Custom Template Editor Controls Panel */}
          <div className="lg:col-span-5 bg-[#111114] border border-slate-850 p-6 rounded-3xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">{isAr ? 'محرر تصميم قوالب الطباعة' : 'Print Template Customizer'}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{isAr ? 'تخصيص الهوية والشكل الخارجي والبيانات' : 'Branding & Layout Configuration'}</p>
              </div>
              <button
                onClick={handleSavePrintSettings}
                disabled={savingTemplate}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#d4af37] hover:bg-yellow-600 disabled:opacity-50 text-black text-xs font-black rounded-xl transition"
              >
                {savingTemplate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isAr ? 'حفظ التغييرات' : 'Save Config'}
              </button>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {/* Paper Layout size options */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? 'حجم ونسق ورقة الطباعة' : 'Print Layout Canvas Size'}</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'A4', label: isAr ? 'ورق مالي A4 طولي' : 'A4 Portrait' },
                    { id: 'A4_Landscape', label: isAr ? 'ورق مالي A4 عرضي' : 'A4 Landscape' },
                    { id: '80mm', label: isAr ? 'شريط حراري 80mm' : '80mm Thermal Receipt' },
                    { id: '58mm', label: isAr ? 'شريط حراري 58mm' : '58mm Thermal Receipt' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setPrintSettings(prev => ({ ...prev, paperSize: opt.id as any }))}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-black text-center transition ${printSettings.paperSize === opt.id ? 'bg-[#d4af37]/15 text-[#d4af37] border-[#d4af37]' : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-400'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Branding Titles (Arabic / English) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">{isAr ? 'عنوان رأس الورقة (عربي)' : 'Header Title (AR)'}</label>
                  <input
                    type="text"
                    value={printSettings.headerTitleAr}
                    onChange={e => setPrintSettings(p => ({ ...p, headerTitleAr: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-550 uppercase">{isAr ? 'عنوان الرأس (إنجليزي)' : 'Header Title (EN)'}</label>
                  <input
                    type="text"
                    value={printSettings.headerTitleEn}
                    onChange={e => setPrintSettings(p => ({ ...p, headerTitleEn: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              {/* Subtitles Description details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">{isAr ? 'العنوان الفرعي (عربي)' : 'Subtitle (AR)'}</label>
                  <input
                    type="text"
                    value={printSettings.subtitleAr}
                    onChange={e => setPrintSettings(p => ({ ...p, subtitleAr: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-550 uppercase">{isAr ? 'العنوان الفرعي (إنجليزي)' : 'Subtitle (EN)'}</label>
                  <input
                    type="text"
                    value={printSettings.subtitleEn}
                    onChange={e => setPrintSettings(p => ({ ...p, subtitleEn: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              {/* Tax Register options */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase block">{isAr ? 'الرقم الضريبي الموحد للمنشأة' : 'Corporate Tax ID Registration'}</label>
                <input
                  type="text"
                  value={printSettings.taxNumber}
                  onChange={e => setPrintSettings(p => ({ ...p, taxNumber: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-850 text-xs font-mono font-bold text-[#d4af37] rounded-xl px-3 py-2 outline-none"
                />
              </div>

              {/* Layout Custom Margins */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 block uppercase">{isAr ? 'هوامش ومقاسات محاذاة الصفحة' : 'Layout Margin Borders'}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'none', label: isAr ? 'بلا هوامش (0)' : 'No Margin' },
                    { id: 'minimal', label: isAr ? 'هوامش ضيقة (5mm)' : 'Minimal' },
                    { id: 'default', label: isAr ? 'افتراضي (12mm)' : 'Standard' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setPrintSettings(prev => ({ ...prev, margins: opt.id as any }))}
                      className={`px-3 py-2 rounded-lg border text-[11px] font-bold text-center transition ${printSettings.margins === opt.id ? 'bg-[#d4af37]/15 text-[#d4af37] border-[#d4af37]' : 'bg-slate-950 border-slate-850 text-slate-400'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout Font Size Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 block uppercase">{isAr ? 'حجم الخط الأساسي في مستند الفاتورة' : 'Invoice Typography Font Size'}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'xs', label: isAr ? 'صغير جداً' : 'XS' },
                    { id: 'sm', label: isAr ? 'صغير' : 'Small' },
                    { id: 'md', label: isAr ? 'متوسط' : 'Medium' },
                    { id: 'lg', label: isAr ? 'كبير' : 'Large' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setPrintSettings(prev => ({ ...prev, fontSize: opt.id as any }))}
                      className={`px-1 py-1.5 rounded border text-[10px] font-black text-center transition ${printSettings.fontSize === opt.id ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]' : 'bg-slate-950 border-slate-850 text-slate-400'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle Switches */}
              <div className="space-y-2 border-t border-slate-850 pt-4">
                <span className="text-[10px] text-slate-550 block font-black uppercase tracking-widest mb-1">{isAr ? 'عناصر وهوامش المخرجات' : 'Toggle Specific Print Components'}</span>

                <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl cursor-pointer hover:bg-slate-900/50 transition">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-white">{isAr ? 'إدراج شعار سويفت شيب' : 'Include Corporate Identity Logo'}</span>
                    <span className="text-[9.5px] text-slate-500">{isAr ? 'عرض الشعار أعلى الرأس' : 'Render top logo overlay'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={printSettings.showLogo}
                    onChange={e => setPrintSettings(p => ({ ...p, showLogo: e.target.checked }))}
                    className="w-4 h-4 text-[#d4af37] accent-[#d4af37] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl cursor-pointer hover:bg-slate-900/50 transition">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-white">{isAr ? 'إظهار الرمز الشريطي والباركود' : 'Show Transaction Barcode'}</span>
                    <span className="text-[9.5px] text-slate-500">{isAr ? 'تسهيل التدقيق والمسح الضوئي للشحنة' : 'Fast receipt scanning barcode'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={printSettings.showBarcode}
                    onChange={e => setPrintSettings(p => ({ ...p, showBarcode: e.target.checked }))}
                    className="w-4 h-4 text-[#d4af37] accent-[#d4af37] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl cursor-pointer hover:bg-slate-900/50 transition">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-white">{isAr ? 'دمج مربعات التواقيع والاعتماد' : 'Add Auditor Signature Boxes'}</span>
                    <span className="text-[9.5px] text-slate-550">{isAr ? 'إضافة توقيع (المستلم، المحاسب، المدير العام)' : 'Render client, accountant, & admin signature slots'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={printSettings.showSignatures}
                    onChange={e => setPrintSettings(p => ({ ...p, showSignatures: e.target.checked }))}
                    className="w-4 h-4 text-[#d4af37] accent-[#d4af37] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl cursor-pointer hover:bg-slate-900/50 transition">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-white">{isAr ? 'تاريخ وقت المستند تلقائياً' : 'Show Datetime Stamps'}</span>
                    <span className="text-[9.5px] text-slate-550">{isAr ? 'طبع تاريخ ووقت المعاملة اللحظي' : 'Affix timestamp to print document'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={printSettings.showDateTime}
                    onChange={e => setPrintSettings(p => ({ ...p, showDateTime: e.target.checked }))}
                    className="w-4 h-4 text-[#d4af37] accent-[#d4af37] rounded"
                  />
                </label>
              </div>

              {/* Footer text (Arabic) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase block">{isAr ? 'ملاحظات وبنود تذييل الفاتورة (عربي)' : 'Footer Terms Text (AR)'}</label>
                <textarea
                  rows={2}
                  value={printSettings.footerTextAr}
                  onChange={e => setPrintSettings(p => ({ ...p, footerTextAr: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Footer text (English) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-550 uppercase block">{isAr ? 'ملاحظات وبنود تذييل الفاتورة (إنجليزي)' : 'Footer Terms Text (EN)'}</label>
                <textarea
                  rows={2}
                  value={printSettings.footerTextEn || ''}
                  onChange={e => setPrintSettings(p => ({ ...p, footerTextEn: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Table style */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 block uppercase">{isAr ? 'نمط الجدول والتأثير البصري للبيانات' : 'Ledger Table Border Layout'}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'solid', label: isAr ? 'خطوط متصلة' : 'Solid Border' },
                    { id: 'dashed', label: isAr ? 'متقطع رياضي' : 'Dashed Lines' },
                    { id: 'minimal', label: isAr ? 'بسيط مفرغ' : 'Minimal' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPrintSettings(prev => ({ ...prev, tableStyle: opt.id as any }))}
                      className={`px-2 py-2 rounded-xl border text-[11px] font-bold text-center transition ${printSettings.tableStyle === opt.id ? 'bg-[#d4af37]/15 text-[#d4af37] border-[#d4af37]' : 'bg-slate-950 border-slate-850 text-slate-400'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block uppercase">{isAr ? 'نوع الخط وهندسة الكلمات المطبوعة' : 'Typography Font Family'}</label>
                <select
                  value={printSettings.fontFamily || 'Cairo'}
                  onChange={e => setPrintSettings(p => ({ ...p, fontFamily: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                >
                  <option value="Cairo">{isAr ? 'Cairo (خط دبي السلس - افتراضي)' : 'Cairo (Modern AR Sans)'}</option>
                  <option value="Inter">{isAr ? 'Inter (خط هندسي عالمي مفصل)' : 'Inter (International Sans)'}</option>
                  <option value="Segoe UI">{isAr ? 'Segoe UI (واجهة كشوفات الأعمال)' : 'Segoe UI (Systems Standard)'}</option>
                  <option value="JetBrains Mono">{isAr ? 'JetBrains Mono (جمالية الأكواد والرياضيات)' : 'JetBrains Mono (Technical Mono)'}</option>
                </select>
              </div>

              {/* Logo custom upload system */}
              <div className="space-y-1.5 pt-2 border-t border-slate-850">
                <label className="text-[10px] font-black text-slate-400 block uppercase">{isAr ? 'شعار وهوية العلامة التجارية المطبوعة' : 'Business Branding Logo'}</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder={isAr ? 'ضع رابط صورة الشعار URL (أو ارفع ملف بالأسفل)' : 'Logo Image URL Link'}
                    value={printSettings.logoUrl}
                    onChange={e => setPrintSettings(p => ({ ...p, logoUrl: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 text-xs font-mono text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                  />

                  <div className="relative border border-dashed border-slate-800 hover:border-[#d4af37]/35 rounded-xl bg-slate-950 p-3 text-center cursor-pointer transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPrintSettings(p => ({ ...p, logoUrl: reader.result as string }));
                            notificationService.notify({
                              title: isAr ? 'تم تحميل الشعار' : 'Logo Uploaded',
                              message: isAr ? 'تم تحويل الصورة محلياً وحفظ هوية الرأس بنجاح' : 'Custom picture loaded successfully',
                              type: 'success'
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400 text-xs py-1">
                      <DownloadIcon className="w-4 h-4 text-[#d4af37]" />
                      <span className="font-extrabold">{isAr ? 'اسحب أو اختر ملف صورة كشعار من جهازك' : 'Choose local image file'}</span>
                      <span className="text-[9px] text-slate-600">JPG, PNG, WEBP, SVG</span>
                    </div>
                  </div>

                  {printSettings.logoUrl && (
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-850 p-2 rounded-xl">
                      <img src={printSettings.logoUrl} alt="Logo preview" className="h-8 max-w-[130px] object-contain rounded bg-white p-1" />
                      <button
                        type="button"
                        onClick={() => setPrintSettings(p => ({ ...p, logoUrl: '' }))}
                        className="text-[10px] text-red-400 hover:text-red-300 font-extrabold px-2.5 py-1 bg-red-500/10 rounded-lg"
                      >
                        {isAr ? 'حذف الشعار التعبيري' : 'Delete Logo'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Signature custom titles editor */}
              <div className="space-y-3.5 border-t border-slate-850 pt-3">
                <span className="text-[10px] text-slate-550 block font-black uppercase tracking-widest">{isAr ? 'تخصيص أسماء وعناوين مربعات التواقيع' : 'Custom Auditor Signature Labels'}</span>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400">{isAr ? 'توقيع 1 (عربي)' : 'Sign 1 (AR)'}</label>
                      <input
                        type="text"
                        value={printSettings.signature1Ar || ''}
                        onChange={e => setPrintSettings(p => ({ ...p, signature1Ar: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500">{isAr ? 'توقيع 1 (إنجليزي)' : 'Sign 1 (EN)'}</label>
                      <input
                        type="text"
                        value={printSettings.signature1En || ''}
                        onChange={e => setPrintSettings(p => ({ ...p, signature1En: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400">{isAr ? 'توقيع 2 (عربي)' : 'Sign 2 (AR)'}</label>
                      <input
                        type="text"
                        value={printSettings.signature2Ar || ''}
                        onChange={e => setPrintSettings(p => ({ ...p, signature2Ar: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500">{isAr ? 'توقيع 2 (إنجليزي)' : 'Sign 2 (EN)'}</label>
                      <input
                        type="text"
                        value={printSettings.signature2En || ''}
                        onChange={e => setPrintSettings(p => ({ ...p, signature2En: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400">{isAr ? 'توقيع 3 (عربي)' : 'Sign 3 (AR)'}</label>
                      <input
                        type="text"
                        value={printSettings.signature3Ar || ''}
                        onChange={e => setPrintSettings(p => ({ ...p, signature3Ar: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500">{isAr ? 'توقيع 3 (إنجليزي)' : 'Sign 3 (EN)'}</label>
                      <input
                        type="text"
                        value={printSettings.signature3En || ''}
                        onChange={e => setPrintSettings(p => ({ ...p, signature3En: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preset design styling colors selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-450 block uppercase">{isAr ? 'لون الهوية والمحاور المالية للمستند' : 'Corporate Identity Hex color'}</label>
                <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2.5 rounded-xl">
                  {['#d4af37', '#10b981', '#ef4444', '#3b82f6', '#000000', '#f59e0b', '#8b5cf6'].map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setPrintSettings(prev => ({ ...prev, primaryColor: col }))}
                      className="w-7 h-7 rounded-full border border-slate-800 transition transform hover:scale-110 flex items-center justify-center relative"
                      style={{ backgroundColor: col }}
                    >
                      {printSettings.primaryColor === col && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />}
                    </button>
                  ))}

                  {/* Hex input and inline standard color picker */}
                  <div className="flex items-center gap-1.5 border-l border-slate-850 pl-3 ml-2 shrink-0">
                    <input
                      type="color"
                      value={printSettings.primaryColor}
                      onChange={e => setPrintSettings(p => ({ ...p, primaryColor: e.target.value }))}
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={printSettings.primaryColor}
                      onChange={e => setPrintSettings(p => ({ ...p, primaryColor: e.target.value }))}
                      className="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[9.5px] font-mono text-[#d4af37]"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: Live print mock visualization box */}
          <div className="lg:col-span-7 space-y-4">
            <span className="text-xs font-black text-[#d4af37] uppercase flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {isAr ? 'شاشة الرصد والمعاينة المباشرة واللحظية للقالب' : 'Live Interactive Visual Output Sandbox'}
            </span>

            {/* Simulated Sheet container reflecting their exact selected paper size */}
            <div className="bg-slate-950/60 border border-slate-850 p-6 rounded-3xl flex justify-center shadow-inner overflow-x-auto min-h-[500px]">
              <div
                className={`bg-white text-black p-6 rounded-xl shadow-2xl relative border border-slate-300 text-start`}
                style={{
                  width: printSettings.paperSize.startsWith('80mm') ? '300px' : printSettings.paperSize.startsWith('58mm') ? '240px' : '520px',
                  minHeight: '400px',
                  fontFamily: `"${printSettings.fontFamily || 'Cairo'}", sans-serif`,
                  fontSize: printSettings.fontSize === 'xs' ? '10px' : printSettings.fontSize === 'sm' ? '12px' : printSettings.fontSize === 'md' ? '14px' : '16px'
                }}
              >

                {/* Simulated Stamp Logo */}
                {printSettings.showLogo && (
                  <div className="flex justify-center mb-4 border-b pb-3 border-slate-200">
                    {printSettings.logoUrl ? (
                      <img src={printSettings.logoUrl} alt="Logo" className="h-10 object-contain max-w-[180px] p-0.5 bg-white rounded" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-mono font-black" style={{ backgroundColor: printSettings.primaryColor }}>SS</div>
                        <span className="font-mono font-black text-xs tracking-widest text-[#000000]">SWIFTSHIP</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Company Headers from Editor */}
                <div className="text-center space-y-1 mb-5">
                  <h4 className="font-extrabold text-[15px] leading-tight" style={{ color: printSettings.primaryColor }}>{printSettings.headerTitleAr}</h4>
                  <h5 className="font-mono font-bold text-[11px] text-slate-600 tracking-wider uppercase leading-none">{printSettings.headerTitleEn}</h5>
                  <p className="text-[10px] text-slate-500 font-bold">{printSettings.subtitleAr}</p>
                  <p className="text-[9px] font-mono text-slate-400 font-semibold uppercase">{printSettings.subtitleEn}</p>
                </div>

                {/* Document Subtitle based on layout */}
                <div className="border border-slate-300 bg-slate-100 p-2.5 rounded-lg text-center font-bold text-[11px] mb-4">
                  <span>{isAr ? 'سند مالي مؤقت ومصادق / شحن بضائع مستحقة' : 'Receipt Voucher - Cargo Ledger'}</span>
                </div>

                {/* Mock data specs */}
                <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-600 border-b pb-3 mb-4">
                  <div>
                    <span>{isAr ? 'الرقم المرجعي للمستند:' : 'Doc Reference:'} </span>
                    <strong className="text-black font-mono">ALX-ORD-1153</strong>
                  </div>
                  <div className="text-right">
                    <span>{isAr ? 'كود العقد المالي:' : 'Account Ledger:'} </span>
                    <strong className="text-black font-mono">110-CUST399</strong>
                  </div>
                  <div>
                    <span>{isAr ? 'التاريخ الفعلي:' : 'Submission Date:'} </span>
                    <strong className="text-black font-mono">2026-06-11</strong>
                  </div>
                  <div className="text-right">
                    <span>{isAr ? 'الرقابة الضريبية:' : 'Corporate Tax ID:'} </span>
                    <strong className="text-black font-mono">{printSettings.taxNumber}</strong>
                  </div>
                </div>

                {/* Mock Items list */}
                <div className="space-y-2 text-[10px] border-b pb-4 mb-4">
                  <div className="flex justify-between font-bold text-slate-500 border-b pb-1">
                    <span>{isAr ? 'البيانات وتوصيف الحركة' : 'Item Particulars'}</span>
                    <span>{isAr ? 'القيمة الإجمالية' : 'Cost sum'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isAr ? 'شحن طرد كرتون ومواد تجميع خاصة' : 'Procure and Parcel Cargo Courier'}</span>
                    <strong className="font-mono">1,150 SAR</strong>
                  </div>
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>{isAr ? 'خدمات التغليف المؤمن (صندوق خشبي)' : 'Solid Wood Packaging Services'}</span>
                    <strong className="font-mono">50 SAR</strong>
                  </div>
                  <div className="flex justify-between font-black text-xs pt-1.5 border-t border-dashed">
                    <span>{isAr ? 'الرصيد الصافي المجمع:' : 'Net Aggregate Total:'}</span>
                    <span className="font-mono text-emerald-600">1,200 SAR</span>
                  </div>
                </div>

                {/* Simulated Barcode */}
                {printSettings.showBarcode && (
                  <div className="flex flex-col items-center justify-center py-2 mb-4">
                    <div className="w-36 h-6 border bg-slate-100 flex items-center justify-center text-[7px] font-mono tracking-[4px] font-bold text-slate-500 border-slate-200">
                      |||||||||||||||||||||||
                    </div>
                    <span className="text-[7.5px] font-mono mt-1 text-slate-400">ALX-1153-CUST</span>
                  </div>
                )}

                {/* Footer notes text */}
                <div className="text-center text-[9px] text-slate-500 italic font-bold mb-6">
                  <p className="leading-relaxed leading-3">{printSettings.footerTextAr}</p>
                  <p className="font-mono mt-1 leading-3">{printSettings.footerTextEn}</p>
                </div>

                {/* Verified Signature layout */}
                {printSettings.showSignatures && (
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[7px] font-bold border-t pt-3">
                    <div className="flex flex-col">
                      <span className="text-slate-400 italic mb-4">
                        {isAr
                          ? (printSettings.signature1Ar || 'توقيع المستلم والعميل')
                          : (printSettings.signature1En || 'Recipient Stamp')}
                      </span>
                      <div className="border-b w-full" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 italic mb-4">
                        {isAr
                          ? (printSettings.signature2Ar || 'اعتماد المحاسب المسؤول')
                          : (printSettings.signature2En || 'Corporate Auditor')}
                      </span>
                      <div className="border-b w-full" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 italic mb-4">
                        {isAr
                          ? (printSettings.signature3Ar || 'المدير العام والختم')
                          : (printSettings.signature3En || 'Corporate Director')}
                      </span>
                      <div className="border-b w-full" />
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      )}

      {/* DETAILED PRINT DIALOG/PREVIEW CANVAS ONLY SHOWN IN PRINT OVERLAY MODAL */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-[#0c0c0f] border border-[#d4af37]/30 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col font-sans">

            {/* Header overlay */}
            <div className="bg-black/40 p-5 border-b border-slate-850 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-md font-black text-white">{isAr ? 'نافذة اعتماد وطباعة القيود والسجلات الموحدة' : 'Unified Voucher Standard Printing Dialog'}</h3>
                <p className="text-xs text-slate-500 mt-1">{isAr ? 'هذا المستند يتوافق مع إعدادات قالب الطباعة النشط لتجنب تشوه الخطوط العربية' : 'Active PDF and paper print matching your template style.'}</p>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1 px-3 text-xs font-black rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>

            {/* Zoom / Scale Controller Overlay */}
            <div className="bg-slate-950 px-5 py-2.5 border-b border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 text-xs text-slate-350">
              <div className="flex items-center gap-2">
                <span className="text-slate-450 font-bold">{isAr ? 'مستوى تكبير/تصغير المعاينة بالملفات الشاشة:' : 'Screen Zoom Level:'}</span>
                <span className="font-mono text-[#d4af37] font-black">{Math.round(printZoomScale * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintZoomScale(prev => Math.max(0.4, prev - 0.05))}
                  className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center font-bold text-white border border-slate-800 hover:border-[#d4af37]/35 transition text-xs select-none"
                >
                  -
                </button>
                <input
                  type="range"
                  min="0.3"
                  max="1.5"
                  step="0.05"
                  value={printZoomScale}
                  onChange={(e) => setPrintZoomScale(parseFloat(e.target.value))}
                  className="w-28 sm:w-40 accent-[#d4af37]"
                />
                <button
                  type="button"
                  onClick={() => setPrintZoomScale(prev => Math.min(1.5, prev + 0.05))}
                  className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center font-bold text-white border border-slate-800 hover:border-[#d4af37]/35 transition text-xs select-none"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setPrintZoomScale(0.85)}
                  className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-300 font-bold hover:text-white rounded text-[10px]"
                >
                  {isAr ? 'إعادة ضبط' : 'Reset'}
                </button>
              </div>
              <button
                type="button"
                onClick={triggerNativePrint}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#d4af37] hover:bg-yellow-500 text-black font-black rounded-xl text-xs transition shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                {isAr ? 'طباعة المستند الآن' : 'Print Document'}
              </button>
            </div>

            {/* Printable Frame content */}
            <div className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-8 flex justify-center bg-slate-950/40">

              {/* Scale container wrapping the target print canvas */}
              <div
                style={{
                  transform: `scale(${printZoomScale})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.1s ease-out',
                  height: `${297 * printZoomScale}mm`,
                  width: printSettings.paperSize === '80mm' ? '80mm' : printSettings.paperSize === '58mm' ? '58mm' : '210mm'
                }}
                className="shrink-0 animate-fade-in"
              >

                {/* PRINT CANVAS TARGET: Will be the unique component shown on print */}
                <div
                  id="print-invoice-canvas"
                  className="bg-white text-black p-8 shadow-2xl relative border border-slate-300 text-start"
                  style={{
                    width: printSettings.paperSize === '80mm' ? '80mm' : printSettings.paperSize === '58mm' ? '58mm' : '100%',
                    maxWidth: ['80mm', '58mm'].includes(printSettings.paperSize) ? 'none' : '210mm',
                    minHeight: '297mm',
                    boxSizing: 'border-box',
                    fontFamily: `"${printSettings.fontFamily || 'Cairo'}", sans-serif`,
                    fontSize: printSettings.fontSize === 'xs' ? '11px' : printSettings.fontSize === 'sm' ? '13px' : printSettings.fontSize === 'md' ? '15px' : '17px'
                  }}
                >

                  {/* Logo Section */}
                  {printSettings.showLogo && (
                    <div className="flex justify-center mb-6 pb-4 border-b border-slate-200">
                      {printSettings.logoUrl ? (
                        <img src={printSettings.logoUrl} alt="Logo" className="h-12 object-contain max-w-[210px] p-1 bg-white rounded" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-mono font-black" style={{ backgroundColor: printSettings.primaryColor }}>SS</div>
                          <span className="font-mono font-black text-[13px] tracking-widest text-[#000000]">SWIFTSHIP LOGISTICS</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Print Title Header */}
                  <div className="text-center space-y-1 mb-6">
                    <h2 className="font-extrabold text-[18px] leading-tight" style={{ color: printSettings.primaryColor }}>{printSettings.headerTitleAr}</h2>
                    <h3 className="font-mono font-bold text-[12px] text-slate-600 tracking-wider uppercase leading-none">{printSettings.headerTitleEn}</h3>
                    <p className="text-[11px] text-slate-500 font-bold">{printSettings.subtitleAr}</p>
                    <p className="text-[10px] font-mono text-slate-400 font-semibold uppercase">{printSettings.subtitleEn}</p>
                  </div>

                  {/* Subtitle banner */}
                  <div className="border border-slate-300 bg-slate-100 p-3 rounded-lg text-center font-bold text-[13px] mb-6">
                    <span>
                      {(() => {
                        if (activeReport === 'orders_cost') {
                          return selectedOrderId ? (isAr ? `تقرير تفاصيل شحنة الطلب رقم: ${selectedOrderId}` : `Detailed Statement for Shipment: ${selectedOrderId}`) : (isAr ? 'تقرير ومكاسب تكاليف الطلبات والشحنات المجمعة' : 'All Orders Cost Summary Ledger');
                        }
                        if (activeReport === 'customers') {
                          return selectedCustomerId ? (isAr ? `كشف حساب تفصيلي للعميل: ${customers.find(c => c.id === selectedCustomerId)?.fullName || ''}` : `Detailed Account Statement: ${customers.find(c => c.id === selectedCustomerId)?.fullName || ''}`) : (isAr ? 'كشف تفصيلي بالعملاء والذمم والمديونيات' : 'Customers Outstanding Balances Ledger');
                        }
                        if (activeReport === 'couriers') {
                          return selectedCourierId ? (isAr ? `سجل تصفية عهدة المندوب: ${couriers.find(c => c.id === selectedCourierId)?.fullName || ''}` : `Courier Custody Statement: ${couriers.find(c => c.id === selectedCourierId)?.fullName || ''}`) : (isAr ? 'تقرير عهد وتحصيل وتوزيع المندوبين الكلي' : 'Couriers Collection & Custodies Summary');
                        }
                        if (activeReport === 'shipping_companies') {
                          return selectedCompanyId ? (isAr ? `كشف حساب شركة الشحن: ${selectedCompanyId}` : `Shipping Carrier Statement: ${selectedCompanyId}`) : (isAr ? 'تقرير شركات الشحن والعمولات اللوجستية العامة' : 'Partner Carriers & Commissions Audit');
                        }
                        if (activeReport === 'users') {
                          return selectedUserId ? (isAr ? `مسير رواتب وعمولات الموظف: ${users.find(u => u.id === selectedUserId)?.fullName || ''}` : `Employee Payroll Voucher: ${users.find(u => u.id === selectedUserId)?.fullName || ''}`) : (isAr ? 'تقرير الموظفين والرواتب والعمولات المجمعة' : 'Corporate Payroll & Employee Matrix');
                        }
                        if (activeReport === 'expenses') {
                          return selectedExpenseCategory ? (isAr ? `كشف مصرفات ونفقات فئة: ${selectedExpenseCategory}` : `Categorized Expense Statement: ${selectedExpenseCategory}`) : (isAr ? 'تقرير المصروفات والمدفوعات المتنوعة المجمعة' : 'Operating Expenses Ledger Dashboard');
                        }
                        if (activeReport === 'packaging') {
                          return (isAr ? 'تقرير رسوم التغليف والتعبئة وتكاليف شحن محلي' : 'Packaging and wrapping fees statement');
                        }
                        if (activeReport === 'account_ledger') {
                          return (isAr ? 'كشف الحساب التفصيلي للتدقيق المحاسبي الموحد' : 'Unified Accounting Ledger General Audit');
                        }
                        return (isAr ? 'تقرير نظام ألكس للخدمات اللوجستية' : 'alx Logistics Custom Export Document');
                      })()}
                    </span>
                  </div>

                  {/* Parameters specs metadesk */}
                  <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 border-b pb-4 mb-6">
                    <div>
                      <span>{isAr ? 'الفترة الزمنية:' : 'Statement Period:'} </span>
                      <strong className="text-black font-semibold">{filters.startDate} {isAr ? 'إلى' : 'to'} {filters.endDate}</strong>
                    </div>
                    <div className="text-right">
                      <span>{isAr ? 'تاريخ وقت الطباعة:' : 'Date Issued:'} </span>
                      <strong className="text-black font-mono">{format(new Date(), 'yyyy-MM-dd HH:mm')}</strong>
                    </div>
                    <div>
                      <span>{isAr ? 'الرقابة والترخيص الضريبي:' : 'Corporate Tax ID:'} </span>
                      <strong className="text-black font-mono">{printSettings.taxNumber}</strong>
                    </div>
                    <div className="text-right">
                      <span>{isAr ? 'نوع المستند والتقرير:' : 'Document Classification:'} </span>
                      <strong className="text-black uppercase font-bold">{activeReport} {selectedOrderId || selectedCustomerId || selectedCourierId || selectedCompanyId || selectedUserId || selectedExpenseCategory ? ' (DETAIL)' : ' (INDEX)'}</strong>
                    </div>
                  </div>

                  {/* Table details containing real filtered data rows */}
                  <div className="mb-8">
                    {(() => {
                      // 1. Order Detail Printout card
                      if (activeReport === 'orders_cost' && selectedOrderId !== null) {
                        const o = orders.find(ord => ord.id === selectedOrderId || ord.orderNumber === selectedOrderId);
                        if (!o) return <p className="text-center py-4 font-bold text-slate-500">{isAr ? 'الطلب غير متوفر' : 'Order not found'}</p>;
                        return (
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-[#000] border-b pb-1 text-sm">{isAr ? 'تفاصيل شحنة الطلب وعقد النقل' : 'Detailed Freight Invoice Logistics'}</h4>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div><span className="text-slate-500">{isAr ? 'رقم الطلب:' : 'Order Ref:'}</span> <strong className="font-mono text-black">{o.orderNumber || o.id}</strong></div>
                              <div><span className="text-slate-500">{isAr ? 'تاريخ الإنشاء:' : 'Date Issued:'}</span> <span className="font-mono">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'العميل المستلم:' : 'Customer Receipient:'}</span> <strong className="text-black">{o.customerName}</strong></div>
                              <div><span className="text-slate-500">{isAr ? 'هاتف الاتصال:' : 'Contact Phone:'}</span> <span className="font-mono">{o.customerPhone || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'المندوب الناقل:' : 'Courier Service:'}</span> <span>{o.courierName || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'شركة الشحن والمسار:' : 'Carrier Route:'}</span> <span>{o.shippingCompany || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'عدد القطع:' : 'Items count:'}</span> <span className="font-bold">{o.itemCount || 1}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'حالة الشحنة:' : 'Delivery status:'}</span> <span className="bg-slate-200 px-1.5 py-0.5 rounded font-black text-[9px] uppercase">{o.orderStatus}</span></div>
                            </div>

                            <table className="w-full text-xs text-right border-collapse border border-slate-300">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'البيان وتوصيف الحركة' : 'Particulars'}</th>
                                  <th className="p-2 text-right">{isAr ? 'القيمة المالية' : 'Amount'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="p-2 border-r border-slate-300">{isAr ? 'سعر قيمة شحن الطرد والأغراض' : 'Parcel Freight shipping charges'}</td>
                                  <td className="p-2 text-right font-mono font-bold">{parseFloat(o.totalPrice || '0').toLocaleString()} YER</td>
                                </tr>
                                <tr>
                                  <td className="p-2 border-r border-slate-300">{isAr ? 'تكاليف الخدمات اللوجستية ومصاريف التوريد' : 'Freight distribution & delivery fees'}</td>
                                  <td className="p-2 text-right font-mono">{(parseFloat(o.deliveryCost) || 0).toLocaleString()} YER</td>
                                </tr>
                                <tr className="bg-slate-50 font-bold border-t border-slate-300">
                                  <td className="p-2 border-r border-slate-300">{isAr ? 'المسدد من العميل فعلياً:' : 'Paid / Settled by client:'}</td>
                                  <td className="p-2 text-right font-mono text-emerald-600">{(parseFloat(o.amountPaid) || 0).toLocaleString()} YER</td>
                                </tr>
                                <tr className="bg-slate-50 font-black border-t-2 border-double border-slate-400">
                                  <td className="p-2 border-r border-slate-300 text-rose-500">{isAr ? 'الذمة المتبقية في الحساب:' : 'Outstanding Balance (Debt):'}</td>
                                  <td className="p-2 text-right font-mono text-rose-600">{(parseFloat(o.amountRemaining) || 0).toLocaleString()} YER</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // 2. Customer statement of account
                      if (activeReport === 'customers' && selectedCustomerId !== null) {
                        const cust = customers.find(c => c.id === selectedCustomerId);
                        if (!cust) return <p className="text-center py-4 font-bold text-slate-500">Customer not found</p>;
                        const custOrders = filteredData.orders.filter(o => o.customerId === cust.id || o.customerName === cust.fullName || o.customerPhone === cust.phone);
                        const grossSum = custOrders.reduce((sum, o) => sum + convertCurrency(parseFloat(o.totalPrice) || 0, o.currency || 'YER', 'YER'), 0);
                        const paidSum = custOrders.reduce((sum, o) => sum + convertCurrency(parseFloat(o.amountPaid) || 0, o.currency || 'YER', 'YER'), 0);
                        return (
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-[#000] border-b pb-1 text-sm">{isAr ? `كشف حساب تفصيلي للعميل: ${cust.fullName}` : `Statement Of Account: ${cust.fullName}`}</h4>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div><span className="text-slate-500">{isAr ? 'هاتف العميل:' : 'Phone phone:'}</span> <span className="font-mono text-black font-bold">{cust.phone || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'العنوان الجغرافي:' : 'Location Address:'}</span> <span className="font-bold">{cust.address || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'العملة المسجلة:' : 'Financial Currency:'}</span> <span className="font-black text-rose-600 font-mono">{cust.financialCurrency || 'SAR'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'الرصيد الختامي للدائنية:' : 'Terminal Balance Due:'}</span> <span className="font-black text-emerald-600 font-mono">{(cust.financialBalance || 0).toLocaleString()} {cust.financialCurrency || 'SAR'}</span></div>
                            </div>

                            <span className="text-xs font-black text-slate-800 block mt-2">{isAr ? 'سجل الشحنات والطلب المالي المرتبط' : 'Customer Associated Shipments Ledger'}</span>
                            <table className="w-full text-xs text-right border-collapse border border-slate-300">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'كود الطرد' : 'Order ID'}</th>
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'التاريخ' : 'Date'}</th>
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'الحالة' : 'Status'}</th>
                                  <th className="p-2 border-r border-slate-300 text-center">{isAr ? 'المسدد' : 'Paid'}</th>
                                  <th className="p-2 text-right">{isAr ? 'المجموع' : 'Total'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {custOrders.map(o => (
                                  <tr key={o.id} className="border-b border-slate-200">
                                    <td className="p-2 border-r border-slate-300 font-mono font-bold text-yellow-600">{o.orderNumber || o.id}</td>
                                    <td className="p-2 border-r border-slate-300 text-slate-500">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                    <td className="p-2 border-r border-slate-300 text-stone-600 uppercase font-bold text-[9px]">{o.orderStatus}</td>
                                    <td className="p-2 border-r border-slate-300 text-center text-emerald-600 font-bold">{(parseFloat(o.amountPaid) || 0).toLocaleString()} YER</td>
                                    <td className="p-2 text-right font-mono font-bold">{parseFloat(o.totalPrice || '0').toLocaleString()} YER</td>
                                  </tr>
                                ))}
                                {custOrders.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="p-4 text-center text-slate-400 italic">{isAr ? 'لا توجد شحنات مسجلة للعميل' : 'No shipments registered.'}</td>
                                  </tr>
                                )}
                                <tr className="bg-slate-100 font-extrabold border-t border-slate-300">
                                  <td colSpan={3} className="p-2 border-r border-slate-300 text-start">{isAr ? 'مجموع قيم العمليات والمدفوعات الكلية (YER):' : 'Sum Aggregate values (YER):'}</td>
                                  <td className="p-2 text-center text-emerald-600 font-mono">{paidSum.toLocaleString()}</td>
                                  <td className="p-2 text-right font-mono text-black">{grossSum.toLocaleString()}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // 3. Courier custody print card
                      if (activeReport === 'couriers' && selectedCourierId !== null) {
                        const courier = couriers.find(c => c.id === selectedCourierId);
                        if (!courier) return <p className="text-center py-4 font-bold text-slate-500">Courier not found</p>;
                        const coOrders = filteredData.orders.filter(o => o.shippingCourierId === courier.id || o.deliveryCourierId === courier.id || o.courierId === courier.id || o.courierName === courier.fullName);
                        return (
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-[#000] border-b pb-1 text-sm">{isAr ? `مسند تصفية العهد والمالية للمندوب: ${courier.fullName}` : `Courier Debt & Custody Settlement: ${courier.fullName}`}</h4>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div><span className="text-slate-500">{isAr ? 'البريد/الهاتف:' : 'Phone:'}</span> <span className="font-mono text-black font-bold">{courier.phone || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'طريقة الحساب:' : 'Delivery Model:'}</span> <span className="font-bold">{courier.courierType === 'sourcing' ? (isAr ? 'تجميع خارجي' : 'Sourcing') : (isAr ? 'توزيع داخلي' : 'Local')}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'العهدة المالية النشطة حالياً:' : 'Active Custody balance:'}</span> <strong className="font-mono text-rose-500">{(courier.outstandingCustody || 0).toLocaleString()} {courier.financialCurrency || 'SAR'}</strong></div>
                              <div><span className="text-slate-500">{isAr ? 'الرصيد والحساب المصادق:' : 'Terminal Balance:'}</span> <strong className="font-mono text-emerald-600">{(courier.financialBalance || 0).toLocaleString()} {courier.financialCurrency || 'SAR'}</strong></div>
                            </div>

                            <span className="text-xs font-black text-slate-800 block mt-2">{isAr ? 'سجل الطرود التي استلمها المندوب للتوصيل' : 'Custody Handled Shipments Checklist'}</span>
                            <table className="w-full text-xs text-right border-collapse border border-slate-300">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'كود الطرد' : 'Order ID'}</th>
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'توصيل العميل' : 'Receipient'}</th>
                                  <th className="p-2 border-r border-slate-300 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                                  <th className="p-2 text-right">{isAr ? 'العهدة المستحقة' : 'Due Custody'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {coOrders.map(o => (
                                  <tr key={o.id} className="border-b border-slate-200">
                                    <td className="p-2 border-r border-slate-300 font-mono font-bold text-yellow-600">{o.orderNumber || o.id}</td>
                                    <td className="p-2 border-r border-slate-300 font-bold text-black">{o.customerName}</td>
                                    <td className="p-2 border-r border-slate-300 text-center uppercase font-bold text-[9px]">{o.orderStatus}</td>
                                    <td className="p-2 text-right font-mono font-bold text-rose-500">{(parseFloat(o.amountRemaining) || 0).toLocaleString()} YER</td>
                                  </tr>
                                ))}
                                {coOrders.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="p-4 text-center text-slate-400 italic">{isAr ? 'لا توجد شحنات معنية للمندوب' : 'No shipments assigned currently.'}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // 4. Shipping Carriers view print details
                      if (activeReport === 'shipping_companies' && selectedCompanyId !== null) {
                        const sc = shippingCompanies.find(c => c.name === selectedCompanyId || c.id === selectedCompanyId) || { name: selectedCompanyId, type: 'INTERNATIONAL', phone: '-', dueAmount: 0 };
                        const coOrders = filteredData.orders.filter(o => o.shippingCompany === sc.name || o.shippingCompanyId === sc.id);
                        return (
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-[#000] border-b pb-1 text-sm">{isAr ? `كشف أداء وحساب شركة الشحن والمسار: ${sc.name}` : `Shipping Carrier Auditing: ${sc.name}`}</h4>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div><span className="text-slate-500">{isAr ? 'تصنيف خطوط الشحن:' : 'Carrier route type:'}</span> <span className="font-black text-yellow-600">{sc.type}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'رقم الاتصال والدعم:' : 'Operations Phone:'}</span> <span className="font-mono">{sc.phone || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'عدد الشحنات الكلي:' : 'Total orders routed:'}</span> <strong className="text-black font-mono">{coOrders.length}</strong></div>
                              <div><span className="text-slate-500">{isAr ? 'الذمة المالية والمستنقع:' : 'Outstanding due amount:'}</span> <strong className="font-mono text-rose-500">{(sc.dueAmount || 0).toLocaleString()} YER</strong></div>
                            </div>

                            <span className="text-xs font-black text-slate-800 block mt-2">{isAr ? 'كشف الشحنات التي تم نقلها عبر هذه الشركة' : 'Carrier Routed Cargo Bills'}</span>
                            <table className="w-full text-xs text-right border-collapse border border-slate-300">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'كود الشحنة' : 'Waybill ID'}</th>
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'العميل النهائي' : 'End Customer'}</th>
                                  <th className="p-2 border-r border-slate-300 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                                  <th className="p-2 text-right">{isAr ? 'القيمة الإجمالية' : 'Total charge'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {coOrders.map(o => (
                                  <tr key={o.id} className="border-b border-slate-200">
                                    <td className="p-2 border-r border-slate-300 font-mono font-bold text-yellow-600">{o.orderNumber || o.id}</td>
                                    <td className="p-2 border-r border-slate-300 text-black">{o.customerName}</td>
                                    <td className="p-2 border-r border-slate-300 text-center font-bold text-[9px] uppercase">{o.orderStatus}</td>
                                    <td className="p-2 text-right font-mono font-black">{parseFloat(o.totalPrice || '0').toLocaleString()} YER</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // 5. Users and Salaries detailed printout card
                      if (activeReport === 'users' && selectedUserId !== null) {
                        const u = users.find(user => user.id === selectedUserId);
                        if (!u) return <p className="text-center py-4 font-bold text-slate-500">Employee not found</p>;
                        return (
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-[#000] border-b pb-1 text-sm">{isAr ? `قسيمة رواتب وعمولات الموظف: ${u.fullName}` : `Employee payroll card statement: ${u.fullName}`}</h4>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div><span className="text-slate-500">{isAr ? 'المسمى الوظيفي:' : 'Job Designation:'}</span> <strong className="text-black font-bold uppercase">{u.role || '-'}</strong></div>
                              <div><span className="text-slate-500">{isAr ? 'رقم الهاتف:' : 'Phone phone:'}</span> <span className="font-mono">{u.phone || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'الراتب الأساسي الصافي:' : 'Base Monthly salary:'}</span> <strong className="font-mono text-emerald-600">{(u.baseSalary || 0).toLocaleString()} YER</strong></div>
                              <div><span className="text-slate-500">{isAr ? 'رصيد الذمة والحساب:' : 'Overage / outstanding balance:'}</span> <strong className="font-mono text-rose-500">{(u.financialBalance || 0).toLocaleString()} YER</strong></div>
                            </div>

                            <table className="w-full text-xs text-right border-collapse border border-slate-300">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'البند التفصيلي' : 'Payment Particular Label'}</th>
                                  <th className="p-2 text-right">{isAr ? 'القيمة المحتسبة' : 'Subtotal calculated'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="p-2 border-r border-slate-300">{isAr ? 'الراتب الشهري الأساسي المصادق' : 'Regular basic salary package'}</td>
                                  <td className="p-2 text-right font-mono">{(u.baseSalary || 0).toLocaleString()} YER</td>
                                </tr>
                                <tr>
                                  <td className="p-2 border-r border-slate-300">{isAr ? 'العمولات التشغيلية ومكافأت الاستحقاق' : 'Operational incentive commissions'}</td>
                                  <td className="p-2 text-right font-mono">0 YER</td>
                                </tr>
                                <tr className="bg-slate-50 font-black border-t-2 border-slate-400">
                                  <td className="p-2 border-r border-slate-300">{isAr ? 'صافي الحساب والرواتب المستحقة الصرف:' : 'Net Payroll due balance outstanding:'}</td>
                                  <td className="p-2 text-right font-mono text-emerald-600">{(u.baseSalary || 0).toLocaleString()} YER</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // 6. Expense category breakdown printout card
                      if (activeReport === 'expenses' && selectedExpenseCategory !== null) {
                        const catExpenses = filteredData.expenses.filter(e => e.category === selectedExpenseCategory);
                        const catSum = catExpenses.reduce((sum, e) => sum + convertToYER(parseFloat(e.amount) || 0, e.currency || 'YER'), 0);
                        return (
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-[#000] border-b pb-1 text-sm">{isAr ? `كشف تفصيلي لمصروفات تصنيف: ${selectedExpenseCategory}` : `Expense Statement Category: ${selectedExpenseCategory}`}</h4>

                            <table className="w-full text-xs text-right border-collapse border border-slate-300">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'رقم المصروف' : 'Doc ID'}</th>
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'الجهة المستفيدة' : 'Recipient'}</th>
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'شرح النفقة' : 'Narration'}</th>
                                  <th className="p-2 text-right">{isAr ? 'المقدار المالي' : 'Amount'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {catExpenses.map(e => (
                                  <tr key={e.id} className="border-b border-slate-200 font-medium">
                                    <td className="p-2 border-r border-slate-300 font-mono font-bold text-yellow-600">{e.expenseNumber}</td>
                                    <td className="p-2 border-r border-slate-300 text-black">{e.recipientName}</td>
                                    <td className="p-2 border-r border-slate-300 text-slate-500">{e.notes || '-'}</td>
                                    <td className="p-2 text-right font-mono font-black">{e.amount?.toLocaleString()} {e.currency}</td>
                                  </tr>
                                ))}
                                <tr className="bg-slate-50 font-extrabold border-t-2 border-slate-300">
                                  <td colSpan={3} className="p-2 border-r border-slate-300 text-end">{isAr ? 'مجموع نفقات التصنيف الإجمالي:' : 'Aggregate Expense Sum:'}</td>
                                  <td className="p-2 text-right font-mono text-rose-600">{catSum.toLocaleString()} YER</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // 7. DEFAULT: RENDER INDEX SPREADSHEET TABLE OF REPORT RANGE
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-right border-collapse border border-slate-300">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-300 font-black text-[12px]">
                                {activeReport === 'expenses' ? (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'كود السند' : 'Doc ID'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'فئة النفقة' : 'Category'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'المستلم' : 'Entity'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'البيان الوصفي' : 'Narration'}</th>
                                    <th className="p-3 text-right">{isAr ? 'المبلغ المالي' : 'Amount'}</th>
                                  </>
                                ) : activeReport === 'account_ledger' ? (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'الرقم المرجعي للقيد' : 'Voucher Ref'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'البيان التفصيلي والشرح' : 'Description'}</th>
                                    <th className="p-3 text-right">{isAr ? 'مدين (Debit)' : 'Debit'}</th>
                                    <th className="p-3 text-right">{isAr ? 'دائن (Credit)' : 'Credit'}</th>
                                    <th className="p-3 text-right">{isAr ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                                  </>
                                ) : activeReport === 'customers' ? (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'اسم العميل الموحد' : 'Customer'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'هاتف التواصل' : 'Phone'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'العنوان' : 'Address'}</th>
                                    <th className="p-3 text-right">{isAr ? 'الرصيد النهائي' : 'Balance'}</th>
                                  </>
                                ) : activeReport === 'couriers' ? (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'اسم المندوب' : 'Courier'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'طريقة الحساب' : 'Type'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'العهدة المعلقة بعهدته' : 'Pending Custody'}</th>
                                    <th className="p-3 text-right">{isAr ? 'رصيد الحساب المالي' : 'Balance'}</th>
                                  </>
                                ) : activeReport === 'shipping_companies' ? (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'اسم الشركة الناقلة' : 'Shipping Co'}</th>
                                    <th className="p-3 border-r border-slate-300 text-center">{isAr ? 'نوع خط الشحن' : 'Shipline Route'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'هاتف الاتصال' : 'Phone'}</th>
                                    <th className="p-3 text-right">{isAr ? 'الرصيد والذمة المستحقة' : 'Outstanding Balance'}</th>
                                  </>
                                ) : activeReport === 'users' ? (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'اسم الموظف' : 'Employee'}</th>
                                    <th className="p-3 border-r border-slate-300 uppercase text-slate-600 font-bold">{isAr ? 'المسمى الوظيفي' : 'Job Role'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'الراتب الأساسي الصافي' : 'Base Salary'}</th>
                                    <th className="p-3 text-right">{isAr ? 'رصيد الذمة والحساب' : 'Balance'}</th>
                                  </>
                                ) : (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'رقم السند/الطلب' : 'Doc Num'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'اسم المستفيد/العميل' : 'Customer'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'الحالة والفرز' : 'Status'}</th>
                                    <th className="p-3 text-right">{isAr ? 'السعر النهائي' : 'Price Total'}</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {activeReport === 'expenses' ? (
                                filteredData.expenses.map(e => (
                                  <tr key={e.id} className="border-b border-slate-300 font-medium">
                                    <td className="p-3 border-r border-slate-300 font-mono text-slate-700">{e.expenseNumber}</td>
                                    <td className="p-3 border-r border-slate-300 uppercase">{e.category}</td>
                                    <td className="p-3 border-r border-slate-300">{e.recipientName}</td>
                                    <td className="p-3 border-r border-slate-300 text-slate-600">{e.notes || '-'}</td>
                                    <td className="p-3 text-right font-mono font-black">{e.amount?.toLocaleString()} {e.currency}</td>
                                  </tr>
                                ))
                              ) : activeReport === 'account_ledger' ? (
                                ledgerMetrics ? (
                                  ledgerMetrics.displayRows.map(tx => {
                                    const amt = parseFloat(tx.amount) || 0;
                                    return (
                                      <tr key={tx.id} className="border-b border-slate-300 font-medium">
                                        <td className="p-3 border-r border-slate-300 font-mono text-slate-600">
                                          {format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm')}
                                        </td>
                                        <td className="p-3 border-r border-slate-300 font-mono text-slate-700">{tx.refNumber}</td>
                                        <td className="p-3 border-r border-slate-300 text-slate-900 font-semibold">{tx.description}</td>
                                        <td className="p-3 text-right font-mono font-bold text-rose-600">
                                          {tx.type === 'Debit' ? `+${amt.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-emerald-600">
                                          {tx.type === 'Credit' ? `-${amt.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="p-3 text-right font-mono font-black">
                                          {tx.runningBalance.toLocaleString()} {tx.currencyOriginal || tx.currency || 'SAR'}
                                        </td>
                                      </tr>
                                    );
                                  })
                                ) : (
                                  <tr>
                                    <td colSpan={6} className="text-center p-4 italic text-slate-500">
                                      {isAr ? 'يرجى تحديد حساب مالي' : 'Please select an account'}
                                    </td>
                                  </tr>
                                )
                              ) : activeReport === 'customers' ? (
                                filteredData.customers.map(c => (
                                  <tr key={c.id} className="border-b border-slate-300 font-medium">
                                    <td className="p-3 border-r border-slate-300 font-bold">{c.fullName}</td>
                                    <td className="p-3 border-r border-slate-300 font-mono">{c.phone || '-'}</td>
                                    <td className="p-3 border-r border-slate-300">{c.address || '-'}</td>
                                    <td className="p-3 text-right font-mono font-black">{c.financialBalance?.toLocaleString()} {c.financialCurrency || 'SAR'}</td>
                                  </tr>
                                ))
                              ) : activeReport === 'couriers' ? (
                                filteredData.couriers.map(c => (
                                  <tr key={c.id} className="border-b border-slate-300 font-medium">
                                    <td className="p-3 border-r border-slate-300 font-bold">{c.fullName}</td>
                                    <td className="p-3 border-r border-slate-300">{c.courierType === 'sourcing' ? (isAr ? 'تجميع خارجي' : 'Sourcing') : (isAr ? 'توزيع داخلي' : 'Local')}</td>
                                    <td className="p-3 border-r border-slate-300 font-mono font-black text-rose-600">{(c.outstandingCustody || 0).toLocaleString()} {c.financialCurrency || 'SAR'}</td>
                                    <td className="p-3 text-right font-mono font-black">{(c.financialBalance || 0).toLocaleString()} {c.financialCurrency || 'SAR'}</td>
                                  </tr>
                                ))
                              ) : activeReport === 'shipping_companies' ? (
                                filteredData.shippingCompanies.map(sc => (
                                  <tr key={sc.id} className="border-b border-slate-300 font-medium">
                                    <td className="p-3 border-r border-slate-300 font-bold">{sc.name}</td>
                                    <td className="p-3 border-r border-slate-300 text-center font-bold text-[#d4af37] text-[10px] uppercase">{sc.type || 'INTERNATIONAL'}</td>
                                    <td className="p-3 border-r border-slate-300 font-mono text-slate-500">{sc.phone || '-'}</td>
                                    <td className="p-3 text-right font-mono font-black text-rose-500">-{sc.dueAmount?.toLocaleString() || 0} YER</td>
                                  </tr>
                                ))
                              ) : activeReport === 'users' ? (
                                filteredData.users.map(u => (
                                  <tr key={u.id} className="border-b border-slate-300 font-medium">
                                    <td className="p-3 border-r border-slate-300 font-bold">{u.fullName}</td>
                                    <td className="p-3 border-r border-slate-300 uppercase text-slate-650 font-semibold">{u.role || '-'}</td>
                                    <td className="p-3 border-r border-slate-300 font-mono">{(u.baseSalary || 0).toLocaleString()} YER</td>
                                    <td className="p-3 text-right font-mono font-black">{(u.financialBalance || 0).toLocaleString()} YER</td>
                                  </tr>
                                ))
                              ) : (
                                filteredData.orders.map(o => (
                                  <tr key={o.id} className="border-b border-slate-300 font-medium">
                                    <td className="p-3 border-r border-slate-300 font-mono text-[#d4af37]">{o.orderNumber}</td>
                                    <td className="p-3 border-r border-slate-300">{o.customerName}</td>
                                    <td className="p-3 border-r border-slate-300 uppercase">{o.orderStatus}</td>
                                    <td className="p-3 text-right font-mono font-black">{o.totalPrice?.toLocaleString()} YER</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Summary calculation parameters */}
                  <div className="flex justify-end mb-6">
                    <div className="w-1/2 border border-slate-300 rounded-xl p-4 space-y-2 text-xs">
                      <div className="flex justify-between border-b pb-1">
                        <span>{isAr ? 'المجموع المؤشر للحركات:' : 'Aggregate volume:'}</span>
                        <strong className="font-mono">
                          {activeReport === 'expenses' ? `${reportMetrics.costs.toLocaleString()} YER` :
                            activeReport === 'account_ledger' ? `${accountTransactions.length} Record` :
                              `${reportMetrics.revenue.toLocaleString()} YER`}
                        </strong>
                      </div>
                      <div className="flex justify-between font-black text-[#000000]">
                        <span>{isAr ? 'التصديق المالي والتدقيق المعتمد:' : 'Certified final balance:'}</span>
                        <strong className="font-mono">APPROVED</strong>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Barcode */}
                  {printSettings.showBarcode && (
                    <div className="flex flex-col items-center justify-center py-2 mb-6">
                      <div className="w-44 h-8 border bg-slate-100 flex items-center justify-center text-[8px] font-mono tracking-[5px] font-black text-slate-500 border-slate-300">
                        ||||||||||||||||||||||||||||||
                      </div>
                      <span className="text-[8px] font-mono mt-1 text-slate-400">ALX-SWIFT-REPORT-{format(new Date(), 'yyyyMMdd')}</span>
                    </div>
                  )}

                  {/* Footer instructions */}
                  <div className="text-center text-[10px] text-slate-500 italic font-bold mb-8">
                    <p className="leading-relaxed leading-4">{printSettings.footerTextAr}</p>
                    <p className="font-mono mt-1 leading-4">{printSettings.footerTextEn}</p>
                  </div>

                  {/* Print signatures slots */}
                  {printSettings.showSignatures && (
                    <div className="grid grid-cols-3 gap-3 text-center text-[8px] font-semibold border-t pt-4">
                      <div className="flex flex-col">
                        <span className="text-slate-400 italic mb-6">
                          {isAr
                            ? (printSettings.signature1Ar || 'توقيع المستلم والعميل')
                            : (printSettings.signature1En || 'Client Signature')}
                        </span>
                        <div className="border-b w-full" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 italic mb-6">
                          {isAr
                            ? (printSettings.signature2Ar || 'اعتماد المحاسب المسؤول والتدقيق')
                            : (printSettings.signature2En || 'Accountant Sign')}
                        </span>
                        <div className="border-b w-full" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 italic mb-6">
                          {isAr
                            ? (printSettings.signature3Ar || 'مسؤول مستند المدير والختم')
                            : (printSettings.signature3En || 'General Director Stamp')}
                        </span>
                        <div className="border-b w-full" />
                      </div>
                    </div>
                  )}

                </div>

              </div>

            </div>

            {/* Print and Export Controls */}
            <div className="p-4 bg-black/40 border-t border-slate-850 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-6 py-2.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-black"
              >
                {isAr ? 'إلغاء المعاينة' : 'Cancel'}
              </button>
              <button
                onClick={triggerNativePrint}
                className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl shadow-lg transition flex items-center gap-1.5 text-xs"
              >
                <Printer className="w-4 h-4" />
                {isAr ? 'تنفيذ الطباعة المباشرة' : 'Initiate Printing'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
