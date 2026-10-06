import { z } from 'zod';

const nonNegativeMoney = z.number().finite().min(0).max(1_000_000_000);

export const portalTicketCreateSchema = z.object({
  type: z.enum(['inquiry', 'suggestion', 'complaint']),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(5).max(5_000),
}).strict();

const locationDetailsSchema = z.object({
  country: z.string().trim().max(120).optional(),
  governorate: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  street: z.string().trim().max(300).optional(),
  addressDetails: z.string().trim().max(500).optional(),
  lat: z.number().finite().min(-90).max(90).nullable().optional(),
  lng: z.number().finite().min(-180).max(180).nullable().optional(),
}).strict();

const customerBodyDetailsSchema = z.object({
  heightCm: z.number().finite().min(20).max(300).nullable().optional(),
  weightKg: z.number().finite().min(1).max(500).nullable().optional(),
  shortsSize: z.string().max(40).optional(),
  coatSize: z.string().max(40).optional(),
  pantsSize: z.string().max(40).optional(),
  shoeSize: z.string().max(40).optional(),
  preferredColors: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
}).strict();

const acquisitionSourceSchema = z.object({
  joinBy: z.string().trim().max(80),
  referrerId: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(500).optional(),
}).strict();

export const portalCustomerDetailsUpdateSchema = z.object({
  privacyPolicyAgreed: z.boolean().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  age: z.number().finite().int().min(13).max(120).optional(),
  location: locationDetailsSchema.optional(),
  bodyDetails: customerBodyDetailsSchema.optional(),
  preferredCategories: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  acquisitionSource: acquisitionSourceSchema.optional(),
  joinBy: z.string().trim().max(80).optional(),
  referrerId: z.string().trim().max(128).optional(),
  onboardingCompleted: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one customer detail field must be provided.',
});

export const portalOrderCreateSchema = z.object({
  orderSourceId: z.string().trim().min(1).max(128).optional(),
  externalOrderNumber: z.string().trim().max(120).optional(),
  cartShareCode: z.string().trim().max(120).optional(),
  items: z.array(z.object({
    productName: z.string().trim().min(1).max(300),
    productUrl: z.string().trim().max(2_000).optional(),
    quantity: z.number().finite().int().min(1).max(10_000),
    productPrice: nonNegativeMoney,
    weight: z.number().finite().min(0).max(1_000_000).optional(),
    cbm: z.number().finite().min(0).max(1_000_000).optional(),
    length: z.number().finite().min(0).max(100_000).optional(),
    width: z.number().finite().min(0).max(100_000).optional(),
    height: z.number().finite().min(0).max(100_000).optional(),
    trackingNumber: z.string().trim().max(120).optional(),
  }).strict()).min(1).max(50),
  packagingType: z.enum(['normal', 'gift', 'vip']),
  isUrgent: z.boolean(),
  packageType: z.enum(['standard', 'express', 'factory_cbm', 'heavy']),
  paymentMethod: z.enum(['Cash', 'Transfer', 'Wallet']).optional(),
  notes: z.string().trim().max(2_000).optional(),
}).strict().refine((value) => value.items.reduce((total, item) => total + item.quantity * item.productPrice, 0) <= 1_000_000_000, {
  message: 'Order item total exceeds the supported maximum.',
  path: ['items'],
}).refine((value) => value.items.reduce((total, item) => total + item.quantity * (item.weight ?? 0), 0) <= 1_000_000, {
  message: 'Order weight exceeds the supported maximum.',
  path: ['items'],
}).refine((value) => value.items.reduce((total, item) => total + item.quantity * (item.cbm ?? 0), 0) <= 1_000_000, {
  message: 'Order volume exceeds the supported maximum.',
  path: ['items'],
});

export const portalPaymentRequestCreateSchema = z.object({
  amount: z.number().finite().min(0.01).max(100_000_000).multipleOf(0.01),
  currency: z.enum(['YER', 'USD', 'SAR']),
  paymentMethod: z.enum(['cash', 'transfer', 'wallet', 'check']),
  reference: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2_000).optional(),
}).strict();

export const portalPaymentRequestIdSchema = z.string().uuid();
export const portalPaymentRequestSettleSchema = z.object({
  financeEntryId: z.string().trim().min(1).max(200),
}).strict();
export const portalPaymentRequestRejectSchema = z.object({
  reviewNote: z.string().trim().min(5).max(1_000),
}).strict();

export type PortalTicketCreateInput = z.infer<typeof portalTicketCreateSchema>;
export type PortalOrderCreateInput = z.infer<typeof portalOrderCreateSchema>;
export type PortalPaymentRequestCreateInput = z.infer<typeof portalPaymentRequestCreateSchema>;
export type PortalCustomerDetailsUpdateInput = z.infer<typeof portalCustomerDetailsUpdateSchema>;
