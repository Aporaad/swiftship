/**
 * productService.ts
 * خدمة إدارة المنتجات الرئيسية وبنود الطلبات
 * Service for managing master products catalog and order line items
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
  product_name?: string;
  sku?: string;
  internal_note?: string;
  customer_note?: string;
  nota?: string;
  quantity?: number;
  total_price?: number;
  unit__weight?: number;
  total__weight?: number;
  unit_cbm?: number;
  total_cbm?: number;
  packaging_option_id?: string; // FK → order_option.id
  packaging_option_price?: number;
  total_packaging_price?: number;
  is_insured?: boolean;
  insurance_fee?: number;
  items_status?: ItemStatus;
  shipment_id?: string;
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

// ────────────────────────── Row mapping ──────────────────────────

type ApiRow = Record<string, unknown>;

const readText = (value: unknown): string | undefined =>
  value === null || value === undefined ? undefined : String(value);
const readNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};
const readBoolean = (value: unknown): boolean | undefined =>
  value === null || value === undefined ? undefined : Boolean(value);

const toProduct = (row: ApiRow): Product => ({
  product_id: readText(row.productId ?? row.product_id) ?? '',
  product_name_ar: readText(row.productNameAr ?? row.product_name_ar),
  product_name_en: readText(row.productNameEn ?? row.product_name_en),
  product_url: readText(row.productUrl ?? row.product_url),
  product_price_currency: readNumber(row.productPriceCurrency ?? row.product_price_currency),
  unit_price: readNumber(row.unitPrice ?? row.unit_price),
  item_category_id: readText(row.itemCategoryId ?? row.item_category_id),
  is_allowed: readBoolean(row.isAllowed ?? row.is_allowed),
  cbm: readNumber(row.cbm),
  width: readNumber(row.width),
  height: readNumber(row.height),
  length: readNumber(row.length),
  weight: readNumber(row.weight),
  created_at: readText(row.createdAt ?? row.created_at),
  created_by: readText(row.createdBy ?? row.created_by),
  updated_at: readText(row.updatedAt ?? row.updated_at),
  updated_by: readText(row.updatedBy ?? row.updated_by),
});

const toProductPayload = (product: Partial<Product>): ApiRow => {
  const payload: ApiRow = {};
  if (product.product_name_ar !== undefined) payload.productNameAr = product.product_name_ar;
  if (product.product_name_en !== undefined) payload.productNameEn = product.product_name_en;
  if ('product_url' in product) payload.productUrl = product.product_url ?? '';
  if (product.product_price_currency !== undefined && product.product_price_currency !== null) {
    payload.productPriceCurrency = String(product.product_price_currency);
  }
  if (product.unit_price !== undefined) payload.unitPrice = product.unit_price;
  if ('item_category_id' in product) payload.itemCategoryId = product.item_category_id ?? '';
  if (product.is_allowed !== undefined) payload.isAllowed = product.is_allowed;
  if (product.cbm !== undefined) payload.cbm = product.cbm;
  if (product.width !== undefined) payload.width = product.width;
  if (product.height !== undefined) payload.height = product.height;
  if (product.length !== undefined) payload.length = product.length;
  if (product.weight !== undefined) payload.weight = product.weight;
  return payload;
};

const toOrderItem = (row: ApiRow): OrderItem => ({
  items_id: readText(row.orderItemId ?? row.items_id) ?? '',
  order_id: readText(row.orderId ?? row.order_id),
  product_id: readText(row.productId ?? row.product_id),
  product_price: readNumber(row.productPrice ?? row.product_price),
  product_url: readText(row.productUrl ?? row.product_url),
  tracking_number: readText(row.trackingNumber ?? row.tracking_number),
  produc_source_id: readText(row.productSourceId ?? row.produc_source_id),
  produc_source_url: readText(row.productSourceUrl ?? row.produc_source_url),
  product_cooler: readText(row.productColor ?? row.product_cooler),
  product_name: readText(row.productName ?? row.product_name),
  sku: readText(row.sku),
  internal_note: readText(row.internalNote ?? row.internal_note),
  customer_note: readText(row.customerNote ?? row.customer_note),
  nota: readText(row.nota),
  quantity: readNumber(row.quantity),
  total_price: readNumber(row.totalPrice ?? row.total_price),
  unit__weight: readNumber(row.unitWeight ?? row.unit__weight),
  total__weight: readNumber(row.totalWeight ?? row.total__weight),
  unit_cbm: readNumber(row.unitCbm ?? row.unit_cbm),
  total_cbm: readNumber(row.totalCbm ?? row.total_cbm),
  packaging_option_id: readText(row.packagingOptionId ?? row.packaging_option_id),
  packaging_option_price: readNumber(row.packagingOptionPrice ?? row.packaging_option_price),
  total_packaging_price: readNumber(row.totalPackagingPrice ?? row.total_packaging_price),
  is_insured: readBoolean(row.isInsured ?? row.is_insured),
  insurance_fee: readNumber(row.insuranceFee ?? row.insurance_fee),
  items_status: readText(row.itemsStatus ?? row.items_status) as ItemStatus | undefined,
  shipment_id: readText(row.shipmentId ?? row.shipment_id),
  created_at: readText(row.createdAt ?? row.created_at),
  created_by: readText(row.createdBy ?? row.created_by),
  updated_at: readText(row.updatedAt ?? row.updated_at),
  updated_by: readText(row.updatedBy ?? row.updated_by),
});

const toOrderItemPayload = (item: Partial<OrderItem>): ApiRow => {
  const payload: ApiRow = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) payload[key] = value;
  };
  set('orderId', item.order_id);
  set('productId', item.product_id);
  set('productPrice', item.product_price);
  set('productUrl', item.product_url);
  set('trackingNumber', item.tracking_number);
  set('producSourceId', item.produc_source_id);
  set('producSourceUrl', item.produc_source_url);
  set('productColor', item.product_cooler);
  set('productName', item.product_name);
  set('sku', item.sku);
  set('internalNote', item.internal_note);
  set('customerNote', item.customer_note);
  set('nota', item.nota);
  set('quantity', item.quantity);
  set('totalPrice', item.total_price);
  set('unitWeight', item.unit__weight);
  set('totalWeight', item.total__weight);
  set('unitCbm', item.unit_cbm);
  set('totalCbm', item.total_cbm);
  set('packagingOptionId', item.packaging_option_id);
  set('packagingOptionPrice', item.packaging_option_price);
  set('totalPackagingPrice', item.total_packaging_price);
  set('isInsured', item.is_insured);
  set('insuranceFee', item.insurance_fee);
  set('itemsStatus', item.items_status);
  set('shipmentId', item.shipment_id);
  return payload;
};

const extractRows = (data: ApiRow[] | { items?: ApiRow[] } | undefined): ApiRow[] =>
  Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

// ────────────────────────── Products CRUD ──────────────────────────

/**
 * جلب جميع المنتجات الرئيسية
 * Fetch all master products
 */
