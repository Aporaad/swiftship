import React, { useEffect, useMemo, useState } from 'react';
import { DollarSign, Package, Truck, Users as UsersIcon, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { financialAccountService } from '../../../../services/financialAccountService';
import { subscribeDashboardData } from '../services/dashboardGateway';
import { ACTIVE_DELIVERY_STATUSES, COURIER_AVATARS, FIXED_COURIER_COORDS, DASHBOARD_ACTION_LABELS } from '../constants';
import type { DashboardData, DashboardStats } from '../types';

type UseDashboardDataArgs = {
  auth: { currentUser?: unknown | null };
  role: unknown;
  roleLoading: boolean;
  isAr: boolean;
  settings: { currency?: string };
  dbRates: { USD?: number; SAR?: number };
};

const initialStats: DashboardStats = {
  totalOrders: 0,
  totalRevenues: 0,
  netProfit: 0,
  activeDeliveries: 0,
  delayedOrders: 0,
  activeCustomers: 0,
  amountRemaining: 0,
  amountPaid: 0,
};

export function useDashboardData({ auth, role, roleLoading, isAr, settings, dbRates }: UseDashboardDataArgs): DashboardData {
  const [orders, setOrders] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const expenses: any[] = [];
  const [realLogs, setRealLogs] = useState<any[]>([]);
  const [customersCount, setCustomersCount] = useState(0);
  const [couriersCount, setCouriersCount] = useState(0);
  const expensesCount = 0;
  const [loading, setLoading] = useState(true);
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]);
  const [stats, setStats] = useState<DashboardStats>(initialStats);

  useEffect(() => {
    if (roleLoading || !auth.currentUser) return;

    return subscribeDashboardData({
      setCustomersCount,
      setCouriers,
      setCouriersCount,
      setOrders,
      setRealLogs,
      setFinancialAccounts,
      setLoading,
    });
  }, [role, roleLoading]);

  useEffect(() => {
    let computedTotalOrders = orders.length;
    let computedActive = 0;
    let computedDelayed = 0;

    orders.forEach((o: any) => {
      const status = o.orderStatus || o.order_status || 'Processing';
      if (ACTIVE_DELIVERY_STATUSES.includes(status)) computedActive++;
      if (status === 'Delayed' || status === 'متأخر') computedDelayed++;
    });

    const totalRevenues = financialAccounts
      .filter((a) => a.accountCode?.startsWith('4') || a.accountCode?.startsWith('REV'))
      .reduce((sum, a) => {
        const balance = parseFloat(a.balance as any) || 0;
        const converted = financialAccountService.convertToDefaultCurrency(balance, a.currency || 'YER', settings.currency || 'YER', { USD: dbRates.USD, SAR: dbRates.SAR });
        return sum + converted;
      }, 0);

    const totalCosts = financialAccounts
      .filter((a) => a.accountCode?.startsWith('5') || a.accountCode?.startsWith('EXP'))
      .reduce((sum, a) => {
        const balance = parseFloat(a.balance as any) || 0;
        const converted = financialAccountService.convertToDefaultCurrency(balance, a.currency || 'YER', settings.currency || 'YER', { USD: dbRates.USD, SAR: dbRates.SAR });
        return sum + converted;
      }, 0);

    const netReceivables = financialAccounts
      .filter((a) => a.entityType === 'customer' || a.accountCode?.startsWith('1130'))
      .reduce((sum, a) => {
        const balance = parseFloat(a.balance as any) || 0;
        const converted = financialAccountService.convertToDefaultCurrency(balance, a.currency || 'YER', settings.currency || 'YER', { USD: dbRates.USD, SAR: dbRates.SAR });
        return sum + converted;
      }, 0);

    setStats({
      totalOrders: computedTotalOrders,
      totalRevenues,
      netProfit: totalRevenues - totalCosts,
      activeDeliveries: computedActive,
      delayedOrders: computedDelayed,
      activeCustomers: customersCount,
      amountRemaining: netReceivables,
      amountPaid: totalRevenues - netReceivables,
    });
  }, [orders, customersCount, financialAccounts, settings.currency, dbRates.USD, dbRates.SAR]);

  const volumeChartData = useMemo(() => {
    const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const hasRealOrders = orders.length > 0;
    return last7Days.map((date) => {
      const dayOfWeek = date.getDay();
      const dayName = isAr ? dayNamesAr[dayOfWeek] : dayNamesEn[dayOfWeek];
      let count = 0;
      if (hasRealOrders) {
        count = orders.filter((order: any) => {
          if (!order.createdAt) return false;
          const orderDate = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
          return orderDate.getDate() === date.getDate() && orderDate.getMonth() === date.getMonth() && orderDate.getFullYear() === date.getFullYear();
        }).length;
      }
      return { day: dayName, volume: count };
    });
  }, [orders, isAr]);

  const statusChartData = useMemo(() => {
    const groups: { [key: string]: number } = { Delivered: 0, 'In Transit': 0, Processing: 0, 'In Local Warehouse': 0, Delayed: 0 };
    if (orders.length > 0) {
      orders.forEach((o: any) => {
        let status = o.orderStatus || o.order_status || 'Processing';
        if (status === 'تم التسليم' || status?.toLowerCase() === 'delivered') status = 'Delivered';
        else if (status === 'جاري التوصيل' || status === 'قيد الشحن' || status?.toLowerCase() === 'in transit' || status?.toLowerCase() === 'shipped') status = 'In Transit';
        else if (status === 'في الطريق' || status?.toLowerCase() === 'processing') status = 'Processing';
        else if (status === 'وصل المخزن' || status === 'تم التجهيز' || status?.toLowerCase() === 'in local warehouse') status = 'In Local Warehouse';
        else if (status === 'متأخر' || status?.toLowerCase() === 'delayed') status = 'Delayed';
        else status = 'Processing';
        groups[status] = (groups[status] || 0) + 1;
      });
    }
    return [
      { name: isAr ? 'تم التسليم' : 'Delivered', value: groups.Delivered || 0, color: '#10b981' },
      { name: isAr ? 'جاري التوصيل' : 'In Transit', value: groups['In Transit'] || 0, color: '#3b82f6' },
      { name: isAr ? 'في الطريق' : 'Processing', value: groups.Processing || 0, color: '#f59e0b' },
      { name: isAr ? 'وصل المخزن' : 'Local Warehouse', value: groups['In Local Warehouse'] || 0, color: '#d4af37' },
      { name: isAr ? 'متأخر' : 'Delayed', value: groups.Delayed || 0, color: '#ef4444' },
    ];
  }, [orders, isAr]);

  const mapCouriers = useMemo(() => {
    if (couriers.length === 0) return [];
    return couriers.map((courier, idx) => {
      const coord = FIXED_COURIER_COORDS[idx % FIXED_COURIER_COORDS.length];
      const avatar = COURIER_AVATARS[idx % COURIER_AVATARS.length];
      const courierOrders = orders.filter((o) => o.deliveryCourierId === courier.id);
      const activeOrder = courierOrders[0];
      const orderRef = activeOrder ? (activeOrder.orderNumber || `ALX-ID-${activeOrder.id.slice(0, 4)}`) : (isAr ? 'بدون شحنة نشطة' : 'No Active Order');
      let statusStr = isAr ? 'نشط ميدانياً' : 'Operational';
      let statusColor = 'blue';
      if (activeOrder) {
        const oStatus = activeOrder.orderStatus || activeOrder.order_status || 'Processing';
        if (oStatus === 'Delivered' || oStatus === 'تم التسليم') { statusStr = isAr ? 'تم التسليم' : 'Delivered'; statusColor = 'green'; }
        else if (oStatus === 'Delayed' || oStatus === 'متأخر') { statusStr = isAr ? 'متأخر' : 'Delayed'; statusColor = 'red'; }
        else { statusStr = isAr ? 'جاري التوصيل' : 'Delivering'; statusColor = 'blue'; }
      }
      return { id: courier.id, name: courier.fullName || courier.name || 'Courier', avatar, order: orderRef, status: statusStr, statusColor, x: coord.x, y: coord.y };
    });
  }, [couriers, orders, isAr]);

  const recentActivities = useMemo(() => {
    if (realLogs.length === 0) return [];
    return realLogs.map((log) => {
      let title = isAr ? DASHBOARD_ACTION_LABELS[log.action as keyof typeof DASHBOARD_ACTION_LABELS]?.ar || log.action || 'نشاط لوحة التحكم' : DASHBOARD_ACTION_LABELS[log.action as keyof typeof DASHBOARD_ACTION_LABELS]?.en || log.action || 'System ledger log';
      let icon = Package;
      let iconBg = 'bg-blue-950/40 text-blue-400 border-blue-900/30';
      if (log.action?.includes('order') || log.category === 'ORDERS') { icon = Package; iconBg = 'bg-blue-950/40 text-blue-400 border-blue-900/30'; }
      else if (log.action?.includes('expense') || log.action?.includes('custody') || log.category === 'FINANCE') { icon = DollarSign; iconBg = 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'; }
      else if (log.action?.includes('courier') || log.category === 'COURIERS') { icon = Truck; iconBg = 'bg-cyan-950/40 text-cyan-400 border-cyan-900/30'; }
      else if (log.action?.includes('customer') || log.category === 'CUSTOMERS') { icon = UsersIcon; iconBg = 'bg-purple-950/40 text-purple-400 border-purple-900/30'; }
      else { icon = CheckCircle2; iconBg = 'bg-slate-900/40 text-slate-400 border-slate-800/35'; }
      const now = Date.now();
      const diffMs = now - (log.createdAt ? log.createdAt.getTime() : now);
      const mins = Math.floor(diffMs / 60000);
      let timeStr = '';
      if (mins < 1) timeStr = isAr ? 'الآن' : 'Just now';
      else if (mins < 60) timeStr = isAr ? `منذ ${mins} دقيقة` : `${mins}m ago`;
      else { const hours = Math.floor(mins / 60); if (hours < 24) timeStr = isAr ? `منذ ${hours} ساعة` : `${hours}h ago`; else timeStr = isAr ? `منذ ${Math.floor(hours / 24)} يوم` : `${Math.floor(hours / 24)}d ago`; }
      return { id: log.id, title, ref: log.target || log.userEmail || log.userName || '', time: timeStr, icon, iconBg };
    });
  }, [realLogs, isAr]);

  const alertsList = useMemo(() => {
    const list: any[] = [];
    const delayed = orders.filter((o) => ['Delayed', 'متأخر'].includes(o.orderStatus || o.order_status || ''));
    if (delayed.length > 0) list.push({ id: 'delayed_alert', type: 'danger', messageAr: `يوجد ${delayed.length} شحنات متأخرة بالوصول في النظام حالياً!`, messageEn: `There are ${delayed.length} delayed shipments in the system currently!`, icon: AlertCircle, bgClass: 'bg-rose-950/20 border-rose-800/40', textClass: 'text-rose-400' });
    const outstanding = orders.filter((o) => parseFloat(o.amountRemaining || '0') > 15000);
    if (outstanding.length > 0) list.push({ id: 'debt_alert', type: 'warning', messageAr: `مبالغ متبقية مستحقة تزيد عن ١٥,٠٠٠ ريال يمني على ${outstanding.length} طلبات!`, messageEn: `Outstanding balances over 15k YER detected on ${outstanding.length} orders!`, icon: ShieldAlert, bgClass: 'bg-amber-950/20 border-amber-800/40', textClass: 'text-amber-500' });
    const idleCouriersCount = couriers.length - orders.reduce((acc, o) => { if (o.deliveryCourierId) acc.add(o.deliveryCourierId); return acc; }, new Set<string>()).size;
    if (idleCouriersCount > 0 && couriers.length > 0) list.push({ id: 'courier_idle_alert', type: 'info', messageAr: `يوجد ${idleCouriersCount} مناديب في جاهزية تامة في الميدان لتوزيع الشحنات الإضافية.`, messageEn: `${idleCouriersCount} registered dispatchers are standby on the field for operations.`, icon: Truck, bgClass: 'bg-cyan-950/20 border-cyan-800/40', textClass: 'text-cyan-400' });
    if (list.length === 0) list.push({ id: 'system_ok', type: 'success', messageAr: 'نظام إدارة الشحنات والمناديب مستقر تماماً. كافة الخدمات والاتصالات الطارئة مؤمنة.', messageEn: 'Shipping management core is fully optimized. All dispatch networks secure.', icon: CheckCircle2, bgClass: 'bg-emerald-950/15 border-emerald-900/45', textClass: 'text-emerald-400' });
    return list;
  }, [orders, couriers, isAr]);

  const displayOrders = useMemo(() => {
    if (orders.length === 0) return [];
    return orders.slice(0, 5).map((ord) => {
      const matchingCourier = couriers.find((c) => c.id === ord.deliveryCourierId || c.id === ord.shippingCourierId);
      return { ...ord, orderNumber: ord.orderNumber || `ALX-ID-${ord.id.slice(0, 4)}`, customerName: ord.customerName || (isAr ? 'عضو زائر' : 'Guest Customer'), orderStatus: ord.orderStatus || ord.order_status || 'Processing', deliveryCourierName: matchingCourier ? (matchingCourier.fullName || matchingCourier.name) : '—', totalCostYER: ord.totalPrice || ord.totalCostYER || '0', createdAt: ord.createdAt };
    });
  }, [orders, couriers, isAr]);

  return { orders, couriers, couriersCount, customersCount, expensesCount, loading, stats, volumeChartData, statusChartData, mapCouriers, recentActivities, alertsList, displayOrders };
}
