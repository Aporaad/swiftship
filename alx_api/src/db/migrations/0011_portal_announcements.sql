-- Migration: 0011_portal_announcements.sql
-- Description: إنشاء جدول الإعلانات العامة للبوابة الإلكترونية
-- Creation of public announcements table for the customer portal module
-- Date: 2026-10-05
-- Author: Claude Sonnet 4.6 (Thinking)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. جدول الإعلانات العامة (public announcements)
-- Used by the portal module for customer-facing announcements
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  -- المعرف الفريد للإعلان
  announcement_id       UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),

  -- عنوان الإعلان
  title                 TEXT        NOT NULL,

  -- محتوى الإعلان
  content               TEXT        NOT NULL,

  -- أولوية الإعلان: normal | high | urgent
  priority              TEXT        NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('normal', 'high', 'urgent')),

  -- هل الإعلان نشط (مرئي للعملاء)
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,

  -- تاريخ انتهاء الإعلان (اختياري)
  expires_at            TIMESTAMPTZ,

  -- حقول التدقيق
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            TEXT        NOT NULL DEFAULT 'system',
  updated_by            TEXT        NOT NULL DEFAULT 'system'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. فهارس جدول الإعلانات
-- Indexes for announcements table
-- ─────────────────────────────────────────────────────────────────────────────
-- فهرس للإعلانات النشطة مرتبة بالأولوية
CREATE INDEX IF NOT EXISTS idx_announcements_active_priority
  ON public.announcements (is_active, priority DESC, created_at DESC)
  WHERE is_active = TRUE;

-- فهرس للإعلانات المنتهية الصلاحية
CREATE INDEX IF NOT EXISTS idx_announcements_expires
  ON public.announcements (expires_at)
  WHERE expires_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. تعليق على الجدول
-- Table comments
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.announcements IS
  'إعلانات عامة موجهة للعملاء عبر بوابة الموقع الإلكتروني (Portal Module)';

COMMENT ON COLUMN public.announcements.priority IS
  'أولوية الإعلان: normal = عادي، high = مهم، urgent = عاجل';

COMMENT ON COLUMN public.announcements.is_active IS
  'true = الإعلان مرئي للعملاء، false = مخفي (Soft disable)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. بيانات تجريبية للتطوير (Development seed data)
-- Sample announcements for local development only
-- ─────────────────────────────────────────────────────────────────────────────
-- ملاحظة: هذه البيانات للتطوير فقط، لا تُطبَّق على الإنتاج تلقائياً
-- Note: These are dev-only seeds, not auto-applied to production
INSERT INTO public.announcements (title, content, priority, is_active, created_by)
VALUES
  (
    'مرحباً بكم في SwiftShip',
    'نحن سعداء بخدمتكم. يمكنكم تتبع شحناتكم باستخدام رقم التتبع الخاص بطلبكم.',
    'normal',
    TRUE,
    'system'
  )
ON CONFLICT DO NOTHING;
