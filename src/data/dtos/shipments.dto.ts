import type { AuditDto, IsoUtcString, NumericValue } from './common.dto';
import type { IsoDateString, ShipmentStatus } from '../../shared/contracts/value-primitives';

/** Non-column fields written by ShipmentFormModal and retained in the JSON payload. */
export interface ShipmentSupplementalData {
  shippingType?: string | null;
  shippingSource?: string | null;
  shippingDestination?: string | null;
  packagingFees?: NumericValue | null;
  shippingDate?: IsoUtcString | string | null;
  shippingDuration?: string | null;
  expectedArrival?: IsoUtcString | string | null;
  deliveryDate?: IsoUtcString | string | null;
  notes?: string | null;
  shippingCategoryName?: string | null;
  shippingCategoryPrice?: NumericValue | null;
}

/** Normalized view shape: shipment calendar fields are date-only, never timestamps. */
export interface ShipmentSupplementalViewData extends Omit<ShipmentSupplementalData, 'shippingDate' | 'expectedArrival' | 'deliveryDate'> {
  shippingDate?: IsoDateString | null;
  expectedArrival?: IsoDateString | null;
  deliveryDate?: IsoDateString | null;
}

export interface ShipmentDatabaseRow {
  shipment_id: string;
  order_id: string | null;
  tracking_number: string | null;
  shipping_company_id: string | null;
  courier_id: string | null;
  shipment_status: string | null;
  shipping_cost: NumericValue | null;
  weight: NumericValue | null;
  /** حقل JSONB للبيانات الإضافية القديمة — يُستخدم فقط للتوافق مع السجلات القديمة */
  data: Partial<ShipmentSupplementalData> | null;
  // ========= الأعمدة المستخرجة من data JSONB (migration 20261002023000) =========
  /** نوع الشحن (جوي/بحري/بري) */
  shipping_type: string | null;
  /** مصدر الشحن */
  shipping_source: string | null;
  /** وجهة الشحن */
  shipping_destination: string | null;
  /** تاريخ الشحن */
  shipping_date: string | null;
  /** مدة الشحن بالأيام */
  shipping_duration: NumericValue | null;
  /** تاريخ الوصول المتوقع */
  expected_arrival: string | null;
  /** تاريخ التسليم الفعلي */
  delivery_date: string | null;
  /** رسوم التغليف */
  packaging_fees: NumericValue | null;
  /** سعر فئة الشحن */
  shipping_category_price: NumericValue | null;
  // ============================================================================
  created_at: string | null;
  shipping_category_id: string | null;
  /** اسم فئة الشحن (shipping_category_name مخزنة في الأعمدة بعد الاستخراج) */
  shipping_category_name: string | null;
  content_category_id: string | null;
  content_category_name: string | null;
  carton_count: NumericValue | null;
  customs_fee: NumericValue | null;
  tax_fee: NumericValue | null;
  other_category_fee: NumericValue | null;
  category_fees_total: NumericValue | null;
  category_fee_currency: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface ShipmentsApiDto {
  shipmentId: string;
  orderId: string | null;
  trackingNumber: string | null;
  shippingCompanyId: string | null;
  courierId: string | null;
  status: ShipmentStatus | null;
  shippingCost: number | null;
  weight: number | null;
  shippingCategoryId: string | null;
  /** اسم فئة الشحن المخزن مباشرة في العمود */
  shippingCategoryName: string | null;
  contentCategoryId: string | null;
  contentCategoryName: string | null;
  cartonCount: number | null;
  customsFee: number | null;
  taxFee: number | null;
  otherCategoryFee: number | null;
  categoryFeesTotal: number | null;
  categoryFeeCurrency: string | null;
  // ========= الحقول المستخرجة من data JSONB (canonical columns) =========
  /** نوع الشحن */
  shippingType: string | null;
  /** مصدر الشحن */
  shippingSource: string | null;
  /** وجهة الشحن */
  shippingDestination: string | null;
  /** تاريخ الشحن */
  shippingDate: IsoDateString | null;
  /** مدة الشحن بالأيام */
  shippingDuration: number | null;
  /** تاريخ الوصول المتوقع */
  expectedArrival: IsoDateString | null;
  /** تاريخ التسليم الفعلي */
  deliveryDate: IsoDateString | null;
  /** رسوم التغليف */
  packagingFees: number | null;
  /** سعر فئة الشحن */
  shippingCategoryPrice: number | null;
  // ====================================================================
  /** بيانات إضافية من JSONB للسجلات القديمة فقط — لا تُستخدم في الكود الجديد */
  shipmentData: ShipmentSupplementalViewData;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ShipmentsCreateInput {
  orderId?: string | null;
  trackingNumber: string;
  shippingCompanyId?: string | null;
  courierId?: string | null;
  status?: string | null;
  shippingCost?: number | null;
  weight?: number | null;
  shippingCategoryId?: string | null;
  shippingCategoryName?: string | null;
  contentCategoryId?: string | null;
  contentCategoryName?: string | null;
  cartonCount?: number | null;
  customsFee?: number | null;
  taxFee?: number | null;
  otherCategoryFee?: number | null;
  categoryFeesTotal?: number | null;
  categoryFeeCurrency?: string | null;
  // ========= الحقول المستخرجة الجديدة (canonical columns) =========
  shippingType?: string | null;
  shippingSource?: string | null;
  shippingDestination?: string | null;
  shippingDate?: string | null;
  shippingDuration?: number | null;
  expectedArrival?: string | null;
  deliveryDate?: string | null;
  packagingFees?: number | null;
  shippingCategoryPrice?: number | null;
  // =============================================================
  /** بيانات إضافية legacy — تُستخدم للتوافق مع السجلات القديمة فقط */
  shipmentData?: Partial<ShipmentSupplementalData>;
}
export type ShipmentsUpdateInput = Partial<ShipmentsCreateInput>;
export type ShipmentsViewModel = Partial<ShipmentsApiDto> & { id: string };
export type ShipmentsAudit = AuditDto;
