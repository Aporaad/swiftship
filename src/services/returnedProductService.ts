/**
 * returnedProductService.ts
 * خدمة إدارة المنتجات المرتجعة من العملاء
 * Service for managing returned products from customers
 *
 * المنتجات المرتجعة: تتبع المنتجات التي يُرجعها العملاء مع تفاصيل السبب والحالة والاسترداد المالي
 * Returned Products: Track products returned by customers with reason, status, and financial refund details
 */

import { supabase, db, collection, addDoc } from '../lib/supabase-firebase-adapter';

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

// ────────────────────────── CRUD Functions ──────────────────────────

/**
 * جلب جميع المنتجات المرتجعة مع دعم الفلترة
 * Fetch all returned products with optional filters
 */
export async function fetchReturnedProducts(
  filters?: ReturnedProductFilters
): Promise<ReturnedProduct[]> {
  let query = supabase
    .from('returned_products')
    .select('*')
    .order('created_at', { ascending: false });

  // تطبيق الفلاتر - Apply filters
  if (filters?.order_id) {
    query = query.eq('order_id', filters.order_id);
  }
  if (filters?.product_id) {
    query = query.eq('product_id', filters.product_id);
  }
  if (filters?.customer_id) {
    query = query.eq('customer_id', filters.customer_id);
  }
  if (filters?.return_status) {
    query = query.eq('return_status', filters.return_status);
  }
  if (filters?.return_type) {
    query = query.eq('return_type', filters.return_type);
  }
  if (filters?.date_from) {
    query = query.gte('returned_at', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('returned_at', filters.date_to + 'T23:59:59Z');
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    query = query.or(
      `customer_name.ilike.${searchTerm},product_name.ilike.${searchTerm},order_id.ilike.${searchTerm},return_reason.ilike.${searchTerm}`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * إنشاء سجل مرتجع جديد
 * Create a new returned product record
 */
export async function createReturnedProduct(
  returnData: Omit<ReturnedProduct, 'return_id' | 'created_at' | 'updated_at'>,
  createdBy?: string
): Promise<ReturnedProduct> {
  // توليد معرف فريد للمرتجع - Generate unique return ID
  const return_id = 'ret_' + Math.random().toString(36).substring(2, 11);
  const now = new Date().toISOString();

  const payload: ReturnedProduct = {
    return_id,
    ...returnData,
    order_id: (returnData.order_id || '').trim() || undefined,
    order_item_id: (returnData.order_item_id || '').trim() || undefined,
    product_id: (returnData.product_id || '').trim() || undefined,
    customer_id: (returnData.customer_id || '').trim() || undefined,
    quantity: Math.max(1, Number(returnData.quantity) || 1),
    refund_amount: Math.max(0, Number(returnData.refund_amount) || 0),
    insurance_refund: returnData.is_insured
      ? Math.max(0, Number(returnData.insurance_refund) || 0)
      : 0,
    return_status: returnData.return_status || 'معلق',
    return_type: returnData.return_type || 'استرداد',
    return_condition: returnData.return_condition || 'مستخدم',
    is_insured: Boolean(returnData.is_insured),
    returned_at: returnData.returned_at
      ? (returnData.returned_at.includes('T') ? returnData.returned_at : new Date(returnData.returned_at).toISOString())
      : now,
    processed_at: returnData.processed_at
      ? (returnData.processed_at.includes('T') ? returnData.processed_at : new Date(returnData.processed_at).toISOString())
      : undefined,
    processed_by: (returnData.processed_by || '').trim() || undefined,
    created_at: now,
    created_by: createdBy || 'system',
    updated_at: now,
    updated_by: createdBy || 'system',
  };

  await addDoc(return_id, collection(db, 'returned_products'), payload);
  return payload;
}

/**
 * تحديث بيانات مرتجع موجود
 * Update an existing returned product record
 */
export async function updateReturnedProduct(
  return_id: string,
  updates: Partial<ReturnedProduct>,
  updatedBy?: string
): Promise<ReturnedProduct> {
  const { data, error } = await supabase
    .from('returned_products')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    })
    .eq('return_id', return_id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * تحديث حالة المرتجع وتسجيل من قام بالمعالجة
 * Update return status and record who processed it
 */
export async function updateReturnStatus(
  return_id: string,
  new_status: ReturnStatus,
  processed_by?: string
): Promise<ReturnedProduct> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('returned_products')
    .update({
      return_status: new_status,
      processed_by: processed_by || null,
      processed_at: new_status !== 'معلق' ? now : null,
      updated_at: now,
      updated_by: processed_by || null,
    })
    .eq('return_id', return_id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * حذف سجل مرتجع
 * Delete a returned product record
 */
export async function deleteReturnedProduct(return_id: string): Promise<void> {
  const { error } = await supabase
    .from('returned_products')
    .delete()
    .eq('return_id', return_id);

  if (error) throw new Error(error.message);
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
  createdBy?: string
): Promise<ReturnedProduct> {
  const return_id = 'ret_' + Math.random().toString(36).substring(2, 11);
  const now = new Date().toISOString();
  const is_insured = Boolean(orderItem.is_insured);
  const insurance_refund = is_insured ? Number(orderItem.insurance_fee || 0) : 0;

  const payload: ReturnedProduct = {
    return_id,
    order_id: (orderItem.order_id || order?.orderNumber || order?.order_number || order?.id || '').trim() || undefined,
    order_item_id: (orderItem.items_id || orderItem.id || '').trim() || undefined,
    product_id: (orderItem.product_id || '').trim() || undefined,
    customer_id: (order?.customer_id || order?.customerId || '').trim() || undefined,
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
    is_insured: is_insured,
    insurance_refund: insurance_refund,
    notes: is_insured
      ? 'تم الإرجاع تلقائياً عبر زر إرجاع المنتجات بحركة المنتجات (منتج مؤمن)'
      : 'تم الإرجاع تلقائياً عبر زر إرجاع المنتجات بحركة المنتجات',
    returned_at: now,
    processed_by: undefined,
    processed_at: undefined,
    created_at: now,
    created_by: createdBy || 'system',
    updated_at: now,
    updated_by: createdBy || 'system',
  };

  await addDoc(return_id, collection(db, 'returned_products'), payload);
  return payload;
}

