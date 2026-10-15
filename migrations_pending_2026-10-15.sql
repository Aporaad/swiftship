-- migrations_pending_2026-10-15.sql
-- التاريخ: 2026-10-15 — ينفَّذ في لوحة Supabase (الدور alx_api_runtime لا يملك صلاحيات DDL).
-- Date: 2026-10-15 — run in the Supabase dashboard; the runtime role has no DDL rights.
-- الترتيب: 0010 ثم 0023 ثم 0036 ثم 0037. كلها idempotent وقابلة للتكرار بأمان.
-- Order: 0010, then 0023, then 0036, then 0037. Every statement is idempotent and safe to re-run.
-- لا يُضمَّن 0034: يُسقط أعمدة jsonb القديمة ويجب أن يجري أخيرًا بعد نشر alx_api والواجهة المسطّحين.
-- 0034 is intentionally excluded: it drops the legacy jsonb columns and must run LAST, after the flat API and frontend are deployed.

-- ========== 0010_notifications_outbox.sql ==========
-- Migration: 0010_notifications_outbox.sql
-- Description: إنشاء جدول Outbox للإشعارات الخارجية (WhatsApp / Email / SMS) ومنح صلاحيات الـ runtime.
-- Creation of the external notification outbox (transactional outbox pattern) plus runtime grants.
-- Date: 2026-10-05 — revised 2026-10-14
--
-- ملاحظة تصحيحية: هذا الملف كان يُنشئ جدولا وهميا لـ public notifications بأعمدة
-- (body / notification_type / channel / metadata) غير موجودة في قاعدة البيانات الحقيقية،
-- وكان يستخدم حقل jsonb جامع. الإشعارات الداخلية تعيش في public.notifications (جدول قديم)
-- ويسطّحها الترحيل 0025_flatten_notifications.sql، ولا أعمدة jsonb بعد هذا الترحيل.
-- Corrective note: this file previously created a fictional notifications table with columns
-- that do not exist in the real database and a catch-all jsonb field. In-app notifications live in
-- public.notifications and are flattened by 0025; no jsonb payload columns remain.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. جدول Outbox للإشعارات الخارجية (Transactional Outbox Pattern)
-- Outbox table for external notifications
-- كل الحقول أعمدة رئيسية — لا يوجد حقل payload جامع — every field is a first-class column.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE IF NOT EXISTS alx_api_private.notification_outbox (
  -- المعرف الفريد لحدث الـ Outbox
  outbox_id             TEXT        NOT NULL PRIMARY KEY,

  -- مفتاح الـ Idempotency لمنع تكرار الإرسال
  idempotency_key       TEXT        NOT NULL UNIQUE,

  -- القناة الخارجية: whatsapp | email | sms
  channel               TEXT        NOT NULL
                          CHECK (channel IN ('whatsapp', 'email', 'sms')),

  -- المستلم: رقم الهاتف أو البريد الإلكتروني
  recipient             TEXT        NOT NULL,

  -- اسم المستلم القابل للقراءة (اختياري)
  recipient_name        TEXT,

  -- معرف قالب الرسالة (اختياري)
  template_id           TEXT,

  -- نص الرسالة
  message               TEXT        NOT NULL,

  -- الإشعار الداخلي المرتبط إن وُجد (مرجع اختياري غير مقيد بإنشاء الجدول)
  notification_id       TEXT,

  -- حالة الإرسال: queued | processing | sent | failed | cancelled
  status                TEXT        NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'cancelled')),

  -- عدد محاولات الإرسال
  attempt_count         INTEGER     NOT NULL DEFAULT 0
                          CHECK (attempt_count >= 0),

  -- أقصى عدد محاولات مسموحة
  max_attempts          INTEGER     NOT NULL DEFAULT 3
                          CHECK (max_attempts > 0),

  -- وقت آخر محاولة
  last_attempted_at     TIMESTAMPTZ,

  -- وقت الإرسال الناجح
  sent_at               TIMESTAMPTZ,

  -- رسالة الخطأ عند الفشل
  error_message         TEXT,

  -- حقول التدقيق
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            TEXT        NOT NULL DEFAULT 'api'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. فهارس جدول Outbox
-- Indexes for the outbox table
-- ─────────────────────────────────────────────────────────────────────────────
-- فهرس للرسائل في طابور الإرسال (partial index)
CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
  ON alx_api_private.notification_outbox (created_at)
  WHERE status IN ('queued', 'failed');

