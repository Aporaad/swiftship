-- Migration: 0010_notifications_outbox.sql
-- Description: إنشاء جدول الإشعارات وجدول Outbox للإشعارات الخارجية
-- Creation of notifications table and outbox table for external notifications
-- Date: 2026-10-05
-- Author: Claude Sonnet 4.6 (Thinking)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. جدول الإشعارات الداخلية (in-app notifications)
-- Internal notifications table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  -- المعرف الفريد للإشعار
  notification_id       TEXT        NOT NULL PRIMARY KEY,

  -- المستخدم المستهدف (null = إشعار عام للجميع)
  user_id               UUID        REFERENCES public.users(id) ON DELETE CASCADE,

  -- عنوان الإشعار
  title                 TEXT        NOT NULL,

  -- نص الإشعار
  body                  TEXT        NOT NULL,

  -- نوع الإشعار: system | order | shipment | finance | alert
  notification_type     TEXT        NOT NULL DEFAULT 'system'
                        CHECK (notification_type IN ('system', 'order', 'shipment', 'finance', 'alert')),

  -- هل تم قراءة الإشعار
  is_read               BOOLEAN     NOT NULL DEFAULT FALSE,

  -- قناة الإشعار: in_app | whatsapp | email | sms
  channel               TEXT        NOT NULL DEFAULT 'in_app'
                        CHECK (channel IN ('in_app', 'whatsapp', 'email', 'sms')),

  -- بيانات إضافية للإشعار (JSONB)
  metadata              JSONB,

  -- توقيت القراءة
  read_at               TIMESTAMPTZ,

  -- حقول التدقيق
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            TEXT        NOT NULL DEFAULT 'system',
  updated_by            TEXT        NOT NULL DEFAULT 'system'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. فهارس جدول الإشعارات
-- Indexes for notifications table
-- ─────────────────────────────────────────────────────────────────────────────
-- فهرس للبحث بالمستخدم وحالة القراءة
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications (user_id, is_read);

-- فهرس للبحث بالنوع والتاريخ
CREATE INDEX IF NOT EXISTS idx_notifications_type_created
  ON public.notifications (notification_type, created_at DESC);

-- فهرس للإشعارات غير المقروءة
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id) WHERE is_read = FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. جدول Outbox للإشعارات الخارجية (WhatsApp / Email / SMS)
-- Outbox table for external notifications (transactional outbox pattern)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alx_api_private.notification_outbox (
  -- المعرف الفريد لحدث الـ Outbox
  outbox_id             UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),

  -- مفتاح الـ Idempotency لمنع التكرار
  idempotency_key       TEXT        NOT NULL UNIQUE,

  -- القناة الخارجية: whatsapp | email | sms
  channel               TEXT        NOT NULL
                        CHECK (channel IN ('whatsapp', 'email', 'sms')),

  -- المستلم: رقم الهاتف أو البريد الإلكتروني
  recipient             TEXT        NOT NULL,

  -- معرف قالب الرسالة (اختياري)
  template_id           TEXT,

  -- نص الرسالة
  message               TEXT        NOT NULL,

  -- البيانات الإضافية
  payload               JSONB,

  -- حالة الإرسال: queued | processing | sent | failed | cancelled
  status                TEXT        NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'cancelled')),

  -- عدد محاولات الإرسال
  attempt_count         INTEGER     NOT NULL DEFAULT 0,

  -- أقصى عدد محاولات مسموحة
  max_attempts          INTEGER     NOT NULL DEFAULT 3,

  -- وقت آخر محاولة
  last_attempted_at     TIMESTAMPTZ,

  -- وقت الإرسال الناجح
  sent_at               TIMESTAMPTZ,

  -- رسالة الخطأ عند الفشل
  error_message         TEXT,

  -- حقول التدقيق
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            TEXT        NOT NULL DEFAULT 'system'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. فهارس جدول Outbox
-- Indexes for notification_outbox table
-- ─────────────────────────────────────────────────────────────────────────────
-- فهرس للرسائل في طابور الإرسال
CREATE INDEX IF NOT EXISTS idx_notification_outbox_queued
  ON alx_api_private.notification_outbox (status, created_at)
  WHERE status IN ('queued', 'failed') AND attempt_count < max_attempts;

-- فهرس للقناة والحالة
CREATE INDEX IF NOT EXISTS idx_notification_outbox_channel_status
  ON alx_api_private.notification_outbox (channel, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. تعليق على الجداول
-- Table comments
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.notifications IS
  'إشعارات داخلية للمستخدمين داخل التطبيق (in-app notifications)';

COMMENT ON TABLE alx_api_private.notification_outbox IS
  'قائمة انتظار الإشعارات الخارجية (Transactional Outbox Pattern) لـ WhatsApp/Email/SMS';
