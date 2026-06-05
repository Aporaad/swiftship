import React, { useState, useMemo, useEffect } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { Download, TrendingUp, Wallet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { EXPENSE_CATEGORIES } from '../pages/Expenses';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface FinanceReportsProps {
  orders: any[];
  expenses: any[];
  couriers: any[];
  sources: any[];
  isAr: boolean;
  settings: any;
}

export default function FinanceReports({ orders, expenses, couriers, sources, isAr, settings }: FinanceReportsProps) {
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);

  useEffect(() => {
    // In reports, we typically want a larger window, but still limited for initial load
    // Users can use specific date filters which could be improved with dynamic queries
    const q = query(
      collection(db, 'account_transactions'),
      orderBy('createdAt', 'desc'),
      limit(1000)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAccountTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);
  // Advanced Filter state
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const getDateRange = () => {
    const now = new Date();
    const start = new Date();

    if (dateRange === 'today') start.setHours(0, 0, 0, 0);
    else if (dateRange === 'week') start.setDate(now.getDate() - 7);
    else if (dateRange === 'month') start.setMonth(now.getMonth() - 1);
    else if (dateRange === 'year') start.setFullYear(now.getFullYear() - 1);
    else if (dateRange === 'custom') return { start: new Date(startDate), end: new Date(endDate) };
    else return { start: new Date(0), end: now };

    return { start, end: now };
  };

  const { start: rangeStart, end: rangeEnd } = getDateRange();

  const filteredExpenses = expenses.filter(e => {
    const expDate = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt || 0);
    return expDate >= rangeStart && expDate <= rangeEnd;
  });

  const filteredOrders = orders.filter(o => {
    const ordDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
    return ordDate >= rangeStart && ordDate <= rangeEnd;
  });

  const convertToYER = (amount: number, currency: string): number => {
    if (currency === 'YER') return amount;
    if (currency === 'USD') return amount * (settings.exchangeRateUSD || 535);
    if (currency === 'SAR') return amount * (settings.exchangeRateSAR || 140);
    return amount;
  };

  const revenueBySourceData = useMemo(() => {
    const groupedBySources: { [key: string]: { revenue: number, count: number } } = {};

    filteredOrders.forEach(o => {
      const src = o.orderSourceName || 'Unknown';
      const amt = parseFloat(o.amountPaid || 0);
      groupedBySources[src] = groupedBySources[src] || { revenue: 0, count: 0 };
      groupedBySources[src].revenue += amt;
      groupedBySources[src].count++;
    });

    return Object.entries(groupedBySources).map(([name, data]) => ({
      name,
      revenue: data.revenue,
      orders: data.count
    }));
  }, [filteredOrders]);

  const expensesByCategoryData = useMemo(() => {
    const groupedByCategories: { [key: string]: number } = {};
    filteredExpenses.forEach(e => {
      const cat = e.category || 'Other';
      const amt = convertToYER(e.amount || 0, e.currency);
      groupedByCategories[cat] = (groupedByCategories[cat] || 0) + amt;
    });
    return Object.entries(groupedByCategories).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

  const dailyRevenueExpensesData = useMemo(() => {
    const formatDateKey = (d: any) => {
      const date = d?.toDate ? d.toDate() : new Date(d);
      const key = date.toISOString().split('T')[0];
      const label = date.toLocaleDateString(isAr ? 'ar-YE' : 'en-US', { month: 'short', day: 'numeric' });
      return { key, label };
    };

    const dailyMap: { [key: string]: { dateStr: string; dateLabel: string; revenue: number; expenses: number } } = {};

    filteredOrders.forEach(o => {
      const { key, label } = formatDateKey(o.createdAt);
      if (!dailyMap[key]) {
        dailyMap[key] = { dateStr: key, dateLabel: label, revenue: 0, expenses: 0 };
      }
      dailyMap[key].revenue += parseFloat(o.amountPaid || 0);
    });

    // Use account transactions for more accurate expense tracking including manual adjustments
    accountTransactions.forEach(tx => {
      // Date filter for chart
      const { key, label } = formatDateKey(tx.createdAt);
      if (!dailyMap[key]) {
        dailyMap[key] = { dateStr: key, dateLabel: label, revenue: 0, expenses: 0 };
      }

      // If it's a Credit on a customer account, it's actually Revenue for the company (payment received)
      // If it's a Debit on a customer account, it's an Invoiced Amount
      // If it's a Credit on a courier/employee account, it's an Expense for the company

      if (tx.entityType === 'customer') {
        if (tx.type === 'Credit') {
          dailyMap[key].revenue += tx.amount;
        }
      } else {
        if (tx.type === 'Credit') {
          dailyMap[key].expenses += tx.amount;
        } else if (tx.type === 'Debit' && (tx.module === 'custody' || tx.module === 'adjustment')) {
          // Returning custody or adjustment inflow is a reduction in net expenses for reporting
          dailyMap[key].expenses -= tx.amount;
        }
      }
    });

    // Also include legacy expenses that ARE NOT linked to accounts to ensure data continuity
    filteredExpenses.forEach(e => {
      if (e.linkedAccountId || e.financialAccountId) return; // Already handled via accountTransactions

      const { key, label } = formatDateKey(e.createdAt);
      if (!dailyMap[key]) {
        dailyMap[key] = { dateStr: key, dateLabel: label, revenue: 0, expenses: 0 };
      }
      dailyMap[key].expenses += convertToYER(e.amount || 0, e.currency);
    });

    return Object.values(dailyMap).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredOrders, filteredExpenses, accountTransactions, isAr]);

  const summaryStats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + parseFloat(o.amountPaid || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + convertToYER(e.amount || 0, e.currency), 0);
    const profit = totalRevenue - totalExpenses;
    const margin = totalRevenue ? ((profit / totalRevenue) * 100).toFixed(1) : '0';

    return { totalRevenue, totalExpenses, profit, margin };
  }, [filteredOrders, filteredExpenses]);

  const handleDownloadReport = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;

    // Title
    pdf.setFontSize(18);
    pdf.setTextColor(40);
    pdf.text(isAr ? 'تقرير الإيرادات والمصروفات' : 'Revenue & Expense Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Summary
    pdf.setFontSize(10);
    pdf.setTextColor(0);
    const summaryText = isAr 
      ? [`إجمالي الإيرادات: ${summaryStats.totalRevenue.toLocaleString()} YER`, 
          `إجمالي المصروفات: ${summaryStats.totalExpenses.toLocaleString()} YER`,
          `الربح الصافي: ${summaryStats.profit.toLocaleString()} YER`,
          `هامش الربح: ${summaryStats.margin}%`]
      : [`Total Revenue: ${summaryStats.totalRevenue.toLocaleString()} YER`,
          `Total Expenses: ${summaryStats.totalExpenses.toLocaleString()} YER`,
          `Net Profit: ${summaryStats.profit.toLocaleString()} YER`,
          `Profit Margin: ${summaryStats.margin}%`];

    summaryText.forEach(text => {
      pdf.text(text, 20, yPosition);
      yPosition += 8;
    });

    pdf.save(`financial-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 'today', 'week', 'month', 'year', 'custom'] as const).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                dateRange === range
                  ? 'bg-[#d4af37] text-black'
                  : 'bg-black/50 border border-slate-800 text-slate-300 hover:border-[#d4af37]'
              }`}
            >
              {isAr ? { all: 'الكل', today: 'اليوم', week: 'أسبوع', month: 'شهر', year: 'سنة', custom: 'مخصص' }[range] : range}
            </button>
          ))}
        </div>
        {dateRange === 'custom' && (
          <div className="flex gap-3">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 bg-black/50 border border-slate-800 rounded-lg p-2 text-xs text-white" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 bg-black/50 border border-slate-800 rounded-lg p-2 text-xs text-white" />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-950/50 to-green-950/50 border border-emerald-800/50 rounded-2xl p-4">
          <p className="text-emerald-300 text-[10px] font-black uppercase tracking-wider mb-1">{isAr ? 'الإيرادات' : 'Revenue'}</p>
          <p className="text-emerald-400 text-2xl font-black font-mono">{summaryStats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-rose-950/50 to-red-950/50 border border-rose-800/50 rounded-2xl p-4">
          <p className="text-rose-300 text-[10px] font-black uppercase tracking-wider mb-1">{isAr ? 'المصروفات' : 'Expenses'}</p>
          <p className="text-rose-400 text-2xl font-black font-mono">{summaryStats.totalExpenses.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-950/50 to-cyan-950/50 border border-blue-800/50 rounded-2xl p-4">
          <p className="text-blue-300 text-[10px] font-black uppercase tracking-wider mb-1">{isAr ? 'الربح' : 'Profit'}</p>
          <p className={`text-2xl font-black font-mono ${summaryStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{summaryStats.profit.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-950/50 to-yellow-950/50 border border-amber-800/50 rounded-2xl p-4">
          <p className="text-amber-300 text-[10px] font-black uppercase tracking-wider mb-1">{isAr ? 'الهامش %' : 'Margin %'}</p>
          <p className="text-amber-400 text-2xl font-black font-mono">{summaryStats.margin}%</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue vs Expenses */}
        <div className="bg-[#121215] border border-slate-850 rounded-2xl p-4">
          <h3 className="text-sm font-black text-[#d4af37] mb-4">{isAr ? 'الإيرادات والمصروفات اليومية' : 'Daily Revenue vs Expenses'}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyRevenueExpensesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="dateLabel" stroke="#888" style={{ fontSize: '10px' }} />
              <YAxis stroke="#888" style={{ fontSize: '10px' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b98180" name={isAr ? 'إيرادات' : 'Revenue'} />
              <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#ef444480" name={isAr ? 'مصروفات' : 'Expenses'} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Source */}
        <div className="bg-[#121215] border border-slate-850 rounded-2xl p-4">
          <h3 className="text-sm font-black text-[#d4af37] mb-4">{isAr ? 'الإيرادات حسب المصدر' : 'Revenue by Source'}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueBySourceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" style={{ fontSize: '10px' }} />
              <YAxis stroke="#888" style={{ fontSize: '10px' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }} />
              <Bar dataKey="revenue" fill="#10b981" name={isAr ? 'الإيرادات' : 'Revenue'} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expenses by Category */}
        <div className="bg-[#121215] border border-slate-850 rounded-2xl p-4">
          <h3 className="text-sm font-black text-[#d4af37] mb-4">{isAr ? 'المصروفات حسب الفئة' : 'Expenses by Category'}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={expensesByCategoryData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value">
                {expensesByCategoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#ef4444', '#f97316', '#eab308', '#10b981'][index % 4]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Download Button */}
      <button onClick={handleDownloadReport} className="w-full bg-[#d4af37] hover:bg-[#e5bf4c] text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
        <Download size={18} />
        {isAr ? 'تحميل التقرير' : 'Download Report'}
      </button>
    </div>
  );
}
