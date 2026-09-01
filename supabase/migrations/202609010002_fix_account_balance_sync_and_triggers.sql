-- =============================================================================
-- Migration 202609010002: إصلاح احتساب الأرصدة التراكمية ومتزامنة الحذف والتعديل
-- 1. تحديث recalculate_accounting_hierarchy لتشمل كافة القيود المعتمدة في account_trans
-- 2. تحسين المشغلات (Triggers) على account_trans و main_entry للعمل التلقائي الفوري عند الإضافة/التعديل/الحذف
-- 3. إضافة وتوفير دالة recalculate_all_account_balances وإعادتها لكافة الحسابات
-- =============================================================================

BEGIN;

-- 1. تحديث دالة احتساب الرصيد للحساب الواحد وتفرعاته
CREATE OR REPLACE FUNCTION public.recalculate_accounting_hierarchy(p_account_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  resolved_sub_id text;
  resolved_main_id text;
  resolved_root_id text;
  normalized_balance numeric;
BEGIN
  IF p_account_id IS NULL OR btrim(p_account_id) = '' THEN
    RETURN;
  END IF;

  SELECT acc_sub_id INTO resolved_sub_id FROM public.accounts WHERE id = p_account_id;
  IF resolved_sub_id IS NULL THEN RETURN; END IF;

  -- حساب صافي رصيد الحركة من أسطر account_trans المعتمدة
  -- يحسب الجمع لكافة أسطر الحركات ذات القيود المعتمدة (أو الحركات المباشرة التي لا تتبع لـ Temp/draft)
  SELECT COALESCE(SUM(CASE WHEN tx.trans_type = 'Debit' THEN tx.amount ELSE -tx.amount END), 0)
  INTO normalized_balance
  FROM public.account_trans tx
  LEFT JOIN public.main_entry entry ON entry.id = tx.entry_id
  WHERE tx.account_id = p_account_id
    AND (
      tx.entry_id IS NULL
      OR (
        COALESCE(entry.posting_status, 'posted') = 'posted'
        AND COALESCE(entry.entry_category, '') <> 'Temp'
      )
    );

  -- تحديث رصيد الحساب المباشر بجدول accounts بحسب طبيعته (Asset/Expense -> مدين، غير ذلك -> دائن)
  UPDATE public.accounts account
  SET balance = CASE
      WHEN account.type IN ('Asset', 'Expense') THEN normalized_balance
      ELSE -normalized_balance
    END,
    "lastRecalculatedAt" = now()
  WHERE account.id = p_account_id;

  SELECT acc_main_id INTO resolved_main_id FROM public.acc_sub WHERE id = resolved_sub_id;
  SELECT account_id INTO resolved_root_id FROM public.acc_main WHERE id = resolved_main_id;

  -- تحديث أرصدة العقد والمجموعات الرئيسية والفرعية لشجرة الحسابات
  UPDATE public.acc_sub_group group_node
  SET balance = COALESCE((
    SELECT SUM(public.accounting_to_system_currency(account.balance, account.cur_no))
    FROM public.accounts account
    WHERE account.group_id = group_node.id
  ), 0)
  WHERE group_node.acc_sub_id = resolved_sub_id;

  UPDATE public.acc_sub sub_node
  SET balance = COALESCE((
    SELECT SUM(public.accounting_to_system_currency(account.balance, account.cur_no))
    FROM public.accounts account
    WHERE account.acc_sub_id = sub_node.id
  ), 0)
  WHERE sub_node.id = resolved_sub_id;

  UPDATE public.acc_main main_node
  SET balance = COALESCE((
    SELECT SUM(public.accounting_to_system_currency(account.balance, account.cur_no))
    FROM public.accounts account
    JOIN public.acc_sub sub_node ON sub_node.id = account.acc_sub_id
    WHERE sub_node.acc_main_id = main_node.id
  ), 0)
  WHERE main_node.id = resolved_main_id;

  UPDATE public.account root_node
  SET balance = COALESCE((
    SELECT SUM(public.accounting_to_system_currency(account.balance, account.cur_no))
    FROM public.accounts account
    JOIN public.acc_sub sub_node ON sub_node.id = account.acc_sub_id
    JOIN public.acc_main main_node ON main_node.id = sub_node.acc_main_id
    WHERE main_node.account_id = root_node.id
  ), 0)
  WHERE root_node.id = resolved_root_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_accounting_hierarchy(text) TO anon, authenticated, service_role, public;

-- 2. دعم مصفوفة الحسابات للإعادة التراكمية
CREATE OR REPLACE FUNCTION public.recalculate_accounting_hierarchy(p_account_ids text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  acc_id text;
BEGIN
  IF p_account_ids IS NULL OR cardinality(p_account_ids) = 0 THEN
    RETURN;
  END IF;

  FOR acc_id IN SELECT DISTINCT unnest(p_account_ids)
  LOOP
    IF acc_id IS NOT NULL AND btrim(acc_id) <> '' THEN
      PERFORM public.recalculate_accounting_hierarchy(acc_id);
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_accounting_hierarchy(text[]) TO anon, authenticated, service_role, public;

-- 3. دالة ومُشغّل التنسيق التلقائي لحسابات الحركة المباشرة (INSERT / UPDATE / DELETE)
CREATE OR REPLACE FUNCTION public.sync_account_balance_after_financial_trans()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_accounting_hierarchy(OLD.account_id);
  ELSE
    PERFORM public.recalculate_accounting_hierarchy(NEW.account_id);
    IF TG_OP = 'UPDATE' AND NEW.account_id IS DISTINCT FROM OLD.account_id THEN
      PERFORM public.recalculate_accounting_hierarchy(OLD.account_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_account_trans_after_balance_sync ON public.account_trans;
CREATE TRIGGER trg_account_trans_after_balance_sync
  AFTER INSERT OR UPDATE OF account_id, amount, trans_type, entry_id OR DELETE ON public.account_trans
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_balance_after_financial_trans();

-- 4. دالة ومُشغّل التنسيق التلقائي عند تغيير حالة القيد أو حذفه من main_entry
CREATE OR REPLACE FUNCTION public.sync_account_balances_after_entry_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  account_record record;
  target_entry_id text := COALESCE(NEW.id, OLD.id);
BEGIN
  IF TG_OP = 'DELETE' OR NEW.posting_status IS DISTINCT FROM OLD.posting_status THEN
    FOR account_record IN SELECT DISTINCT account_id FROM public.account_trans WHERE entry_id = target_entry_id
    LOOP
      PERFORM public.recalculate_accounting_hierarchy(account_record.account_id);
    END LOOP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_main_entry_after_posting_balance_sync ON public.main_entry;
CREATE TRIGGER trg_main_entry_after_posting_balance_sync
  AFTER UPDATE OF posting_status OR DELETE ON public.main_entry
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_balances_after_entry_status_change();

-- 5. إتاحة دالة الشمول لإعادة بناء وتحديث كافة أرصدة الحسابات الـ 87 دفعة واحدة
CREATE OR REPLACE FUNCTION public.recalculate_all_account_balances()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  acc record;
  recalculated_count integer := 0;
BEGIN
  FOR acc IN SELECT id FROM public.accounts LOOP
    PERFORM public.recalculate_accounting_hierarchy(acc.id);
    recalculated_count := recalculated_count + 1;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'recalculatedCount', recalculated_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_all_account_balances() TO anon, authenticated, service_role, public;

-- 6. تشغيل إعادة الحساب الفورية لكافة أرصدة الحسابات بالحصول
SELECT public.recalculate_all_account_balances();

COMMIT;
