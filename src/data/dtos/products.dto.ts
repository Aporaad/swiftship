import type { AuditDto, IsoUtcString, NumericValue } from './common.dto';
import type { Amount, CurrencyCode } from '../../shared/contracts/value-primitives';

export interface ProductsDatabaseRow {
  product_id: string;
  product_name_ar: string | null;
  product_name_en: string | null;
  product_url: string | null;
  product_price_currency: number | null;
  unit_price: NumericValue | null;
  item_category_id: string | null;
  is_allowed: boolean;
  cbm: NumericValue | null;
  width: NumericValue | null;
  height: NumericValue | null;
  length: NumericValue | null;
  weight: NumericValue | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface ProductCategoryDatabaseRow {
  items_category_id: string;
  code: string | null;
  name_ar: string | null;
  name_en: string | null;
  description: string | null;
  hs_code_hint: string | null;
  customs_per_carton: NumericValue | null;
  tax_per_carton: NumericValue | null;
  other_fees_per_carton: NumericValue | null;
  customs_rate: NumericValue | null;
  tax_rate: NumericValue | null;
  fee_currency: string | null;
  requires_review: boolean;
  is_active: boolean;
  details: unknown;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface OrderItemDatabaseRow {
  order_item_id: string;
  order_id: string;
  product_id: string | null;
  product_price: NumericValue | null;
  product_url: string | null;
  tracking_number: string | null;
  produc_source_id: string | null;
  produc_source_url: string | null;
  product_cooler: string | null;
  nota: string | null;
  quantity: NumericValue;
  total_price: NumericValue | null;
  total__weight: NumericValue | null;
  total_cbm: NumericValue | null;
  packaging_option_id: string | null;
  packaging_option_price: NumericValue | null;
  is_insured: boolean;
  insurance_fee: NumericValue | null;
  items_status: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface ReturnedProductDatabaseRow {
  return_id: string;
  order_id: string;
  order_item_id: string | null;
  product_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  product_name: string | null;
  product_url: string | null;
  quantity: number;
  return_reason: string | null;
  return_type: string | null;
  return_status: string;
  return_condition: string | null;
  refund_amount: NumericValue | null;
  refund_currency: string | null;
  is_insured: boolean;
  insurance_refund: NumericValue | null;
  notes: string | null;
  returned_at: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface ProductsApiDto {
  productId: string;
  nameAr: string | null;
  nameEn: string | null;
  url: string | null;
  priceCurrencyId: number | null;
  unitPrice: Amount | null;
  categoryId: string | null;
  isAllowed: boolean;
  cbm: number | null;
  width: number | null;
  height: number | null;
  length: number | null;
  weight: number | null;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ProductCategoryApiDto {
  categoryId: string;
  code: string | null;
  nameAr: string | null;
  nameEn: string | null;
  description: string | null;
  hsCodeHint: string | null;
  customsPerCarton: Amount | null;
  taxPerCarton: Amount | null;
  otherFeesPerCarton: Amount | null;
  customsRate: number | null;
  taxRate: number | null;
  feeCurrency: CurrencyCode | null;
  requiresReview: boolean;
  isActive: boolean;
  details: Record<string, unknown>;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface OrderItemApiDto {
  orderItemId: string;
  orderId: string;
  productId: string | null;
  productPrice: Amount | null;
  productUrl: string | null;
  trackingNumber: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  cooler: string | null;
  note: string | null;
  quantity: number;
  totalPrice: Amount | null;
  totalWeight: number | null;
  totalCbm: number | null;
  packagingOptionId: string | null;
  packagingOptionPrice: Amount | null;
  isInsured: boolean;
  insuranceFee: Amount | null;
  status: string | null;
  createdAt: IsoUtcString;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ReturnedProductApiDto {
  returnId: string;
  orderId: string;
  orderItemId: string | null;
  productId: string | null;
  customerId: string | null;
  customerName: string | null;
  productName: string | null;
  productUrl: string | null;
  quantity: number;
  reason: string | null;
  type: string | null;
  status: string;
  condition: string | null;
  refundAmount: Amount | null;
  refundCurrency: CurrencyCode | null;
  isInsured: boolean;
  insuranceRefund: Amount | null;
  notes: string | null;
  returnedAt: IsoUtcString | null;
  processedBy: string | null;
  processedAt: IsoUtcString | null;
  createdAt: IsoUtcString;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ProductsCreateInput {
  nameAr: string;
  nameEn?: string | null;
  url?: string | null;
  priceCurrencyId?: number | null;
  unitPrice?: number | null;
  categoryId?: string | null;
  isAllowed?: boolean;
  cbm?: number | null;
  width?: number | null;
  height?: number | null;
  length?: number | null;
  weight?: number | null;
}
export type ProductsUpdateInput = Partial<ProductsCreateInput>;
export type ProductCategoryCreateInput = Omit<ProductCategoryApiDto, 'categoryId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'details'> & { details?: Record<string, unknown> };
export type OrderItemCreateInput = Omit<OrderItemApiDto, 'orderItemId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;
export type ReturnedProductCreateInput = Omit<ReturnedProductApiDto, 'returnId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;
export type ProductsViewModel = Partial<ProductsApiDto> & Pick<ProductsApiDto, 'productId'>;
export type ProductsAudit = AuditDto;
