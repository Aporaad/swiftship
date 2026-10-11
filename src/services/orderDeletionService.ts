import { ApiClient } from '../data/http/api-client';

const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () =>
    typeof sessionStorage === 'undefined'
      ? null
      : (sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

type ApiEnvelope<T> = { success: true; data: T };

export interface OrderDeletionSummary {
  orderIds: string[];
  orders: number;
  shipments: number;
  products: number;
  mainEntries: number;
  accountTrans: number;
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

  const response = await apiClient.post<ApiEnvelope<OrderDeletionSummary>>('/api/v1/orders/batch-delete', {
    orderIds: normalizedIds,
  });
  if (!response?.success || !response.data) {
    throw new Error('ORDER_DELETION_RESPONSE_INVALID');
  }
  return response.data;
}
