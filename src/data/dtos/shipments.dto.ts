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
  data: Partial<ShipmentSupplementalData> | null;
  created_at: string | null;
  shipping_category_id: string | null;
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
  contentCategoryId: string | null;
  contentCategoryName: string | null;
  cartonCount: number | null;
  customsFee: number | null;
  taxFee: number | null;
  otherCategoryFee: number | null;
  categoryFeesTotal: number | null;
  categoryFeeCurrency: string | null;
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
  contentCategoryId?: string | null;
  contentCategoryName?: string | null;
  cartonCount?: number | null;
  customsFee?: number | null;
  taxFee?: number | null;
  otherCategoryFee?: number | null;
  categoryFeesTotal?: number | null;
  categoryFeeCurrency?: string | null;
  shipmentData?: Partial<ShipmentSupplementalData>;
}
export type ShipmentsUpdateInput = Partial<ShipmentsCreateInput>;
export type ShipmentsViewModel = Partial<ShipmentsApiDto> & { id: string };
export type ShipmentsAudit = AuditDto;
