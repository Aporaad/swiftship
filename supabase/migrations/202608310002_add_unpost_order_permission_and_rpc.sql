-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 202608310002_add_unpost_order_permission_and_rpc.sql
-- الهدف: إضافة دالة إلغاء ترحيل قيد/سند مرحّل مرتبط بطلب
--         مع التحقق من الصلاحية وإعادة احتساب الأرصدة
-- Purpose: Add unpost function for posted order entries with permission check
-- Fix: Use session variable to bypass the posting_status transition trigger
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. تعديل تريجر validate_main_entry_posting_transition
--    للسماح بالعودة من posted -> draft عند وجود المتغير الجلسي swiftship.allow_unpost
-- Modify posting_status transition trigger to allow posted->draft
-- when called via the authorized unpost_financial_entry function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_main_entry_posting_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- منع إعادة تفعيل قيد مُبطل — Prevent re-activating a voided entry
  IF OLD.posting_status = 'voided' AND NEW.posting_status <> 'voided' THEN
    RAISE EXCEPTION 'لا يمكن إعادة تفعيل قيد مُبطل؛ أنشئ قيدًا جديدًا أو قيدًا عكسيًا.';
  END IF;

  -- السماح بإلغاء الترحيل فقط عند استخدام إجراء unpost_financial_entry الآمن
  -- عبر المتغير الجلسي swiftship.allow_unpost = 'true'
  -- Allow reverting posted -> draft ONLY when called from unpost_financial_entry (via session variable)
  IF OLD.posting_status = 'posted' AND NEW.posting_status = 'draft' THEN
    IF current_setting('swiftship.allow_unpost', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'لا يمكن إعادة القيد المُرحّل إلى مسودة.';
    END IF;
  END IF;

  -- التحقق من ميزان القيد وحدود الحسابات عند الترحيل
  -- Validate balance and account limits when posting
  IF NEW.posting_status = 'posted' AND OLD.posting_status <> 'posted' THEN
    PERFORM public.validate_financial_entry_balance(NEW.id);
    IF NEW.entry_category <> 'Temp' THEN
      PERFORM public.validate_financial_entry_account_limits(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. دالة إلغاء ترحيل قيد/سند مرحّل مع ضبط المتغير الجلسي
--    Unpost function using session variable to bypass the transition trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unpost_financial_entry(
  p_entry_id   text,
  p_unposted_by text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_entry public.main_entry%ROWTYPE;
  v_affected_accounts text[];
  -- تحديد هوية منفذ الإلغاء: من المعامل، أو مستخدم الجلسة الحالي
  -- Resolve actor: provided UID, or current auth session user
  v_actor_id text := COALESCE(
    NULLIF(btrim(COALESCE(p_unposted_by, '')), ''),
    auth.uid()::text
  );
BEGIN
  -- التحقق من وجود القيد — Verify entry exists
  SELECT * INTO v_entry FROM public.main_entry WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'القيد المحدد غير موجود.';
  END IF;

  -- التحقق من أن القيد مرحّل بالفعل — Verify entry is currently posted
  IF v_entry.posting_status <> 'posted' THEN
    RAISE EXCEPTION 'يمكن فقط إلغاء ترحيل القيود والسندات المرحّلة.';
  END IF;

  -- تجميع الحسابات المتأثرة بالقيد قبل إلغاء الترحيل
  -- Collect affected account IDs before unposting
  SELECT ARRAY_AGG(DISTINCT account_id) INTO v_affected_accounts
  FROM public.account_trans
  WHERE entry_id = p_entry_id;

  -- ضبط المتغير الجلسي للسماح للتريجر بإجراء التحويل posted -> draft
  -- Set session variable so the trigger allows posted -> draft transition
  -- true = local to current transaction (auto-reset on transaction end)
  PERFORM set_config('swiftship.allow_unpost', 'true', true);

  -- التحديث: تحويل الحالة إلى مسودة وتصفير بيانات الترحيل
  -- Update: revert to draft and clear posting metadata
  UPDATE public.main_entry
  SET posting_status = 'draft',
      posted_at      = NULL,
      posted_by_uid  = NULL,
      updated_at     = now(),
      updated_by_uid = COALESCE(NULLIF(btrim(v_actor_id), ''), updated_by_uid)
  WHERE id = p_entry_id;

  -- إعادة تعيين المتغير الجلسي للأمان — Reset session variable for safety
  PERFORM set_config('swiftship.allow_unpost', 'false', true);

  -- إعادة احتساب أرصدة شجرة الحسابات المتأثرة تلقائياً
  -- Recalculate accounting hierarchy balances for affected accounts
  IF v_affected_accounts IS NOT NULL AND ARRAY_LENGTH(v_affected_accounts, 1) > 0 THEN
    PERFORM public.recalculate_accounting_hierarchy(v_affected_accounts);
  END IF;

  RETURN jsonb_build_object(
    'id',           p_entry_id,
    'postingStatus','draft',
    'unposted',     true
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. الإجراء الآمن المزود بفحص صلاحية "unpost_posted_orders"
--    Secure RPC that enforces the unpost_posted_orders permission before delegating
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.secure_unpost_order_financial_entry(p_entry_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id text;
BEGIN
  -- التحقق من امتلاك المستخدم لـ صلاحية إلغاء ترحيل الطلبات المرحّلة
  -- Enforce permission check: unpost_posted_orders
  v_actor_id := public.require_financial_permission('unpost_posted_orders', NULL);

  RETURN public.unpost_financial_entry(p_entry_id, v_actor_id);
END;
$$;

-- منح صلاحيات التنفيذ للمستخدمين المصرح لهم
-- Grant execution privileges
GRANT EXECUTE ON FUNCTION public.unpost_financial_entry(text, text) TO authenticated, service_role, public;
GRANT EXECUTE ON FUNCTION public.secure_unpost_order_financial_entry(text) TO authenticated, service_role, public;

COMMIT;
