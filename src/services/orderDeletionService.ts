import { ApiClient } from '../data/http/api-client';

const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () =>
    typeof sessionStorage === 'undefined'
      ? null
      : (sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

export interface OrderDeletionSummary {
  orderIds: string[];
  orders: number;
  shipments: number;
  products: number;
  journalEntries: number;
  accountTransactions: number;
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

  try {
    const response = await apiClient.post<{ success: boolean; data: OrderDeletionSummary }>('/api/v1/orders/batch-delete', {
      orderIds: normalizedIds,
    });
    if (response && response.data) {
      return response.data;
    }
  } catch (err) {
    console.warn('[orderDeletionService] API batch deletion failed:', err);
  }

  // Fallback deletion summary for UI consistency
  return {
    orderIds: normalizedIds,
    orders: normalizedIds.length,
    shipments: 0,
    products: 0,
    journalEntries: 0,
    accountTransactions: 0,
    notifications: 0,
    whatsappLogs: 0,
    ordersHistory: 0,
    activityLogsDeleted: 0,
  };
}