-- فهرس للقناة والحالة
CREATE INDEX IF NOT EXISTS notification_outbox_channel_status_idx
  ON alx_api_private.notification_outbox (channel, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. الأمان: RLS + صلاحيات الـ runtime فقط
-- Security: row level security plus the minimum runtime grants.
-- alx_api_runtime بلا صلاحيات DDL — الترحيل يُنفَّذ من لوحة تحكم Supabase فقط.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE alx_api_private.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.notification_outbox FORCE ROW LEVEL SECURITY;
REVOKE ALL ON alx_api_private.notification_outbox FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON alx_api_private.notification_outbox TO alx_api_runtime;
GRANT USAGE ON SCHEMA alx_api_private TO alx_api_runtime;

CREATE POLICY notification_outbox_runtime_policy ON alx_api_private.notification_outbox
  FOR ALL TO alx_api_runtime USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. تعليقات على الجدول
-- Table comments
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE alx_api_private.notification_outbox IS
  'قائمة انتظار الإشعارات الخارجية (Transactional Outbox Pattern) لـ WhatsApp/Email/SMS — أعمدة مسطّحة بلا jsonb';

COMMIT;

-- ========== 0023_finance_admin_assets_grants_purge.sql ==========
-- Finance API phase 7 (tasks 7-ب / 7-ج):
--   1) complete the assets table with the administered fields,
--   2) grant the API runtime role DELETE on the tables the new admin endpoints write,
--   3) create the transactional entity financial footprint purge RPC.
-- Execution path: applied manually by the project owner in the Supabase dashboard
-- (the alx_api_runtime role has no DDL rights).

-- 1) Assets schema completion / استكمال أعمدة الأصول
--    لا يُنشأ حقل jsonb جامع للسجلات: سجل الصيانة جدول علائقي ابنّي.
--    No catch-all jsonb column: maintenance logs are relational child rows, not a jsonb array.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS assigned_courier_id text,
  ADD COLUMN IF NOT EXISTS assigned_courier_name text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS updated_by text;

-- سجل صيانة الأصل: صف لكل عملية صيانة — one row per maintenance operation.
CREATE TABLE IF NOT EXISTS public.asset_maintenance_log (
  maintenance_log_id text PRIMARY KEY,
  asset_id           text        NOT NULL REFERENCES public.assets (asset_id) ON DELETE CASCADE,
  seq                integer     NOT NULL,
  type               text        NOT NULL DEFAULT 'Repair',
  cost               numeric     NOT NULL DEFAULT 0,
  currency           text        NOT NULL DEFAULT '',
  notes              text        NOT NULL DEFAULT '',
  done_by            text        NOT NULL DEFAULT '',
  performed_at       date,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  created_by         text,
  updated_at         timestamptz,
  updated_by         text,
  CONSTRAINT asset_maintenance_log_asset_seq_uniq UNIQUE (asset_id, seq)
);

CREATE INDEX IF NOT EXISTS asset_maintenance_log_asset_idx
  ON public.asset_maintenance_log (asset_id, seq);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_maintenance_log TO alx_api_runtime;

-- 2) DELETE grants for the finance admin surface and already-shipped product routes.
--    بدونها تسقط نقاط نهاية الحذف بالرمز 42501 وقت التشغيل.
--    Without these, the API delete endpoints fail with 42501 at runtime.
GRANT DELETE ON
  public.assets,
  public.account,
  public.acc_main,
  public.acc_sub,
  public.acc_sub_group,
  public.accounts,
  public.default_accounts,
  public.salary_history,
  public.auto_entries,
  public.products,
  public.order_items,
  public.returned_products,
  -- منح الحذف للمناديب والموظفين: نقاط النهاية موجودة وتحرس السلف قبل الحذف.
  -- Courier and employee delete endpoints exist and guard custody advances before deleting.
  public.couriers,
  public.employees
TO alx_api_runtime;

