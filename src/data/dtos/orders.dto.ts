import type { AuditDto, IsoUtcString, NumericValue } from './common.dto';
import type { OrderItemApiDto } from './products.dto';
import type { ShipmentsApiDto } from './shipments.dto';
import type { Amount, CurrencyCode, OrderStatus, PaymentStatus } from '../../shared/contracts/value-primitives';

/** Explicit allowlist of operational/financial keys written by the legacy Orders page into orders.data. */
export interface OrderSupplementalData {
  customerName?: string | null;
  recipientName?: string | null;
  customerPhone?: string | null;
  deliveryCity?: string | null;
  orderSourceName?: string | null;
  totalPrice?: NumericValue | null;
  status?: string | null;
  notes?: string | null;
  totalAmount?: NumericValue | null;
  currency?: string | null;
  orderCurrency?: string | null;
  paidCurrency?: string | null;
  exchangeRate?: NumericValue | null;
  exchangeRateYER?: NumericValue | null;
  exchangeRateUSD?: NumericValue | null;
  bankCommissionRate?: NumericValue | null;
  bankCommissionType?: string | null;
  companyProfitRate?: NumericValue | null;
  packagingFee?: NumericValue | null;
  sheinRedPrice?: NumericValue | null;
  cartShareCode?: string | null;
  bankCommissionEnabled?: boolean | null;
  couponEnabled?: boolean | null;
  couponRate?: NumericValue | null;
  couponValue?: NumericValue | null;
  productsSum?: NumericValue | null;
  packagingFeeEnabled?: boolean | null;
  packagingFeeRate?: NumericValue | null;
  totalWeight?: NumericValue | null;
  totalCBM?: NumericValue | null;
  totalCostSAR?: NumericValue | null;
  totalCostYER?: NumericValue | null;
  amountPaid?: NumericValue | null;
  amountRemaining?: NumericValue | null;
  paymentStatus?: string | null;
  homeDeliveryEnabled?: boolean | null;
  viaShippingAgent?: boolean | null;
  payLater?: boolean | null;
  directApprove?: boolean | null;
  paymentMethod?: string | null;
  cashAccountId?: string | null;
  bankAccountId?: string | null;
  bankReference?: string | null;
  cashAmount?: NumericValue | null;
  bankAmount?: NumericValue | null;
  profitPerKgRate?: NumericValue | null;
  cbmShippingRateValue?: NumericValue | null;
  addShippingEnabled?: boolean | null;
  shippingCostSAR?: NumericValue | null;
  shippingCourierFeeRate?: NumericValue | null;
  profitSaudiSAR?: NumericValue | null;
  profitCompanySAR?: NumericValue | null;
  deductSourcingCostFromCourier?: boolean | null;
  sourcing_cost?: string | null;
  sourcingCostAmount?: NumericValue | null;
  orderStatus?: string | null;
  deliveryStatus?: string | null;
  locationYemen?: string | null;
  firedTriggers?: string[] | null;
  shippingCompany?: string | null;
  externalOrderNumber?: string | null;
  deliveryCourierFee?: NumericValue | null;
  deliveryCourierFeeCurrency?: string | null;
  deliveryCourierFeeOrderCurrency?: NumericValue | null;
  productInsuranceFee?: NumericValue | null;
  product_insurance_fee?: NumericValue | null;
  orderDate?: IsoUtcString | number | string | null;
  createdAt?: IsoUtcString | number | string | null;
}

export interface OrderPartySummary {
  id: string;
  type: 'customer' | 'employee' | 'courier';
  name: string | null;
  phone: string | null;
  accountId: string | null;
}

export interface OrderRelatedData {
  customerName?: string | null;
  customerPhone?: string | null;
  orderSourceName?: string | null;
  orderParty?: OrderPartySummary | null;
  items?: OrderItemApiDto[];
  shipments?: ShipmentsApiDto[];
}

export interface OrdersDatabaseRow {
  order_id: string;
  data?: Partial<OrderSupplementalData> | null;
  order_number: string;
  tracking_number: string | null;
  customer_id: string | null;
  order_status1: string;
  created_at: string;
  order_status_id: string | null;
  order_source_id: string | null;
  order_source_type: string | null;
  delivery_courier_id: string | null;
  shipping_courier_id: string | null;
  order_party_id: string | null;
  order_party_type: 'customer' | 'employee' | 'courier';
  is_staff_order: boolean;
  employee_id: string | null;
  courier_id: string | null;
  order_party_account_id: string | null;
  created_by_name: string | null;
  updated_at: string | null;
  updated_by: string | null;
  created_by: string | null;
}

