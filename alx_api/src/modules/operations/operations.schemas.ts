import { z } from 'zod';

export const entityIdSchema = z.string().trim().min(1).max(128);
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  search: z.string().trim().min(1).max(120).optional(),
});
const money = z.number().finite().nonnegative().max(1_000_000_000);
const optionalText = z.string().trim().max(500).optional();
export const orderItemInputSchema = z.object({
  productId: optionalText,
  productName: optionalText,
  productNameAr: optionalText,
  productNameEn: optionalText,
  productUrl: z.string().url().max(2000).optional(),
  quantity: z.number().int().positive().max(1_000_000),
  unitPrice: money,
  weight: money.optional(),
  cbm: money.optional(),
  notes: optionalText,
});
export const shipmentInputSchema = z.object({
  trackingNumber: optionalText,
  shippingCompanyId: optionalText,
  courierId: optionalText,
  shipmentStatus: optionalText,
  shippingCost: money.optional(),
  weight: money.optional(),
  shippingType: optionalText,
  shippingSource: optionalText,
  shippingDestination: optionalText,
  cartonCount: z.number().int().nonnegative().max(1_000_000).optional(),
});
export const createOrderInputSchema = z.object({
  orderNumber: z.string().trim().min(1).max(128),
  customerId: optionalText,
  status: z.string().trim().min(1).max(80).optional(),
  orderStatusId: optionalText,
  trackingNumber: optionalText,
  currency: optionalText,
  orderCurrency: optionalText,
  orderCurrencyPrice: money.optional(),
  externalOrderNumber: optionalText,
  items: z.array(orderItemInputSchema).max(1000).default([]),
  shipment: shipmentInputSchema.optional(),
});
export const updateOrderStatusInputSchema = z.object({
  status: z.string().trim().min(1).max(80),
  note: optionalText,
});
export const productInputSchema = z.object({
  productId: z.string().trim().min(1).max(128),
  productNameAr: optionalText,
  productNameEn: optionalText,
  productUrl: z.string().url().max(2000).optional(),
  productPriceCurrency: optionalText,
  unitPrice: money.optional(),
  itemCategoryId: optionalText,
  cbm: money.optional(),
  width: money.optional(),
  height: money.optional(),
  length: money.optional(),
  weight: money.optional(),
});
export const updateShipmentInputSchema = shipmentInputSchema.extend({});

export const createCourierSchema = z.object({
  courierId: entityIdSchema.optional(),
  fullName: z.string().trim().min(1).max(255),
  nameAr: optionalText,
  nameEn: optionalText,
  courierType: optionalText,
  courierLevel: optionalText,
  commissionRate: money.optional(),
  currency: optionalText,
  isActive: z.boolean().optional(),
  accountId: optionalText,
});
export const updateCourierSchema = createCourierSchema.partial();

export const createEmployeeSchema = z.object({
  employeeId: entityIdSchema.optional(),
  fullName: z.string().trim().min(1).max(255),
  nameAr: optionalText,
  nameEn: optionalText,
  jobType: optionalText,
  monthlySalary: money.optional(),
  commissionRate: money.optional(),
  currency: optionalText,
  accountId: optionalText,
});
export const updateEmployeeSchema = createEmployeeSchema.partial();
