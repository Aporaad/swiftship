import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Package, Truck, CheckCircle2, AlertCircle, TrendingUp, Users as UsersIcon, DollarSign, FileText, TrendingDown } from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useAuthSession } from '../features/auth/AuthSessionProvider';
import { useSettings } from '../context/SettingsContext';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { LOCKED } from './dashboard/subcomponents/constants';
import { useDashboardData } from './dashboard/subcomponents/hooks/useDashboardData';
import {
  DashboardHeaderAndCustomizer,
  DashboardMetricCards,
  DashboardMapAndActivity,
  DashboardAnalyticsCharts,
  DashboardOperations,
  DashboardQuickActions,
} from './dashboard/subcomponents/components/DashboardWidgets';

export default function Dashboard() {
  const { legacyAuth: auth } = useAuthSession();
  const navigate = useNavigate();
  const { role, hasPermission, profile, loading: roleLoading } = useRole();
  const { settings, updateSettings, t } = useSettings();
  const { rates: dbRates } = useExchangeRates();
  const isAr = settings.language === 'ar';

  const visibleMetrics = settings.visibleMetrics || ['totalOrders', 'totalRevenues', 'netProfit', 'activeDeliveries', 'delayedOrders', 'activeCustomers'];
  const [isCustomizing, setIsCustomizing] = useState(false);
  const gridColumns = settings.dashboardGridColumns || 6;
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);

  const saveDashboardSettings = async (metrics: string[], cols: number) => {
    try {
      await updateSettings({ visibleMetrics: metrics, dashboardGridColumns: cols });
    } catch (e) {
      console.error("Failed to save dashboard settings:", e);
    }
  };

  const dashboardData = useDashboardData({ auth, role, roleLoading, isAr, settings, dbRates });
  const { orders, couriersCount, expensesCount, loading, stats, mapCouriers, recentActivities, alertsList, displayOrders, volumeChartData, statusChartData } = dashboardData;

  if (loading || roleLoading) {
    return (
      <div className="flex bg-[#0e0e11] text-white h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#d4af37] border-t-transparent"></div>
      </div>
    );
  }

  if (role !== 'Admin' && !hasPermission('view_dashboard')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-800 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide">{isAr ? 'وصول مقيد' : 'Access Denied'}</h2>
        <p className="text-slate-500 max-w-md">{isAr ? 'لا تملك صلاحية عرض لوحة التحكم. تواصل مع مديرك لطلب الصلاحية.' : 'You do not have permission to access the dashboard. Contact your administrator.'}</p>
      </div>
    );
  }

  const canViewStats = role === 'Admin' || hasPermission('view_statistics');

  // Define available metric configurations
  const metricConfigs: { [key: string]: any } = {
    totalOrders: {
      titleAr: 'إجمالي الطلبات',
      titleEn: 'Total Orders',
      value: stats.totalOrders.toLocaleString(),
      changeAr: '+12.5% من أمس',
      changeEn: '+12.5% vs yesterday',
      isPositive: true,
      colorClass: 'text-white',
      accentColor: '#d4af37',
      bgClass: 'bg-[#d4af37]/5 border-[#d4af37]/10 text-[#d4af37]',
      icon: Package,
    },
    totalRevenues: {
      titleAr: 'إجمالي الإيرادات',
      titleEn: 'Total Revenue',
      value: canViewStats ? `${stats.totalRevenues.toLocaleString()} ${settings.currency || 'YER'}` : LOCKED,
      changeAr: '+18.7% من أمس',
      changeEn: '+18.7% vs yesterday',
      isPositive: true,
      colorClass: canViewStats ? 'text-[#d4af37]' : 'text-rose-500',
      accentColor: '#d4af37',
      bgClass: canViewStats ? 'bg-[#d4af37]/5 border-[#d4af37]/10 text-[#d4af37]' : 'bg-rose-950/20 border-rose-900/30 text-rose-400',
      icon: DollarSign,
    },
    netProfit: {
      titleAr: 'صافي أرباح الشركة',
      titleEn: 'Net Profits',
      value: canViewStats ? `${stats.netProfit.toLocaleString()} ${settings.currency || 'YER'}` : LOCKED,
      changeAr: '+15.2% من أمس',
      changeEn: '+15.2% vs yesterday',
      isPositive: true,
      colorClass: canViewStats ? 'text-white' : 'text-rose-500',
      accentColor: '#d4af37',
      bgClass: canViewStats ? 'bg-[#d4af37]/5 border-[#d4af37]/10 text-[#d4af37]' : 'bg-rose-950/20 border-rose-900/30 text-rose-400',
      icon: TrendingUp,
    },
    activeDeliveries: {
      titleAr: 'طلبات قيد التوصيل',
      titleEn: 'In Delivery',
      value: stats.activeDeliveries.toLocaleString(),
      changeAr: '+8.4% من أمس',
      changeEn: '+8.4% vs yesterday',
      isPositive: true,
      colorClass: 'text-white',
      accentColor: '#d4af37',
      bgClass: 'bg-[#d4af37]/5 border-[#d4af37]/10 text-[#d4af37]',
      icon: Truck,
    },
    delayedOrders: {
      titleAr: 'الطلبات المتأخرة',
      titleEn: 'Delayed Orders',
      value: stats.delayedOrders.toLocaleString(),
      changeAr: '-4.3% تحسن',
      changeEn: '-4.3% improved',
      isPositive: false,
      colorClass: 'text-rose-500',
      accentColor: '#f43f5e',
      bgClass: 'bg-rose-950/20 border-rose-900/40 text-rose-400',
      icon: AlertCircle,
    },
    activeCustomers: {
      titleAr: 'العملاء النشطين',
      titleEn: 'Active Customers',
      value: stats.activeCustomers.toLocaleString(),
      changeAr: '+10.1% من أمس',
      changeEn: '+10.1% vs yesterday',
      isPositive: true,
      colorClass: 'text-white',
      accentColor: '#d4af37',
      bgClass: 'bg-[#d4af37]/5 border-[#d4af37]/10 text-[#d4af37]',
      icon: UsersIcon,
    },
    amountPaid: {
      titleAr: 'المبالغ المحصلة كاش',
      titleEn: 'Cash Collected',
      value: canViewStats ? `${stats.amountPaid.toLocaleString()} ${settings.currency || 'YER'}` : LOCKED,
      changeAr: '+14.2% مؤشر ممتاز',
      changeEn: '+14.2% healthy level',
      isPositive: true,
      colorClass: canViewStats ? 'text-emerald-400' : 'text-rose-500',
      accentColor: '#10b981',
      bgClass: canViewStats ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400' : 'bg-rose-950/20 border-rose-900/30 text-rose-400',
      icon: CheckCircle2,
    },
    amountRemaining: {
      titleAr: 'المبالغ المتبقية والمديونيات',
      titleEn: 'Outstanding Debts',
      value: canViewStats ? `${stats.amountRemaining.toLocaleString()} ${settings.currency || 'YER'}` : LOCKED,
      changeAr: '+2.1% معلق للتحصيل',
      changeEn: '+2.1% pending collect',
      isPositive: false,
      colorClass: canViewStats ? 'text-rose-450' : 'text-rose-500',
      accentColor: '#f43f5e',
      bgClass: canViewStats ? 'bg-rose-950/10 border-rose-950/30 text-rose-400' : 'bg-rose-950/20 border-rose-900/30 text-rose-400',
      icon: TrendingDown,
    },
    couriersCount: {
      titleAr: 'طاقم المناديب النشط',
      titleEn: 'Active Couriers',
      value: couriersCount > 0 ? couriersCount.toLocaleString() : '12',
      changeAr: 'تحديث فوري للمسار',
      changeEn: 'Routes synced live',
      isPositive: true,
      colorClass: 'text-cyan-400',
      accentColor: '#22d3ee',
      bgClass: 'bg-cyan-950/20 border-cyan-900/30 text-cyan-400',
      icon: Truck,
    },
    expensesCount: {
      titleAr: 'العمليات التشغيلية المنفذة',
      titleEn: 'Expense Vouchers',
      value: expensesCount > 0 ? expensesCount.toLocaleString() : '48',
      changeAr: 'صندوق المصروفات',
      changeEn: 'Cash register ledger',
      isPositive: true,
      colorClass: 'text-slate-200',
      accentColor: '#94a3b8',
      bgClass: 'bg-slate-900 border-slate-700 text-slate-300',
      icon: FileText,
    }
  };

  return (
    <div className="space-y-6 pb-12 text-[#cacfd2] text-right font-sans" dir={isAr ? 'rtl' : 'ltr'}>
      <DashboardHeaderAndCustomizer
        isAr={isAr}
        isCustomizing={isCustomizing}
        setIsCustomizing={setIsCustomizing}
        visibleMetrics={visibleMetrics}
        gridColumns={gridColumns}
        metricConfigs={metricConfigs}
        saveDashboardSettings={saveDashboardSettings}
      />
      <DashboardMetricCards
        isAr={isAr}
        visibleMetrics={visibleMetrics}
        gridColumns={gridColumns}
        metricConfigs={metricConfigs}
        canViewStats={canViewStats}
      />
      <DashboardMapAndActivity
        isAr={isAr}
        navigate={navigate}
        mapCouriers={mapCouriers}
        selectedCourierId={selectedCourierId}
        setSelectedCourierId={setSelectedCourierId}
        recentActivities={recentActivities}
      />
      <DashboardAnalyticsCharts
        isAr={isAr}
        orders={orders}
        volumeChartData={volumeChartData}
        statusChartData={statusChartData}
      />
      <DashboardOperations
        isAr={isAr}
        navigate={navigate}
        orders={orders}
        canViewStats={canViewStats}
        stats={stats}
        displayOrders={displayOrders}
        alertsList={alertsList}
      />
      <DashboardQuickActions isAr={isAr} navigate={navigate} />
    </div>
  );
}
