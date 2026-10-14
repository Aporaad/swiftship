/**
 * returnedProductService.ts
 * خدمة إدارة المنتجات المرتجعة من العملاء
 * Service for managing returned products from customers
 *
 * المنتجات المرتجعة: تتبع المنتجات التي يُرجعها العملاء مع تفاصيل السبب والحالة والاسترداد المالي
 * Returned Products: Track products returned by customers with reason, status, and financial refund details
 */

import { ApiClient } from '../data/http/api-client';

const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () =>
    typeof sessionStorage === 'undefined'
      ? null
      : (sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

// ────────────────────────── Types ──────────────────────────

/** أنواع الإرجاع المتاحة - Available return types */
export type ReturnType = 'استبدال' | 'استرداد' | 'إصلاح' | 'أخرى';

/** حالات المرتجع - Return statuses */
export type ReturnStatus = 'معلق' | 'مقبول' | 'مرفوض' | 'مكتمل';

/** حالة المنتج المُرتجع - Condition of returned product */
export type ReturnCondition = 'جديد' | 'مستخدم' | 'تالف' | 'غير معلوم';

/** قائمة أنواع الإرجاع - Return types list */
export const RETURN_TYPE_LIST: ReturnType[] = ['استبدال', 'استرداد', 'إصلاح', 'أخرى'];

/** قائمة حالات المرتجع - Return statuses list */
export const RETURN_STATUS_LIST: ReturnStatus[] = ['معلق', 'مقبول', 'مرفوض', 'مكتمل'];

/** قائمة حالات المنتج - Product conditions list */
export const RETURN_CONDITION_LIST: ReturnCondition[] = ['جديد', 'مستخدم', 'تالف', 'غير معلوم'];

/** نوع بيانات المنتج المُرتجع - Returned product record type */
export interface ReturnedProduct {
  return_id: string;

  // ربط الطلب وبند الطلب - Order & Item references
  order_id?: string;
  order_item_id?: string;
  product_id?: string;

  // بيانات العميل - Customer info
  customer_id?: string;
  customer_name?: string;

  // بيانات المنتج وقت الإرجاع - Product info at return time
  product_name?: string;
  product_url?: string;
  quantity?: number;

  // تفاصيل الإرجاع - Return details
  return_reason?: string;
  return_type?: ReturnType;
  return_status?: ReturnStatus;
  return_condition?: ReturnCondition;

  // البيانات المالية للاسترداد - Refund financial data
  refund_amount?: number;
  refund_currency?: string;
  is_insured?: boolean;
  insurance_refund?: number;

  // ملاحظات - Notes
  notes?: string;

  // تواريخ الإرجاع والمعالجة - Return & processing dates
  returned_at?: string;
  processed_by?: string;
  processed_at?: string;

  // حقول التدقيق - Audit fields
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

/** فلاتر جلب المرتجعات - Filters for fetching returned products */
export interface ReturnedProductFilters {
  order_id?: string;
  product_id?: string;
  customer_id?: string;
  return_status?: ReturnStatus;
  return_type?: ReturnType;
  date_from?: string;
  date_to?: string;
  search?: string;
}

/** إحصائيات المرتجعات - Returns statistics */
export interface ReturnedProductStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  completed: number;
  total_refund_amount: number;
}

// ────────────────────────── Row mapping ──────────────────────────

type ApiRow = Record<string, unknown>;

const readText = (value: unknown): string | undefined =>
  value === null || value === undefined ? undefined : String(value);
const readNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

/** خرائط الحقول بين واجهة النظام (snake_case) و alx_api (camelCase) */
const SNAKE_TO_CAMEL: Record<string, string> = {
  order_id: 'orderId',
  order_item_id: 'orderItemId',
  product_id: 'productId',
  customer_id: 'customerId',
  customer_name: 'customerName',
  product_name: 'productName',
  product_url: 'productUrl',
  quantity: 'quantity',
  return_reason: 'returnReason',
  return_type: 'returnType',
  return_status: 'returnStatus',
  return_condition: 'returnCondition',
  refund_amount: 'refundAmount',
  refund_currency: 'refundCurrency',
  is_insured: 'isInsured',
  insurance_refund: 'insuranceRefund',
  notes: 'notes',
  returned_at: 'returnedAt',
  processed_by: 'processedBy',
  processed_at: 'processedAt',
};

const toApiFields = (data: Record<string, unknown>): ApiRow => {
  const payload: ApiRow = {};
  for (const [snake, camel] of Object.entries(SNAKE_TO_CAMEL)) {
    if (snake in data) payload[camel] = data[snake];
  }
  return payload;
};

const fromApiRow = (row: ApiRow): ReturnedProduct => ({
  return_id: readText(row.returnId ?? row.return_id) ?? '',
  order_id: readText(row.orderId ?? row.order_id),
  order_item_id: readText(row.orderItemId ?? row.order_item_id),
  product_id: readText(row.productId ?? row.product_id),
  customer_id: readText(row.customerId ?? row.customer_id),
  customer_name: readText(row.customerName ?? row.customer_name),
  product_name: readText(row.productName ?? row.product_name),
  product_url: readText(row.productUrl ?? row.product_url),
  quantity: readNumber(row.quantity),
  return_reason: readText(row.returnReason ?? row.return_reason),
  return_type: readText(row.returnType ?? row.return_type) as ReturnType | undefined,
  return_status: readText(row.returnStatus ?? row.return_status) as ReturnStatus | undefined,
  return_condition: readText(row.returnCondition ?? row.return_condition) as ReturnCondition | undefined,
  refund_amount: readNumber(row.refundAmount ?? row.refund_amount),
  refund_currency: readText(row.refundCurrency ?? row.refund_currency),
  is_insured: row.isInsured === null || row.isInsured === undefined ? undefined : Boolean(row.isInsured),
  insurance_refund: readNumber(row.insuranceRefund ?? row.insurance_refund),
  notes: readText(row.notes),
  returned_at: readText(row.returnedAt ?? row.returned_at),
  processed_by: readText(row.processedBy ?? row.processed_by),
  processed_at: readText(row.processedAt ?? row.processed_at),
  created_at: readText(row.createdAt ?? row.created_at),
  created_by: readText(row.createdBy ?? row.created_by),
  updated_at: readText(row.updatedAt ?? row.updated_at),
  updated_by: readText(row.updatedBy ?? row.updated_by),
});

const extractRows = (data: ApiRow[] | { items?: ApiRow[] } | undefined): ApiRow[] =>
  Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

const toIso = (value: string): string =>
  value.includes('T') ? value : new Date(value).toISOString();

// ────────────────────────── CRUD Functions ──────────────────────────

/**
 * جلب جميع المنتجات المرتجعة مع دعم الفلترة
 * Fetch all returned products with optional filters
 */
export async function fetchReturnedProducts(
  filters?: ReturnedProductFilters
): Promise<ReturnedProduct[]> {
  const query: Record<string, string | number> = { limit: 1000, offset: 0 };
  if (filters?.order_id) query.orderId = filters.order_id;
  if (filters?.product_id) query.productId = filters.product_id;
  if (filters?.customer_id) query.customerId = filters.customer_id;
  if (filters?.return_status) query.returnStatus = filters.return_status;
  if (filters?.return_type) query.returnType = filters.return_type;
  if (filters?.date_from) query.dateFrom = filters.date_from;
  if (filters?.date_to) query.dateTo = filters.date_to + 'T23:59:59Z';
  if (filters?.search) query.search = filters.search;

  const res = await apiClient.get<{ success: boolean; data: ApiRow[] | { items?: ApiRow[] } }>(
    '/api/v1/operations/returned-products',
    query,
  );
  return extractRows(res.data).map(fromApiRow);
}

/**
 * إنشاء سجل مرتجع جديد
 * Create a new returned product record
 */
export async function createReturnedProduct(
  returnData: Omit<ReturnedProduct, 'return_id' | 'created_at' | 'updated_at'> & { return_id?: string },
): Promise<ReturnedProduct> {
  const return_id = (returnData.return_id || '').trim() || 'ret_' + Math.random().toString(36).substring(2, 11);
  const now = new Date().toISOString();

  const sanitized: Record<string, unknown> = {
    ...returnData,
    order_id: (returnData.order_id || '').trim() || null,
    order_item_id: (returnData.order_item_id || '').trim() || null,
    product_id: (returnData.product_id || '').trim() || null,
    customer_id: (returnData.customer_id || '').trim() || null,
    quantity: Math.max(1, Number(returnData.quantity) || 1),
    refund_amount: Math.max(0, Number(returnData.refund_amount) || 0),
    insurance_refund: returnData.is_insured
      ? Math.max(0, Number(returnData.insurance_refund) || 0)
      : 0,
    return_status: returnData.return_status || 'معلق',
    return_type: returnData.return_type || 'استرداد',
    return_condition: returnData.return_condition || 'مستخدم',
    is_insured: Boolean(returnData.is_insured),
    returned_at: returnData.returned_at ? toIso(String(returnData.returned_at)) : now,
    processed_at: returnData.processed_at
      ? toIso(String(returnData.processed_at))
      : null,
    processed_by: (returnData.processed_by || '').trim() || null,
  };
  delete sanitized.return_id;
  delete sanitized.created_at;
  delete sanitized.created_by;
  delete sanitized.updated_at;
  delete sanitized.updated_by;

  const res = await apiClient.post<{ success: boolean; data: ApiRow }>(
    '/api/v1/operations/returned-products',
    { returnId: return_id, ...toApiFields(sanitized) },
  );
  return res.data ? fromApiRow(res.data) : fromApiRow({ returnId: return_id, ...toApiFields(sanitized) });
}

/**
 * تحديث بيانات مرتجع موجود
 * Update an existing returned product record
 */
export async function updateReturnedProduct(
  return_id: string,
  updates: Partial<ReturnedProduct>,
): Promise<ReturnedProduct> {
  const fields = toApiFields(updates as Record<string, unknown>);
  if (updates.returned_at) fields.returnedAt = toIso(updates.returned_at);
  if (updates.processed_at) fields.processedAt = toIso(updates.processed_at);

  const res = await apiClient.patch<{ success: boolean; data: ApiRow }>(
    `/api/v1/operations/returned-products/${encodeURIComponent(return_id)}`,
    fields,
  );
  return res.data ? fromApiRow(res.data) : fromApiRow({ returnId: return_id, ...fields });
}

/**
 * حذف سجل مرتجع
 * Delete a returned product record
 */
export async function deleteReturnedProduct(return_id: string): Promise<void> {
  await apiClient.delete(`/api/v1/operations/returned-products/${encodeURIComponent(return_id)}`);
}

/**
 * احتساب إحصائيات المرتجعات
 * Calculate returned products statistics
 */
export function calculateReturnStats(returns: ReturnedProduct[]): ReturnedProductStats {
  return {
    total: returns.length,
    pending: returns.filter(r => r.return_status === 'معلق').length,
    accepted: returns.filter(r => r.return_status === 'مقبول').length,
    rejected: returns.filter(r => r.return_status === 'مرفوض').length,
    completed: returns.filter(r => r.return_status === 'مكتمل').length,
    total_refund_amount: returns.reduce(
      (sum, r) => sum + (Number(r.refund_amount) || 0) + (Number(r.insurance_refund) || 0),
      0
    ),
  };
}

/**
 * إنشاء مرتجع تلقائياً من بند طلب عند النقر على زر الإرجاع في حركة المنتجات
 * Automatically create returned product record from order item when clicking return
 */
export async function createReturnedProductFromOrderItem(
  orderItem: any,
  order?: any,
  masterProduct?: any,
  orderCurrency: string = 'YER',
): Promise<ReturnedProduct> {
  const now = new Date().toISOString();
  const is_insured = Boolean(orderItem.is_insured);
  const insurance_refund = is_insured ? Number(orderItem.insurance_fee || 0) : 0;

  return createReturnedProduct({
    order_id: (orderItem.order_id || order?.orderNumber || order?.order_number || order?.id || '').trim(),
    order_item_id: (orderItem.items_id || orderItem.id || '').trim(),
    product_id: (orderItem.product_id || '').trim(),
    customer_id: (order?.customer_id || order?.customerId || '').trim(),
    customer_name: (order?.customerName || order?.customer_name || order?.customer_id || 'عميل').trim(),
    product_name: (orderItem.product_cooler || masterProduct?.product_name_ar || masterProduct?.productName || 'منتج').trim(),
    product_url: (orderItem.product_url || '').trim(),
    quantity: Math.max(1, Number(orderItem.quantity) || 1),
    return_reason: is_insured ? 'إرجاع منتج مؤمن من حركة المنتجات' : 'إرجاع منتج من حركة المنتجات',
    return_type: 'استرداد',
    return_status: 'معلق',
    return_condition: 'مستخدم',
    refund_amount: Number(orderItem.total_price || (orderItem.product_price ? orderItem.product_price * (orderItem.quantity || 1) : 0)),
    refund_currency: order?.currency || orderCurrency,
    is_insured,
    insurance_refund,
    notes: is_insured
      ? 'تم الإرجاع تلقائياً عبر زر إرجاع المنتجات بحركة المنتجات (منتج مؤمن)'
      : 'تم الإرجاع تلقائياً عبر زر إرجاع المنتجات بحركة المنتجات',
    returned_at: now,
  });
}
