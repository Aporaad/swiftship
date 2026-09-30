export type { CouriersViewModel } from '../../data/dtos/couriers.dto';

export interface CourierFormValues {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  gpsLocation: string;
  commissionRate: number;
  notes: string;
  courierType: 'sourcing' | 'local';
}

export interface CourierEditFormValues extends CourierFormValues {
  disabled: boolean;
}

export interface CourierSystemUserFormValues {
  username: string;
  email: string;
  password: string;
  systemPin: string;
  role: string;
}


export type CourierDetailTab = 'logistics' | 'financial';
export type CourierLedgerModuleFilter = 'all' | 'order' | 'expense' | 'payment' | 'custody';

export interface CourierDetailsRecord {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gpsLocation?: string | null;
  courierCustomId?: string | null;
  commissionRate?: number | null;
  notes?: string | null;
  accountId?: string | null;
  financialAccountId?: string | null;
  financialCurrency?: string | null;
}

export interface CourierOrderRecord {
  id: string;
  orderNumber?: string | null;
  orderStatus?: string | null;
  order_status?: string | null;
  shippingCourierId?: string | null;
  deliveryCourierId?: string | null;
  trackingNumber?: string | null;
  receiverName?: string | null;
  receiver_name?: string | null;
  receiverCity?: string | null;
  receiver_city?: string | null;
  amountPaid?: number | string | null;
  amountRemaining?: number | string | null;
  createdAt?: string | number | Date | null;
}

export interface CourierExpenseRecord {
  id: string;
  recipientId?: string | null;
  type?: string | null;
  status?: string | null;
  amount?: number | string | null;
  amountInDefaultCurrency?: number | string | null;
  remittedAmount?: number | string | null;
  currency?: string | null;
}

export interface CourierCustodyStats {
  totalReceived: number;
  totalRemitted: number;
  remainingCustody: number;
  totalDelivered: number;
  totalOrdersCount: number;
  deliverySuccessRate: number;
  totalInTransit: number;
  courierExpenses: CourierExpenseRecord[];
  courierOrders: CourierOrderRecord[];
}

export interface CourierOrderPartyStats {
  totalOrders: number;
  totalValue: number;
  outstanding: number;
  paid: number;
  lastOrder: CourierOrderRecord | null;
}

export interface CourierFinancialAccountRecord {
  id: string;
  accountCode?: string | null;
  entityId?: string | null;
  currency?: string | null;
  balance?: number | null;
}

export interface CourierLedgerEntry {
  id: string;
  date: string | number | Date;
  type: 'Debit' | 'Credit';
  amount: number;
  amountFCurrency: number;
  amountOriginal: number;
  currencyOriginal: string;
  module: string;
  title: string;
  description: string;
  ref: string;
  runningAccountBal: number;
}
