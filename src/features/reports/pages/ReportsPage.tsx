import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection, onSnapshot, query, orderBy, getDocs, doc, setDoc, getDoc, where, addDoc, deleteDoc
} from '../../../lib/supabase-adapter';
import { db } from '../../../lib/supabase-adapter';
import { useSettings } from '../../../context/SettingsContext';
import { useRole } from '../../../hooks/useRole';
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
import { printContent } from '../../../lib/printUtils';
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import * as XLSX from 'xlsx';
import { notificationService } from '../../../services/notificationService';
import { useExpenseCategories } from '../../../hooks/useExpenseCategories';
import { financialAccountService } from '../../../services/financialAccountService';
import { useExchangeRates } from '../../../hooks/useExchangeRates';
import { PrintDesignerPageTab } from './tabs/PrintDesignerPageTab';
import ReportsTabContent from './tabs/ReportsTabContent';
import { ReportPrintPreviewModal } from '../components/ReportPrintPreviewModal';
import { DEFAULT_PRINT_SETTINGS, REPORT_TYPES, type PrintTemplateSettings, type ReportFilter } from '../types/reports.types';

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

export default function ReportsPage() {
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

  const [mainEntriesMap, setMainEntriesMap] = useState<Map<string, any>>(new Map());

  // Subscribe to main_entry to track posting_status real-time
  useEffect(() => {
    const unsubMain = onSnapshot(collection(db, 'main_entry'), (snap) => {
      const map = new Map<string, any>();
      snap.docs.forEach((doc: any) => {
        map.set(doc.id, doc.data());
      });
      setMainEntriesMap(map);
    });
    return () => unsubMain();
  }, []);

  // Fetch ALL account transactions for general financial metrics calculation
  useEffect(() => {
    const qAllTxs = query(
      collection(db, 'account_trans'),
      orderBy('created_at', 'desc')
    );

    const unsub = onSnapshot(qAllTxs, (snap) => {
      const allRawTxs = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as any[];
      // Filter out non-posted entries (posting_status !== 'posted')
      const allTxs = allRawTxs.filter((tx: any) => {
        const entryId = tx.entryId || tx.entry_id;
        if (entryId) {
          const mainEntry = mainEntriesMap.get(entryId);
          if (!mainEntry) return false;
          const ps = mainEntry.postingStatus || mainEntry.posting_status || '';
          if (ps !== 'posted') return false;
        }
        return true;
      });

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
  }, [filters.startDate, filters.endDate, mainEntriesMap]);


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
      collection(db, 'account_trans'),
      orderBy('created_at', 'desc')
    );

    const unsub = onSnapshot(qTx, (snap) => {
      const allTxs = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as any[];
      const filtered = allTxs.filter((tx: any) => {
        // استبعاد أي حركة غير مرحّلة (posting_status !== 'posted')
        // Exclude non-posted entries
        const entryId = tx.entryId || tx.entry_id;
        if (entryId) {
          const mainEntry = mainEntriesMap.get(entryId);
          if (!mainEntry) return false;
          const ps = mainEntry.postingStatus || mainEntry.posting_status || '';
          if (ps !== 'posted') return false;
        }

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

  // Save changes to print settings template in supabase 
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

    const getTime = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      if (typeof val.toDate === 'function') return val.toDate().getTime();
      const d = new Date(val);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const isDebitNormal = (acc: any) => {
      const type = (acc.type || acc.accountType || '').trim();
      if (type === 'Asset' || type === 'Expense') return true;
      if (type === 'Liability' || type === 'Equity' || type === 'Revenue') return false;
      const cleanCode = (acc.accountCode || '').trim().toUpperCase();
      if (cleanCode.startsWith('1') || cleanCode.startsWith('5') || cleanCode.startsWith('AST') || cleanCode.startsWith('EXP')) return true;
      return false;
    };
    const debitNormal = isDebitNormal(selectedAccount);

    // Get all transactions of all time for this account (excluding temporary entries)
    const myAllTimeTxs = allTimeTransactions.filter((tx: any) => {
      if (tx.entryCategory === 'Temp' || tx.entry_category === 'Temp' || tx.category === 'Temp') return false;

      const matchesIdOrCode = tx.accountId === selectedAccount.id || tx.accountCode === selectedAccount.accountCode;
      const matchesEntity = selectedAccount.entityId && (tx.entityId === selectedAccount.entityId || tx.accountId === selectedAccount.entityId);
      const isTargetPackaging = selectedAccount.entityId === 'sys_packaging_fees' || selectedAccount.accountCode === '5100-7355';
      const matchesPackaging = isTargetPackaging && (tx.accountId === 'sys_packaging_fees' || tx.entityId === 'sys_packaging_fees');
      return matchesIdOrCode || matchesEntity || matchesPackaging;
    });

    // Sort chronologically (oldest first) to compute running balance
    const sortedAllTime = [...myAllTimeTxs].sort((a, b) => {
      const tA = getTime(a.createdAt || a.created_at);
      const tB = getTime(b.createdAt || b.created_at);
      return tA - tB;
    });

    let openingBalance = 0;
    let periodDebits = 0;
    let periodCredits = 0;

    sortedAllTime.forEach(tx => {
      const t = getTime(tx.createdAt || tx.created_at);
      const txDate = new Date(t);
      const amt = parseFloat(tx.amount) || 0;
      const isDebit = (tx.trans_type || tx.transType || tx.type) === 'Debit';

      if (txDate < start) {
        if (isDebit) {
          openingBalance += debitNormal ? amt : -amt;
        } else {
          openingBalance += debitNormal ? -amt : amt;
        }
      } else if (isWithinInterval(txDate, { start, end })) {
        if (isDebit) {
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
        const t = getTime(tx.createdAt || tx.created_at);
        const txDate = new Date(t);
        return isWithinInterval(txDate, { start, end });
      })
      .map(tx => {
        const amt = parseFloat(tx.amount) || 0;
        const isDebit = (tx.trans_type || tx.transType || tx.type) === 'Debit';
        if (isDebit) {
          currentRunning += debitNormal ? amt : -amt;
        } else {
          currentRunning += debitNormal ? -amt : amt;
        }
        return {
          ...tx,
          type: tx.trans_type || tx.transType || tx.type || 'Debit',
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

              <ReportsTabContent
                activeReport={activeReport}
                isAr={isAr}
                filteredData={filteredData}
                reportMetrics={reportMetrics}
                treasuryBalances={treasuryBalances}
                pnlData={pnlData}
                EXPENSE_CATEGORIES_DYNAMIC={EXPENSE_CATEGORIES_DYNAMIC}
                selectedExpenseCategory={selectedExpenseCategory}
                setSelectedExpenseCategory={setSelectedExpenseCategory}
                accountTransactions={accountTransactions}
                accounts={accounts}
                ledgerMetrics={ledgerMetrics}
                searchMatchList={searchMatchList}
                convertToYER={convertToYER}
                convertCurrency={convertCurrency}
                selectedPackagingAccountIds={selectedPackagingAccountIds}
                setSelectedPackagingAccountIds={setSelectedPackagingAccountIds}
                selectedOrdersCostAccountIds={selectedOrdersCostAccountIds}
                setSelectedOrdersCostAccountIds={setSelectedOrdersCostAccountIds}
                selectedShippingCompaniesAccountIds={selectedShippingCompaniesAccountIds}
                setSelectedShippingCompaniesAccountIds={setSelectedShippingCompaniesAccountIds}
                selectedOrderId={selectedOrderId}
                setSelectedOrderId={setSelectedOrderId}
                selectedCustomerId={selectedCustomerId}
                setSelectedCustomerId={setSelectedCustomerId}
                selectedCourierId={selectedCourierId}
                setSelectedCourierId={setSelectedCourierId}
                selectedCompanyId={selectedCompanyId}
                setSelectedCompanyId={setSelectedCompanyId}
                selectedUserId={selectedUserId}
                setSelectedUserId={setSelectedUserId}
                handleSaveAccountSelection={handleSaveAccountSelection}
                MultiAccountSelectorComponent={MultiAccountSelector}
              />
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
        <PrintDesignerPageTab
          isAr={isAr}
          printSettings={printSettings}
          setPrintSettings={setPrintSettings}
          savingTemplate={savingTemplate}
          handleSavePrintSettings={handleSavePrintSettings}
          handleResetPrintSettings={() => setPrintSettings(DEFAULT_PRINT_SETTINGS)}
        />
      )}

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
        ledgerMetrics={ledgerMetrics}
        initialPrintZoomScale={0.8}
        triggerNativePrint={triggerNativePrint}
        convertToYER={convertToYER}
        convertCurrency={convertCurrency}
      />
    </div>
  );
}
