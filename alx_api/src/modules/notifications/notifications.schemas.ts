/**
 * notifications.schemas.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * مخططات التحقق لقيم وحدة الإشعارات (Zod Validation Schemas for Notifications).
 * Zod schemas for request validation following exactOptionalPropertyTypes strictness.
 */

import { z } from 'zod';

// مخطط تحقق معاملات الترقيم والفلترة لقائمة الإشعارات
// Pagination and filter query schema for listing notifications
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  userId: z.string().trim().optional(),
  isRead: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// مخطط تحقق إنشاء إشعار داخلي
// Create in-app notification input schema
export const createNotificationSchema = z.object({
  userId: z.string().trim().nullable().optional(),
  title: z.string().trim().min(1, 'العنوان مطلوب').max(200),
  body: z.string().trim().min(1, 'نص الإشعار مطلوب').max(2000),
  type: z.enum(['system', 'order', 'shipment', 'finance', 'alert']).default('system'),
  channel: z.enum(['in_app', 'whatsapp', 'email', 'sms']).default('in_app'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// مخطط تحقق إرسال إشعار خارجي (WhatsApp / Email / SMS)
// Send external notification input schema (outbox pattern)
export const sendExternalNotificationSchema = z.object({
  recipient: z.string().trim().min(3, 'اسم أو عنوان المستلم مطلوب'),
  channel: z.enum(['whatsapp', 'email', 'sms']),
  templateId: z.string().trim().optional(),
  message: z.string().trim().min(1, 'رسالة الإشعار مطلوبة').max(2000),
  idempotencyKey: z.string().trim().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
