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

  // Drilldown Selected States
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string | null>(null);

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

  // Fetch detailed account transactions when account ID is selected or packaging report is active
  useEffect(() => {
    const isPackagingReport = activeReport === 'packaging';
    if (!filters.accountId && !filters.entityId && !isPackagingReport) {
      setAccountTransactions([]);
      return;
    }

    const packagingAccountId = accounts.find(a => a.entityId === 'sys_packaging_fees')?.id;
    const targetAccountId = filters.accountId || 
      (filters.entityId ? accounts.find(a => a.entityId === filters.entityId)?.id : null) ||
      (isPackagingReport ? packagingAccountId : null);

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
        const matchesAccount = tx.accountId === targetAccountId || tx.entityId === 'sys_packaging_fees' || (packagingAccountId && tx.accountId === packagingAccountId);
        if (!matchesAccount) return false;
        
        const txDate = new Date(tx.createdAt);
        const start = startOfDay(new Date(filters.startDate));
        const end = endOfDay(new Date(filters.endDate));
        return isWithinInterval(txDate, { start, end });
      });
      setAccountTransactions(filtered);
    });

    return () => unsub();
  }, [filters.accountId, filters.entityId, filters.startDate, filters.endDate, accounts, activeReport]);

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
    <div className="space-y-6 pb-24 text-start font-sans relative w-full max-w-full overflow-hidden">
      
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
                        {EXPENSE_CATEGORIES.filter(cat => cat.id !== 'all').map(cat => {
                          const catExpenses = filteredData.expenses.filter(e => e.category === cat.id);
                          const catSum = catExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
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
                    </div>
                  ) : (
                    // SELECTED EXPENSE CATEGORY DETAILED VIEW
                    <div className="space-y-6">
                      {(() => {
                        const catObj = EXPENSE_CATEGORIES.find(c => c.id === selectedExpenseCategory);
                        const catExpenses = filteredData.expenses.filter(e => e.category === selectedExpenseCategory);
                        const catSum = catExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                        const matchedTxs = accountTransactions.filter(tx => tx.description?.toLowerCase().includes((selectedExpenseCategory || '').toLowerCase()) || tx.description?.includes(catObj?.labelAr || ''));

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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'معدل الحركة الواحدة' : 'Average value per ticket'}</span>
                                <span className="text-lg font-mono font-black text-[#d4af37]">
                                  {catExpenses.length > 0 ? Math.round(catSum / catExpenses.length).toLocaleString() : 0} YER
                                </span>
                                <span className="text-[9px] text-slate-550 block mt-1">{isAr ? 'متوسط قيمة المعاملة الواحدة المقدر' : 'Arithmetic mean value.'}</span>
                              </div>
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
                    const pkgAcc = accounts.find(a => a.entityId === 'sys_packaging_fees');
                    
                    // 1. Calculate Income (Credit - Collected fees from orders)
                    // We sum up active orders packaging fees in SAR and convert to default YER
                    const totalOrderPackagingFees = filteredData.orders
                      .filter(o => o.orderStatus !== 'Cancelled')
                      .reduce((sum, o) => sum + (parseFloat(o.packagingFee as any) || 0), 0);

                    // Alternatively, we sum up credit transactions on the Packaging Account
                    const totalCreditTxs = accountTransactions
                      .filter(tx => tx.type === 'Credit')
                      .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

                    const packagingIncome = totalCreditTxs || (totalOrderPackagingFees * (settings.exchangeRateSAR || 1));

                    // 2. Calculate Expenses (Debit - direct expenses or manual adjustments)
                    const directPackagingExpenses = filteredData.expenses
                      .filter(e => e.category === 'PACKAGING')
                      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

                    const totalDebitTxs = accountTransactions
                      .filter(tx => tx.type === 'Debit')
                      .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

                    const packagingOutgoings = directPackagingExpenses || totalDebitTxs;

                    // 3. Difference
                    const packagingMargin = packagingIncome - packagingOutgoings;

                    return (
                      <div className="space-y-6">
                        {/* Financial Header linked to Chart of Accounts */}
                        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full blur-2xl pointer-events-none" />
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="space-y-1">
                              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider block w-fit">
                                {isAr ? 'الحساب المالي المرتبط بشجرة الحسابات' : 'Linked Account Node'}
                              </span>
                              <h4 className="text-sm font-black text-white flex items-center gap-2">
                                <span className="text-[#d4af37]">[{pkgAcc?.accountCode || '5200-0001'}]</span>
                                {pkgAcc?.entityName || (isAr ? 'حساب رسوم التغليف والتعبئة' : 'Packaging & Wrapping Fees Account')}
                              </h4>
                              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xl">
                                {isAr 
                                  ? 'يتم ربط هذا التقرير تلقائياً بحساب "رسوم التغليف والتعبئة" في النظام. ترحل إليه رسوم تغليف شحنات العملاء كحركات دائنة (دخل)، ومصاريف كرتون التغليف كحركات مدينة (منصرف/خرج).' 
                                  : 'This report automatically syncs with the central chart. Order wrapping fees map as Credits (Income) and wrapping supply cardboard purchases record as Debits (Opex).'}
                              </p>
                            </div>
                            <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-xl text-end self-stretch md:self-auto min-w-[140px]">
                              <span className="text-[10px] text-slate-500 block font-bold mb-0.5 font-sans">
                                {isAr ? 'الرصيد التراكمي الإجمالي:' : 'Total Ledger Balance:'}
                              </span>
                              <span className={`text-md font-mono font-black ${pkgAcc?.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {pkgAcc?.balance?.toLocaleString() || 0} {pkgAcc?.currency || 'SAR'}
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
                              {packagingIncome.toLocaleString()} <span className="text-[10px] font-sans">YER</span>
                            </span>
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
                              {packagingOutgoings.toLocaleString()} <span className="text-[10px] font-sans">YER</span>
                            </span>
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
                              {packagingMargin.toLocaleString()} <span className="text-[10px] font-sans">YER</span>
                            </span>
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
                                    filteredData.orders.filter(o => o.orderStatus !== 'Cancelled' && (parseFloat(o.packagingFee) || 0) > 0).slice(0, 100).map(o => (
                                      <tr key={o.id} className="bg-slate-900/20 hover:bg-slate-900/40 rounded-lg">
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
                                    filteredData.expenses.filter(e => e.category === 'PACKAGING').map(e => (
                                      <tr key={e.id} className="bg-slate-900/20 hover:bg-slate-900/40 rounded-lg">
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
                      <div className="overflow-x-auto w-full max-w-full pb-2">
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
                <div className="space-y-6">
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
                              <th className="py-2 px-3 text-right">{isAr ? 'التأمين الكلي' : 'Total Insurance'}</th>
                              <th className="py-2 px-3 text-right">{isAr ? 'رسوم التغليف' : 'Packaging'}</th>
                              <th className="py-2 px-3 text-right">{isAr ? 'صافي القيمة المستحقة' : 'Net Price'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'الإجراء' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {searchMatchList(filteredData.orders, 'customerName').map((o) => (
                              <tr key={o.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl transition cursor-pointer" onClick={() => setSelectedOrderId(o.orderNumber || o.id)}>
                                <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                                <td className="py-3 px-3 font-bold text-white">{o.customerName}</td>
                                <td className="py-3 px-3 text-slate-500 font-mono">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                <td className="py-3 px-3">
                                  <span className="px-2 py-0.5 rounded-full text-[9px] bg-slate-950 text-slate-400 border border-slate-850 font-bold">{o.orderStatus}</span>
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-slate-500">{o.insuranceAmount?.toLocaleString() || 0}</td>
                                <td className="py-3 px-3 text-right font-mono text-slate-500">{o.packagingFee?.toLocaleString() || 0}</td>
                                <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">{o.totalPrice?.toLocaleString()} YER</td>
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
                                <span className="text-md font-mono font-black text-white">{o.netPrice?.toLocaleString() || 0} <span className="text-[10px] text-slate-500">SAR</span></span>
                                <p className="text-[9px] text-slate-550 mt-1">{isAr ? 'القيمة بدون احتساب الرسوم الإضافية' : 'Base inventory shipping value'}</p>
                              </div>
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl">
                                <span className="text-[10px] text-slate-500 font-black block uppercase mb-1">{isAr ? 'رسوم التأمين والتغليف المضافة' : 'Surcharges (Ins & Pkg)'}</span>
                                <span className="text-md font-mono font-black text-[#d4af37]">
                                  {((o.insuranceAmount || 0) + (o.packagingFee || 0)).toLocaleString()} <span className="text-[10px]">SAR</span>
                                </span>
                                <p className="text-[9px] text-slate-550 mt-1">{isAr ? `تأمين: ${o.insuranceAmount || 0} / تغليف: ${o.packagingFee || 0}` : 'Aggregated surcharges sum'}</p>
                              </div>
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl">
                                <span className="text-[10px] text-slate-550 font-black block uppercase mb-1">{isAr ? 'مجموع المقدار المستحق الكلي' : 'Total Price (YER)'}</span>
                                <span className="text-md font-mono font-black text-rose-400">{o.totalPrice?.toLocaleString() || 0} <span className="text-[10px]">YER</span></span>
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
              )}

              {/* Shipping companies */}
              {activeReport === 'shipping_companies' && (
                <div className="space-y-6">
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
                        const coOrders = orders.filter(o => o.shippingCompany === sc.name || o.shippingCompanyId === sc.id);
                        const totalSum = coOrders.reduce((sum, o) => sum + (parseFloat(o.totalPrice) || 0), 0);
                        const paidSum = coOrders.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || 0), 0);
                        const linkedTxs = accountTransactions.filter(tx => tx.description?.toLowerCase().includes((sc?.name || '').toLowerCase()) || tx.description?.includes(sc?.name || ''));

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
                                <span className="text-md font-mono font-black text-rose-400">{(sc.dueAmount || 0).toLocaleString()} YER</span>
                              </div>
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                <span className="text-[10.5px] text-slate-500 font-bold block mb-1">{isAr ? 'حجم المبيعات الكلي (YER)' : 'Gross Volume (YER)'}</span>
                                <span className="text-md font-mono font-black text-white">{totalSum.toLocaleString()} YER</span>
                              </div>
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                <span className="text-[10.5px] text-slate-500 font-bold block mb-1">{isAr ? 'المسدد فعليا (YER)' : 'Paid / Settled YER'}</span>
                                <span className="text-md font-mono font-black text-emerald-400">{paidSum.toLocaleString()} YER</span>
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
                            {searchMatchList(filteredData.customers, 'fullName').map((c) => (
                              <tr key={c.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl cursor-pointer transition animate-fade-in" onClick={() => setSelectedCustomerId(c.id)}>
                                <td className="py-3 px-3 font-bold text-white text-start">{c.fullName}</td>
                                <td className="py-3 px-3 text-slate-450 font-mono font-bold">{c.phone || '-'}</td>
                                <td className="py-3 px-3 text-[10px] text-center font-black text-slate-400 uppercase">{c.financialCurrency || 'SAR'}</td>
                                <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">{c.financialBalance?.toLocaleString() || 0} {c.financialCurrency || 'SAR'}</td>
                                <td className="py-3 px-3 text-center">
                                  <button className="p-1 px-2.5 bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 rounded-md text-[10px] font-black">
                                    {isAr ? 'كشف حساب' : 'Extract'}
                                  </button>
                                </td>
                              </tr>
                            ))}
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

                        const custOrders = orders.filter(o => o.customerId === cust.id || o.customerName === cust.fullName || o.customerPhone === cust.phone);
                        const grossSum = custOrders.reduce((sum, o) => sum + (parseFloat(o.totalPrice) || 0), 0);
                        const paidSum = custOrders.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || 0), 0);
                        const remainDebt = custOrders.reduce((sum, o) => sum + (parseFloat(o.amountRemaining) || 0), 0);
                        const statementsTxs = accountTransactions.filter(tx => tx.description?.includes(cust.fullName) || tx.description?.includes(cust.phone || 'xx'));

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
                                <span className="text-lg font-mono font-black text-emerald-400">{(cust.financialBalance || 0).toLocaleString()} {cust.financialCurrency || 'SAR'}</span>
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
                            <div className="space-y-3">
                              <span className="text-xs font-black text-white block">{isAr ? 'سجل فواتير شحنات العميل التفصيلية' : 'Comprehensive order history statement'}</span>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-start border-separate border-spacing-y-1">
                                  <thead>
                                    <tr className="text-slate-550 font-bold border-b border-slate-800 pb-1.5 uppercase">
                                      <th className="py-2 px-3 text-start">{isAr ? 'رقم الشحنة' : 'Order ID'}</th>
                                      <th className="py-2 px-3">{isAr ? 'تاريخ المعاملة' : 'Date'}</th>
                                      <th className="py-2 px-3 text-right">{isAr ? 'صافي القيمة المستحقة' : 'Cargo Cost'}</th>
                                      <th className="py-2 px-3 text-right">{isAr ? 'المبلغ المسدد' : 'Paid'}</th>
                                      <th className="py-2 px-3 text-right">{isAr ? 'الذمة المتبقية' : 'Outstanding Bal'}</th>
                                      <th className="py-2 px-3 text-center">{isAr ? 'حالتها الاستحقاقية' : 'Transport Status'}</th>
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
                                        <tr key={o.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl">
                                          <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                                          <td className="py-3 px-3 text-slate-500 font-mono">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                          <td className="py-3 px-3 text-right font-mono font-bold text-white">{o.totalPrice?.toLocaleString()} YER</td>
                                          <td className="py-3 px-3 text-right font-mono text-emerald-400 font-bold">{(o.amountPaid || 0).toLocaleString()} YER</td>
                                          <td className="py-3 px-3 text-right font-mono text-rose-400 font-bold">{(o.amountRemaining || 0).toLocaleString()} YER</td>
                                          <td className="py-3 px-3 text-center">
                                            <span className="px-2 py-0.5 rounded text-[9.5px] bg-slate-950 text-slate-400 border border-slate-850 font-bold">{o.orderStatus}</span>
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
                            {searchMatchList(filteredData.couriers, 'fullName').map((c) => (
                              <tr key={c.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl text-center cursor-pointer transition" onClick={() => setSelectedCourierId(c.id)}>
                                <td className="py-3 px-3 font-bold text-white text-start">{c.fullName}</td>
                                <td className="py-3 px-3 text-center">
                                  <span className="px-2 py-0.5 bg-blue-500/5 text-blue-400 border border-blue-500/20 rounded-md text-[9.5px] font-extrabold uppercase">
                                    {c.courierType === 'sourcing' ? (isAr ? 'مندوب تجميع خارجي' : 'External Sourcing') : (isAr ? 'تحديث وتوزيع داخلي' : 'Local Delivery')}
                                  </span>
                                </td>
                                <td className="py-3 px-3 font-mono font-black text-amber-500">
                                  {(c.outstandingCustody || 0).toLocaleString()} {c.financialCurrency || 'SAR'}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">
                                  {(c.financialBalance || 0).toLocaleString()} {c.financialCurrency || 'SAR'}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <button className="p-1 px-2.5 bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 rounded-md text-[10px] font-black">
                                    {isAr ? 'تحليل الأداء' : 'Stat analysis'}
                                  </button>
                                </td>
                              </tr>
                            ))}
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

                        const coOrders = orders.filter(o => o.shippingCourierId === courier.id || o.deliveryCourierId === courier.id);
                        const totalAssigned = coOrders.length;
                        const deliveredCo = coOrders.filter(o => ['Completed', 'Delivered', 'تم التسليم'].includes(o.orderStatus));
                        const successRate = totalAssigned > 0 ? Math.round((deliveredCo.length / totalAssigned) * 105) : 0;
                        const pendingCustody = courier.outstandingCustody || 0;

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
                                <span className="text-lg font-mono font-black text-amber-500">{pendingCustody.toLocaleString()} {courier.financialCurrency || 'SAR'}</span>
                                <p className="text-[9px] text-slate-655 mt-1">{isAr ? 'مبالغ تحت التسوية والمحاسبة اليومية' : 'Unsettled cash from deliveries'}</p>
                              </div>
                              <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl">
                                <span className="text-[10px] text-emerald-400 font-bold block mb-1">{isAr ? 'الرصيد الجاري المستحق' : 'Aggregate Account Balance'}</span>
                                <span className="text-lg font-mono font-black text-emerald-400">{(courier.financialBalance || 0).toLocaleString()} {courier.financialCurrency || 'SAR'}</span>
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
                            <div className="space-y-3">
                              <span className="text-xs font-black text-white block">{isAr ? 'سجل حركات شحنات المندوب المقترنة' : 'Assigned order manifest log'}</span>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-start border-separate border-spacing-y-1">
                                  <thead>
                                    <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                      <th className="py-2.5 px-3 text-start">{isAr ? 'رقم الشحنة' : 'Order ID'}</th>
                                      <th className="py-2.5 px-3">{isAr ? 'المستلم' : 'Customer'}</th>
                                      <th className="py-2.5 px-3 text-right">{isAr ? 'صافي المال المطلوب تحصيله' : 'Required collection'}</th>
                                      <th className="py-2.5 px-3 text-center">{isAr ? 'حالتها الاستحقاقية' : 'Logistics status'}</th>
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
                                        <tr key={o.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl">
                                          <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                                          <td className="py-3 px-3 font-bold text-white">{o.customerName}</td>
                                          <td className="py-3 px-3 text-right font-mono text-emerald-450 font-black">{o.totalPrice?.toLocaleString()} YER</td>
                                          <td className="py-3 px-3 text-center">
                                            <span className="px-2 py-0.5 rounded text-[9px] bg-slate-950 border border-slate-850 text-slate-400 font-bold">{o.orderStatus}</span>
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
                            {searchMatchList(users, 'fullName').map((u) => (
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
                        const staffTxs = accountTransactions.filter(tx => tx.description?.includes(u.fullName) || tx.description?.includes(u.displayName || '---'));

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
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'مستندات الصرف والتحويل المعالجة' : 'Cashed Salary Slips count'}</span>
                                <span className="text-lg font-mono font-black text-white">{staffTxs.length} <span className="text-xs font-sans text-slate-550">{isAr ? 'سند' : 'entries'}</span></span>
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
                                      <th className="py-2.5 px-3">{isAr ? 'رقم المعاملة' : 'Journal ID'}</th>
                                      <th className="py-2.5 px-3">{isAr ? 'الشرح والمصادقة' : 'Narration'}</th>
                                      <th className="py-2.5 px-3 text-right">{isAr ? 'المبلغ الفعلي' : 'Net Disbursed'}</th>
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
                                          <td className="py-3 px-3 text-right font-mono font-black text-rose-400">-{tx.amount?.toLocaleString()} {tx.currencyOriginal || 'SAR'}</td>
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
                        return (isAr ? 'تقرير رسوم التغليف والتعبئة والتكاليف الأخرى' : 'Packaging and wrapping fees statement');
                      }
                      if (activeReport === 'account_ledger') {
                        return (isAr ? 'كشف الحساب التفصيلي للتدقيق المحاسبي الموحد' : 'Unified Accounting Ledger General Audit');
                      }
                      return (isAr ? 'تقرير نظام سويفت شيب للخدمات اللوجستية' : 'SwiftShip Logistics Custom Export Document');
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
                      const custOrders = orders.filter(o => o.customerId === cust.id || o.customerName === cust.fullName || o.customerPhone === cust.phone);
                      const grossSum = custOrders.reduce((sum, o) => sum + (parseFloat(o.totalPrice) || 0), 0);
                      const paidSum = custOrders.reduce((sum, o) => sum + (parseFloat(o.amountPaid) || 0), 0);
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
                      const coOrders = orders.filter(o => o.courierId === courier.id || o.courierName === courier.fullName);
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
                      const coOrders = orders.filter(o => o.shippingCompany === sc.name || o.shippingCompanyId === sc.id);
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
                      const catSum = catExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
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