export interface OrderApiDto {
  orderId: string;
  orderNumber: string;
  trackingNumber: string | null;
  customerId: string | null;
  orderStatusId: string | null;
  orderSourceId: string | null;
  orderSourceType: string | null;
  deliveryCourierId: string | null;
  shippingCourierId: string | null;
  orderPartyId: string | null;
  orderPartyType: 'customer' | 'employee' | 'courier';
  isStaffOrder: boolean;
  employeeId: string | null;
  courierId: string | null;
  orderPartyAccountId: string | null;
  createdByName: string | null;
  totalAmount: Amount | null;
  totalPrice: Amount | null;
  currency: CurrencyCode | null;
  notes: string | null;
  paymentStatus: PaymentStatus | null;
  status: OrderStatus | null;
  orderDate: IsoUtcString | null;
  orderData: OrderSupplementalData;
  customerName: string | null;
  recipientName: string | null;
  customerPhone: string | null;
  deliveryCity: string | null;
  orderSourceName: string | null;
  orderParty: OrderPartySummary | null;
  items: OrderItemApiDto[];
  shipments: ShipmentsApiDto[];
  createdAt: IsoUtcString;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * تفاصيل الطلب المسطّحة — كل مفتاح هنا عمود حقيقي في public.orders ويرسله الواجهة إلى alx_api.
 * Flat order detail — every key here is a real column in public.orders sent by the UI to alx_api.
 * لا توجد أي حمولة jsonb في مسار الكتابة. / The write path carries no jsonb payload.
 */
export interface OrderDetailPayload {
  totalCostYER?: number | null;
  totalCostSAR?: number | null;
  productsSum?: number | null;
  sourcingCostAmount?: number | null;
  sourcingCostSource?: string | null;
  deliveryCourierFee?: number | null;
  deliveryCourierFeeCurrency?: string | null;
  deliveryCourierFeeOrderCurrency?: number | null;
  shippingCostSAR?: number | null;
  shippingCourierFeeRate?: number | null;
  productInsuranceFee?: number | null;
  packagingFee?: number | null;
  packagingFeeRate?: number | null;
  profitCompanySAR?: number | null;
  profitSaudiSAR?: number | null;
  profitPerKgRate?: number | null;
  companyProfitRate?: number | null;
  sheinRedPrice?: number | null;
  cbmShippingRateValue?: number | null;
  totalCBM?: number | null;
  totalWeight?: number | null;
  amountPaid?: number | null;
  amountRemaining?: number | null;
  cashAmount?: number | null;
  bankAmount?: number | null;
  paymentMethod?: string | null;
  bankReference?: string | null;
  payLater?: boolean | null;
  exchangeRate?: number | null;
  exchangeRateUSD?: number | null;
  exchangeRateYER?: number | null;
  customerAccountId?: string | null;
  cashAccountId?: string | null;
  bankAccountId?: string | null;
  bankCommissionRate?: number | null;
  bankCommissionType?: string | null;
  bankCommissionEnabled?: boolean | null;
  couponRate?: number | null;
  couponValue?: number | null;
  couponEnabled?: boolean | null;
  deliveryStatus?: string | null;
  locationYemen?: string | null;
  shippingCompany?: string | null;
  internalNotes?: string | null;
  cartShareCode?: string | null;
  addShippingEnabled?: boolean | null;
  homeDeliveryEnabled?: boolean | null;
  packagingFeeEnabled?: boolean | null;
  deductSourcingCostFromCourier?: boolean | null;
  viaShippingAgent?: boolean | null;
  directApprove?: boolean | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientAddress?: string | null;
  deliveryCity?: string | null;
  orderSourceName?: string | null;
  goodsDescription?: string | null;
  customerUid?: string | null;
  portalUid?: string | null;
  createdByName?: string | null;
}

// مفاتيح التفاصيل المسطّحة وقتياً حتى يستطيع بوابة الـAPI تقسيم حمولة التعديل بين الأعمدة الرئيسية والتفاصيل.
// Runtime flat-detail key list so the API gateway can split an update payload between identity columns and detail columns.
export const orderDetailPayloadKeys: readonly (keyof OrderDetailPayload)[] = [
  'totalCostYER', 'totalCostSAR', 'productsSum', 'sourcingCostAmount', 'sourcingCostSource',
  'deliveryCourierFee', 'deliveryCourierFeeCurrency', 'deliveryCourierFeeOrderCurrency', 'shippingCostSAR',
  'shippingCourierFeeRate', 'productInsuranceFee', 'packagingFee', 'packagingFeeRate', 'profitCompanySAR',
  'profitSaudiSAR', 'profitPerKgRate', 'companyProfitRate', 'sheinRedPrice', 'cbmShippingRateValue',
  'totalCBM', 'totalWeight', 'amountPaid', 'amountRemaining', 'cashAmount', 'bankAmount', 'paymentMethod',
  'bankReference', 'payLater', 'exchangeRate', 'exchangeRateUSD', 'exchangeRateYER', 'customerAccountId',
  'cashAccountId', 'bankAccountId', 'bankCommissionRate', 'bankCommissionType', 'bankCommissionEnabled',
  'couponRate', 'couponValue', 'couponEnabled', 'deliveryStatus', 'locationYemen', 'shippingCompany',
  'internalNotes', 'cartShareCode', 'addShippingEnabled', 'homeDeliveryEnabled', 'packagingFeeEnabled',
  'deductSourcingCostFromCourier', 'viaShippingAgent', 'directApprove', 'customerName', 'customerPhone',
  'customerEmail', 'customerAddress', 'recipientName', 'recipientPhone', 'recipientAddress', 'deliveryCity',
  'orderSourceName', 'goodsDescription', 'customerUid', 'portalUid', 'createdByName',
];

export interface OrderCreateInput {
  orderNumber: string;
  status?: string | null;
  trackingNumber?: string | null;
  customerId?: string | null;
  orderStatusId?: string | null;
  orderSourceId?: string | null;
  orderSourceType?: string | null;
  externalOrderNumber?: string | null;
  deliveryCourierId?: string | null;
  shippingCourierId?: string | null;
  orderPartyId?: string | null;
  orderPartyType: 'customer' | 'employee' | 'courier';
  isStaffOrder?: boolean;
  employeeId?: string | null;
  courierId?: string | null;
  orderPartyAccountId?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  orderCurrency?: string | null;
  orderCurrencyPrice?: number | null;
  notes?: string | null;
  paymentStatus?: string | null;
  orderDate?: IsoUtcString | null;
  orderDetail?: OrderDetailPayload;
  firedTriggers?: readonly string[];
  recipientName?: string | null;
  deliveryCity?: string | null;
  totalPrice?: number | null;
}

export type OrderUpdateInput = Partial<OrderCreateInput>;
export type OrdersViewModel = Partial<OrderApiDto> & { id: string };
export type OrdersAudit = AuditDto;
