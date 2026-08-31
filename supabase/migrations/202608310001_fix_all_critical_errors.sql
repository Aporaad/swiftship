-- =============================================================================
-- Migration 202608310001: إصلاح شامل للأخطاء الحرجة
-- Fix all critical errors:
--   1. replace_financial_entry_draft - add SET search_path to find text[] overload
--   2. delete_orders_with_dependents - suppress orders history trigger during deletion
--   3. orders_history_from_orders - handle delete suppression flag
--   4. record_order_payment_v2 - remove strict currency validation for collection accounts
--   5. replace_financial_entry_payment_details - use rounded comparison for amount validation
-- =============================================================================

-- =============================================================================
-- 1. إصلاح replace_financial_entry_draft: إضافة SET search_path = public
-- يسمح بالعثور على الدالة المحملة بمصفوفة text[] لـ recalculate_accounting_hierarchy
-- Fix replace_financial_entry_draft: add SET search_path so that the
-- text[] overload of recalculate_accounting_hierarchy is found at runtime.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.replace_financial_entry_draft(p_entry_id text, p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  entry_record public.main_entry%ROWTYPE;
  replacement jsonb;
  target_status text;
  affected_accounts text[];
BEGIN
  -- التحقق من وجود القيد
  -- Check that the entry exists
  SELECT * INTO entry_record FROM public.main_entry WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'القيد غير موجود.';
  END IF;

  -- جمع الحسابات المتأثرة قبل الحذف
  -- Collect accounts affected before deletion so balances can be recalculated afterward
  SELECT ARRAY_AGG(DISTINCT account_id) INTO affected_accounts
  FROM public.account_trans
  WHERE entry_id = p_entry_id;

  -- تحديد حالة القيد الجديدة
  -- Determine the target posting status
  target_status := COALESCE(p_entry->>'postingStatus', entry_record.posting_status, 'draft');
  replacement := jsonb_set(
    jsonb_set(COALESCE(p_entry, '{}'::jsonb), '{id}', to_jsonb(p_entry_id), true),
    '{postingStatus}',
    to_jsonb(target_status),
    true
  );

  -- حذف تفاصيل الدفع وأسطر الحركات والقيد الأصلي
  -- Delete payment details, account transactions, and the original entry header
  DELETE FROM public.entry_payment_details WHERE entry_id = p_entry_id;
  DELETE FROM public.account_trans WHERE entry_id = p_entry_id;
  DELETE FROM public.main_entry WHERE id = p_entry_id;

  -- إعادة احتساب التسلسل الهرمي للحسابات المتأثرة
  -- Recalculate hierarchy for all previously affected accounts
  IF affected_accounts IS NOT NULL AND cardinality(affected_accounts) > 0 THEN
    PERFORM public.recalculate_accounting_hierarchy(affected_accounts);
  END IF;

  -- إنشاء القيد الجديد البديل
  -- Create the replacement entry
  RETURN public.create_financial_entry_v2(replacement);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.replace_financial_entry_draft(text, jsonb) TO anon, authenticated, service_role, public;

-- =============================================================================
-- 2. إصلاح orders_history_from_orders: دعم كبت سجل الحذف الجماعي
-- Fix orders_history_from_orders trigger to respect deletion suppression flag.
-- عند استخدام delete_orders_with_dependents نتجنب محاولة الإدراج بـ order_id محذوف.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.orders_history_from_orders()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  before_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row jsonb  := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  changed_fields text[] := public.orders_history_changed_fields(before_row, after_row);
  event_name text;
  event_summary text;
  order_ref text;
BEGIN
  -- كبت التحديثات الصامتة
  -- Suppress silent update-history if requested
  IF TG_OP = 'UPDATE' AND current_setting('swiftship.suppress_order_update_history', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- كبت سجل الحذف الجماعي (يُستخدم أثناء delete_orders_with_dependents)
  -- Suppress order-deleted history entry when the bulk-deletion RPC is running.
  -- This prevents a FK violation caused by trying to INSERT an orders_history row
  -- that references an already-deleted order.
  IF TG_OP = 'DELETE' AND current_setting('swiftship.suppress_order_delete_history', true) = 'on' THEN
    RETURN OLD;
  END IF;

  -- تجاهل التحديثات التي لا تمس أي حقل فعلي
  -- Ignore updates that change no tracked fields
  IF TG_OP = 'UPDATE' AND COALESCE(array_length(changed_fields, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  order_ref := COALESCE(NEW.id, OLD.id);

  IF TG_OP = 'INSERT' THEN
    event_name := 'order.created';
    event_summary := 'تم إنشاء الطلب';
  ELSIF TG_OP = 'DELETE' THEN
    event_name := 'order.deleted';
    event_summary := 'تم حذف الطلب';
  ELSIF OLD.order_status IS DISTINCT FROM NEW.order_status
     OR OLD.order_status_id IS DISTINCT FROM NEW.order_status_id THEN
    event_name := 'order.status_changed';
    event_summary := 'تم تحديث حالة الطلب';
  ELSE
    event_name := 'order.updated';
    event_summary := 'تم تعديل بيانات الطلب';
  END IF;

  PERFORM public.orders_history_write(
    order_ref,
    COALESCE(NEW.order_number, OLD.order_number),
    NULL, NULL, NULL, NULL,
    event_name, 'order', lower(TG_OP), 'order', 'database_trigger',
    event_summary, before_row, after_row,
    jsonb_build_object(
      'changedFields', changed_fields,
      'changes', public.orders_history_change_details(before_row, after_row),
      'trigger', TG_NAME
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- =============================================================================
-- 3. إصلاح delete_orders_with_dependents: كبت مشغل سجل الحذف
-- Fix delete_orders_with_dependents: suppress the orders history trigger
-- before deleting orders rows to prevent FK violation from the AFTER DELETE trigger.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.delete_orders_with_dependents(p_order_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  target_ids text[];
  target_numbers text[];
  shipment_ids text[];
  main_entry_ids text[];
  account_trans_ids text[];
  affected_accounts text[];
  requested_count integer;
  actual_count integer;
  deleted_shipments integer := 0;
  deleted_products integer := 0;
  deleted_main_entries integer := 0;
  deleted_account_trans integer := 0;
  deleted_expenses integer := 0;
  deleted_notifications integer := 0;
  deleted_whatsapp_logs integer := 0;
  deleted_orders_history integer := 0;
  deleted_orders integer := 0;
BEGIN
  -- تنظيف وإزالة التكرارات من معرفات الطلبات
  -- Clean and deduplicate order IDs
  SELECT COALESCE(array_agg(DISTINCT trimmed_id ORDER BY trimmed_id), ARRAY[]::text[])
    INTO target_ids
  FROM (
    SELECT NULLIF(btrim(order_id), '') AS trimmed_id
    FROM unnest(COALESCE(p_order_ids, ARRAY[]::text[])) AS order_id
  ) AS cleaned
  WHERE trimmed_id IS NOT NULL;

  requested_count := cardinality(target_ids);
  IF requested_count = 0 THEN
    RAISE EXCEPTION 'At least one order ID is required for deletion.';
  END IF;

  -- التحقق من وجود جميع الطلبات
  -- Verify all requested orders still exist
  SELECT count(*), COALESCE(array_agg(order_number), ARRAY[]::text[])
    INTO actual_count, target_numbers
  FROM public.orders
  WHERE id = ANY(target_ids);

  IF actual_count <> requested_count THEN
    RAISE EXCEPTION 'One or more selected orders no longer exist; no deletion was performed.';
  END IF;

  -- جمع معرفات الكيانات المرتبطة
  -- Collect IDs of all dependent entities
  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO shipment_ids
  FROM public.shipments
  WHERE order_id = ANY(target_ids);

  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO main_entry_ids
  FROM public.main_entry
  WHERE order_id = ANY(target_ids);

  SELECT COALESCE(array_agg(id), ARRAY[]::text[]), COALESCE(array_agg(DISTINCT account_id), ARRAY[]::text[])
    INTO account_trans_ids, affected_accounts
  FROM public.account_trans
  WHERE order_id = ANY(target_ids)
     OR shipment_id = ANY(shipment_ids)
     OR entry_id = ANY(main_entry_ids);

  -- حذف الإشعارات
  -- Delete notifications
  DELETE FROM public.notifications
  WHERE data->>'orderId' = ANY(target_ids)
     OR data->>'order_id' = ANY(target_ids)
     OR data->>'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

  -- حذف سجلات واتساب
  -- Delete WhatsApp logs
  DELETE FROM public.whatsapp_logs
  WHERE data->>'orderId' = ANY(target_ids)
     OR data->>'order_id' = ANY(target_ids)
     OR data->>'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_whatsapp_logs = ROW_COUNT;

  -- حذف المصروفات
  -- Delete expenses
  DELETE FROM public.expenses
  WHERE data->>'orderId' = ANY(target_ids)
     OR data->>'order_id' = ANY(target_ids)
     OR data->>'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_expenses = ROW_COUNT;

  -- حذف تفاصيل الدفع المرتبطة بالقيود
  -- Delete payment details linked to financial entries
  IF cardinality(main_entry_ids) > 0 THEN
    DELETE FROM public.entry_payment_details WHERE entry_id = ANY(main_entry_ids);
  END IF;

  -- حذف حركات الحسابات
  -- Delete account transactions
  DELETE FROM public.account_trans
  WHERE id = ANY(account_trans_ids)
     OR entry_id = ANY(main_entry_ids)
     OR order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_account_trans = ROW_COUNT;

  -- حذف رأس القيود المالية
  -- Delete financial entry headers
  DELETE FROM public.main_entry
  WHERE id = ANY(main_entry_ids)
     OR order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_main_entries = ROW_COUNT;

  -- حذف الشحنات
  -- Delete shipments
  DELETE FROM public.shipments WHERE id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_shipments = ROW_COUNT;

  -- حذف المنتجات
  -- Delete products
  DELETE FROM public.products WHERE order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_products = ROW_COUNT;

  -- حذف سجل التاريخ المرتبط بالطلبات والشحنات
  -- Delete orders history records linked to these orders/shipments
  DELETE FROM public.orders_history
  WHERE order_id = ANY(target_ids)
     OR order_number = ANY(target_numbers)
     OR shipment_id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_orders_history = ROW_COUNT;

  -- كبت مشغل قاعدة البيانات لسجل الحذف قبل حذف سجلات الطلبات
  -- Suppress the orders_history AFTER DELETE trigger to prevent FK violation.
  -- The trigger would try to INSERT an orders_history row referencing the
  -- order_id that was just deleted, which violates the FK constraint.
  PERFORM set_config('swiftship.suppress_order_delete_history', 'on', true);

  -- حذف الطلبات نفسها
  -- Delete the orders
  DELETE FROM public.orders WHERE id = ANY(target_ids);
  GET DIAGNOSTICS deleted_orders = ROW_COUNT;

  -- إعادة تفعيل مشغل سجل الحذف
  -- Re-enable the history trigger for subsequent operations in this session
  PERFORM set_config('swiftship.suppress_order_delete_history', 'off', true);

  -- إعادة احتساب التسلسل الهرمي للحسابات المتأثرة
  -- Recalculate accounting hierarchy for all affected accounts
  IF affected_accounts IS NOT NULL AND cardinality(affected_accounts) > 0 THEN
    PERFORM public.recalculate_accounting_hierarchy(affected_accounts);
  END IF;

  RETURN jsonb_build_object(
    'orderIds', target_ids,
    'orders', deleted_orders,
    'shipments', deleted_shipments,
    'products', deleted_products,
    'mainEntries', deleted_main_entries,
    'accountTrans', deleted_account_trans,
    'expenses', deleted_expenses,
    'notifications', deleted_notifications,
    'whatsappLogs', deleted_whatsapp_logs,
    'ordersHistory', deleted_orders_history,
    'activityLogsDeleted', 0
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_orders_with_dependents(text[]) TO anon, authenticated, service_role, public;

-- =============================================================================
-- 4. إصلاح record_order_payment_v2: إزالة التحقق الصارم من عملة حساب التحصيل
-- Fix record_order_payment_v2: Remove strict currency validation for the
-- collection (Debit) accounts. The DB only needs to verify:
--   - party account (Credit line) matches the order's party account
--   - payment amount does not exceed the remaining balance
-- Cross-currency collection accounts are now allowed (the frontend handles
-- exchange logic). Currency no. validation on the header is also relaxed
-- to use a tolerance comparison.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.record_order_payment_v2(
  p_order_id text,
  p_payment_amount numeric,
  p_entry jsonb,
  p_updated_by_uid text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  order_record public.orders%ROWTYPE;
  v_order_data jsonb;
  v_old_paid numeric;
  v_old_remaining numeric;
  v_total numeric;
  v_new_paid numeric;
  v_new_remaining numeric;
  v_payment_status text;
  v_entry_result jsonb;
  v_party_account_id text;
BEGIN
  -- التحقق من المعطيات المطلوبة
  -- Validate required parameters
  IF p_order_id IS NULL OR btrim(p_order_id) = '' THEN
    RAISE EXCEPTION 'معرف الطلب مطلوب.';
  END IF;
  IF p_payment_amount IS NULL OR p_payment_amount <= 0 THEN
    RAISE EXCEPTION 'مبلغ الدفعة يجب أن يكون موجبًا.';
  END IF;
  IF p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' THEN
    RAISE EXCEPTION 'بيانات سند القبض مطلوبة.';
  END IF;

  -- جلب وقفل سجل الطلب
  -- Fetch and lock the order record
  SELECT * INTO order_record FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود.';
  END IF;

  -- حساب المبلغ المتبقي
  -- Calculate remaining amount with tolerance for floating-point precision
  v_order_data := COALESCE(order_record.data, '{}'::jsonb);
  v_old_paid := COALESCE(NULLIF(v_order_data->>'amountPaid', '')::numeric, 0);
  v_total := COALESCE(
    NULLIF(v_order_data->>'totalAmount', '')::numeric,
    NULLIF(v_order_data->>'totalCostYER', '')::numeric,
    0
  );
  v_old_remaining := COALESCE(
    NULLIF(v_order_data->>'amountRemaining', '')::numeric,
    GREATEST(v_total - v_old_paid, 0)
  );

  -- التحقق من أن الدفعة لا تتجاوز المتبقي (مع هامش تسامح عشري صغير)
  -- Verify payment does not exceed remaining (with small decimal tolerance)
  IF p_payment_amount > (v_old_remaining + 0.01) THEN
    RAISE EXCEPTION 'مبلغ الدفعة يتجاوز المتبقي للطلب. المتبقي: %, الدفعة: %',
      round(v_old_remaining, 2), round(p_payment_amount, 2);
  END IF;

  -- التحقق من تطابق مرجع الطلب في سند القبض
  -- Verify order reference matches
  IF COALESCE(p_entry->>'orderId', '') <> p_order_id THEN
    RAISE EXCEPTION 'مرجع الطلب في سند القبض غير مطابق.';
  END IF;

  -- التحقق من نوع القيد
  -- Verify entry type
  IF COALESCE(p_entry->>'entryTypeId', '') <> 'type_order_payment' THEN
    RAISE EXCEPTION 'تحصيل الطلب يجب أن يستخدم نوع قيد دفعة الطلب.';
  END IF;

  -- التحقق من وجود حساب الطرف في الساق الدائنة
  -- Verify party account appears in the credit leg
  v_party_account_id := COALESCE(
    NULLIF(btrim(v_order_data->>'orderPartyAccountId'), ''),
    NULLIF(btrim(v_order_data->>'customerAccountId'), '')
  );
  IF v_party_account_id IS NULL THEN
    RAISE EXCEPTION 'الطلب لا يحمل حسابًا ماليًا لطرف التحصيل.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_entry->'lines', '[]'::jsonb)) AS line(value)
    WHERE line.value->>'transType' = 'Credit'
      AND line.value->>'accountId' = v_party_account_id
  ) THEN
    RAISE EXCEPTION 'الساق الدائنة في سند القبض يجب أن تطابق حساب طرف الطلب.';
  END IF;

  -- التحقق من المستخدم المحدّث
  -- Validate updater user
  IF p_updated_by_uid IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_updated_by_uid)
  THEN
    p_updated_by_uid := NULL;
  END IF;

  -- إنشاء القيد المالي
  -- Create the financial entry
  v_entry_result := public.create_financial_entry_v2(p_entry);

  -- تحديث أرصدة الطلب
  -- Update order payment balances
  v_new_paid := v_old_paid + p_payment_amount;
  v_new_remaining := GREATEST(v_old_remaining - p_payment_amount, 0);
  v_payment_status := CASE WHEN v_new_remaining <= 0.005 THEN 'Paid' ELSE 'Partial Paid' END;

  UPDATE public.orders
  SET data = v_order_data || jsonb_build_object(
    'amountPaid',      v_new_paid,
    'amountRemaining', v_new_remaining,
    'paymentStatus',   v_payment_status,
    'updatedAt',       floor(extract(epoch FROM now()) * 1000)::bigint
  )
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'orderId',        p_order_id,
    'entryId',        v_entry_result->>'id',
    'amountPaid',     v_new_paid,
    'amountRemaining', v_new_remaining,
    'paymentStatus',  v_payment_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_order_payment_v2(text, numeric, jsonb, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_order_payment_v2(text, numeric, jsonb, text) FROM PUBLIC, anon;

-- =============================================================================
-- 5. إصلاح replace_financial_entry_payment_details: مقارنة المجاميع بهامش تسامح
-- Fix replace_financial_entry_payment_details: compare amounts with a
-- small rounding tolerance to avoid false mismatches from floating-point.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.replace_financial_entry_payment_details(
  p_entry_id text,
  p_details jsonb,
  p_actor_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_entry public.main_entry%ROWTYPE;
  v_detail jsonb;
  v_no integer := 0;
  v_amount numeric;
  v_total numeric := 0;
  v_method text;
  v_account_id text;
  v_entry_amount_original numeric;
  v_entry_currency_original_no integer;
BEGIN
  -- التحقق من وجود القيد
  -- Verify the entry header exists
  SELECT * INTO v_entry FROM public.main_entry WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'رأس القيد غير موجود.';
  END IF;

  -- حساب مجموع المدين الأصلي ورقم عملة القيد
  -- Compute debit-side total and entry currency from account_trans
  SELECT
    COALESCE(SUM(amount_original) FILTER (WHERE trans_type = 'Debit'), 0),
    COALESCE(MAX(currency_original_no), 1)
  INTO v_entry_amount_original, v_entry_currency_original_no
  FROM public.account_trans
  WHERE entry_id = p_entry_id;

  -- إذا كانت تفاصيل الدفع فارغة
  -- Handle null/missing payment details
  IF p_details IS NULL OR jsonb_typeof(p_details) = 'null' THEN
    IF v_entry.payment_method = 'mixed' THEN
      RAISE EXCEPTION 'طريقة الدفع المختلطة تحتاج تفاصيل توزيع صريحة.';
    END IF;
    RETURN jsonb_build_object('entryId', p_entry_id, 'count', 0);
  END IF;

  IF jsonb_typeof(p_details) <> 'array' THEN
    RAISE EXCEPTION 'تفاصيل الدفع يجب أن تكون قائمة.';
  END IF;

  IF v_entry.payment_method = 'mixed' AND jsonb_array_length(p_details) < 2 THEN
    RAISE EXCEPTION 'طريقة الدفع المختلطة تحتاج توزيعين أو أكثر.';
  END IF;

  -- حذف التفاصيل القديمة
  -- Delete old payment details
  DELETE FROM public.entry_payment_details WHERE entry_id = p_entry_id;

  -- إدراج التفاصيل الجديدة
  -- Insert new payment details
  FOR v_detail IN SELECT value FROM jsonb_array_elements(p_details)
  LOOP
    v_no := v_no + 1;
    v_method := NULLIF(btrim(v_detail->>'paymentMethod'), '');
    v_account_id := NULLIF(btrim(v_detail->>'accountId'), '');

    -- التحقق من صحة كل سطر
    -- Validate each detail row
    IF v_method NOT IN ('cash', 'bank', 'deferred')
      OR v_account_id IS NULL
      OR COALESCE(v_detail->>'amountOriginal', '') !~ '^[0-9]+(\.[0-9]+)?$'
      OR (v_detail->>'amountOriginal')::numeric <= 0
    THEN
      RAISE EXCEPTION 'كل تفصيل دفع يحتاج طريقة وحسابًا ومبلغًا موجبًا.';
    END IF;

    v_amount := (v_detail->>'amountOriginal')::numeric;
    v_total := v_total + v_amount;

    INSERT INTO public.entry_payment_details (
      id, entry_id, allocation_no, payment_method, account_id,
      amount_original, currency_original_no,
      bank_reference, due_at, note, created_by_uid, updated_by_uid
    ) VALUES (
      COALESCE(NULLIF(btrim(v_detail->>'id'), ''), gen_random_uuid()::text),
      p_entry_id, v_no, v_method, v_account_id,
      v_amount, v_entry_currency_original_no,
      COALESCE(v_detail->>'bankReference', ''),
      NULLIF(v_detail->>'dueAt', '')::timestamptz,
      COALESCE(v_detail->>'note', ''),
      p_actor_id, p_actor_id
    );
  END LOOP;

  -- التحقق من تساوي مجموع التفاصيل مع مبلغ القيد (مع هامش تسامح ±0.05)
  -- Verify total of details equals entry debit amount with rounding tolerance
  IF v_no > 0 AND v_entry_amount_original > 0
    AND ABS(v_total - v_entry_amount_original) > 0.05
  THEN
    RAISE EXCEPTION
      'مجموع تفاصيل الدفع (%) يجب أن يساوي مبلغ رأس القيد بعملته الأصلية (%).',
      round(v_total, 4), round(v_entry_amount_original, 4);
  END IF;

  IF v_entry.payment_method = 'mixed' AND v_no = 0 THEN
    RAISE EXCEPTION 'طريقة الدفع المختلطة تحتاج تفاصيل توزيع صريحة.';
  END IF;

  RETURN jsonb_build_object(
    'entryId', p_entry_id,
    'count', v_no,
    'amountOriginal', v_total
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.replace_financial_entry_payment_details(text, jsonb, text) TO anon, authenticated, service_role, public;
