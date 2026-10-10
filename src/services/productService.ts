/**
 * productService.ts
 * خدمة إدارة المنتجات الرئيسية وبنود الطلبات
 * Service for managing master products catalog and order line items
 */

import { SELECT_FIELDS } from '../data/contracts/select-fields';
import { ApiClient } from '../data/http/api-client';

const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () =>
    typeof sessionStorage === 'undefined'
      ? null
      : (sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

// ────────────────────────────── Types ──────────────────────────────

/** نوع بيانات المنتج الرئيسي في جدول products */
/** Master product catalog entry */
export interface Product {
  product_id: string;
  product_name_ar?: string;
  product_name_en?: string;
  product_url?: string;
  product_price_currency?: number; // FK → currency.cur_id
  unit_price?: number;
  item_category_id?: string; // FK → items_category.id
  is_allowed?: boolean;
  cbm?: number;
  width?: number;
  height?: number;
  length?: number;
  weight?: number;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  // حقول مشتقة للعرض - Derived display fields
  order_count?: number;
}

/** نوع بيانات بند طلب في جدول order_items */
/** Order line item */
export interface OrderItem {
  items_id: string;
  order_id?: string;
  product_id?: string;
  product_price?: number;
  product_url?: string;
  tracking_number?: string;
  produc_source_id?: string; // FK → sources.id
  produc_source_url?: string;
  product_cooler?: string;
  nota?: string;
  quantity?: number;
  total_price?: number;
  total__weight?: number;
  total_cbm?: number;
  packaging_option_id?: string; // FK → order_option.id
  packaging_option_price?: number;
  is_insured?: boolean;
  insurance_fee?: number;
  items_status?: ItemStatus;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  // حقول مشتقة - Derived fields
  product?: Product;
  order_number?: string;
}

/** حالات بند الطلب الممكنة */
/** Possible order item statuses */
export type ItemStatus =
  | 'قيد الطلب'
  | 'محجوز بالميناء'
  | 'تم مصادرته'
  | 'وصل المخزن'
  | 'تم التسليم'
  | 'مرتجع';

export const ITEM_STATUS_LIST: ItemStatus[] = [
  'قيد الطلب',
  'محجوز بالميناء',
  'تم مصادرته',
  'وصل المخزن',
  'تم التسليم',
  'مرتجع',
];

// ────────────────────────── Products CRUD ──────────────────────────

// ────────────────────────── Products CRUD ──────────────────────────

/**
 * جلب جميع المنتجات الرئيسية
 * Fetch all master products
 */
export async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await apiClient.get<{ success: boolean; data: { items?: Product[] } | Product[] }>('/api/v1/operations/products');
    const items = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    return items;
  } catch (err) {
    console.warn('[productService] fetchProducts error:', err);
    return [];
  }
}

/**
 * جلب المنتجات المسموح بها فقط (is_allowed = true)
 * Fetch only allowed products for order selection
 */
export async function fetchAllowedProducts(): Promise<Product[]> {
  try {
    const products = await fetchProducts();
    return products.filter(p => p.is_allowed !== false);
  } catch (err) {
    console.warn('[productService] fetchAllowedProducts error:', err);
    return [];
  }
}

/**
 * إنشاء منتج رئيسي جديد
 * Create a new master product
 */
export async function createProduct(
  productData: Omit<Product, 'product_id' | 'created_at' | 'updated_at' | 'order_count'>,
  createdBy?: string
): Promise<Product> {
  const productId = 'prod_' + Math.random().toString(36).substring(2, 11);

  const payload: Product = {
    product_id: productId,
    ...productData,
    is_allowed: productData.is_allowed !== false,
    created_at: new Date().toISOString(),
    created_by: createdBy || null as any,
    updated_at: new Date().toISOString(),
    updated_by: createdBy || null as any,
  };

  try {
    const res = await apiClient.post<{ success: boolean; data: Product }>('/api/v1/operations/products', payload);
    return res.data || payload;
  } catch (err) {
    console.warn('[productService] createProduct fallback:', err);
    return payload;
  }
}

/**
 * تحديث منتج رئيسي موجود
 * Update an existing master product
 */
export async function updateProduct(
  productId: string,
  updates: Partial<Product>,
  updatedBy?: string
): Promise<Product> {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || null,
  };

  try {
    const res = await apiClient.patch<{ success: boolean; data: Product }>(`/api/v1/operations/products/${productId}`, payload);
    return res.data || ({ product_id: productId, ...payload } as Product);
  } catch (err) {
    console.warn('[productService] updateProduct fallback:', err);
    return { product_id: productId, ...payload } as Product;
  }
}

/**
 * حذف منتج رئيسي
 * Delete a master product
 */
export async function deleteProduct(productId: string): Promise<void> {
  try {
    await apiClient.delete(`/api/v1/operations/products/${productId}`);
  } catch (err) {
    console.warn('[productService] deleteProduct fallback:', err);
  }
}

/**
 * عدد الطلبات المرتبطة بمنتج معين
 * Count orders linked to a product
 */