export async function fetchProducts(): Promise<Product[]> {
  const res = await apiClient.get<{ success: boolean; data: ApiRow[] | { items?: ApiRow[] } }>('/api/v1/products', {
    limit: 1000,
    offset: 0,
  });
  return extractRows(res.data).map(toProduct);
}

/**
 * جلب المنتجات المسموح بها فقط (is_allowed = true)
 * Fetch only allowed products for order selection
 */
export async function fetchAllowedProducts(): Promise<Product[]> {
  const products = await fetchProducts();
  return products.filter(p => p.is_allowed !== false);
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
    created_by: createdBy ?? undefined,
  };

  const res = await apiClient.post<{ success: boolean; data: ApiRow }>('/api/v1/products', {
    productId,
    ...toProductPayload(payload),
  });
  return res.data ? toProduct({ ...res.data, productId }) : payload;
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
  const res = await apiClient.patch<{ success: boolean; data: ApiRow }>(
    `/api/v1/products/${encodeURIComponent(productId)}`,
    toProductPayload(updates),
  );
  return res.data
    ? toProduct({ ...res.data, productId })
    : { product_id: productId, ...updates, updated_by: updatedBy };
}

/**
 * حذف منتج رئيسي
 * Delete a master product
 */
export async function deleteProduct(productId: string): Promise<void> {
  await apiClient.delete(`/api/v1/products/${encodeURIComponent(productId)}`);
}

/**
 * عدد الطلبات المرتبطة بمنتج معين
 * Count orders linked to a product
 */
export async function getProductOrderCount(productId: string): Promise<number> {
  const movements = await fetchProductMovements(productId);
  return movements.length;
}

/**
 * جلب تفاصيل حركة منتج معين عبر بنود الطلبات
 * Fetch movement details for a specific product across order_items
 */
export async function fetchProductMovements(productId: string): Promise<OrderItem[]> {
  return fetchOrderItems({ productId });
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
  const query: Record<string, string | number> = { limit: 1000, offset: 0 };
  if (filters?.orderId) query.orderId = filters.orderId;
  if (filters?.productId) query.productId = filters.productId;
  if (filters?.status) query.status = filters.status;

  const res = await apiClient.get<{ success: boolean; data: ApiRow[] | { items?: ApiRow[] } }>(
    '/api/v1/operations/order-items',
    query,
  );
  return extractRows(res.data).map(toOrderItem);
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
    created_by: createdBy,
  };

  const res = await apiClient.post<{ success: boolean; data: ApiRow }>('/api/v1/operations/order-items', {
    orderItemId: itemsId,
    ...toOrderItemPayload(payload),
  });
  return res.data ? toOrderItem({ ...res.data, orderItemId: itemsId }) : payload;
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
  const payload = toOrderItemPayload(updates);
  if (updates.quantity !== undefined || updates.product_price !== undefined) {
    const quantity = Number(updates.quantity ?? 1);
    const price = Number(updates.product_price ?? 0);
    payload.totalPrice = quantity * price;
  }

  const res = await apiClient.patch<{ success: boolean; data: ApiRow }>(
    `/api/v1/operations/order-items/${encodeURIComponent(itemsId)}`,
    payload,
  );
  return res.data ? toOrderItem({ ...res.data, orderItemId: itemsId }) : { items_id: itemsId, ...updates, updated_by: updatedBy };
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
  await apiClient.delete(`/api/v1/operations/order-items/${encodeURIComponent(itemsId)}`);
}