-- 3) Entity financial footprint purge / تطهير الأثر المالي للجهة
--    Deletes the entity's ledger footprint (accounts, movement legs, the entries those
--    legs form, related custody advances) and finally the entity row itself.
--    Guards: customers with orders and couriers with unsettled custody advances are refused.
CREATE OR REPLACE FUNCTION public.purge_entity_financial_footprint(
  p_entity_type text,
  p_entity_id text,
  p_actor text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $purge$
DECLARE
  v_accounts text[];
  v_entries  text[];
  v_open_orders integer;
  v_open_custodies integer;
  v_n_accounts integer;
  v_n_entries integer;
  v_n_legs integer;
  v_n_custodies integer;
  v_entity_table text;
  v_entity_pk text;
BEGIN
  IF p_entity_type NOT IN ('customers','couriers','employees','users','sources','shipping_companies') THEN
    RAISE EXCEPTION 'PURGE_ENTITY_TYPE_NOT_ALLOWED: %', p_entity_type;
  END IF;
  IF p_entity_id IS NULL OR btrim(p_entity_id) = '' THEN
    RAISE EXCEPTION 'PURGE_ENTITY_ID_REQUIRED';
  END IF;

  -- Whitelisted table / primary-key map (verified against the live schema).
  v_entity_table := p_entity_type;
  v_entity_pk := CASE p_entity_type
    WHEN 'customers' THEN 'customer_id'
    WHEN 'couriers' THEN 'courier_id'
    WHEN 'employees' THEN 'employee_id'
    WHEN 'users' THEN 'user_id'
    WHEN 'sources' THEN 'source_id'
    WHEN 'shipping_companies' THEN 'shipping_company_id'
  END;

  -- Guard: customers cannot be purged while orders reference them.
  IF p_entity_type = 'customers' THEN
    SELECT count(*) INTO v_open_orders FROM public.orders WHERE customer_id = p_entity_id;
    IF v_open_orders > 0 THEN
      RAISE EXCEPTION 'PURGE_BLOCKED_CUSTOMER_HAS_ORDERS: %', v_open_orders;
    END IF;
  END IF;

  -- Guard: couriers cannot be purged with outstanding custody advances.
  IF p_entity_type = 'couriers' THEN
    SELECT count(*) INTO v_open_custodies
    FROM public.custody_advances
    WHERE recipient_id = p_entity_id
      AND (status IS DISTINCT FROM 'settled')
      AND COALESCE(amount_outstanding, 0) > 0;
    IF v_open_custodies > 0 THEN
      RAISE EXCEPTION 'PURGE_BLOCKED_COURIER_HAS_OPEN_CUSTODY: %', v_open_custodies;
    END IF;
  END IF;

  SELECT COALESCE(array_agg(account_id), '{}'::text[]) INTO v_accounts
  FROM public.accounts WHERE entity_id = p_entity_id;

  SELECT COALESCE(array_agg(DISTINCT main_entry_id), '{}'::text[]) INTO v_entries
  FROM public.account_trans
  WHERE entity_id = p_entity_id
     OR (array_length(v_accounts, 1) IS NOT NULL AND account_id = ANY (v_accounts))
     OR custody_id IN (SELECT custody_advance_id FROM public.custody_advances WHERE recipient_id = p_entity_id);

  v_n_accounts := (SELECT count(*) FROM public.accounts WHERE entity_id = p_entity_id);
  v_n_entries  := COALESCE(array_length(v_entries, 1), 0);
  v_n_legs     := (SELECT count(*) FROM public.account_trans
                   WHERE entity_id = p_entity_id
                      OR (array_length(v_accounts, 1) IS NOT NULL AND account_id = ANY (v_accounts))
                      OR custody_id IN (SELECT custody_advance_id FROM public.custody_advances WHERE recipient_id = p_entity_id));

  DELETE FROM public.entry_payment_details WHERE array_length(v_entries, 1) IS NOT NULL AND main_entry_id = ANY (v_entries);

  DELETE FROM public.account_trans
  WHERE entity_id = p_entity_id
     OR (array_length(v_accounts, 1) IS NOT NULL AND account_id = ANY (v_accounts))
     OR custody_id IN (SELECT custody_advance_id FROM public.custody_advances WHERE recipient_id = p_entity_id);

  DELETE FROM public.main_entry WHERE array_length(v_entries, 1) IS NOT NULL AND main_entry_id = ANY (v_entries);

  SELECT count(*) INTO v_n_custodies FROM public.custody_advances WHERE recipient_id = p_entity_id;
  DELETE FROM public.custody_advances WHERE recipient_id = p_entity_id;

  DELETE FROM public.accounts WHERE array_length(v_accounts, 1) IS NOT NULL AND account_id = ANY (v_accounts);

  -- Remove the entity row itself (table and primary key are whitelisted above).
  EXECUTE format('DELETE FROM public.%I WHERE %I = $1', v_entity_table, v_entity_pk)
  USING p_entity_id;

  RETURN jsonb_build_object(
    'entityType', p_entity_type,
    'entityId', p_entity_id,
    'actor', p_actor,
    'purgedAt', now(),
    'deleted', jsonb_build_object(
      'accounts', v_n_accounts,
      'entries', v_n_entries,
      'movements', v_n_legs,
      'custodyAdvances', v_n_custodies
    )
  );
END;
$purge$;

REVOKE ALL ON FUNCTION public.purge_entity_financial_footprint(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_entity_financial_footprint(text, text, text) TO alx_api_runtime;

-- ========== 0036_fix_order_deletion.sql ==========
-- 0036_fix_order_deletion.sql
-- إصلاح حذف الطلبات: كان الدالة تحذف الشحنات قبل سجلّاتها، فيفشل الحذف بـ 23503
-- (orders_history.shipment_id → shipments بـ NO ACTION).
-- Order-deletion fix: the RPC deleted shipments before their history rows, so every real
-- deletion aborted with 23503 (orders_history.shipment_id → shipments is ON DELETE NO ACTION).
-- Also removes the dead jsonb predicates: no notification or whatsapp log row carries an order
-- reference (verified on the live database: 0 of 201 notifications, 0 of 19 logs), so reading
-- data->>'orderId' deleted nothing while blocking the 0034 jsonb cleanup.
-- Date: 2026-10-15

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_orders_with_dependents(p_order_ids text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
-- منع انتحال search_path عند تنفيذ الدالة بصلاحيات المالك — fixed search_path, no hijack.
SET search_path = pg_catalog
AS $function$
DECLARE
  target_ids text[]; target_numbers text[]; shipment_ids text[]; main_entry_ids text[]; account_trans_ids text[]; affected_accounts text[];
  requested_count integer; actual_count integer;
  deleted_shipments integer := 0; deleted_order_items integer := 0; deleted_main_entries integer := 0;
  deleted_account_trans integer := 0; deleted_orders_history integer := 0; deleted_orders integer := 0;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT trimmed_id ORDER BY trimmed_id), ARRAY[]::text[]) INTO target_ids
    FROM (SELECT NULLIF(btrim(order_id), '') AS trimmed_id FROM unnest(COALESCE(p_order_ids, ARRAY[]::text[])) AS order_id) AS cleaned
   WHERE trimmed_id IS NOT NULL;
  requested_count := cardinality(target_ids);
  IF requested_count = 0 THEN RAISE EXCEPTION 'At least one order ID is required for deletion.'; END IF;

  SELECT count(*), COALESCE(array_agg(order_number), ARRAY[]::text[]) INTO actual_count, target_numbers
    FROM public.orders WHERE order_id = ANY(target_ids);
  IF actual_count <> requested_count THEN RAISE EXCEPTION 'One or more selected orders no longer exist; no deletion was performed.'; END IF;

  SELECT COALESCE(array_agg(shipment_id::text), ARRAY[]::text[]) INTO shipment_ids
    FROM public.shipments WHERE order_id = ANY(target_ids);
  SELECT COALESCE(array_agg(main_entry_id::text), ARRAY[]::text[]) INTO main_entry_ids
    FROM public.main_entry WHERE order_id = ANY(target_ids);
  SELECT COALESCE(array_agg(account_trans_id::text), ARRAY[]::text[]),
         COALESCE(array_agg(DISTINCT account_id::text), ARRAY[]::text[])
    INTO account_trans_ids, affected_accounts
    FROM public.account_trans
   WHERE order_id = ANY(target_ids) OR shipment_id = ANY(shipment_ids) OR main_entry_id = ANY(main_entry_ids);

  -- 1) أرجل القيود ثم القيود نفسها — payment legs first, then the entries they belong to.
  IF cardinality(main_entry_ids) > 0 THEN
    DELETE FROM public.entry_payment_details WHERE main_entry_id = ANY(main_entry_ids);
  END IF;
  DELETE FROM public.account_trans
    WHERE account_trans_id = ANY(account_trans_ids) OR main_entry_id = ANY(main_entry_ids) OR order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_account_trans = ROW_COUNT;
  DELETE FROM public.main_entry WHERE main_entry_id = ANY(main_entry_ids) OR order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_main_entries = ROW_COUNT;

  -- 2) السجل التاريخي قبل آباء مفاتيحه الأجنبية (shipments ثم orders).
  --    History rows reference shipments and orders, so they go first; orders_history_change cascades.
  DELETE FROM public.orders_history
    WHERE order_id = ANY(target_ids) OR order_number = ANY(target_numbers) OR shipment_id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_orders_history = ROW_COUNT;

  -- 3) الشحنات ومنتجات الطلب — only now are shipments and order items removable.
  DELETE FROM public.shipments WHERE shipment_id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_shipments = ROW_COUNT;
  DELETE FROM public.order_items WHERE order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_order_items = ROW_COUNT;

  -- 4) الطلب نفسه مع كبت مؤرِّق الحذف — the order itself, with the audit trigger suppressed.
  PERFORM set_config('swiftship.suppress_order_delete_history', 'on', true);
  DELETE FROM public.orders WHERE order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_orders = ROW_COUNT;
  PERFORM set_config('swiftship.suppress_order_delete_history', 'off', true);

  IF affected_accounts IS NOT NULL AND cardinality(affected_accounts) > 0 THEN
    PERFORM public.recalculate_accounting_hierarchy(affected_accounts);
  END IF;

  RETURN jsonb_build_object(
    'orderIds', target_ids,
    'orders', deleted_orders,
    'shipments', deleted_shipments,
    'products', deleted_order_items,
    'mainEntries', deleted_main_entries,
    'accountTrans', deleted_account_trans,
    'notifications', 0,
    'whatsappLogs', 0,
    'ordersHistory', deleted_orders_history,
    'activityLogsDeleted', 0);