export async function getProductOrderCount(productId: string): Promise<number> {
  try {
    const movements = await fetchProductMovements(productId);
    return movements.length;
  } catch {
    return 0;
  }
}

/**
 * جلب تفاصيل حركة منتج معين عبر بنود الطلبات
 * Fetch movement details for a specific product across order_items
 */
export async function fetchProductMovements(productId: string): Promise<OrderItem[]> {
  try {
    return await fetchOrderItems({ productId });
  } catch (err) {
    console.warn('[productService] fetchProductMovements error:', err);
    return [];
  }
}

// ────────────────────────── Order Items CRUD ──────────────────────────

/**
 * جلب جميع بنود الطلبات
 * Fetch all order items
 */
export async function fetchOrderItems(filters?: {
  orderId?: string;
  productId?: string;
  status?: ItemStatus;
}): Promise<OrderItem[]> {
  try {
    const query: Record<string, string> = {};
    if (filters?.orderId) query.orderId = filters.orderId;
    if (filters?.productId) query.productId = filters.productId;
    if (filters?.status) query.status = filters.status;

    const res = await apiClient.get<{ success: boolean; data: { items?: OrderItem[] } | OrderItem[] }>('/api/v1/operations/order-items', query);
    const items = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    return items;
  } catch (err) {
    console.warn('[productService] fetchOrderItems error:', err);
    return [];
  }
}

/**
 * إنشاء بند طلب جديد مع إنشاء المنتج الرئيسي إذا لزم
 * Create a new order item (and optionally a new master product)
 */
export async function createOrderItem(
  itemData: Omit<OrderItem, 'items_id' | 'created_at' | 'updated_at' | 'product'>,
  createdBy?: string
): Promise<OrderItem> {
  const itemsId = 'item_' + Math.random().toString(36).substring(2, 11);

  const quantity = Number(itemData.quantity) || 1;
  const productPrice = Number(itemData.product_price) || 0;
  const weight = Number(itemData.total__weight) || 0;
  const cbm = Number(itemData.total_cbm) || 0;

  const payload: OrderItem = {
    items_id: itemsId,
    ...itemData,
    quantity,
    product_price: productPrice,
    total_price: quantity * productPrice,
    total__weight: weight * quantity,
    total_cbm: cbm * quantity,
    items_status: itemData.items_status || 'قيد الطلب',
    is_insured: Boolean(itemData.is_insured),
    insurance_fee: itemData.is_insured ? (Number(itemData.insurance_fee) || 0) : 0,
    created_at: new Date().toISOString(),
    created_by: createdBy || null as any,
    updated_at: new Date().toISOString(),
    updated_by: createdBy || null as any,
  };

  try {
    const res = await apiClient.post<{ success: boolean; data: OrderItem }>('/api/v1/operations/order-items', payload);
    return res.data || payload;
  } catch (err) {
    console.warn('[productService] createOrderItem fallback:', err);
    return payload;
  }
}

/**
 * تحديث بند طلب موجود
 * Update an existing order item
 */
export async function updateOrderItem(
  itemsId: string,
  updates: Partial<OrderItem>,
  updatedBy?: string
): Promise<OrderItem> {
  const updatePayload: any = { ...updates };
  if (updates.quantity !== undefined || updates.product_price !== undefined) {
    const quantity = Number(updates.quantity ?? 1);
    const price = Number(updates.product_price ?? 0);
    updatePayload.total_price = quantity * price;
  }
  updatePayload.updated_at = new Date().toISOString();
  updatePayload.updated_by = updatedBy || null;

  try {
    const res = await apiClient.patch<{ success: boolean; data: OrderItem }>(`/api/v1/operations/order-items/${itemsId}`, updatePayload);
    return res.data || ({ items_id: itemsId, ...updatePayload } as OrderItem);
  } catch (err) {
    console.warn('[productService] updateOrderItem fallback:', err);
    return { items_id: itemsId, ...updatePayload } as OrderItem;
  }
}

/**
 * إرجاع منتج مؤمن - تغيير حالة البند وإعادة المبلغ للعميل
 * Return an insured item - changes status to 'مرتجع' and logs a refund
 */
export async function returnOrderItem(
  itemsId: string,
  updatedBy?: string
): Promise<{ item: OrderItem; refundAmount: number }> {
  const existingItems = await fetchOrderItems();
  const existing = existingItems.find(i => i.items_id === itemsId);

  if (!existing) {
    throw new Error('Order item not found');
  }

  if (!existing.is_insured) {
    throw new Error('Only insured items can be returned (is_insured must be true)');
  }

  const updatedItem = await updateOrderItem(itemsId, { items_status: 'مرتجع' as ItemStatus }, updatedBy);
  const refundAmount = Number(existing.total_price || 0) + Number(existing.insurance_fee || 0);

  return { item: updatedItem, refundAmount };
}

/**
 * حذف بند طلب
 * Delete an order item
 */
export async function deleteOrderItem(itemsId: string): Promise<void> {
  try {
    await apiClient.delete(`/api/v1/operations/order-items/${itemsId}`);
  } catch (err) {
    console.warn('[productService] deleteOrderItem fallback:', err);
  }
}
