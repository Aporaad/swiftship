import React, { useState, useMemo, useEffect } from 'react';
import { 
  collection, onSnapshot, query, orderBy, getDocs 
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
  Settings as SettingsIcon, AlertCircle, RefreshCw, Layers, Layout
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { notificationService } from '../services/notificationService';

// Types
interface ReportFilter {
  startDate: string;
  endDate: string;
  type: string;
  accountId?: string;
  categoryId?: string;
  entityId?: string;
}

const COLORS = ['#d4af37', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#f59e0b'];

const REPORT_TYPES = [
  { id: 'financial_overview', labelAr: 'نظرة عامة مالية', labelEn: 'Financial Overview', icon: TrendingUp },
  { id: 'profit_loss', labelAr: 'تقرير الأرباح والتحليل المالي', labelEn: 'Profit & Loss Analysis', icon: DollarSign },
  { id: 'expenses', labelAr: 'تقرير المصروفات التفصيلي', labelEn: 'Detailed Expenses', icon: FileText },
  { id: 'packaging', labelAr: 'تقرير رسوم التغليف وتكاليف أخرى', labelEn: 'Packaging & Other Costs', icon: Package },
  { id: 'orders_cost', labelAr: 'تقرير تكاليف الطلبات', labelEn: 'Orders Cost Analysis', icon: Truck },
  { id: 'shipping_companies', labelAr: 'تقرير شركات الشحن', labelEn: 'Shipping Companies Report', icon: Truck },
  { id: 'customers', labelAr: 'تقرير العملاء والذمم', labelEn: 'Customers Report', icon: Users },
  { id: 'couriers', labelAr: 'تقرير المناديب والتحصيلات', labelEn: 'Couriers Report', icon: Truck },
  { id: 'users', labelAr: 'تقرير المستخدمين والرواتب', labelEn: 'Users & Staff Report', icon: Users },
  { id: 'account_ledger', labelAr: 'كشف حساب تفصيلي (شجرة الحسابات)', labelEn: 'Detailed Account Ledger', icon: Layers },
];

const EXPENSE_CATEGORIES = [
  { id: 'all', labelAr: 'الكل', labelEn: 'All' },
  { id: 'OPERATIONAL', labelAr: 'مصاريف تشغيلية', labelEn: 'Operational' },
  { id: 'FUEL', labelAr: 'بنزين ومحروقات', labelEn: 'Fuel' },
  { id: 'SALARY', labelAr: 'رواتب وأجور', labelEn: 'Salaries' },
  { id: 'PACKAGING', labelAr: 'تغليف وتعبئة', labelEn: 'Packaging' },
  { id: 'RENT', labelAr: 'إيجارات', labelEn: 'Rent' },
  { id: 'OTHER', labelAr: 'أخرى', labelEn: 'Other' },
];

export default function Reports() {
  const { settings } = useSettings();
  const { role, hasPermission, loading: roleLoading } = useRole();
  const isAr = settings.language === 'ar';

  // Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]);

  // UI States
  const [activeReport, setActiveReport] = useState('financial_overview');
  const [filters, setFilters] = useState<ReportFilter>({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    type: 'all'
  });
  const [showFilters, setShowFilters] = useState(true);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch Data
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

  // Handle Account Transaction Fetching
  useEffect(() => {
    if (!filters.accountId && !filters.entityId) {
      setAccountTransactions([]);
      return;
    }

    const targetAccountId = filters.accountId || 
      (filters.entityId ? accounts.find(a => a.entityId === filters.entityId)?.id : null);

    if (!targetAccountId) return;

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
      setAccountTransactions(filtered.sort((a, b) => b.createdAt - a.createdAt));
    });

    return () => unsub();
  }, [filters.accountId, filters.entityId, filters.startDate, filters.endDate, accounts]);

  // Derived Data
  const filteredData = useMemo(() => {
    const start = startOfDay(new Date(filters.startDate));
    const end = endOfDay(new Date(filters.endDate));

    const checkInterval = (timestamp: number) => {
      if (!timestamp) return false;
      return isWithinInterval(new Date(timestamp), { start, end });
    };

    let filteredOrders = orders.filter(o => checkInterval(o.createdAt || 0));
    let filteredExpenses = expenses.filter(e => checkInterval(e.createdAt || 0));

    if (filters.type && filters.type !== 'all' && activeReport === 'expenses') {
      filteredExpenses = filteredExpenses.filter(e => e.category === filters.type);
    }

    // Apply Sorting
    const sortFn = (a: any, b: any) => {
      const valA = a.createdAt || 0;
      const valB = b.createdAt || 0;
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    };

    return {
      orders: filteredOrders.sort(sortFn),
      expenses: filteredExpenses.sort(sortFn),
      couriers,
      customers,
      shippingCompanies
    };
  }, [orders, expenses, couriers, customers, shippingCompanies, filters, sortOrder, activeReport]);

  const handleExportCSV = () => {
    let dataToExport: any[] = [];
    let title = activeReport;

    if (activeReport === 'expenses') {
      dataToExport = filteredData.expenses.map(e => ({
        ID: e.expenseNumber,
        Date: format(e.createdAt, 'yyyy-MM-dd'),
        Category: e.category,
        Recipient: e.recipientName,
        Amount: e.amount,
        Currency: e.currency,
        Notes: e.notes
      }));
    } else if (activeReport === 'account_ledger') {
      dataToExport = accountTransactions.map(tx => ({
        Date: format(tx.createdAt, 'yyyy-MM-dd HH:mm'),
        ID: tx.refNumber,
        Type: tx.type === 'Debit' ? (isAr ? 'مدين' : 'Debit') : (isAr ? 'دائن' : 'Credit'),
        Description: tx.description,
        Amount: tx.amount,
        Module: tx.module
      }));
    } else if (activeReport === 'customers') {
      dataToExport = customers.map(c => ({
        Name: c.fullName,
        Phone: c.phone,
        Balance: c.financialBalance || 0,
        Currency: c.financialCurrency || 'YER'
      }));
    } else if (activeReport === 'shipping_companies') {
      dataToExport = shippingCompanies.map(sc => ({
        Name: sc.name,
        Phone: sc.phone,
        Type: sc.type
      }));
    } else {
      dataToExport = filteredData.orders.map(o => ({
        OrderNum: o.orderNumber,
        Date: format(o.createdAt, 'yyyy-MM-dd'),
        Customer: o.customerName,
        Status: o.orderStatus,
        Total: o.totalPrice,
        Paid: o.amountPaid,
        Remaining: o.amountRemaining
      }));
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `SwiftShip_${title}_${filters.startDate}.xlsx`);
    
    notificationService.notify({
      title: isAr ? 'تم التصدير بنجاح' : 'Export Successful',
      message: isAr ? 'تم إنشاء ملف Excel وتحميله' : 'Excel file generated and downloaded',
      type: 'success'
    });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4') as any;
    const titleText = REPORT_TYPES.find(r => r.id === activeReport)?.[isAr ? 'labelAr' : 'labelEn'] || activeReport;
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('SwiftShip Logistics System', 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text(titleText, 105, 25, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Report Period: ${filters.startDate} to ${filters.endDate}`, 15, 35);
    doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 15, 40);

    let headers: string[] = [];
    let tableData: any[] = [];

    if (activeReport === 'expenses') {
      headers = ['ID', 'Date', 'Category', 'Recipient', 'Amount'];
      tableData = filteredData.expenses.map(e => [
        e.expenseNumber || '-',
        format(e.createdAt || 0, 'yyyy-MM-dd'),
        e.category || '-',
        e.recipientName || '-',
        `${(e.amount || 0).toLocaleString()} ${e.currency || 'YER'}`
      ]);
    } else if (activeReport === 'account_ledger') {
      headers = ['Date', 'Ref', 'Type', 'Description', 'Amount'];
      tableData = accountTransactions.map(tx => [
        format(tx.createdAt, 'MM-dd HH:mm'),
        tx.refNumber || '-',
        tx.type,
        tx.description || '-',
        tx.amount.toLocaleString()
      ]);
    } else if (activeReport === 'customers') {
      headers = ['Customer Name', 'Phone', 'Current Balance', 'Currency'];
      tableData = customers.map(c => [
        c.fullName,
        c.phone || '-',
        (c.financialBalance || 0).toLocaleString(),
        c.financialCurrency || 'YER'
      ]);
    } else {
      headers = ['Order #', 'Date', 'Customer', 'Status', 'Total'];
      tableData = filteredData.orders.map(o => [
        o.orderNumber || '-',
        format(o.createdAt || 0, 'yyyy-MM-dd'),
        o.customerName || '-',
        o.orderStatus || '-',
        (o.totalPrice || 0).toLocaleString()
      ]);
    }

    autoTable(doc, {
      startY: 50,
      head: [headers],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: '#d4af37', textColor: '#000000', fontStyle: 'bold' },
      styles: { fontSize: 8, font: 'Helvetica' }
    });

    doc.save(`SwiftShip_Report_${activeReport}_${Date.now()}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const reportMetrics = useMemo(() => {
    const orders = filteredData.orders;
    const expenses = filteredData.expenses;
    
    const revenue = orders.filter(o => o.status !== 'Cancelled').reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const costs = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = revenue - costs;
    
    // Additional metrics
    const packagingCosts = expenses.filter(e => e.category === 'PACKAGING').reduce((sum, e) => sum + (e.amount || 0), 0);
    const shippingCosts = expenses.filter(e => e.category === 'SHIPPING').reduce((sum, e) => sum + (e.amount || 0), 0);
    const salaryCosts = expenses.filter(e => e.category === 'SALARY').reduce((sum, e) => sum + (e.amount || 0), 0);
    
    return { revenue, costs, profit, packagingCosts, shippingCosts, salaryCosts };
  }, [filteredData]);

  const pnlData = useMemo(() => {
    return [
      { name: isAr ? 'الإيرادات' : 'Revenue', value: reportMetrics.revenue },
      { name: isAr ? 'المصروفات' : 'Expenses', value: reportMetrics.costs },
      { name: isAr ? 'صافي الربح' : 'Net Profit', value: Math.max(0, reportMetrics.profit) },
    ];
  }, [reportMetrics, isAr]);

  if (loading || roleLoading) {
    return (
      <div className="flex bg-[#0e0e11] text-white h-[80vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded border-2 border-[#d4af37]/25 border-t-[#d4af37]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-start font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-6 rounded-3xl shadow-lg relative overflow-hidden gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-3 rounded-2xl text-[#d4af37]">
            <TrendingUp className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white leading-none mb-1">
              {isAr ? 'مركز التقارير والذكاء المالي' : 'Reports & Financial Intelligence'}
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {isAr ? 'تحليلات عميقة • كشوفات تفصيلية • مركز المهندس المتطور' : 'Deep Analytics • Detailed Ledgers • Professional Report Suite'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${showFilters ? 'bg-[#d4af37] text-black' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'}`}
          >
            <Filter className="w-4 h-4" />
            {isAr ? 'خيارات الفلترة' : 'Filter Options'}
          </button>
          
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-900">
            <button 
              onClick={handlePrint}
              className="p-2.5 text-[#d4af37] hover:bg-[#d4af37]/10 rounded-lg transition-all"
              title={isAr ? 'طباعة مباشرة' : 'Direct Print'}
            >
              <Printer className="w-4 h-4" />
            </button>
            <button 
              onClick={handleExportPDF}
              className="p-2.5 text-[#d4af37] hover:bg-[#d4af37]/10 rounded-lg transition-all"
              title={isAr ? 'تصدير PDF' : 'Save PDF'}
            >
              <FileText className="w-4 h-4" />
            </button>
            <button 
              onClick={handleExportCSV}
              className="p-2.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
              title={isAr ? 'تصدير Excel' : 'Export Excel'}
            >
              <DownloadIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sidebar Navigation */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[#121215] border border-slate-850 p-3 rounded-3xl">
            <h3 className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-850">
              {isAr ? 'بوابة التقارير' : 'Reports Portal'}
            </h3>
            <div className="space-y-1">
              {REPORT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setActiveReport(type.id);
                    // Clear secondary filters when changing report type
                    setFilters(prev => ({ ...prev, accountId: undefined, entityId: undefined }));
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl transition-all group ${
                    activeReport === type.id 
                      ? 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 shadow-[0_4px_12px_rgba(212,175,55,0.1)]' 
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <type.icon className={`w-4 h-4 ${activeReport === type.id ? 'text-[#d4af37]' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    <span className="text-xs font-bold">{isAr ? type.labelAr : type.labelEn}</span>
                  </div>
                  {activeReport === type.id && <div className="w-1.5 h-1.5 bg-[#d4af37] rounded-full animate-pulse" />}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats Panel */}
          <div className="bg-black/40 border border-[#d4af37]/10 p-5 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
               <Layers className="w-4 h-4 text-[#d4af37]" />
               <span className="text-[10px] font-black text-slate-500 uppercase">{isAr ? 'ملخص سريع' : 'Quick Summary'}</span>
            </div>
            <div className="space-y-3">
               <div>
                 <span className="text-[10px] text-slate-500 block font-bold mb-0.5">{isAr ? 'عدد العمليات' : 'Trans. Vol'}</span>
                 <span className="text-sm font-black text-white">{filteredData.orders.length + filteredData.expenses.length}</span>
               </div>
               <div>
                 <span className="text-[10px] text-slate-500 block font-bold mb-0.5">{isAr ? 'إجمالي المبيعات' : 'Sales Value'}</span>
                 <span className="text-sm font-black text-emerald-400">{reportMetrics.revenue.toLocaleString()} YER</span>
               </div>
            </div>
          </div>
        </div>

        {/* Main Report Area */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-[#121215] border border-slate-850 p-6 rounded-3xl space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 text-start">
                  <label className="text-[10px] font-black text-slate-550 uppercase px-1">{isAr ? 'تاريخ البدء' : 'Date Range Start'}</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-[#d4af37]/50" />
                    <input 
                      type="date" 
                      value={filters.startDate}
                      onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full bg-black/40 border border-slate-850 text-white rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none focus:border-[#d4af37]/50 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5 text-start">
                  <label className="text-[10px] font-black text-slate-550 uppercase px-1">{isAr ? 'تاريخ الانتهاء' : 'Date Range End'}</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-[#d4af37]/50" />
                    <input 
                      type="date" 
                      value={filters.endDate}
                      onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full bg-black/40 border border-slate-850 text-white rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none focus:border-[#d4af37]/50 transition-all"
                    />
                  </div>
                </div>
                
                {/* Secondary Filter context based */}
                {activeReport === 'expenses' ? (
                  <div className="space-y-1.5 text-start">
                    <label className="text-[10px] font-black text-slate-550 uppercase px-1">{isAr ? 'تصنيف المصروفات' : 'Expense Category'}</label>
                    <select 
                      value={filters.type}
                      onChange={e => setFilters(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[#d4af37]/50 transition-all"
                    >
                      {EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>{isAr ? cat.labelAr : cat.labelEn}</option>
                      ))}
                    </select>
                  </div>
                ) : activeReport === 'account_ledger' ? (
                  <div className="space-y-1.5 text-start">
                    <label className="text-[10px] font-black text-slate-550 uppercase px-1">{isAr ? 'اختر الحساب' : 'Select Account'}</label>
                    <select 
                      value={filters.accountId || ''}
                      onChange={e => setFilters(prev => ({ ...prev, accountId: e.target.value }))}
                      className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[#d4af37]/50 transition-all"
                    >
                      <option value="">{isAr ? '-- اختر حساب من الشجرة --' : '-- Choose Account --'}</option>
                      {accounts.sort((a,b) => (a.accountCode || '').localeCompare(b.accountCode || '')).map(acc => (
                         <option key={acc.id} value={acc.id}>{acc.accountCode} - {acc.entityName || acc.name}</option>
                      ))}
                    </select>
                  </div>
                ) : ['customers', 'couriers', 'users'].includes(activeReport) ? (
                   <div className="space-y-1.5 text-start">
                    <label className="text-[10px] font-black text-slate-550 uppercase px-1">
                      {activeReport === 'customers' ? (isAr ? 'تحديد العميل' : 'Filter by Customer') : 
                       activeReport === 'couriers' ? (isAr ? 'تحديد المندوب' : 'Filter by Courier') : 
                       (isAr ? 'تحديد المستخدم' : 'Filter by Staff')}
                    </label>
                    <select 
                      value={filters.entityId || ''}
                      onChange={e => setFilters(prev => ({ ...prev, entityId: e.target.value }))}
                      className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[#d4af37]/50 transition-all"
                    >
                      <option value="">{isAr ? '-- الكل --' : '-- All Entities --'}</option>
                      {(activeReport === 'customers' ? customers : activeReport === 'couriers' ? couriers : users).map(u => (
                        <option key={u.id} value={u.id}>{u.fullName || u.displayName || u.email}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-start">
                    <label className="text-[10px] font-black text-slate-550 uppercase px-1">{isAr ? 'فرز وترتيب' : 'Sort Results'}</label>
                    <div className="flex gap-2">
                       <select 
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        className="flex-1 bg-black/40 border border-slate-850 text-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[#d4af37]/50 transition-all"
                      >
                        <option value="date">{isAr ? 'حسب التاريخ' : 'Sort by Date'}</option>
                        <option value="amount">{isAr ? 'حسب المبلغ' : 'Sort by Value'}</option>
                      </select>
                      <button 
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-slate-400"
                      >
                         <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${sortOrder === 'desc' ? 'rotate-180 text-[#d4af37]' : ''}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Report Content Dynamic Render */}
          <div className="bg-[#121215] border border-slate-850 rounded-3xl min-h-[500px] relative overflow-hidden shadow-2xl">
             
             {/* Simple Stats for active report */}
             <div className="p-6 border-b border-slate-850 bg-black/10 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-3">
                    {activeReport === 'account_ledger' && <Layers className="w-5 h-5 text-[#d4af37]" />}
                    {REPORT_TYPES.find(t => t.id === activeReport)?.[isAr ? 'labelAr' : 'labelEn']}
                  </h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                    {isAr ? 'بوابة البيانات المركزية • التدقيق اللحظي' : 'Central Data Gateway • Real-time Auditing'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                   <div className="hidden md:flex flex-col items-end">
                      <span className="text-[9px] font-black text-slate-550 uppercase leading-none">{isAr ? 'حالة المزامنة' : 'Sync Status'}</span>
                      <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1 mt-1">
                         <div className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                         LIVE
                      </span>
                   </div>
                   <button className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-[#d4af37] transition-all active:rotate-90">
                    <RefreshCw className="w-4 h-4" />
                   </button>
                </div>
             </div>

             {/* Content */}
             <div className="p-6 overflow-x-auto">
                {activeReport === 'financial_overview' && (
                  <div className="space-y-6">
                    {/* KPI Mini Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <div className="bg-black/30 border border-slate-850 p-5 rounded-2xl relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full -mr-8 -mt-8" />
                          <span className="text-[9px] font-black text-slate-550 block uppercase mb-1">{isAr ? 'إجمالي المبيعات' : 'Total Gross Volume'}</span>
                          <span className="text-xl font-mono font-black text-white">{reportMetrics.revenue.toLocaleString()} <span className="text-[10px] text-slate-500">YER</span></span>
                          <div className="mt-2 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                             <div className="h-full bg-blue-500 w-3/4" />
                          </div>
                       </div>
                       <div className="bg-black/30 border border-slate-850 p-5 rounded-2xl relative overflow-hidden">
                          <span className="text-[9px] font-black text-slate-550 block uppercase mb-1">{isAr ? 'إجمالي التكاليف' : 'Operating Costs'}</span>
                          <span className="text-xl font-mono font-black text-rose-500">{reportMetrics.costs.toLocaleString()} <span className="text-[10px] text-slate-500">YER</span></span>
                          <div className="mt-2 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                             <div className="h-full bg-rose-500 w-1/4" />
                          </div>
                       </div>
                       <div className="bg-black/30 border border-slate-850 p-5 rounded-2xl relative overflow-hidden">
                          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="text-[9px] font-black text-slate-550 block uppercase mb-1">{isAr ? 'صافي الربح' : 'Net Liquidity'}</span>
                          <span className="text-xl font-mono font-black text-[#d4af37]">{reportMetrics.profit.toLocaleString()} <span className="text-[10px] text-slate-500">YER</span></span>
                          <div className="mt-2 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                             <div className="h-full bg-[#d4af37] w-1/2" />
                          </div>
                       </div>
                       <div className="bg-black/30 border border-slate-850 p-5 rounded-2xl relative overflow-hidden">
                          <span className="text-[9px] font-black text-slate-550 block uppercase mb-1">{isAr ? 'هامش الربحية' : 'Profitability %'}</span>
                          <span className="text-xl font-mono font-black text-emerald-500">
                            {reportMetrics.revenue > 0 ? ((reportMetrics.profit / reportMetrics.revenue) * 100).toFixed(1) : 0}%
                          </span>
                          <div className="mt-2 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                             <div className="h-full bg-emerald-500 w-2/3" />
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                      <div className="h-[300px] w-full bg-black/20 rounded-2xl border border-slate-850 p-4">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-tighter">{isAr ? 'تحليل محفظة السيولة' : 'Liquidity Portfolio Analysis'}</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pnlData}
                              cx="50%"
                              cy="45%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {pnlData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #d4af3720', borderRadius: '16px', fontSize: '10px' }}
                              itemStyle={{ fontWeight: '800' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} iconType="circle" />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="h-[300px] w-full bg-black/20 rounded-2xl border border-slate-850 p-4">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-tighter">{isAr ? 'نبض الإيرادات (آخر 10 عمليات)' : 'Revenue Pulse (Stream)'}</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={filteredData.orders.slice(0, 10).reverse().map((o, i) => ({ name: o.orderNumber?.slice(-4), value: o.totalPrice }))}>
                            <defs>
                              <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={8} axisLine={false} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={8} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px dashed #d4af3750', borderRadius: '12px', fontSize: '10px' }}
                              itemStyle={{ color: '#d4af37', fontWeight: '900' }}
                            />
                            <Area type="monotone" dataKey="value" stroke="#d4af37" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {activeReport === 'expenses' && (
                  <div className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
                           <span className="text-[9px] font-black text-rose-300 block uppercase mb-1">{isAr ? 'إجمالي المصروفات' : 'Expenditure Cap'}</span>
                           <span className="text-xl font-mono font-black text-rose-500">{reportMetrics.costs.toLocaleString()} <span className="text-xs">YER</span></span>
                        </div>
                        <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                           <span className="text-[9px] font-black text-blue-300 block uppercase mb-1">{isAr ? 'رواتب الموظفين' : 'Salary stipend'}</span>
                           <span className="text-xl font-mono font-black text-blue-400">{reportMetrics.salaryCosts.toLocaleString()} <span className="text-xs">YER</span></span>
                        </div>
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                           <span className="text-[9px] font-black text-emerald-300 block uppercase mb-1">{isAr ? 'مصاريف التغليف' : 'Packaging Reserve'}</span>
                           <span className="text-xl font-mono font-black text-emerald-500">{reportMetrics.packagingCosts.toLocaleString()} <span className="text-xs">YER</span></span>
                        </div>
                     </div>

                     <div className="min-w-[800px]">
                        <table className="w-full text-[11px] text-start border-separate border-spacing-y-2">
                           <thead>
                              <tr className="text-slate-500 font-black uppercase tracking-wider">
                                 <th className="px-4 py-2">{isAr ? 'رقم السند' : 'ID'}</th>
                                 <th className="px-4 py-2">{isAr ? 'التاريخ' : 'Date'}</th>
                                 <th className="px-4 py-2 text-center">{isAr ? 'الفئة' : 'Class'}</th>
                                 <th className="px-4 py-2">{isAr ? 'المستلم' : 'Entity'}</th>
                                 <th className="px-4 py-2">{isAr ? 'البيان' : 'Statement'}</th>
                                 <th className="px-4 py-2 text-right">{isAr ? 'المبلغ' : 'Value'}</th>
                              </tr>
                           </thead>
                           <tbody>
                              {filteredData.expenses.map((exp) => (
                                <tr key={exp.id} className="bg-black/20 border border-slate-850 rounded-xl hover:bg-black/40 transition-all group animate-in fade-in slide-in-from-left-2 duration-300">
                                   <td className="px-4 py-3 font-mono font-black text-[#d4af37] border-l-2 border-[#d4af37]/50">{exp.expenseNumber}</td>
                                   <td className="px-4 py-3 text-slate-500 font-bold">{format(exp.createdAt || 0, 'yyyy-MM-dd')}</td>
                                   <td className="px-4 py-3 text-center">
                                      <span className="bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">{exp.category}</span>
                                   </td>
                                   <td className="px-4 py-3 font-bold text-white">{exp.recipientName}</td>
                                   <td className="px-4 py-3 text-slate-500 italic max-w-xs truncate">{exp.notes}</td>
                                   <td className="px-4 py-3 text-right font-mono font-black text-white">{exp.amount?.toLocaleString()} <span className="text-slate-600 font-sans">{exp.currency}</span></td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
                )}

                {activeReport === 'account_ledger' && (
                  <div className="space-y-6">
                    {!filters.accountId ? (
                      <div className="p-20 text-center flex flex-col items-center justify-center space-y-4">
                        <div className="bg-slate-900/40 p-6 rounded-full border border-slate-850 animate-pulse">
                           <Layout className="w-12 h-12 text-[#d4af37]/30" />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-white">{isAr ? 'بانتظار تحديد الحساب' : 'Financial Ledger Ready'}</h4>
                          <p className="text-xs text-slate-500 mt-1">{isAr ? 'يرجى اختيار حساب من القائمة المنسدلة في الفلاتر لعرض الحركات المالية التفصيلية' : 'Please select an account from the filters dropdown to fetch live transaction streams.'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                         {/* Ledger Stats Header */}
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(() => {
                              const acc = accounts.find(a => a.id === filters.accountId);
                              return (
                                <>
                                  <div className="p-5 bg-black/30 border border-slate-850 rounded-2xl">
                                     <span className="text-[9px] font-black text-slate-550 block uppercase mb-1">{isAr ? 'كود الحساب' : 'Ledger Code'}</span>
                                     <span className="text-lg font-mono font-black text-[#d4af37]">{acc?.accountCode || 'N/A'}</span>
                                  </div>
                                  <div className="p-5 bg-black/30 border border-slate-850 rounded-2xl">
                                     <span className="text-[9px] font-black text-slate-550 block uppercase mb-1">{isAr ? 'اسم الحساب' : 'Account Identifier'}</span>
                                     <span className="text-lg font-black text-white truncate block">{acc?.entityName || acc?.name}</span>
                                  </div>
                                  <div className="p-5 bg-black/30 border-2 border-emerald-500/20 rounded-2xl">
                                     <span className="text-[9px] font-black text-emerald-400 block uppercase mb-1">{isAr ? `الرصيد الختامي (${acc?.currency || 'YER'})` : `Terminal Balance (${acc?.currency || 'YER'})`}</span>
                                     <span className={`text-lg font-mono font-black ${acc?.balance >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                       {acc?.balance?.toLocaleString()} <span className="text-xs">{acc?.currency}</span>
                                     </span>
                                  </div>
                                </>
                              );
                            })()}
                         </div>

                         {/* Transaction Table */}
                         <div className="min-w-[800px] pt-4">
                            <table className="w-full text-[11px] text-start border-separate border-spacing-y-2">
                               <thead>
                                  <tr className="text-slate-500 font-black uppercase tracking-wider">
                                     <th className="px-4 py-2">{isAr ? 'التاريخ والوقت' : 'Timestamp'}</th>
                                     <th className="px-4 py-2">{isAr ? 'رقم القيد' : 'Ref #'}</th>
                                     <th className="px-4 py-2">{isAr ? 'النوع' : 'Entry Type'}</th>
                                     <th className="px-4 py-2">{isAr ? 'البيان الوصفي' : 'Narration'}</th>
                                     <th className="px-4 py-2 text-right">{isAr ? 'مدين (+)' : 'Debit (+)'}</th>
                                     <th className="px-4 py-2 text-right">{isAr ? 'دائن (-)' : 'Credit (-)'}</th>
                                  </tr>
                               </thead>
                               <tbody>
                                  {accountTransactions.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-20 text-slate-600 font-bold italic">{isAr ? 'لا توجد حركات مالية في هذه الفترة' : 'No transactions found for the specified interval.'}</td></tr>
                                  ) : (
                                    accountTransactions.map((tx) => (
                                      <tr key={tx.id} className="bg-black/20 border-l border-slate-850 rounded-xl hover:bg-black/40 transition-all font-medium">
                                         <td className="px-4 py-3 text-slate-500">{format(tx.createdAt, 'yyyy-MM-dd HH:mm')}</td>
                                         <td className="px-4 py-3 font-mono font-bold text-slate-300">{tx.refNumber || '-'}</td>
                                         <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${tx.type === 'Debit' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                              {tx.type === 'Debit' ? (isAr ? 'مدين' : 'DEBIT') : (isAr ? 'دائن' : 'CREDIT')}
                                            </span>
                                         </td>
                                         <td className="px-4 py-3 text-white max-w-xs truncate">{tx.description}</td>
                                         <td className="px-4 py-3 text-right font-mono text-emerald-400">
                                            {(() => {
                                              const txCourier = couriers.find((c: any) => c.id === tx.entityId || c.financialAccountId === tx.accountId);
                                              const isSourcing = txCourier?.courierType === 'sourcing' || tx.currencyOriginal === 'SAR' || tx.accountId === 'sys_sourcing_cost';
                                              const displayCurrency = isSourcing ? 'SAR' : (tx.currencyOriginal || 'YER');
                                              const exchangeRateSAR = parseFloat(settings.exchangeRateSAR || 140);
                                              return tx.type === 'Debit' ? (
                                                <div className="flex flex-col items-end">
                                                  <span>{tx.amount.toLocaleString()} {displayCurrency}</span>
                                                  {isSourcing && (
                                                    <span className="text-[9px] text-slate-500 font-normal mt-0.5" dir="ltr">
                                                      (≈ {(tx.amount * exchangeRateSAR).toLocaleString()} YER)
                                                    </span>
                                                  )}
                                                </div>
                                              ) : '-';
                                            })()}
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono text-rose-400">
                                            {(() => {
                                              const txCourier = couriers.find((c: any) => c.id === tx.entityId || c.financialAccountId === tx.accountId);
                                              const isSourcing = txCourier?.courierType === 'sourcing' || tx.currencyOriginal === 'SAR' || tx.accountId === 'sys_sourcing_cost';
                                              const displayCurrency = isSourcing ? 'SAR' : (tx.currencyOriginal || 'YER');
                                              const exchangeRateSAR = parseFloat(settings.exchangeRateSAR || 140);
                                              return tx.type === 'Credit' ? (
                                                <div className="flex flex-col items-end">
                                                  <span>{tx.amount.toLocaleString()} {displayCurrency}</span>
                                                  {isSourcing && (
                                                    <span className="text-[9px] text-slate-500 font-normal mt-0.5" dir="ltr">
                                                      (≈ {(tx.amount * exchangeRateSAR).toLocaleString()} YER)
                                                    </span>
                                                  )}
                                                </div>
                                              ) : '-';
                                            })()}
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

                {activeReport === 'profit_loss' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl space-y-4">
                          <div className="flex items-center gap-3">
                             <TrendingUp className="w-5 h-5 text-emerald-500" />
                             <h4 className="text-xs font-black text-white uppercase">{isAr ? 'تحليل الإيرادات' : 'Revenue Streams'}</h4>
                          </div>
                          <div className="space-y-3">
                             <div className="flex justify-between items-center text-xs font-bold border-b border-white/5 pb-2">
                                <span className="text-slate-500">{isAr ? 'مبيعات الطلبات' : 'Order Sales'}</span>
                                <span className="text-white">+{reportMetrics.revenue.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs font-bold border-b border-white/5 pb-2">
                                <span className="text-slate-500">{isAr ? 'رسوم خدمات' : 'Service Fees'}</span>
                                <span className="text-white">+0.00</span>
                             </div>
                             <div className="flex justify-between items-center pt-2">
                                <span className="text-sm font-black text-white">{isAr ? 'إجمالي الدخل' : 'Gross Income'}</span>
                                <span className="text-sm font-mono font-black text-emerald-400">+{reportMetrics.revenue.toLocaleString()}</span>
                             </div>
                          </div>
                       </div>

                       <div className="p-6 bg-rose-500/5 border border-rose-500/10 rounded-3xl space-y-4">
                          <div className="flex items-center gap-3">
                             <DollarSign className="w-5 h-5 text-rose-500" />
                             <h4 className="text-xs font-black text-white uppercase">{isAr ? 'تحليل النفقات' : 'Expense Burn'}</h4>
                          </div>
                          <div className="space-y-3">
                             <div className="flex justify-between items-center text-xs font-bold border-b border-white/5 pb-2 text-start">
                                <span className="text-slate-500">{isAr ? 'تكلفة الشحن والتوزيع' : 'Logistics/Freight'}</span>
                                <span className="text-white">-{reportMetrics.shippingCosts.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs font-bold border-b border-white/5 pb-2 text-start">
                                <span className="text-slate-500">{isAr ? 'رواتب الموظفين' : 'Staff Salaries'}</span>
                                <span className="text-white">-{reportMetrics.salaryCosts.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs font-bold border-b border-white/5 pb-2 text-start">
                                <span className="text-slate-500">{isAr ? 'تكاليف التغليف' : 'Packing Goods'}</span>
                                <span className="text-white">-{reportMetrics.packagingCosts.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between items-center pt-2 text-start">
                                <span className="text-sm font-black text-white">{isAr ? 'إجمالي النفقات' : 'Gross Expenses'}</span>
                                <span className="text-sm font-mono font-black text-rose-400">-{reportMetrics.costs.toLocaleString()}</span>
                             </div>
                          </div>
                       </div>

                       <div className="p-6 bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-3xl flex flex-col justify-between h-full relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full -mr-16 -mt-16 sm:block hidden" />
                          <div>
                            <div className="flex items-center gap-3 mb-6 relative z-10 text-start">
                               <TrendingUp className="w-5 h-5 text-[#d4af37]" />
                               <h4 className="text-xs font-black text-white uppercase">{isAr ? 'مؤشر الربح النهائي' : 'Terminal Profit'}</h4>
                            </div>
                            <div className="space-y-2 relative z-10 text-start">
                               <span className="text-[10px] text-slate-550 block font-black uppercase">{isAr ? 'صافي الربح المتبقي' : 'Retained Net Revenue'}</span>
                               <span className={`text-4xl font-mono underline decoration-dotted decoration-[#d4af37]/30 font-black ${reportMetrics.profit >= 0 ? 'text-[#d4af37]' : 'text-rose-500'}`}>
                                 {reportMetrics.profit.toLocaleString()}
                               </span>
                               <span className="text-xs text-slate-500 block font-bold font-mono tracking-widest mt-1">CURRENCY: YER</span>
                            </div>
                          </div>
                          
                          <div className="mt-8 pt-4 border-t border-slate-850/50 relative z-10 text-start">
                             <div className="flex justify-between text-[10px] font-black uppercase text-slate-600 mb-2">
                                <span>{isAr ? 'نسبة الكفاءة' : 'Margin Efficiency'}</span>
                                <span>{reportMetrics.revenue > 0 ? ((reportMetrics.profit / reportMetrics.revenue) * 100).toFixed(1) : 0}%</span>
                             </div>
                             <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-emerald-500 to-[#d4af37]" 
                                  style={{ width: `${Math.min(100, Math.max(0, (reportMetrics.profit / (reportMetrics.revenue || 1)) * 100))}%` }}
                                />
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {/* Default placeholder for other reports or in development */}
                {!['financial_overview', 'expenses', 'profit_loss', 'account_ledger'].includes(activeReport) && (
                   <div className="min-w-[800px]">
                      <table className="w-full text-[11px] text-start border-separate border-spacing-y-2">
                         <thead>
                            <tr className="text-slate-500 font-black uppercase tracking-wider">
                               <th className="px-4 py-2 border-b border-slate-850">{isAr ? 'البيان' : 'Description'}</th>
                               <th className="px-4 py-2 border-b border-slate-850">{isAr ? 'البيانات' : 'Data'}</th>
                               <th className="px-4 py-2 border-b border-slate-850 text-right">{isAr ? 'التفاصيل' : 'Details'}</th>
                            </tr>
                         </thead>
                         <tbody>
                            {activeReport === 'customers' && customers.map(c => (
                              <tr key={c.id} className="bg-black/20 border border-slate-850 rounded-xl">
                                 <td className="px-4 py-3 font-bold text-white">{c.fullName}</td>
                                 <td className="px-4 py-3 text-slate-500">{c.phone} | {c.address}</td>
                                 <td className="px-4 py-3 text-right font-mono font-black text-emerald-400">{c.financialBalance?.toLocaleString()} {c.financialCurrency}</td>
                              </tr>
                            ))}
                            {activeReport === 'couriers' && couriers.map(c => {
                               const isSourcing = c.courierType === 'sourcing' || c.financialCurrency === 'SAR';
                               const exchangeRateSAR = parseFloat(settings.exchangeRateSAR || 140);
                               return (
                                 <tr key={c.id} className="bg-black/20 border border-slate-850 rounded-xl">
                                    <td className="px-4 py-3 font-bold text-white">
                                       <div>
                                          <span>{c.fullName}</span>
                                          {isSourcing && (
                                             <span className="block text-[8.5px] text-[#d4af37] font-semibold mt-0.5">
                                                {isAr ? 'مندوب تجميع (سعودي)' : 'Sourcing Courier (SAR)'}
                                             </span>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{c.phone} | {isAr ? 'نسبة العمولة: ' : 'Comm: '}{c.commissionRate}%</td>
                                    <td className="px-4 py-3 text-right font-mono font-black text-amber-500">
                                       <div className="flex flex-col items-end">
                                          <span>{c.financialBalance?.toLocaleString()} {c.financialCurrency || 'YER'}</span>
                                          {isSourcing && (
                                             <span className="text-[10px] text-slate-500 font-normal mt-0.5 font-sans" dir="ltr">
                                                (≈ {( (c.financialBalance || 0) * exchangeRateSAR ).toLocaleString()} YER)
                                             </span>
                                          )}
                                       </div>
                                    </td>
                                 </tr>
                               );
                             })}
                            {activeReport === 'shipping_companies' && shippingCompanies.map(sc => (
                               <tr key={sc.id} className="bg-black/20 border border-slate-850 rounded-xl">
                                 <td className="px-4 py-3 font-bold text-white">{sc.name}</td>
                                 <td className="px-4 py-3 text-slate-500">{sc.phone} | {sc.type}</td>
                                 <td className="px-4 py-3 text-right"><div className="w-2 h-2 rounded-full bg-emerald-500 ml-auto" /></td>
                              </tr>
                            ))}
                            {activeReport === 'users' && users.map(u => (
                               <tr key={u.id} className="bg-black/20 border border-slate-850 rounded-xl">
                                 <td className="px-4 py-3 font-bold text-white">{u.fullName || u.displayName}</td>
                                 <td className="px-4 py-3 text-slate-500">{u.email} | {u.role}</td>
                                 <td className="px-4 py-3 text-right font-mono font-black text-[#d4af37]">{u.monthlySalary?.toLocaleString()} YER</td>
                              </tr>
                            ))}
                            {activeReport === 'orders_cost' && filteredData.orders.map(o => (
                              <tr key={o.id} className="bg-black/20 border border-slate-850 rounded-xl">
                                <td className="px-4 py-3 font-bold text-[#d4af37]">{o.orderNumber}</td>
                                <td className="px-4 py-3 text-slate-500">{o.customerName}</td>
                                <td className="px-4 py-3 text-right font-mono font-black text-rose-400">{o.totalPrice?.toLocaleString()} YER</td>
                              </tr>
                            ))}
                            {activeReport === 'packaging' && filteredData.expenses.filter(e => e.category === 'PACKAGING').map(e => (
                               <tr key={e.id} className="bg-black/20 border border-slate-850 rounded-xl">
                                 <td className="px-4 py-3 font-bold text-white">{e.recipientName}</td>
                                 <td className="px-4 py-3 text-slate-500">{e.notes}</td>
                                 <td className="px-4 py-3 text-right font-mono font-black text-emerald-400">{e.amount?.toLocaleString()} {e.currency}</td>
                              </tr>
                            ))}
                         </tbody>
                      </table>
                      {(activeReport === 'customers' ? customers : activeReport === 'couriers' ? couriers : activeReport === 'users' ? users : []).length === 0 && (
                        <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                          <div className="bg-slate-900/50 p-6 rounded-full border border-slate-850">
                            <AlertCircle className="w-12 h-12 text-slate-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-white">{isAr ? 'لا توجد بيانات متاحة' : 'Matrix Empty'}</h3>
                            <p className="text-sm text-slate-500">{isAr ? 'لم نقم بالعثور على سجلات لهذا القسم في قاعدة البيانات النشطة.' : 'No historic records verified for this entity in the active vault.'}</p>
                          </div>
                        </div>
                      )}
                   </div>
                )}
             </div>

          </div>

          {/* Report Engineer Tips */}
          <div className="bg-gradient-to-br from-indigo-950/20 to-slate-950 border border-indigo-500/20 p-6 rounded-3xl flex items-center gap-6">
             <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-full text-indigo-400">
                <SettingsIcon className="w-8 h-8 animate-spin-slow" />
             </div>
             <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">
                  {isAr ? 'مساعد المهندس والتقارير الذكي' : 'Report Engineer Insights'}
                </h4>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] bg-emerald-500 text-black font-black px-1.5 py-0.5 rounded tracking-tighter uppercase whitespace-nowrap">AUDIT_PROTOCOL_v4_ACTIVE</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-bold">
                  {isAr 
                    ? 'لضمان دقة التقارير، يتم سحب البيانات مباشرة من بلوكشين العمليات اللحظية. نوصي باستكشاف "كشف الحساب التفصيلي" لتدقيق العمليات المعقدة والذمم المتراكمة. يتم تحديث محرك الرسوم البيانية كل 5 ثوانٍ تلقائياً.' 
                    : 'For maximum precision, data is derived directly from real-time transaction nodes. Exploration of "Detailed Account Ledger" is recommended for high-fidelity auditing of liabilities. The telemetry engine refreshes auto-magically.'}
                </p>
             </div>
          </div>

        </div>

      </div>

    </div>
  );
}

// Helper types for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}