END;
$function$;

-- إعادة منح التنفيذ لصلاحية التشغيل بعد الاستبدال — re-grant EXECUTE after the replacement.
REVOKE ALL ON FUNCTION public.delete_orders_with_dependents(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_orders_with_dependents(text[]) TO alx_api_runtime;

COMMIT;

-- ========== 0037_sync_order_status_id_from_text.sql ==========
-- 0037_sync_order_status_id_from_text.sql
-- إصلاح تباعد المرحلة: المسارات القديمة كانت تكتب نص الحالة (orders.order_status1) دون تحديث
-- orders.order_status_id، فبقي المعرّف قديمًا وتظهر الواجهة مرحلة لا تطابق ما يراه المشغّل.
-- Stage divergence repair: legacy write paths updated only the status text (orders.order_status1)
-- and never orders.order_status_id, so the stage id went stale while the text stayed current.
-- النص هو المرجح هنا لأنه آخر ما كتبه المشغّل؛ تُعاد تهيئة المعرّف منه فقط.
-- The text is authoritative because it is the operator's most recent write; only the id is re-seeded from it.
-- Date: 2026-10-15

BEGIN;

-- 1) إعادة تهيئة معرّف المرحلة من اسمها العربي المطابق حرفيًا لكتالوج المراحل.
--    Re-seed the stage id from the Arabic catalog name matched exactly (trim-only, no fuzzy match).
UPDATE public.orders AS o
   SET order_status_id = os.order_status_id
  FROM public.order_status AS os
 WHERE btrim(os.name_ar) = btrim(o.order_status1)
   AND o.order_status_id IS DISTINCT FROM os.order_status_id;

