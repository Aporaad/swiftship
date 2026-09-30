import type {
  OrderCreateInput,
  OrderSupplementalData,
  OrderUpdateInput,
} from '../../../data/dtos/orders.dto';
import { makeObjectSchema, type FieldRule } from '../../../data/dtos/common.dto';
import type {
  PaymentFormData,
  ShipmentFormData,
  UpdateFormData,
} from '../types';

const orderRules = {
  orderNumber: 'nonEmptyString',
  trackingNumber: 'string',
  customerId: 'string',
  orderStatusId: 'string',
  orderSourceId: 'string',
  orderSourceType: 'string',
  deliveryCourierId: 'string',
  shippingCourierId: 'string',
  orderPartyId: 'string',
  orderPartyType: 'nonEmptyString',
  isStaffOrder: 'boolean',
  employeeId: 'string',
  courierId: 'string',
  orderPartyAccountId: 'string',
  totalAmount: 'number',
  totalPrice: 'number',
  currency: 'string',
  notes: 'string',
  paymentStatus: 'string',
  status: 'string',
  orderDate: 'string',
  recipientName: 'string',
  deliveryCity: 'string',
  orderData: 'object',
} as const satisfies Readonly<Record<string, FieldRule>>;

export const ordersCreateSchema = makeObjectSchema<OrderCreateInput>(
  ['orderNumber', 'orderPartyType'],
  orderRules,
);

export const ordersUpdateSchema = makeObjectSchema<OrderUpdateInput>([], orderRules);

const paymentRules = {
  amount: 'string',
  method: 'string',
  receivingAccountId: 'string',
  bankReference: 'string',
  notes: 'string',
  pin: 'string',
  paymentCurrency: 'string',
  voucherDate: 'string',
  voucherNumber: 'string',
} as const satisfies Readonly<Record<string, FieldRule>>;

export const orderPaymentSchema = makeObjectSchema<PaymentFormData>([], paymentRules);

const statusUpdateRules = {
  orderStatus: 'string',
  deliveryStatus: 'string',
  locationYemen: 'string',
  internalNotes: 'string',
  shippingCourierId: 'string',
  deliveryCourierId: 'string',
} as const satisfies Readonly<Record<string, FieldRule>>;

export const orderStatusUpdateSchema = makeObjectSchema<UpdateFormData>([], statusUpdateRules);

const shipmentRules = {
  id: 'string',
  orderId: 'string',
  trackingNumber: 'string',
  shippingCompany: 'string',
  shippingCompanyId: 'string',
  courierId: 'string',
  shippingType: 'string',
  shippingSource: 'string',
  shippingDestination: 'string',
  shipmentStatus: 'string',
  shippingCost: 'number',
  weight: 'number',
  packagingFees: 'number',
  shippingCategoryId: 'string',
  shippingCategoryName: 'string',
  shippingCategoryPrice: 'number',
  shippingDate: 'string',
  shippingDuration: 'string',
  expectedArrival: 'string',
  deliveryDate: 'string',
  notes: 'string',
  contentCategoryId: 'string',
  contentCategoryName: 'string',
  cartonCount: 'number',
  customsFee: 'number',
  taxFee: 'number',
  otherCategoryFee: 'number',
  categoryFeesTotal: 'number',
  categoryFeeCurrency: 'string',
} as const satisfies Readonly<Record<string, FieldRule>>;

export const orderShipmentSchema = makeObjectSchema<ShipmentFormData>([], shipmentRules);

/** Accepts and returns supplemental order data without stripping legacy or future optional fields. */
export const orderSupplementalDataSchema = makeObjectSchema<Partial<OrderSupplementalData>>([]);
