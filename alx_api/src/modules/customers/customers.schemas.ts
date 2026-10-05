import { z } from 'zod';

export const customerIdSchema = z.string().trim().min(1).max(128);
const nullableText = z.string().trim().max(500).nullable().optional();
const jsonValue = z.unknown().optional();

export const listCustomersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  search: z.string().trim().min(1).max(120).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const createCustomerSchema = z.object({
  customerId: customerIdSchema.optional(),
  accountId: z.string().trim().min(1).max(128).nullable().optional(),
  isActive: z.boolean().optional(),
  joinBy: nullableText,
  referrerId: nullableText,
  fullName: nullableText,
  nameAr: nullableText,
  nameEn: nullableText,
  customerLevel: nullableText,
  acquisitionSource: nullableText,
  preferredCategories: jsonValue,
  location: jsonValue,
  address: nullableText,
  onboardingCompleted: z.boolean().nullable().optional(),
});

export const updateCustomerSchema = createCustomerSchema
  .omit({ customerId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'يجب إرسال حقل واحد على الأقل للتعديل.');
