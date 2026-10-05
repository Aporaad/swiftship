import { z } from 'zod';

const optionalText = z.string().trim().min(1).optional();
export const entityIdSchema = z.string().trim().min(1).max(200);
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  search: z.string().trim().max(100).optional(),
});
const lineSchema = z.object({
  accountId: entityIdSchema,
  accountCurNo: z.number().int().positive(),
  transType: z.enum(['Debit', 'Credit']),
  amount: z.number().finite().positive(),
  amountOriginal: z.number().finite().positive(),
  currencyOriginalNo: z.number().int().positive(),
  currencyPriceId: z.number().int().positive().optional(),
  currencyPriceSeq: z.number().int().positive().optional(),
  accountCurrencyPriceId: z.number().int().positive().optional(),
  accountCurrencyPriceSeq: z.number().int().positive().optional(),
  entityType: optionalText,
  entityId: optionalText,
  paymentMethod: z.enum(['cash', 'bank', 'mixed', 'deferred']).optional(),
  orderId: optionalText,
  shipmentId: optionalText,
  custodyId: optionalText,
  description: z.string().trim().max(500).optional(),
  note: z.string().trim().max(2000).optional(),
});
export const createEntrySchema = z
  .object({
    entryNumber: z.string().trim().min(1).max(100),
    moduleId: entityIdSchema,
    entryTypeId: entityIdSchema,
    entryCategory: z.enum(['General', 'Compound', 'Temp', 'Reversing']),
    postingStatus: z.enum(['draft', 'posted']).default('draft'),
    description: z.string().trim().min(1).max(500),
    notes: z.string().trim().max(2000).optional(),
    attachments: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
    paymentMethod: z.enum(['cash', 'bank', 'mixed', 'deferred']).optional(),
    orderId: optionalText,
    shipmentId: optionalText,
    custodyId: optionalText,
    automationKey: optionalText,
    autoRuleId: optionalText,
    isAutomatic: z.boolean().optional(),
    effectiveAt: z.string().datetime({ offset: true }).optional(),
    lines: z.array(lineSchema).min(2).max(500),
  })
  .superRefine((value, context) => {
    if (value.entryCategory === 'General' && value.lines.length !== 2) {
      context.addIssue({ code: 'custom', path: ['lines'], message: 'القيد العام يتطلب ساقين فقط.' });
    }
    if (value.entryCategory === 'Compound' && value.lines.length < 3) {
      context.addIssue({ code: 'custom', path: ['lines'], message: 'القيد المركب يتطلب ثلاثة أسطر على الأقل.' });
    }
    const debit = value.lines
      .filter((line) => line.transType === 'Debit')
      .reduce((sum, line) => sum + line.amountOriginal, 0);
    const credit = value.lines
      .filter((line) => line.transType === 'Credit')
      .reduce((sum, line) => sum + line.amountOriginal, 0);
    if (Math.abs(debit - credit) > 0.0001) {
      context.addIssue({ code: 'custom', path: ['lines'], message: 'القيد غير متوازن بالعملة الأصلية.' });
    }
  });
export const reverseEntrySchema = z.object({
  description: z.string().trim().min(1).max(500),
  effectiveAt: z.string().datetime({ offset: true }).optional(),
});
export const autoEntryRuleSchema = z.object({
  statusId: z.number().int().positive().optional(),
  statusNameAr: z.string().trim().max(200).optional(),
  nameAr: z.string().trim().min(1).max(300),
  nameEn: z.string().trim().min(1).max(300),
  isActive: z.boolean().default(true),
  amountSource: z.string().trim().min(1).max(100),
  amountSources: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
  amountStrategy: z.literal('sum').default('sum'),
  currency: z.string().trim().max(20).optional(),
  currencyNo: z.number().int().positive().optional(),
  skipWhenZero: z.boolean().default(true),
  autoPost: z.boolean().default(true),
  debitAccount: z.string().trim().min(1).max(200),
  creditAccount: z.string().trim().min(1).max(200),
  descriptionTemplateAr: z.string().trim().min(1).max(500),
  descriptionTemplateEn: z.string().trim().min(1).max(500),
});