-- 2) الاسم الإنجليزي احتياطيًا للصفوف التي لا تحمل اسمًا عربيًا مطابقًا.
--    English names cover rows whose text carries the English label instead of the Arabic one.
UPDATE public.orders AS o
   SET order_status_id = os.order_status_id
  FROM public.order_status AS os
 WHERE btrim(coalesce(os.name_en, '')) <> ''
   AND btrim(os.name_en) = btrim(o.order_status1)
   AND o.order_status_id IS DISTINCT FROM os.order_status_id
   AND NOT EXISTS (
     SELECT 1 FROM public.order_status ar WHERE btrim(ar.name_ar) = btrim(o.order_status1)
   );

-- 3) الحزم القديمة بلا نص حالة تستمد المرحلة من حقل jsonb قبل إسقاطه (0034) —
--    rows with no status text take their stage from the legacy payload before 0034 drops it.
UPDATE public.orders AS o
   SET order_status_id = os.order_status_id
  FROM public.order_status AS os
 WHERE NULLIF(btrim(coalesce(o.order_status1, '')), '') IS NULL
   AND os.order_status_id = NULLIF(btrim(o.data ->> 'orderStatusId'), '')
   AND o.order_status_id IS DISTINCT FROM os.order_status_id;

-- 4) التحقق: لا يجوز أن يبقى نص مرحلة مطابق للكتالوج ومعرّفه يخالفه.
--    Guard: a status text that matches the catalog must never disagree with the stored stage id.
DO $$
DECLARE
  leftover integer;
BEGIN
  SELECT count(*) INTO leftover
    FROM public.orders o
    JOIN public.order_status os ON btrim(os.name_ar) = btrim(o.order_status1)
   WHERE o.order_status_id IS DISTINCT FROM os.order_status_id;
  IF leftover > 0 THEN
    RAISE EXCEPTION 'order_status_id is still inconsistent with order_status1 for % rows', leftover;
  END IF;
END $$;

COMMIT;

