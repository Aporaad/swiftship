import { supabase, notifyOrderDeletionInCache, refetchCollection } from '../lib/supabase';

export interface OrderDeletionSummary {
  orderIds: string[];
  orders: number;
  shipments: number;
  products: number;
  journalEntries: number;
  accountTransactions: number;
  expenses: number;
  notifications: number;
  whatsappLogs: number;
  ordersHistory: number;
  activityLogsDeleted: 0;
}

export function normalizeOrderIds(orderIds: string[]): string[] {
  return [...new Set(orderIds.map((id) => String(id || '').trim()).filter(Boolean))];
}

export async function deleteOrdersWithDependents(orderIds: string[]): Promise<OrderDeletionSummary> {
  const normalizedIds = normalizeOrderIds(orderIds);
  if (!normalizedIds.length) throw new Error('At least one order must be selected.');

  const { data, error } = await supabase.rpc('delete_orders_with_dependents', { p_order_ids: normalizedIds });
  if (error) throw error;
  if (!data || Number(data.orders) !== normalizedIds.length) {
    throw new Error('The order deletion procedure did not confirm deletion of every selected order.');
  }
  if (Number(data.activityLogsDeleted || 0) !== 0) {
    throw new Error('The deletion procedure reported an unexpected activity log deletion.');
  }

  // تحديث الكاش المحلي فوراً وتفعيل كافة مستمعات الشاشة لإخفاء الطلبات المحذوفة لحظياً بدون تحديث الصفحة
  // Immediately update in-memory cache and notify all UI listeners so deleted orders vanish instantly without page reload
  notifyOrderDeletionInCache(normalizedIds);

  // إعادة مزامنة جدول الطلبات خلف الكواليس لتأكيد التطابق التام مع قاعدة البيانات
  // Asynchronously refetch orders collection to guarantee 100% data consistency
  refetchCollection('orders').catch(console.warn);

  return data as OrderDeletionSummary;
}

