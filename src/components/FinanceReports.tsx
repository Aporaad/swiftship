import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { 
  FileText, Calendar, Filter, Download, Printer, TrendingUp, CheckCircle, 
  AlertTriangle, RefreshCw, Layers, DollarSign, Wallet, Truck, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Award, Plus, Check, CheckSquare, Square
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { EXPENSE_CATEGORIES } from '../pages/Expenses';

interface FinanceReportsProps {
  orders: any[];
  expenses: any[];
  couriers: any[];
  sources: any[];
  isAr: boolean;
  settings: any;
}

export default function FinanceReports({ orders, expenses, couriers, sources, isAr, settings }: FinanceReportsProps) {
  // Advanced Filter state
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedCourier, setSelectedCourier] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');

  // Report Builder custom options
  const [pdfOptions, setPdfOptions] = useState({
    includeExecutiveSummary: true,
    includeOrdersLedger: true,
    includeExpensesLedger: true,
    includeCourierStanding: true,
    includeSignatureBox: true,
    highContrastPrintMode: false
  });

  // Calculate Exchange conversions
  const convertToYER = (amount: number, currency: string) => {
    const amt = parseFloat(String(amount || 0));
    if (currency === 'USD') return amt * (settings.exchangeRateUSD || 535);
    if (currency === 'SAR') return amt * (settings.exchangeRateSAR || 140);
    return amt;
  };

  // 1. Core filtered dataset
  const filteredData = useMemo(() => {
    // A. Parse date range
    let startLimit: Date | null = null;
    let endLimit: Date | null = null;

    if (dateRange !== 'all') {
      const now = new Date();
      startLimit = new Date();
      startLimit.setHours(0, 0, 0, 0);
      
      if (dateRange === 'today') {
        // startLimit is today 00:00:00
        endLimit = new Date();
        endLimit.setHours(23, 59, 59, 999);
      } else if (dateRange === 'week') {
        // Last 7 days
        startLimit.setDate(now.getDate() - 7);
      } else if (dateRange === 'month') {
        // Last 30 days
        startLimit.setDate(now.getDate() - 30);
      } else if (dateRange === 'year') {
        // Last 365 Days
        startLimit.setDate(now.getDate() - 365);
      } else if (dateRange === 'custom') {
        startLimit = startDate ? new Date(startDate) : null;
        if (startLimit) startLimit.setHours(0,0,0,0);
        
        endLimit = endDate ? new Date(endDate) : null;
        if (endLimit) endLimit.setHours(23,59,59,999);
      }
    }

    const checkDateInBounds = (timestamp: any) => {
      if (!timestamp) return true;
      let checkDate: Date;
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        checkDate = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        checkDate = timestamp;
      } else {
        checkDate = new Date(timestamp);
      }

      if (startLimit && checkDate < startLimit) return false;
      if (endLimit && checkDate > endLimit) return false;
      return true;
    };

    // Filter orders
    const fOrders = orders.filter(o => {
      // Date filter
      if (!checkDateInBounds(o.createdAt)) return false;

      // Source filter
      if (selectedSource !== 'all' && o.orderSourceId !== selectedSource) return false;

      // Courier filter
      if (selectedCourier !== 'all' && o.deliveryCourierId !== selectedCourier && o.shippingCourierId !== selectedCourier) return false;

      // Payment filter
      const paid = parseFloat(o.amountPaid || 0);
      const remaining = parseFloat(o.amountRemaining || 0);
      if (paymentStatus === 'fully_paid' && remaining > 0) return false;
      if (paymentStatus === 'unpaid' && paid > 0) return false;
      if (paymentStatus === 'partially_paid' && (paid === 0 || remaining === 0)) return false;

      return true;
    });

    // Filter expenses
    const fExpenses = expenses.filter(e => {
      // Date filter
      if (!checkDateInBounds(e.createdAt)) return false;

      // Courier/recipient filter
      if (selectedCourier !== 'all' && e.recipientId !== selectedCourier) return false;

      return true;
    });

    return { filteredOrders: fOrders, filteredExpenses: fExpenses };
  }, [orders, expenses, dateRange, startDate, endDate, selectedSource, selectedCourier, paymentStatus, settings]);

  const { filteredOrders, filteredExpenses } = filteredData;

  // 2. Financial Metrics calculations
  const metrics = useMemo(() => {
    // Revenues
    const totalOrderValueYER = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.amountPaid || 0) + parseFloat(o.amountRemaining || 0)), 0);
    const totalCollectedYER = filteredOrders.reduce((sum, o) => sum + parseFloat(o.amountPaid || 0), 0);
    const totalOutstandingYER = filteredOrders.reduce((sum, o) => sum + parseFloat(o.amountRemaining || 0), 0);

    // Expenses
    let totalGeneralExpensesYER = 0;
    let totalChinaFactoryUSD = 0;
    let totalCourierCustodyIssuedYER = 0;
    let totalCourierCustodySettledYER = 0;

    filteredExpenses.forEach(exp => {
      const convertedAmt = convertToYER(exp.amount || 0, exp.currency);
      
      if (exp.type === 'General') {
        totalGeneralExpensesYER += convertedAmt;
      } else if (exp.type === 'FactoryPayment') {
        if (exp.currency === 'USD') {
          totalChinaFactoryUSD += parseFloat(exp.amount || 0);
        } else {
          totalGeneralExpensesYER += convertedAmt;
        }
      } else if (exp.type === 'Custody') {
        totalCourierCustodyIssuedYER += convertedAmt;
        if (exp.status === 'Settled') {
          totalCourierCustodySettledYER += convertedAmt;
        }
      }
    });

    const netOperationalExpenses = totalGeneralExpensesYER + (totalCourierCustodyIssuedYER - totalCourierCustodySettledYER);
    const netProfitYER = totalCollectedYER - netOperationalExpenses;
    const grossProfitYER = totalOrderValueYER - netOperationalExpenses;

    const netProfitMargin = totalCollectedYER > 0 
      ? Math.round((netProfitYER / totalCollectedYER) * 100) 
      : 0;

    // Delivery rate success percentage
    const nonCancelledOrders = filteredOrders.filter(o => o.orderStatus !== 'ملغي' && o.orderStatus !== 'Cancelled');
    const deliveredCount = nonCancelledOrders.filter(o => o.orderStatus === 'تم التسليم' || o.orderStatus === 'Delivered').length;
    const deliveryRate = nonCancelledOrders.length > 0
      ? Math.round((deliveredCount / nonCancelledOrders.length) * 100)
      : 0;

    const delayedCount = nonCancelledOrders.filter(o => o.orderStatus === 'متأخر' || o.orderStatus === 'Delayed' || o.orderStatus?.toLowerCase() === 'delayed').length;

    return {
      totalOrderValueYER,
      totalCollectedYER,
      totalOutstandingYER,
      totalGeneralExpensesYER,
      totalChinaFactoryUSD,
      totalCourierCustodyIssuedYER,
      totalCourierCustodySettledYER,
      netOperationalExpenses,
      netProfitYER,
      grossProfitYER,
      netProfitMargin,
      totalOrders: filteredOrders.length,
      deliveredOrders: deliveredCount,
      delayedOrders: delayedCount,
      deliverySuccessRate: deliveryRate
    };
  }, [filteredOrders, filteredExpenses, settings]);

  // 3. Analytics Charts formatting data
  const chartsData = useMemo(() => {
    // A. Revenue vs Expenses over past days of filter
    // Let's group transactions by day
    const dailyMap: Record<string, { dateStr: string; dateLabel: string; revenue: number; expenses: number }> = {};

    const formatDateKey = (timestamp: any) => {
      let date: Date;
      if (timestamp && timestamp.toDate) {
        date = timestamp.toDate();
      } else {
        date = new Date(timestamp || Date.now());
      }
      return {
        key: date.toISOString().split('T')[0],
        label: `${date.getMonth() + 1}/${date.getDate()}`
      };
    };

    filteredOrders.forEach(o => {
      const { key, label } = formatDateKey(o.createdAt);
      if (!dailyMap[key]) {
        dailyMap[key] = { dateStr: key, dateLabel: label, revenue: 0, expenses: 0 };
      }
      dailyMap[key].revenue += parseFloat(o.amountPaid || 0);
    });

    filteredExpenses.forEach(e => {
      const { key, label } = formatDateKey(e.createdAt);
      if (!dailyMap[key]) {
        dailyMap[key] = { dateStr: key, dateLabel: label, revenue: 0, expenses: 0 };
      }
      const amtInYER = convertToYER(e.amount || 0, e.currency);
      dailyMap[key].expenses += amtInYER;
    });

    const trend = Object.values(dailyMap)
      .sort((a, b) => (a.dateStr || '').localeCompare(b.dateStr || ''))
      .slice(-15); // limit to last 15 days of data for high visibility

    // B. Hub Sources share
    const sourceMap: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const hub = o.orderSourceName || (isAr ? 'برنامج تسبّق' : 'Order Source');
      sourceMap[hub] = (sourceMap[hub] || 0) + 1;
    });
    const sourcesShare = Object.entries(sourceMap).map(([name, count]) => ({
      name,
      value: count
    }));

    // C. Courier Standing chart
    const courierPerf: Record<string, { name: string; delivered: number; pending: number }> = {};
    filteredOrders.forEach(o => {
      if (o.deliveryCourierId) {
        const cId = o.deliveryCourierId;
        const cName = o.deliveryCourierName || (isAr ? 'مندوب توزيع' : 'Courier');
        if (!courierPerf[cId]) {
          courierPerf[cId] = { name: cName, delivered: 0, pending: 0 };
        }
        if (o.orderStatus === 'تم التسليم' || o.orderStatus === 'Delivered') {
          courierPerf[cId].delivered += 1;
        } else {
          courierPerf[cId].pending += 1;
        }
      }
    });
    const courierStandings = Object.values(courierPerf).slice(0, 8); // top 8 couriers

    // D. Financial Pie Balance
    const financialPie = [
      { name: isAr ? 'المبالغ المحصلة' : 'Revenue Collected', value: metrics.totalCollectedYER, color: '#10b981' },
      { name: isAr ? 'المذمم المستحقة' : 'Receivables Dues', value: metrics.totalOutstandingYER, color: '#f59e0b' },
      { name: isAr ? 'مصاريف تشغيلية' : 'General Expenses', value: metrics.netOperationalExpenses, color: '#ef4444' }
    ].filter(item => item.value > 0);

    return {
      trend,
      sourcesShare,
      courierStandings,
      financialPie
    };
  }, [filteredOrders, filteredExpenses, isAr, metrics]);

  // 4. Advanced jsPDF generator implementation
  const handleExportPDF = () => {
    // Page setup
    const doc = new jsPDF('p', 'mm', 'a4');
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    
    // Aesthetic Colors
    const primaryGold = [178, 143, 40]; // #d28f28 ALX Gold
    const charCoal = [15, 15, 18];      // Deep luxury black
    const whitePaper = [255, 255, 255];
    const borderGray = [230, 230, 235];
    
    let y = 15;

    // Helper functions
    const drawDivider = () => {
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.25);
      doc.line(15, y, width - 15, y);
      y += 8;
    };

    const addHeaderBlock = () => {
      // Background Accent bar
      doc.setFillColor(charCoal[0], charCoal[1], charCoal[2]);
      doc.rect(12, 12, width - 24, 25, 'F');

      // Title
      doc.setTextColor(212, 175, 55);
      doc.setFont('Helvetica', 'Bold');
      doc.setFontSize(14);
      doc.text(settings.companyName || 'ALX SYSTEM FINANCE', 16, 21);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text('ANALYTICS & EXECUTIVE ACCOUNTING STATEMENT', 16, 26);
      
      // Date and Metadata
      doc.setTextColor(212, 175, 55);
      doc.setFontSize(8);
      const todayStr = new Date().toLocaleDateString();
      doc.text(`REPORT PRINT DATE: ${todayStr}`, width - 16, 21, { align: 'right' });
      doc.setTextColor(200, 200, 200);
      doc.text(`DATE COVERS: [ ${dateRange.toUpperCase()} ] RANGE`, width - 16, 26, { align: 'right' });
      doc.text(`SYSTEM REG: ${settings.taxId || 'SECURE_HASH'}`, width - 16, 31, { align: 'right' });

      y = 44;
    };

    const addPageIfNeeded = () => {
      if (y > height - 25) {
        doc.addPage();
        addHeaderBlock();
      }
    };

    // Draw page elements
    // A. Page 1 Header
    addHeaderBlock();

    // Company profile letterhead
    doc.setTextColor(100, 100, 110);
    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'Normal');
    doc.text(`Tel: ${settings.companyPhone || '—'}   Email: ${settings.companyEmail || '—'}   City: ${settings.companyAddress || 'Yemen Hub'}`, 15, y);
    y += 5;
    drawDivider();

    // B. Executive Summary Card
    if (pdfOptions.includeExecutiveSummary) {
      addPageIfNeeded();
      doc.setFillColor(248, 248, 250);
      doc.rect(15, y, width - 30, 38, 'F');
      
      // Gold side bar
      doc.setFillColor(primaryGold[0], primaryGold[1], primaryGold[2]);
      doc.rect(15, y, 2.5, 38, 'F');

      doc.setTextColor(30, 30, 35);
      doc.setFont('Helvetica', 'Bold');
      doc.setFontSize(10);
      doc.text('I. EXECUTIVE FINANCIAL SUMMARY STATEMENT', 22, y + 6);

      // 3 block statistics
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      doc.text('TOTAL DECLARED REVENUE (YER)', 22, y + 15);
      doc.text('OPERATIONAL EXPENDITURES (YER)', 85, y + 15);
      doc.text('NET COMPANY SAVINGS (YER)', 148, y + 15);

      doc.setFont('Helvetica', 'Bold');
      doc.setFontSize(10.5);
      doc.setTextColor(16, 185, 129); // Success Green
      doc.text(`${metrics.totalCollectedYER.toLocaleString()} YER`, 22, y + 21);
      
      doc.setTextColor(239, 68, 68); // Expense Red
      doc.text(`${metrics.netOperationalExpenses.toLocaleString()} YER`, 85, y + 21);
      
      doc.setTextColor(178, 143, 40); // Gold
      doc.text(`${metrics.netProfitYER.toLocaleString()} YER`, 148, y + 21);

      // Success Rate subtext
      doc.setFont('Helvetica', 'Normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 130);
      doc.text(`Operational ROI Margin: %${metrics.netProfitMargin}  •  Overall Delivery Success Rate: %${metrics.deliverySuccessRate} (based on ${metrics.totalOrders} total logs)`, 22, y + 31);

      y += 45;
    }

    // C. Shipped Orders database section
    if (pdfOptions.includeOrdersLedger) {
      addPageIfNeeded();
      doc.setTextColor(charCoal[0], charCoal[1], charCoal[2]);
      doc.setFont('Helvetica', 'Bold');
      doc.setFontSize(9.5);
      doc.text('II. CURRENT SYSTEM ORDERS MOVEMENT LEDGER', 15, y);
      y += 4.5;

      // Table Header row
      doc.setFillColor(240, 240, 245);
      doc.rect(15, y, width - 30, 5.5, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 90);
      doc.text('ORDER CODE', 17, y + 4);
      doc.text('BOOKING DATE', 45, y + 4);
      doc.text('CUSTOMER / ROUTE', 75, y + 4);
      doc.text('TOTAL CHARGED', 123, y + 4);
      doc.text('PAID CASH', 150, y + 4);
      doc.text('STATUS', 175, y + 4);
      
      y += 6;

      // Render up to 15 order logs to fit beautifully
      const ordersToPrint = filteredOrders.slice(0, 15);
      ordersToPrint.forEach(ord => {
        addPageIfNeeded();
        doc.setTextColor(50, 50, 55);
        doc.setFont('Helvetica', 'Bold');
        doc.setFontSize(7.5);
        doc.text(ord.orderNumber || 'ALX-CODE', 17, y + 4);
        
        doc.setFont('Helvetica', 'Normal');
        const d = ord.createdAt?.toDate ? ord.createdAt.toDate() : new Date(ord.createdAt || Date.now());
        doc.text(d.toLocaleDateString(), 45, y + 4);
        
        const customerSafe = (ord.customerName || '').substring(0, 22);
        const routeSafe = `${ord.orderSourceName || 'HUB'} -> ${ord.locationYemen || 'YER'}`.substring(0, 22);
        doc.text(customerSafe, 75, y + 3);
        doc.setFontSize(6.5);
        doc.setTextColor(130, 130, 140);
        doc.text(routeSafe, 75, y + 5.5);
        
        doc.setFontSize(7.5);
        doc.setTextColor(50, 50, 55);
        doc.text(`${(parseFloat(ord.amountPaid || 0) + parseFloat(ord.amountRemaining || 0)).toLocaleString()} YER`, 123, y + 4);
        doc.text(`${(ord.amountPaid || 0).toLocaleString()} YER`, 150, y + 4);
        
        // Status badge color help
        const stat = ord.orderStatus || 'Pending';
        if (stat === 'تم التسليم' || stat === 'Delivered') {
          doc.setTextColor(16, 185, 129);
        } else if (stat === 'ملغي' || stat === 'Cancelled') {
          doc.setTextColor(239, 68, 68);
        } else {
          doc.setTextColor(245, 158, 11);
        }
        doc.setFont('Helvetica', 'Bold');
        doc.text(stat.substring(0, 15), 175, y + 4);

        doc.setDrawColor(240, 240, 245);
        doc.setLineWidth(0.15);
        doc.line(15, y + 6.5, width - 15, y + 6.5);

        y += 7.5;
      });

      if (filteredOrders.length === 0) {
        doc.setFont('Helvetica', 'Normal');
        doc.setFontSize(8);
        doc.setTextColor(160, 160, 170);
        doc.text('[ No order logs correspond directly with filter ]', 20, y + 5);
        y += 10;
      }
      y += 5;
    }

    // D. Corporate general expenditures
    if (pdfOptions.includeExpensesLedger) {
      addPageIfNeeded();
      doc.setTextColor(charCoal[0], charCoal[1], charCoal[2]);
      doc.setFont('Helvetica', 'Bold');
      doc.setFontSize(9.5);
      doc.text('III. GENERAL EXPENDITURES & IN-HOUSE OUTFLOWS', 15, y);
      y += 4.5;

      // Table Header row
      doc.setFillColor(240, 240, 245);
      doc.rect(15, y, width - 30, 5.5, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 90);
      doc.text('VOUCHER ID', 17, y + 4);
      doc.text('CATEGORY TYPE', 50, y + 4);
      doc.text('RECIPIENT PARTY', 85, y + 4);
      doc.text('AUTHORIZED BY', 125, y + 4);
      doc.text('VALUATION AMOUNT', 165, y + 4);
      
      y += 6;

      const expensesToPrint = filteredExpenses.slice(0, 12);
      expensesToPrint.forEach(exp => {
        addPageIfNeeded();
        doc.setTextColor(50, 50, 55);
        doc.setFont('Helvetica', 'Bold');
        doc.setFontSize(7.5);
        doc.text(exp.expenseNumber || 'EXP-ID', 17, y + 4);
        
        doc.setFont('Helvetica', 'Normal');
        const catObj = EXPENSE_CATEGORIES.find(c => c.id === exp.category) || 
                       EXPENSE_CATEGORIES.find(c => exp.type === 'Custody' ? c.id === 'custody' : (exp.type === 'FactoryPayment' ? c.id === 'factory' : c.id === 'other'));
        const categoryLabel = catObj ? catObj.labelEn : (exp.type || 'General');
        doc.text(categoryLabel, 50, y + 4);
        doc.text((exp.recipientName || 'Office').substring(0, 20), 85, y + 4);
        doc.text((exp.createdByName || 'Manager').substring(0, 18), 125, y + 4);
        
        doc.setFont('Helvetica', 'Bold');
        doc.setTextColor(178, 143, 40);
        doc.text(`${(exp.amount || 0).toLocaleString()} ${exp.currency || 'YER'}`, 165, y + 4);

        doc.setDrawColor(240, 240, 245);
        doc.setLineWidth(0.15);
        doc.line(15, y + 6.5, width - 15, y + 6.5);

        y += 7.5;
      });

      if (filteredExpenses.length === 0) {
        doc.setFont('Helvetica', 'Normal');
        doc.setFontSize(8);
        doc.setTextColor(160, 160, 170);
        doc.text('[ No ledger custody records correspond with filters ]', 20, y + 5);
        y += 10;
      }
      y += 5;
    }

    // E. Courier custody section
    if (pdfOptions.includeCourierStanding) {
      addPageIfNeeded();
      doc.setTextColor(charCoal[0], charCoal[1], charCoal[2]);
      doc.setFont('Helvetica', 'Bold');
      doc.setFontSize(9.5);
      doc.text('IV. COURIER IN-COOP CUSTODIAL DIRECTORY BALANCES', 15, y);
      y += 4.5;

      // Table Header row
      doc.setFillColor(240, 240, 245);
      doc.rect(15, y, width - 30, 5.5, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 90);
      doc.text('COURIER NAME', 17, y + 4);
      doc.text('REG ID / CODE', 60, y + 4);
      doc.text('TOTAL CUSTODY RECEIVED', 95, y + 4);
      doc.text('TOTAL SETTLED CASH', 140, y + 4);
      doc.text('LOCKED ACTIVE TRUST', 178, y + 4);
      
      y += 6;

      // Courier math mapping
      const activeCouriers = couriers.slice(0, 8);
      activeCouriers.forEach(cour => {
        addPageIfNeeded();
        
        // Calculate custody for this specific courier
        const courExpenses = expenses.filter(e => e.type === 'Custody' && e.recipientId === cour.id);
        const totalCust = courExpenses.reduce((sum, e) => sum + convertToYER(e.amount || 0, e.currency), 0);
        const totalSet = courExpenses.filter(e => e.status === 'Settled').reduce((sum, e) => sum + convertToYER(e.amount || 0, e.currency), 0);
        const outstanding = totalCust - totalSet;

        doc.setTextColor(50, 50, 55);
        doc.setFont('Helvetica', 'Bold');
        doc.setFontSize(7.5);
        doc.text((cour.fullName || '—').substring(0, 22), 17, y + 4);
        
        doc.setFont('Helvetica', 'Normal');
        doc.text(cour.courierCustomId || 'ALX-C', 60, y + 4);
        doc.text(`${totalCust.toLocaleString()} YER`, 95, y + 4);
        doc.text(`${totalSet.toLocaleString()} YER`, 140, y + 4);
        
        doc.setFont('Helvetica', 'Bold');
        if (outstanding > 0) {
          doc.setTextColor(239, 68, 68);
        } else {
          doc.setTextColor(16, 185, 129);
        }
        doc.text(`${outstanding.toLocaleString()} YER`, 178, y + 4);

        doc.setDrawColor(240, 240, 245);
        doc.setLineWidth(0.15);
        doc.line(15, y + 6.5, width - 15, y + 6.5);

        y += 7.5;
      });
      y += 8;
    }

    // F. Safe closing & official signoff box
    if (pdfOptions.includeSignatureBox) {
      addPageIfNeeded();
      y += 5;
      doc.setDrawColor(178, 143, 40);
      doc.setLineWidth(0.5);
      doc.line(15, y, width - 15, y);
      y += 10;

      doc.setTextColor(120, 120, 130);
      doc.setFont('Helvetica', 'Normal');
      doc.setFontSize(7.5);
      doc.text('CONFIDENTIALITY AND LEGAL COMPLIANCE DISCLAIMER:', 15, y);
      doc.text('This ledger statement compiles raw operational databases in real time. It serves as an official company audit file for tax and bank liabilities.', 15, y + 4);

      // Signature structures
      y += 12;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      
      // Box 1
      doc.line(20, y, 75, y);
      doc.setFont('Helvetica', 'Bold');
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 55);
      doc.text('CHIEF FINANCIAL AUDITOR', 20, y + 4);

      // Box 2
      doc.line(width - 75, y, width - 20, y);
      doc.text('CORPORATE GENERAL MANAGER', width - 75, y + 4);
    }

    // Download Statement
    doc.save(`${settings.companyName || 'ALX'}_FINANCIAL_EXECUTIVE_STATEMENT_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 pt-2 animate-fade-in select-none">
      
      {/* 📊 Control & Filter Grid Dashboard */}
      <div className="bg-[#121215] border border-slate-850 p-6 rounded-3xl flex flex-col gap-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/[0.03] pb-4">
          <div className="flex items-center gap-2.5">
            <Filter className="w-4 h-4 text-[#d4af37]" />
            <span className="text-xs font-black text-white uppercase tracking-wider">
              {isAr ? 'مرشحات وفلاتر تصدير التقارير الذكية' : 'Advanced Analytics filters'}
            </span>
          </div>
          
          <div className="flex bg-[#08080a] border border-slate-900 rounded-xl p-0.5">
            {['today', 'week', 'month', 'year', 'all', 'custom'].map((mode) => (
              <button
                key={mode}
                onClick={() => setDateRange(mode as any)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                  dateRange === mode 
                    ? 'bg-[#d4af37] text-black font-black' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'today' && (isAr ? 'اليوم' : 'Today')}
                {mode === 'week' && (isAr ? 'أسبوع' : 'Week')}
                {mode === 'month' && (isAr ? 'شهر' : 'Month')}
                {mode === 'year' && (isAr ? 'عام' : 'Year')}
                {mode === 'all' && (isAr ? 'الكل' : 'Total')}
                {mode === 'custom' && (isAr ? 'مخصص' : 'Custom')}
              </button>
            ))}
          </div>
        </div>

        {/* Input parameters panel */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-bold text-slate-400">
          
          {/* Custom Date Inputs */}
          {dateRange === 'custom' && (
            <div className="md:col-span-1 grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <label className="block text-slate-500 mb-1">{isAr ? 'من تاريخ:' : 'From:'}</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-black/40 border border-slate-850 rounded-lg p-2 text-white text-[10px] uppercase outline-none focus:border-[#d4af37]/65"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">{isAr ? 'إلى تاريخ:' : 'To:'}</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-black/40 border border-slate-850 rounded-lg p-2 text-white text-[10px] uppercase outline-none focus:border-[#d4af37]/65"
                />
              </div>
            </div>
          )}

          {/* Source Filter */}
          <div>
            <label className="block text-slate-500 mb-1.5 text-[10px] uppercase">{isAr ? 'محطة الشحن المصدر' : 'Shipping Origin Hub'}</label>
            <select
              value={selectedSource}
              onChange={e => setSelectedSource(e.target.value)}
              className="w-full bg-black/40 border border-slate-850 text-white rounded-xl p-2.5 outline-none focus:border-[#d4af37]"
            >
              <option value="all">{isAr ? 'جميع محطات ومصادر الطرود' : 'All Origin Hubs'}</option>
              {sources.map(src => (
                <option key={src.id} value={src.id}>{src.name} ({src.type})</option>
              ))}
            </select>
          </div>

          {/* Courier performance filter */}
          <div>
            <label className="block text-slate-500 mb-1.5 text-[10px] uppercase">{isAr ? 'المندوب كافل التسليم' : 'Assigned Logistics Courier'}</label>
            <select
              value={selectedCourier}
              onChange={e => setSelectedCourier(e.target.value)}
              className="w-full bg-black/40 border border-slate-850 text-white rounded-xl p-2.5 outline-none focus:border-[#d4af37]"
            >
              <option value="all">{isAr ? 'جميع المناديب النشطين' : 'All Corporate Couriers'}</option>
              {couriers.map(cour => (
                <option key={cour.id} value={cour.id}>{cour.fullName}</option>
              ))}
            </select>
          </div>

          {/* Payment Standing Filter */}
          <div>
            <label className="block text-slate-500 mb-1.5 text-[10px] uppercase">{isAr ? 'وضعية الحساب المالي للعملاء' : 'Financial Ledger state'}</label>
            <select
              value={paymentStatus}
              onChange={e => setPaymentStatus(e.target.value)}
              className="w-full bg-black/40 border border-slate-850 text-white rounded-xl p-2.5 outline-none focus:border-[#d4af37]"
            >
              <option value="all">{isAr ? 'جميع الحالات والذمم' : 'All Standing Balances'}</option>
              <option value="fully_paid">{isAr ? 'شحنات خالصة وواصلة بالكامل' : 'Paid in Full'}</option>
              <option value="partially_paid">{isAr ? 'المسددين جزئيات (ذمم جارية)' : 'Partially Outstanding'}</option>
              <option value="unpaid">{isAr ? 'قيد التحصيل الكلي (أرصدة صفر)' : 'Zero Paid (Debit Outstanding)'}</option>
            </select>
          </div>

        </div>
      </div>

      {/* 🏛️ Beautiful Top KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 p-4 rounded-3xl relative overflow-hidden shadow-md text-start">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-1">
            {isAr ? 'إجمالي فواتير الشحنات (العائد المالي)' : 'Gross Declared Revenue (YER)'}
          </span>
          <span className="text-xl font-mono font-black text-[#d4af37] block">
            {metrics.totalOrderValueYER.toLocaleString()}
          </span>
          <span className="text-[9px] text-slate-550 font-sans block mt-1">
            {isAr ? 'القيمة الإجمالية المفترضة للطرود المسجلة' : 'Contract value of logged cargo'}
          </span>
          <div className="absolute top-3 right-3 p-1.5 text-yellow-500 bg-yellow-950/20 border border-yellow-900/30 rounded-xl">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 p-4 rounded-3xl relative overflow-hidden shadow-md text-start">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-1">
            {isAr ? 'السيولة المستلمة المحبوسة' : 'Revenues Collected (YER)'}
          </span>
          <span className="text-xl font-mono font-black text-emerald-400 block">
            {metrics.totalCollectedYER.toLocaleString()}
          </span>
          <span className="text-[9px] text-slate-550 font-sans block mt-1">
            {isAr ? 'المبالغ النقدية المقبوضة فعلياً من العملاء' : 'Actual hard cash settled directly'}
          </span>
          <div className="absolute top-3 right-3 p-1.5 text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 rounded-xl">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 p-4 rounded-3xl relative overflow-hidden shadow-md text-start">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-1">
            {isAr ? 'الذمم المستحقة طرف العملاء' : 'Outstanding Receivables (YER)'}
          </span>
          <span className="text-xl font-mono font-black text-amber-500 block">
            {metrics.totalOutstandingYER.toLocaleString()}
          </span>
          <span className="text-[9px] text-slate-550 font-sans block mt-1">
            {isAr ? 'الديون المتبقية خارج الصندوق للتحصيل' : 'Debts in hand of buyers pending collection'}
          </span>
          <div className="absolute top-3 right-3 p-1.5 text-amber-500 bg-amber-950/20 border border-amber-900/30 rounded-xl">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 p-4 rounded-3xl relative overflow-hidden shadow-md text-start">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-1">
            {isAr ? 'صافي أرباح الصندوق التشغيلية' : 'Net Company Profit (YER)'}
          </span>
          <span className="text-xl font-mono font-black text-cyan-400 block animate-pulse">
            {metrics.netProfitYER.toLocaleString()}
          </span>
          <span className="text-[9px] text-slate-550 font-sans block mt-1">
            {isAr ? 'قيمة المقبوضات مطروح منها غرامات ومصاريف' : 'Liquidity cash minus corporate expenses'}
          </span>
          <div className="absolute top-3 right-3 p-1.5 text-cyan-400 bg-cyan-950/20 border border-cyan-900/30 rounded-xl">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

      </div>

      {/* 📈 Advanced Visual Charts Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend Area chart */}
        <div className="lg:col-span-2 bg-[#121215] border border-slate-850 p-5 rounded-3xl text-start shadow-md">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider">{isAr ? 'منحنى تقييم تدفقات الإيرادات والمصروفات' : 'Filing Inflow vs Outflow over time'}</h3>
              <p className="text-[9px] text-slate-500 font-bold">{isAr ? 'مقارنة حجم القبوضات النقدية والمنصرفات اليومية للوقوف على التوازن' : 'Inherent contrast tracking overall liquidity trend'}</p>
            </div>
            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">
              {isAr ? `الهامش: %${metrics.netProfitMargin}` : `Margin: %${metrics.netProfitMargin}`}
            </span>
          </div>

          <div className="h-64 font-mono select-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData.trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d1d24" opacity={0.3} />
                <XAxis dataKey="dateLabel" stroke="#4a5568" fontSize={9} />
                <YAxis stroke="#4a5568" fontSize={9} />
                <Tooltip 
                  contentStyle={{ background: '#09090b', borderColor: 'rgba(212,175,55,0.2)', borderRadius: '12px' }} 
                  labelClassName="text-[#d4af37] font-mono font-black text-[10px]"
                  itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Area name={isAr ? 'المقبوضات المحصلة YER' : 'Cash In YER'} type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area name={isAr ? 'المصاريف التشغيلية YER' : 'Cash Out YER'} type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Pie balance chart */}
        <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl text-start shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">{isAr ? 'توزيع وتسييل الخزينة والذمم' : 'Total Custody Ledger Standing'}</h3>
            <p className="text-[9px] text-slate-500 font-bold mb-4">{isAr ? 'نظرة تحليلية لقيم السيولة والمذمم والمصاريف قياساً على حجم المبيعات' : 'Analysis of receivables contrasted with strict office cash flow'}</p>
          </div>

          <div className="h-44 relative flex items-center justify-center font-mono">
            {chartsData.financialPie.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartsData.financialPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartsData.financialPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#09090b', borderColor: 'rgba(212,175,55,0.2)', borderRadius: '12px' }} 
                    itemStyle={{ fontSize: '10px', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-[9px] text-slate-600 font-mono uppercase">[ no_financial_data_to_share ]</span>
            )}
          </div>

          {/* Legend indicator */}
          <div className="space-y-1.5 mt-2">
            {chartsData.financialPie.map((item, idx) => {
              const perc = metrics.totalCollectedYER + metrics.totalOutstandingYER + metrics.netOperationalExpenses > 0
                ? Math.round((item.value / (metrics.totalCollectedYER + metrics.totalOutstandingYER + metrics.netOperationalExpenses)) * 100)
                : 0;
              return (
                <div key={idx} className="flex justify-between items-center text-[10px] font-bold">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                    {item.name}
                  </span>
                  <span className="text-white font-mono font-black">{perc}% <span className="text-[9px] text-slate-550">({item.value.toLocaleString()})</span></span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 📦 Bottom Layout: Hub Performance Bar Chart & Interactive PDF Report Configurator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Origin share Bar chart */}
        <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl text-start shadow-md lg:col-span-1">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">{isAr ? 'حيوية وقنوات المصادر والشحن' : 'Traffic volumes by origin node'}</h3>
            <p className="text-[9px] text-slate-500 font-bold mb-4">{isAr ? 'قياس تكرار وكتل الشحن الواردة من مخازن السعودية، الصين، تركيا أو دبي' : 'Analyze volume density flowing from shipping warehouses'}</p>
          </div>

          <div className="h-56 font-mono select-none">
            {chartsData.sourcesShare.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData.sourcesShare} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d1d24" opacity={0.3} />
                  <XAxis dataKey="name" stroke="#4a5568" fontSize={8.5} />
                  <YAxis stroke="#4a5568" fontSize={9} />
                  <Tooltip 
                    contentStyle={{ background: '#09090b', borderColor: 'rgba(212,175,55,0.2)', borderRadius: '12px' }} 
                    itemStyle={{ fontSize: '10px' }}
                  />
                  <Bar dataKey="value" fill="#d4af37" radius={[4, 4, 0, 0]}>
                    {chartsData.sourcesShare.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={idx % 2 === 0 ? '#d4af37' : '#eab308'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <span className="text-[9px] text-slate-600 font-mono uppercase">[ no_cargo_logistics_registered ]</span>
              </div>
            )}
          </div>
        </div>

        {/* PDF Design & Custom Printing Panel */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#121215] via-[#121215] to-[#16161a] border border-[#d4af37]/15 p-6 rounded-3xl text-start shadow-2xl relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-y-4 translate-x-4 text-slate-900 group-hover:text-slate-850 transition duration-500 opacity-20">
            <FileText className="w-44 h-44" />
          </div>

          <div className="flex items-center gap-3 border-b border-slate-850 pb-4 mb-5">
            <div className="bg-[#d4af37]/10 border border-[#d4af37]/30 p-2 rounded-2xl text-[#d4af37]">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-rose-50 (isAr ? 'text-white' : 'text-slate-100') uppercase tracking-wider">
                {isAr ? 'مهندس ومخصص التقارير التنفيذية الذكية (PDF Builder)' : 'Interactive Corporate PDF Builder'}
              </h3>
              <p className="text-[9px] text-[#d4af37]" style={{ fontWeight: 'black' }}>
                {isAr ? 'اختر البنود ومستويات الحسابات وأبعاد المراجعة الموازنة لدمجها تلقائياً بالملف النهائي' : 'Build a custom corporate auditor document by ticking desired chapters'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            
            {/* Options boxes */}
            <div className="space-y-2.5 text-[11px] font-bold text-slate-350">
              
              <button 
                type="button"
                onClick={() => setPdfOptions({ ...pdfOptions, includeExecutiveSummary: !pdfOptions.includeExecutiveSummary })}
                className="flex items-center gap-3 text-start w-full hover:bg-black/20 p-2 rounded-xl border border-white/[0.01]"
              >
                {pdfOptions.includeExecutiveSummary ? (
                  <CheckSquare className="w-4 h-4 text-[#d4af37]" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
                <div>
                  <span className="text-white block font-black">{isAr ? '١. الكلاشف والملخص التنفيذي للأرباح' : 'Executive financial savings summary'}</span>
                  <span className="text-[9px] text-slate-500 block">{isAr ? 'دمج بطاقات الإحصاء العام (الايراد والمصاريف والربح)' : 'Includes gross, collection, operational expense, margin'}</span>
                </div>
              </button>

              <button 
                type="button"
                onClick={() => setPdfOptions({ ...pdfOptions, includeOrdersLedger: !pdfOptions.includeOrdersLedger })}
                className="flex items-center gap-3 text-start w-full hover:bg-black/20 p-2 rounded-xl border border-white/[0.01]"
              >
                {pdfOptions.includeOrdersLedger ? (
                  <CheckSquare className="w-4 h-4 text-[#d4af37]" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
                <div>
                  <span className="text-white block font-black">{isAr ? '٢. كرت وجدول حركة طرود الطلبيات بالتفصيل' : 'Cargo transaction records ledger'}</span>
                  <span className="text-[9px] text-slate-500 block">{isAr ? 'طباعة كامل البيانات المصفاة للطلب كرموز وتكاليف وحالات شحن' : 'Dumps current search query list with statuses, routes'}</span>
                </div>
              </button>

            </div>

            <div className="space-y-2.5 text-[11px] font-bold text-slate-350">
              
              <button 
                type="button"
                onClick={() => setPdfOptions({ ...pdfOptions, includeExpensesLedger: !pdfOptions.includeExpensesLedger })}
                className="flex items-center gap-3 text-start w-full hover:bg-black/20 p-2 rounded-xl border border-white/[0.01]"
              >
                {pdfOptions.includeExpensesLedger ? (
                  <CheckSquare className="w-4 h-4 text-[#d4af37]" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
                <div>
                  <span className="text-white block font-black">{isAr ? '٣. جدول المصروفات العامة والتشغيلية' : 'Outflow office expenditures log'}</span>
                  <span className="text-[9px] text-slate-500 block">{isAr ? 'دمج سندات الصرف للمكتب وحوالات مصانع الصين كقيم حرة' : 'Fills details of corporate overheads, factory trade, etc.'}</span>
                </div>
              </button>

              <button 
                type="button"
                onClick={() => setPdfOptions({ ...pdfOptions, includeCourierStanding: !pdfOptions.includeCourierStanding })}
                className="flex items-center gap-3 text-start w-full hover:bg-black/20 p-2 rounded-xl border border-white/[0.01]"
              >
                {pdfOptions.includeCourierStanding ? (
                  <CheckSquare className="w-4 h-4 text-[#d4af37]" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
                <div>
                  <span className="text-white block font-black">{isAr ? '٤. سجل وموازنة عهد المندوبين المالية' : 'Courier custody balance standing'}</span>
                  <span className="text-[9px] text-slate-500 block">{isAr ? 'مستحقات المناديب والعهد الكلية المفتوحة لتصفية الذمة' : 'Reconciliation columns of how much cash safe was given'}</span>
                </div>
              </button>

            </div>

          </div>

          <div className="pt-4 border-t border-slate-850 flex flex-wrap gap-3 items-center justify-between">
            <button 
              type="button"
              onClick={() => setPdfOptions({ ...pdfOptions, includeSignatureBox: !pdfOptions.includeSignatureBox })}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-400"
            >
              {pdfOptions.includeSignatureBox ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#d4af37]" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>{isAr ? 'دمج ذيل تواقيع المصادقة والتفويض المعتمد' : 'Affix auditor signature boxes on report print'}</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="px-6 py-3 bg-[#d4af37] text-black hover:bg-yellow-500 font-extrabold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition active:scale-95"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              {isAr ? 'إنشاء وطباعة ملف PDF المعياري والتشغيلي' : 'Compile & Save PDF Statement'}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
