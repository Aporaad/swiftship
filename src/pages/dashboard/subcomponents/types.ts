import type { LucideIcon } from 'lucide-react';

export type DashboardStats = {
  totalOrders: number;
  totalRevenues: number;
  netProfit: number;
  activeDeliveries: number;
  delayedOrders: number;
  activeCustomers: number;
  amountRemaining: number;
  amountPaid: number;
};

export type DashboardMetricConfig = {
  titleAr: string;
  titleEn: string;
  value: string;
  changeAr: string;
  changeEn: string;
  isPositive: boolean;
  colorClass: string;
  accentColor: string;
  bgClass: string;
  icon: LucideIcon;
};

export type DashboardCourierMarker = {
  id: string;
  name: string;
  avatar: string;
  order: string;
  status: string;
  statusColor: string;
  x: number;
  y: number;
};

export type DashboardActivity = {
  id: string;
  title: string;
  ref: string;
  time: string;
  icon: LucideIcon;
  iconBg: string;
};

export type DashboardAlert = {
  id: string;
  type: string;
  messageAr: string;
  messageEn: string;
  icon: LucideIcon;
  bgClass: string;
  textClass: string;
};

export type DashboardOrder = Record<string, any> & {
  orderNumber: string;
  customerName: string;
  orderStatus: string;
  deliveryCourierName: string;
  totalCostYER: string | number;
  createdAt: Date | null;
};

export type DashboardData = {
  orders: any[];
  couriers: any[];
  couriersCount: number;
  customersCount: number;
  expensesCount: number;
  loading: boolean;
  stats: DashboardStats;
  volumeChartData: Array<{ day: string; volume: number }>;
  statusChartData: Array<{ name: string; value: number; color: string }>;
  mapCouriers: DashboardCourierMarker[];
  recentActivities: DashboardActivity[];
  alertsList: DashboardAlert[];
  displayOrders: DashboardOrder[];
};
