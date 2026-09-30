import type { LucideIcon } from 'lucide-react';

export type LayoutNavItem = {
  id: string;
  name: string;
  path: string;
  icon: LucideIcon;
  permission: string;
};

export type LayoutNavOrderConfig = {
  path: string;
  visible: boolean;
};

export type LayoutSystemStats = {
  activeOrders: number;
  delayedOrders: number;
  onlineStaff: number;
  ongoingShipments: number;
  financiallyPending: number;
  systemStatus: 'good' | 'warning' | 'error';
};
