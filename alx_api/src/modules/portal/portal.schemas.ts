/**
 * portal.schemas.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * مخططات التحقق لبوابة الموقع العامة (Zod Validation Schemas for Public Portal).
 * Zod schemas for Portal tracking and announcements endpoint request validation.
 */

import { z } from 'zod';

/**
 * مخطط التحقق من رمز التتبع في الـ URL param.
 * Validates the tracking token path parameter.
 */
export const trackingTokenParamSchema = z
  .string()
  .trim()
  .min(3, 'رمز التتبع يجب أن يكون 3 أحرف على الأقل.')
  .max(100, 'رمز التتبع طويل جداً.')
  .regex(/^[a-zA-Z0-9_\-]+$/, 'رمز التتبع يحتوي على أحرف غير مسموحة.');

/**
 * مخطط استجابة تتبع الشحنة/الطلب العام.
 * Public tracking response schema for API documentation.
 */
export const publicTrackingResponseSchema = z.object({
  trackingToken: z.string(),
  status: z.string(),
  updatedAt: z.number().nullable(),
  events: z.array(
    z.object({
      status: z.string(),
      occurredAt: z.number().nullable(),
      location: z.string().nullable().optional(),
    }),
  ),
});

/**
 * مخطط استجابة الإعلانات العامة.
 * Public announcements response schema for API documentation.
 */
export const announcementResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  priority: z.enum(['normal', 'high', 'urgent']),
  createdAt: z.number(),
});

// نوع TypeScript المستخرج من مخطط الاستجابة
// TypeScript type inferred from response schema
export type PublicTrackingResponse = z.infer<typeof publicTrackingResponseSchema>;
export type AnnouncementResponse = z.infer<typeof announcementResponseSchema>;
