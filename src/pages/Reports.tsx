import React, { useState, useMemo, useEffect } from 'react';
import { 
  collection, onSnapshot, query, orderBy, getDocs, doc, setDoc, getDoc, where
} from 'firebase/firestore';
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
  Save, CheckCircle2, ChevronDown, Check, Coins, Eye, ShoppingCart, UserCheck
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import * as XLSX from 'xlsx';
import { notificationService } from '../services/notificationService';

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
}

const DEFAULT_PRINT_SETTINGS: PrintTemplateSettings = {
  headerTitleAr: 'سويفت شيب للخدمات اللوجستية ش.م.م',
  headerTitleEn: 'SwiftShip Logistics L.L.C',
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
  primaryColor: '#d4af37'
};

const COLORS = ['#d4af37', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#f59e0b'];

const REPORT_TYPES = [
  { id: 'financial_overview', labelAr: 'التحليل المالي والأرباح العام', labelEn: 'Financial Overview & Profits', icon: TrendingUp },
  { id: 'expenses', labelAr: 'تقرير المصروفات التفصيلي', labelEn: 'Detailed Expenses', icon: FileText },
  { id: 'packaging', labelAr: 'تقرير رسوم التغليف وتكاليف أخرى', labelEn: 'Packaging & Other Costs', icon: Package },
  { id: 'orders_cost', labelAr: 'تقرير تكاليف الطلبات والشحنات', labelEn: 'Orders Cost Analysis', icon: ShoppingCart },
  { id: 'shipping_companies', labelAr: 'تقرير شركات الشحن والعمولات', labelEn: 'Shipping Companies Report', icon: Truck },
  { id: 'customers', labelAr: 'تقرير كشف العملاء والذمم والمديونيات', labelEn: 'Customers Ledger & Balances', icon: Users },
  { id: 'couriers', labelAr: 'تقرير المناديب والتحصيلات والعهدة المعلقة', labelEn: 'Couriers Registry & Custodies', icon: Truck },
  { id: 'users', labelAr: 'تقرير حسابات المستخدمين والرواتب', labelEn: 'Users & Staff Salaries', icon: UserCheck },
  { id: 'account_ledger', labelAr: 'تقرير تفصيلي لأي حساب (شجرة الحسابات)', labelEn: 'Detailed Account Ledger', icon: Layers },
];

const EXPENSE_CATEGORIES = [
  { id: 'all', labelAr: 'جميع التصنيفات', labelEn: 'All Categories' },
  { id: 'OPERATIONAL', labelAr: 'مصاريف تشغيلية', labelEn: 'Operational' },
  { id: 'FUEL', labelAr: 'بنزين ومحروقات', labelEn: 'Fuel' },
  { id: 'SALARY', labelAr: 'رواتب وأجور', labelEn: 'Salaries' },
  { id: 'PACKAGING', labelAr: 'تغليف وتعبئة', labelEn: 'Packaging' },
  { id: 'RENT', labelAr: 'إيجارات ومكاتب', labelEn: 'Rent' },
  { id: 'OTHER', labelAr: 'مصروفات أخرى', labelEn: 'Other' },
];

export default function Reports() {
  const { settings } = useSettings();
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
  const [loading, setLoading] = useState(true);

  // Tabs layout
  const [activeTab, setActiveTab] = useState<'reports' | 'templates'>('reports');

  // Print Template State
  const [printSettings, setPrintSettings] = useState<PrintTemplateSettings>(DEFAULT_PRINT_SETTINGS);
  const [savingTemplate, setSavingTemplate] = useState(false);

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

  // Active Print Slips Preview Modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Fetch Core collections from db
  useEffect(() => {
    if (roleLoading) return;

    const unsubOrders = onSnapshot(collection(db, 'orders'), snap => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubExp = onSnapshot(collection(db, 'expenses'), snap => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubCouriers = onSnapshot(collection(db, 'couriers'), snap => {
      setCouriers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubCustomers = onSnapshot(collection(db, 'customers'), snap => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubSources = onSnapshot(collection(db, 'sources'), snap => {
      setSources(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAccounts = onSnapshot(collection(db, 'accounts'), snap => {
      setAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubShipping = onSnapshot(collection(db, 'shipping_companies'), snap => {
      setShippingCompanies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
    };
  }, [roleLoading]);

  // Fetch detailed account transactions when account ID is selected
  useEffect(() => {
    if (!filters.accountId && !filters.entityId) {
      setAccountTransactions([]);
      return;
    }

    const targetAccountId = filters.accountId || 
      (filters.entityId ? accounts.find(a => a.entityId === filters.entityId)?.id : null);

    if (!targetAccountId) {
      setAccountTransactions([]);
      return;
    }

    const qTx = query(
      collection(db, 'account_transactions'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(qTx, (snap) => {
      const allTxs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const filtered = allTxs.filter((tx: any) => {
        const matchesAccount = tx.accountId === targetAccountId;
        if (!matchesAccount) return false;
        
        const txDate = new Date(tx.createdAt);
        const start = startOfDay(new Date(filters.startDate));
        const end = endOfDay(new Date(filters.endDate));
        return isWithinInterval(txDate, { start, end });
      });
      setAccountTransactions(filtered);
    });

    return () => unsub();
  }, [filters.accountId, filters.entityId, filters.startDate, filters.endDate, accounts]);

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
    if (activeReport === 'customers' && filters.entityId) {
      // Just that individual customer is reported
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
      couriers,
      customers,
      shippingCompanies
    };
  }, [orders, expenses, couriers, customers, shippingCompanies, filters, sortOrder, sortBy, activeReport]);

  const reportMetrics = useMemo(() => {
    const ordersList = filteredData.orders;
    const expensesList = filteredData.expenses;
    
    // Revenue calculations: Gross revenue of orders that are not Cancelled
    const revenue = ordersList
      .filter(o => o.orderStatus !== 'Cancelled')
      .reduce((sum, o) => sum + (parseFloat(o.totalPrice) || 0), 0);
      
    // Total cost from expenses list
    const costs = expensesList.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const profit = revenue - costs;
    
    // Individual costs for specific items
    const defaultPackaging = expensesList
      .filter(e => e.category === 'PACKAGING')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const operationalCosts = expensesList
      .filter(e => e.category === 'OPERATIONAL' || e.category === 'FUEL' || e.category === 'RENT')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const salaryCosts = expensesList
      .filter(e => e.category === 'SALARY')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // Sum up custom packaging fee stored on actual order documents
    const totalOrderPackagingFees = ordersList
      .filter(o => o.orderStatus !== 'Cancelled')
      .reduce((sum, o) => sum + (parseFloat(o.packagingFee) || 0), 0);

    // Sum up shipping company actual costs
    const shippingCosts = expensesList
      .filter(e => e.category === 'OTHER' && (e.notes?.includes('شحن') || e.recipientName?.includes('شركة')))
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    return { 
      revenue, 
      costs, 
      profit, 
      packagingCosts: defaultPackaging || totalOrderPackagingFees, 
      operationalCosts, 
      shippingCosts, 
      salaryCosts 
    };
  }, [filteredData]);

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
  const handleExportExcel = () => {
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
    } else if (activeReport === 'account_ledger') {
      let runningBal = 0;
      dataToExport = [...accountTransactions].reverse().map((tx, idx) => {
        const amt = parseFloat(tx.amount) || 0;
        if (tx.type === 'Debit') runningBal += amt;
        else runningBal -= amt;
        return {
          [isAr ? 'التاريخ' : 'Date']: format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm'),
          [isAr ? 'رقم القيد' : 'Ref']: tx.refNumber || '-',
          [isAr ? 'النوع' : 'Type']: tx.type === 'Debit' ? (isAr ? 'مدين / صادر' : 'Debit') : (isAr ? 'دائن / وارد' : 'Credit'),
          [isAr ? 'البيان الوصفي' : 'Description']: tx.description || '-',
          [isAr ? 'سحب/صرف (+)' : 'Debit']: tx.type === 'Debit' ? amt : 0,
          [isAr ? 'توريد (-)' : 'Credit']: tx.type === 'Credit' ? amt : 0,
          [isAr ? 'الرصيد التراكمي' : 'Running Balance']: runningBal
        };
      });
    } else if (activeReport === 'customers') {
      dataToExport = customers.map(c => ({
        [isAr ? 'اسم العميل' : 'Customer']: c.fullName,
        [isAr ? 'الهاتف' : 'Phone']: c.phone || '-',
        [isAr ? 'العنوان' : 'Address']: c.address || '-',
        [isAr ? 'العملة المفضلة' : 'Currency']: c.financialCurrency || 'SAR',
        [isAr ? 'رصيد الحساب المالي' : 'Balance']: c.financialBalance || 0
      }));
    } else if (activeReport === 'couriers') {
      dataToExport = couriers.map(c => ({
        [isAr ? 'اسم المندوب' : 'Courier Name']: c.fullName,
        [isAr ? 'الهاتف' : 'Phone']: c.phone || '-',
        [isAr ? 'طريقة الحساب' : 'Type']: c.courierType === 'sourcing' ? (isAr ? 'تجميع (سعودي)' : 'Sourcing') : (isAr ? 'توزيع (محلي)' : 'Local'),
        [isAr ? 'الرصيد المالي الحالي' : 'Financial Balance']: c.financialBalance || 0,
        [isAr ? 'رصيد العهدة المعلقة' : 'Outstanding Custody']: c.outstandingCustody || 0,
        [isAr ? 'العملة' : 'Currency']: c.financialCurrency || 'SAR'
      }));
    } else if (activeReport === 'shipping_companies') {
      dataToExport = shippingCompanies.map(sc => ({
        [isAr ? 'شركة الشحن' : 'Shipping Co']: sc.name,
        [isAr ? 'الهاتف' : 'Phone']: sc.phone || '-',
        [isAr ? 'الموقع' : 'Type']: sc.type || '-'
      }));
    } else if (activeReport === 'users') {
      dataToExport = users.map(u => ({
        [isAr ? 'الاسم الكامل' : 'Staff Name']: u.fullName || u.displayName || '-',
        [isAr ? 'البريد الإلكتروني' : 'Email']: u.email || '-',
        [isAr ? 'الصلاحية وظيفة' : 'Role']: u.role || '-',
        [isAr ? 'الراتب الشهري الأساسي' : 'Basic Monthly Salary']: u.monthlySalary || 0
      }));
    } else if (activeReport === 'packaging') {
      dataToExport = filteredData.expenses.filter(e => e.category === 'PACKAGING').map(e => ({
        [isAr ? 'سند' : 'ID']: e.expenseNumber,
        [isAr ? 'التاريخ' : 'Date']: format(new Date(e.createdAt || Date.now()), 'yyyy-MM-dd'),
        [isAr ? 'البيان' : 'Notes']: e.notes || '-',
        [isAr ? 'الجهة' : 'Recipient']: e.recipientName || '-',
        [isAr ? 'رسوم التغليف المدفوعة' : 'Amount']: e.amount || 0,
        [isAr ? 'عملة التكلفة' : 'Currency']: e.currency
      }));
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
    XLSX.writeFile(wb, `SwiftShip_Report_${title}_${filters.startDate}.xlsx`);
    
    notificationService.notify({
      title: isAr ? 'تم تصدير الدفتر بنجاح' : 'Success',
      message: isAr ? 'تم إنشاء كشوف السجلات وتنزيلها بصيغة XLSX احترافية' : 'Financial Spreadsheet compiled and downloaded.',
      type: 'success'
    });
  };

  // Modern Native Print implementation
  const triggerNativePrint = () => {
    window.print();
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
    <div className="space-y-6 pb-24 text-start font-sans relative">
      
      {/* Arabic Print-Friendly Stylesheet overrides browser default layout during printing */}
      <style dangerouslySetInnerHTML={{ __html: `
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
            <h3 className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-850/40 mb-2">
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
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl transition-all border text-right ${
                    activeReport === type.id 
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
          </div>

          {/* RIGHT: Analytical content panels */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Context Filters */}
            <div className="bg-[#111114] border border-slate-850 p-5 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#d4af37] uppercase flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  {isAr ? 'مصفاة البيانات الاحترافية' : 'Professional Filter Deck'}
                </span>
                
                {/* Export controls */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/35 text-[#d4af37] rounded-xl text-xs font-black transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    {isAr ? 'معاينة وطباعة القالب' : 'Live Print Config'}
                  </button>
                  <button 
                    onClick={handleExportExcel}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 text-emerald-400 rounded-xl text-xs font-black transition-all"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    {isAr ? 'إكسل Excel' : 'Excel'}
                  </button>
                </div>
              </div>

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
                      {EXPENSE_CATEGORIES.map(cat => (
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
                        .sort((a,b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
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
                      <span className="text-[10px] text-slate-500 font-black block uppercase mb-1">{isAr ? 'إجمالي المبيعات' : 'Gross Revenue'}</span>
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
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                    <span className="text-xs font-black text-white">{isAr ? 'قائمة الفواتير وسندات الصرف المسجلة' : 'Documented Expenses List'}</span>
                    <span className="text-xs font-bold text-rose-400">{isAr ? 'المجموع المؤشر:' : 'Total OpEx:'} <span className="font-mono font-black">{reportMetrics.costs.toLocaleString()} YER</span></span>
                  </div>
                  
                  <div className="overflow-x-auto min-w-[700px]">
                    <table className="w-full text-xs text-start border-separate border-spacing-y-1.5">
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
                        {searchMatchList(filteredData.expenses, 'recipientName').map((exp) => (
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
              )}

              {/* Packaging fee / other costs report */}
              {activeReport === 'packaging' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                    <span className="text-xs font-black text-white">{isAr ? 'سجل رسوم التغليف والتكاليف الإضافية المفروضة والمصروفة' : 'Packaging fee logs'}</span>
                    <span className="text-xs font-bold text-emerald-400">{isAr ? 'مجموع تكاليف التغليف:' : 'Total Packaging OpEx:'} <span className="font-mono font-black">{reportMetrics.packagingCosts.toLocaleString()} YER</span></span>
                  </div>

                  <div className="overflow-x-auto min-w-[700px]">
                    <table className="w-full text-xs text-start border-separate border-spacing-y-1.5">
                      <thead>
                        <tr className="text-slate-550 font-black">
                          <th className="py-2 px-3">{isAr ? 'رقم السند/الطلب' : 'Doc Code'}</th>
                          <th className="py-2 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                          <th className="py-2 px-3">{isAr ? 'البيان الوصفي للمصاريف' : 'Statement/Notes'}</th>
                          <th className="py-2 px-3">{isAr ? 'الجهة/المورد المستلم' : 'Recipient/Vendor'}</th>
                          <th className="py-2 px-3 text-right">{isAr ? 'قيمة الرسوم' : 'Cost Value'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.expenses.filter(e => e.category === 'PACKAGING').map(e => (
                          <tr key={e.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl">
                            <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{e.expenseNumber}</td>
                            <td className="py-3 px-3 text-slate-500">{format(new Date(e.createdAt || Date.now()), 'yyyy-MM-dd')}</td>
                            <td className="py-3 px-3 text-slate-300 italic">{e.notes || '-'}</td>
                            <td className="py-3 px-3 font-bold text-white">{e.recipientName}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-emerald-500">{e.amount?.toLocaleString()} {e.currency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                    <div className="space-y-4">
                      {/* Active Account specs Header */}
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
                      })()}

                      {/* Transaction entries table */}
                      <div className="overflow-x-auto min-w-[750px]">
                        <table className="w-full text-xs text-start border-collapse">
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
                              accountTransactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-slate-950/20 font-medium">
                                  <td className="py-3 px-3 text-slate-500">{format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm')}</td>
                                  <td className="py-3 px-3 font-mono font-bold text-slate-300">{tx.refNumber || '-'}</td>
                                  <td className="py-3 px-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${tx.type === 'Debit' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                      {tx.type === 'Debit' ? (isAr ? 'مدين / صادر' : 'DEBIT') : (isAr ? 'دائن / وارد' : 'CREDIT')}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-white max-w-xs truncate">{tx.description}</td>
                                  <td className="py-3 px-3 text-right font-mono font-black text-rose-400">
                                    {tx.type === 'Debit' ? `${(parseFloat(tx.amount) || 0).toLocaleString()} ${tx.currencyOriginal || 'SAR'}` : '-'}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">
                                    {tx.type === 'Credit' ? `${(parseFloat(tx.amount) || 0).toLocaleString()} ${tx.currencyOriginal || 'SAR'}` : '-'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Order Cost report */}
              {activeReport === 'orders_cost' && (
                <div className="space-y-4">
                  <span className="text-xs font-black text-white block mb-2">{isAr ? 'سجل تفصيلي الشحنات وتكامل تكلفة النقل' : 'Orders Transport & Delivery Cost Analysis'}</span>
                  <div className="overflow-x-auto min-w-[700px]">
                    <table className="w-full text-xs text-start border-separate border-spacing-y-1">
                      <thead>
                        <tr className="text-slate-550 font-black">
                          <th className="py-2 px-3">{isAr ? 'رقم الشحنة' : 'Order ID'}</th>
                          <th className="py-2 px-3">{isAr ? 'العميل' : 'Customer'}</th>
                          <th className="py-2 px-3">{isAr ? 'حالة الشحن' : 'Status'}</th>
                          <th className="py-2 px-3 text-right">{isAr ? 'التأمين الكلي' : 'Total Insurance'}</th>
                          <th className="py-2 px-3 text-right">{isAr ? 'رسوم التغليف' : 'Packaging'}</th>
                          <th className="py-2 px-3 text-right">{isAr ? 'صافي القيمة المستحقة' : 'Net Price'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchMatchList(filteredData.orders, 'customerName').map((o) => (
                          <tr key={o.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl">
                            <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                            <td className="py-3 px-3 font-bold text-white">{o.customerName}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[9px] bg-slate-950 text-slate-400 border border-slate-850 font-bold">{o.orderStatus}</span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-500">{o.insuranceAmount?.toLocaleString() || 0}</td>
                            <td className="py-3 px-3 text-right font-mono text-slate-500">{o.packagingFee?.toLocaleString() || 0}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">{o.totalPrice?.toLocaleString()} YER</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Shipping companies */}
              {activeReport === 'shipping_companies' && (
                <div className="space-y-4">
                  <span className="text-xs font-black text-white block mb-2">{isAr ? 'شركات النقل والدعم اللوجستي المتعاقدة' : 'Partner Shipping Line Registries'}</span>
                  <div className="overflow-x-auto min-w-[650px]">
                    <table className="w-full text-xs text-start border-separate border-spacing-y-1">
                      <thead>
                        <tr className="text-slate-550 font-black">
                          <th className="py-2 px-3">{isAr ? 'اسم الشركة الناقلة' : 'Shipping Co'}</th>
                          <th className="py-2 px-3">{isAr ? 'الرصيد المفتوح' : 'Outstanding Account'}</th>
                          <th className="py-2 px-3">{isAr ? 'هاتف الاتصال' : 'Phone'}</th>
                          <th className="py-2 px-3">{isAr ? 'نوع خط الشحن' : 'Shipline Route'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchMatchList(filteredData.shippingCompanies, 'name').map((sc) => (
                          <tr key={sc.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl">
                            <td className="py-3 px-3 font-bold text-white">{sc.name}</td>
                            <td className="py-3 px-3 font-mono text-rose-400">-{sc.dueAmount?.toLocaleString() || 0} YER</td>
                            <td className="py-3 px-3 text-slate-400">{sc.phone || '-'}</td>
                            <td className="py-3 px-3 uppercase text-[10px] font-bold text-[#d4af37]">{sc.type || 'INTERNATIONAL'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Customers report list */}
              {activeReport === 'customers' && (
                <div className="space-y-4">
                  <span className="text-xs font-black text-white block mb-2">{isAr ? 'دفتر مستخلص أرصدة العملاء والمديونيات المستحقة الذمة' : 'Customers Account Statement Registry'}</span>
                  <div className="overflow-x-auto min-w-[680px]">
                    <table className="w-full text-xs text-start border-separate border-spacing-y-1">
                      <thead>
                        <tr className="text-slate-550 font-black">
                          <th className="py-2 px-3">{isAr ? 'اسم العميل' : 'Customer Name'}</th>
                          <th className="py-2 px-3">{isAr ? 'الهاتف التواصل' : 'Contact Phone'}</th>
                          <th className="py-2 px-3">{isAr ? 'العالمية المحددة' : 'Currency'}</th>
                          <th className="py-2 px-3 text-right">{isAr ? 'الرصيد الختامي' : 'Terminal Balance'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchMatchList(filteredData.customers, 'fullName').map((c) => (
                          <tr key={c.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl">
                            <td className="py-3 px-3 font-bold text-white">{c.fullName}</td>
                            <td className="py-3 px-3 text-slate-400 font-mono">{c.phone || '-'}</td>
                            <td className="py-3 px-3 text-[10px] font-black text-slate-500 uppercase">{c.financialCurrency || 'SAR'}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">{c.financialBalance?.toLocaleString() || 0} {c.financialCurrency || 'SAR'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Couriers report list */}
              {activeReport === 'couriers' && (
                <div className="space-y-4">
                  <span className="text-xs font-black text-white block mb-2">
                    {isAr ? 'قائمة المناديب وتصفية العهد المعلقة والذمم' : 'Couriers Ledger & Pending Custody Balance Sheets'}
                  </span>
                  <div className="overflow-x-auto min-w-[700px]">
                    <table className="w-full text-xs text-start border-separate border-spacing-y-1">
                      <thead>
                        <tr className="text-slate-550 font-black text-center">
                          <th className="py-2 px-3 text-right">{isAr ? 'اسم المندوب' : 'Courier Name'}</th>
                          <th className="py-2 px-3">{isAr ? 'مسؤولية النطاق' : 'Domain Role'}</th>
                          <th className="py-2 px-3">{isAr ? 'العهد المتبقية بعهدته (المعلقة)' : 'Pending/Outstanding Custody'}</th>
                          <th className="py-2 px-3 text-right">{isAr ? 'أرصد الحساب المالي' : 'Account Balance'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchMatchList(filteredData.couriers, 'fullName').map((c) => (
                          <tr key={c.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl text-center">
                            <td className="py-3 px-3 font-bold text-white text-right">{c.fullName}</td>
                            <td className="py-3 px-3 uppercase text-[9px] font-extrabold text-blue-400 bg-blue-500/5 border border-blue-500/20 rounded-md">
                              {c.courierType === 'sourcing' ? (isAr ? 'مندوب تجميع خارجي' : 'External Sourcing') : (isAr ? 'تحديث وتوزيع داخلي' : 'Local Delivery')}
                            </td>
                            {/* Urgent Custody balance showing 0 immediately if auto settled online! */}
                            <td className="py-3 px-3 font-mono font-black text-amber-500">
                              {(c.outstandingCustody || 0).toLocaleString()} {c.financialCurrency || 'SAR'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">
                              {(c.financialBalance || 0).toLocaleString()} {c.financialCurrency || 'SAR'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Users list with monthly salaries */}
              {activeReport === 'users' && (
                <div className="space-y-4">
                  <span className="text-xs font-black text-white block mb-2">{isAr ? 'دفتر الموظفين وبيانات الرواتب الممنوحة' : 'Corporate Payroll & Employee Manifest'}</span>
                  <div className="overflow-x-auto min-w-[650px]">
                    <table className="w-full text-xs text-start border-separate border-spacing-y-1">
                      <thead>
                        <tr className="text-slate-550 font-black">
                          <th className="py-2 px-3">{isAr ? 'الاسم' : 'Staff Name'}</th>
                          <th className="py-2 px-3">{isAr ? 'البريد المهني' : 'Work Email'}</th>
                          <th className="py-2 px-3 text-center">{isAr ? 'الصلاحيات الوظيفية' : 'Permission Role'}</th>
                          <th className="py-2 px-3 text-right">{isAr ? 'الراتب الأساسي' : 'Stipend Wage'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchMatchList(filteredData.couriers, 'fullName').map((u) => (
                          <tr key={u.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl">
                            <td className="py-3 px-3 font-bold text-white">{u.fullName || u.displayName}</td>
                            <td className="py-3 px-3 text-slate-500 font-mono">{u.email || '-'}</td>
                            <td className="py-3 px-3 text-center uppercase text-[9px] font-black">{u.role || 'COURIER'}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-[#d4af37]">{(u.monthlySalary || 0).toLocaleString()} YER</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

              {/* Preset design styling colors selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 block uppercase">{isAr ? 'لون الهوية الرئيسي للطباعة' : 'Brandy Primary Palette'}</label>
                <div className="flex gap-2">
                  {['#d4af37', '#10b981', '#ef4444', '#3b82f6', '#000000'].map(col => (
                    <button
                      key={col}
                      onClick={() => setPrintSettings(prev => ({ ...prev, primaryColor: col }))}
                      className="w-8 h-8 rounded-full border border-slate-800 transition transform hover:scale-110 flex items-center justify-center relative"
                      style={{ backgroundColor: col }}
                    >
                      {printSettings.primaryColor === col && <Check className="w-4 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />}
                    </button>
                  ))}
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
                  fontSize: printSettings.fontSize === 'xs' ? '10px' : printSettings.fontSize === 'sm' ? '12px' : printSettings.fontSize === 'md' ? '14px' : '16px'
                }}
              >
                
                {/* Simulated Stamp Logo */}
                {printSettings.showLogo && (
                  <div className="flex justify-center mb-4 border-b pb-3 border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-mono font-black" style={{ backgroundColor: printSettings.primaryColor }}>SS</div>
                      <span className="font-mono font-black text-xs tracking-widest text-[#000000]">SWIFTSHIP</span>
                    </div>
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
                      <span className="text-slate-400 italic mb-4">{isAr ? 'توقيع المستلم والعميل' : 'Recipient Stamp'}</span>
                      <div className="border-b w-full" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 italic mb-4">{isAr ? 'اعتماد المحاسب المسؤول' : 'Corporate Auditor'}</span>
                      <div className="border-b w-full" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 italic mb-4">{isAr ? 'المدير العام والختم' : 'Corporate Director'}</span>
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

            {/* Printable Frame content */}
            <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-950/40">
              
              {/* PRINT CANVAS TARGET: Will be the unique component shown on print */}
              <div 
                id="print-invoice-canvas"
                className="bg-white text-black p-8 shadow-2xl relative border border-slate-300 text-start font-sans"
                style={{ 
                  width: printSettings.paperSize === '80mm' ? '80mm' : printSettings.paperSize === '58mm' ? '58mm' : '100%',
                  maxWidth: ['80mm', '58mm'].includes(printSettings.paperSize) ? 'none' : '210mm',
                  minHeight: '297mm',
                  boxSizing: 'border-box',
                  fontSize: printSettings.fontSize === 'xs' ? '11px' : printSettings.fontSize === 'sm' ? '13px' : printSettings.fontSize === 'md' ? '15px' : '17px'
                }}
              >
                
                {/* Logo Section */}
                {printSettings.showLogo && (
                  <div className="flex justify-center mb-6 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-mono font-black" style={{ backgroundColor: printSettings.primaryColor }}>SS</div>
                      <span className="font-mono font-black text-[13px] tracking-widest text-[#000000]">SWIFTSHIP LOGISTICS</span>
                    </div>
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
                    {activeReport === 'expenses' ? (isAr ? 'تقرير سجل المصروفات والنفقات التشغيلية' : 'Operating Expenses Ledger') : 
                     activeReport === 'account_ledger' ? (isAr ? `كشف الحساب التفصيلي للتدقيق المحاسبي` : 'Sub-Ledger Audit Report') : 
                     activeReport === 'customers' ? (isAr ? 'تقرير العملاء والذمم والمديونيات' : 'Customers Ledger Summary') : 
                     activeReport === 'couriers' ? (isAr ? 'سند عهد المندوبين ومستخلص كشف الحساب من الدفتر' : 'Courier Custody and Collection balances') : 
                     (isAr ? 'تقرير نظام سويفت شيب للخدمات اللوجستية' : 'SwiftShip Corporate Financial Log')}
                  </span>
                </div>

                {/* Parameters specs metadesk */}
                <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 border-b pb-4 mb-6">
                  <div>
                    <span>{isAr ? 'الفترة المشمولة بالتقرير:' : 'Report Statement Period:'} </span>
                    <strong className="text-black font-semibold">{filters.startDate} {isAr ? 'إلى' : 'to'} {filters.endDate}</strong>
                  </div>
                  <div className="text-right">
                    <span>{isAr ? 'تاريخ طباعة المستند:' : 'Print Date Stamp:'} </span>
                    <strong className="text-black font-mono">{format(new Date(), 'yyyy-MM-dd HH:mm')}</strong>
                  </div>
                  <div>
                    <span>{isAr ? 'الرقابة والترخيص الضريبي:' : 'Corporate Tax Register:'} </span>
                    <strong className="text-black font-mono">{printSettings.taxNumber}</strong>
                  </div>
                  <div className="text-right">
                    <span>{isAr ? 'تصنيف السجل النشط:' : 'Active Matrix category:'} </span>
                    <strong className="text-black uppercase font-bold">{activeReport}</strong>
                  </div>
                </div>

                {/* Table details containing real filtered data rows */}
                <div className="mb-8 overflow-x-auto">
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
                            <th className="p-3 border-r border-slate-300">{isAr ? 'الرقم المرجعي للقيد' : 'Ref #'}</th>
                            <th className="p-3 border-r border-slate-300 text-center">{isAr ? 'النوع' : 'Type'}</th>
                            <th className="p-3 border-r border-slate-300">{isAr ? 'البيان التفصيلي الشرح' : 'Description'}</th>
                            <th className="p-3 text-right">{isAr ? 'المقدار' : 'Amount'}</th>
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
                        accountTransactions.map(tx => (
                          <tr key={tx.id} className="border-b border-slate-300 font-medium">
                            <td className="p-3 border-r border-slate-300 font-mono text-slate-700">{tx.refNumber}</td>
                            <td className="p-3 border-r border-slate-300 text-center uppercase text-[10px]">{tx.type}</td>
                            <td className="p-3 border-r border-slate-300">{tx.description}</td>
                            <td className="p-3 text-right font-mono font-black">
                              {tx.type === 'Debit' ? '+' : '-'}{tx.amount?.toLocaleString()} {tx.currencyOriginal || 'SAR'}
                            </td>
                          </tr>
                        ))
                      ) : activeReport === 'customers' ? (
                        customers.map(c => (
                          <tr key={c.id} className="border-b border-slate-300 font-medium">
                            <td className="p-3 border-r border-slate-300 font-bold">{c.fullName}</td>
                            <td className="p-3 border-r border-slate-300 font-mono">{c.phone || '-'}</td>
                            <td className="p-3 border-r border-slate-300">{c.address || '-'}</td>
                            <td className="p-3 text-right font-mono font-black">{c.financialBalance?.toLocaleString()} {c.financialCurrency || 'SAR'}</td>
                          </tr>
                        ))
                      ) : activeReport === 'couriers' ? (
                        couriers.map(c => (
                          <tr key={c.id} className="border-b border-slate-300 font-medium">
                            <td className="p-3 border-r border-slate-300 font-bold">{c.fullName}</td>
                            <td className="p-3 border-r border-slate-300">{c.courierType === 'sourcing' ? (isAr ? 'تجميع خارجي' : 'Sourcing') : (isAr ? 'توزيع داخلي' : 'Local')}</td>
                            <td className="p-3 border-r border-slate-300 font-mono font-black text-rose-600">{(c.outstandingCustody || 0).toLocaleString()} {c.financialCurrency || 'SAR'}</td>
                            <td className="p-3 text-right font-mono font-black">{(c.financialBalance || 0).toLocaleString()} {c.financialCurrency || 'SAR'}</td>
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
                      <span className="text-slate-400 italic mb-6">{isAr ? 'توقيع المستلم والعميل' : 'Client Signature'}</span>
                      <div className="border-b w-full" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 italic mb-6">{isAr ? 'اعتماد المحاسب المسؤول والتدقيق' : 'Accountant Sign'}</span>
                      <div className="border-b w-full" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 italic mb-6">{isAr ? 'مسؤول مستند المدير والختم' : 'General Director Stamp'}</span>
                      <div className="border-b w-full" />
                    </div>
                  </div>
                )}

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
