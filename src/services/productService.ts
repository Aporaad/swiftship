/**
 * productService.ts
 * خدمة إدارة المنتجات الرئيسية وبنود الطلبات
 * Service for managing master products catalog and order line items
 */

import { supabase } from '../lib/supabase-firebase-adapter';

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

/**
 * جلب جميع المنتجات الرئيسية
 * Fetch all master products
 */
export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * جلب المنتجات المسموح بها فقط (is_allowed = true)
 * Fetch only allowed products for order selection
 */
export async function fetchAllowedProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_allowed', true)
    .order('product_name_ar', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
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

  const payload = {
    product_id: productId,
    ...productData,
    is_allowed: productData.is_allowed !== false,
    created_at: new Date().toISOString(),
    created_by: createdBy || null,
    updated_at: new Date().toISOString(),
    updated_by: createdBy || null,
  };

  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
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
  const { data, error } = await supabase
    .from('products')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    })
    .eq('product_id', productId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * حذف منتج رئيسي
 * Delete a master product
 */
export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('product_id', productId);

  if (error) throw new Error(error.message);
}

/**
 * عدد الطلبات المرتبطة بمنتج معين
 * Count orders linked to a product
 */
export async function getProductOrderCount(productId: string): Promise<number> {
  const { count, error } = await supabase
    .from('order_items')
    .select('items_id', { count: 'exact', head: true })
    .eq('product_id', productId);

  if (error) return 0;
  return count || 0;
}

/**
 * جلب تفاصيل حركة منتج معين عبر بنود الطلبات
 * Fetch movement details for a specific product across order_items
 */
export async function fetchProductMovements(productId: string): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
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
  let query = supabase
    .from('order_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.orderId) {
    query = query.eq('order_id', filters.orderId);
  }
  if (filters?.productId) {
    query = query.eq('product_id', filters.productId);
  }
  if (filters?.status) {
    query = query.eq('items_status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
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

  const payload = {
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
    created_by: createdBy || null,
    updated_at: new Date().toISOString(),
    updated_by: createdBy || null,
  };

  const { data, error } = await supabase
    .from('order_items')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
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
  // إعادة حساب الإجماليات إذا تم تحديث الكمية أو السعر
  // Recalculate totals if quantity or price changes
  const updatePayload: any = { ...updates };
  if (updates.quantity !== undefined || updates.product_price !== undefined) {
    const quantity = Number(updates.quantity ?? 1);
    const price = Number(updates.product_price ?? 0);
    updatePayload.total_price = quantity * price;
  }

  const { data, error } = await supabase
    .from('order_items')
    .update({
      ...updatePayload,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    })
    .eq('items_id', itemsId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * إرجاع منتج مؤمن - تغيير حالة البند وإعادة المبلغ للعميل
 * Return an insured item - changes status to 'مرتجع' and logs a refund
 */
export async function returnOrderItem(
  itemsId: string,
  updatedBy?: string
): Promise<{ item: OrderItem; refundAmount: number }> {
  // جلب بيانات البند أولاً للتحقق من التأمين
  // Fetch the item first to verify insurance
  const { data: existing, error: fetchError } = await supabase
    .from('order_items')
    .select('*')
    .eq('items_id', itemsId)
    .single();

  if (fetchError || !existing) {
    throw new Error(fetchError?.message || 'Order item not found');
  }

  if (!existing.is_insured) {
    throw new Error('Only insured items can be returned (is_insured must be true)');
  }

  // تحديث حالة البند إلى مرتجع
  // Update item status to returned
  const { data, error } = await supabase
    .from('order_items')
    .update({
      items_status: 'مرتجع' as ItemStatus,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    })
    .eq('items_id', itemsId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // مبلغ الاسترداد = إجمالي سعر المنتج + رسوم التأمين
  // Refund amount = total product price + insurance fee
  const refundAmount = Number(existing.total_price || 0) + Number(existing.insurance_fee || 0);

  return { item: data, refundAmount };
}

/**
 * حذف بند طلب
 * Delete an order item
 */
export async function deleteOrderItem(itemsId: string): Promise<void> {
  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('items_id', itemsId);

  if (error) throw new Error(error.message);
}
