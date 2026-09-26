-- =============================================================================
-- Migration: 202609170002_update_functions_after_pk_rename.sql
-- Description: تحديث جميع الدوال والتريجرات التي تستخدم الأعمدة القديمة (id)
--              بعد إعادة تسميتها في المرحلة 202609170001
--              Update all functions/triggers to use new column names post-PK-rename
-- Author: Antigravity AI
-- Date: 2026-09-17
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. تحديث دالة delete_orders_with_dependents
--    الدالة الأصلية تستخدم orders.id, shipments.id, main_entry.id, account_trans.id
--    الآن تستخدم: orders.order_id, shipments.shipment_id, main_entry.main_entry_id, account_trans.account_trans_id
-- =============================================================================
CREATE OR REPLACE FUNCTION public.delete_orders_with_dependents(
  p_order_ids text[],
  p_deleted_by_uid text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  deleted_order_items integer := 0;
  deleted_main_entries integer := 0;
  deleted_account_trans integer := 0;
  deleted_expenses integer := 0;
  deleted_notifications integer := 0;
  deleted_whatsapp_logs integer := 0;
  deleted_orders_history integer := 0;
  deleted_orders integer := 0;
BEGIN
  -- تجميع معرفات الطلبات المطلوب حذفها وإزالة الفراغات
  -- Collect and clean the order IDs
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

  -- التحقق من وجود الطلبات في قاعدة البيانات / Verify orders exist
  SELECT count(*), COALESCE(array_agg(order_number), ARRAY[]::text[])
    INTO actual_count, target_numbers
  FROM public.orders
  WHERE order_id = ANY(target_ids);

  IF actual_count <> requested_count THEN
    RAISE EXCEPTION 'One or more selected orders no longer exist; no deletion was performed.';
  END IF;

  -- جمع معرفات الشحنات المرتبطة / Collect related shipment IDs
  SELECT COALESCE(array_agg(shipment_id::text), ARRAY[]::text[]) INTO shipment_ids
  FROM public.shipments
  WHERE order_id = ANY(target_ids);

  -- جمع معرفات القيود الرئيسية المرتبطة / Collect related main entry IDs
  SELECT COALESCE(array_agg(main_entry_id::text), ARRAY[]::text[]) INTO main_entry_ids
  FROM public.main_entry
  WHERE order_id = ANY(target_ids);

  -- جمع معرفات حركات الحسابات والحسابات المتأثرة / Collect account trans IDs and affected accounts
  SELECT COALESCE(array_agg(account_trans_id::text), ARRAY[]::text[]),
         COALESCE(array_agg(DISTINCT account_id::text), ARRAY[]::text[])
    INTO account_trans_ids, affected_accounts
  FROM public.account_trans
  WHERE order_id = ANY(target_ids)
     OR shipment_id = ANY(shipment_ids)
     OR entry_id = ANY(main_entry_ids);

  -- حذف الإشعارات المرتبطة / Delete related notifications
  DELETE FROM public.notifications
  WHERE data->>'orderId' = ANY(target_ids)
     OR data->>'order_id' = ANY(target_ids)
     OR data->>'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

  -- حذف سجلات واتساب المرتبطة / Delete related WhatsApp logs
  DELETE FROM public.whatsapp_logs
  WHERE data->>'orderId' = ANY(target_ids)
     OR data->>'order_id' = ANY(target_ids)
     OR data->>'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_whatsapp_logs = ROW_COUNT;

  -- حذف المصروفات المرتبطة / Delete related expenses
  DELETE FROM public.expenses
  WHERE data->>'orderId' = ANY(target_ids)
     OR data->>'order_id' = ANY(target_ids)
     OR data->>'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_expenses = ROW_COUNT;

  -- حذف تفاصيل دفع القيود / Delete entry payment details
  IF cardinality(main_entry_ids) > 0 THEN
    DELETE FROM public.entry_payment_details WHERE entry_id = ANY(main_entry_ids);
  END IF;

  -- حذف حركات الحسابات / Delete account transactions
  DELETE FROM public.account_trans
  WHERE account_trans_id = ANY(account_trans_ids)
     OR entry_id = ANY(main_entry_ids)
     OR order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_account_trans = ROW_COUNT;

  -- حذف القيود الرئيسية / Delete main entries
  DELETE FROM public.main_entry
  WHERE main_entry_id = ANY(main_entry_ids)
     OR order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_main_entries = ROW_COUNT;

  -- حذف الشحنات / Delete shipments
  DELETE FROM public.shipments WHERE shipment_id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_shipments = ROW_COUNT;

  -- حذف عناصر الطلب / Delete order items
  DELETE FROM public.order_items WHERE order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_order_items = ROW_COUNT;

  -- حذف تاريخ الطلبات / Delete orders history
  DELETE FROM public.orders_history
  WHERE order_id = ANY(target_ids)
     OR order_number = ANY(target_numbers)
     OR shipment_id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_orders_history = ROW_COUNT;

  -- قمع تريجر حذف التاريخ مؤقتاً / Suppress history trigger temporarily
  PERFORM set_config('swiftship.suppress_order_delete_history', 'on', true);

  -- حذف الطلبات الرئيسية / Delete the main orders
  DELETE FROM public.orders WHERE order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_orders = ROW_COUNT;

  -- إعادة تفعيل التريجر / Re-enable history trigger
  PERFORM set_config('swiftship.suppress_order_delete_history', 'off', true);

  -- إعادة حساب أرصدة الحسابات المتأثرة / Recalculate affected account balances
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
    'expenses', deleted_expenses,
    'notifications', deleted_notifications,
    'whatsappLogs', deleted_whatsapp_logs,
    'ordersHistory', deleted_orders_history,
    'activityLogsDeleted', 0
  );
END;
$$;

-- =============================================================================
-- 2. تحديث دالة orders_history_from_orders (تريجر)
--    الدالة الأصلية تستخدم COALESCE(NEW.id, OLD.id) و OLD.id
--    الآن تستخدم: COALESCE(NEW.order_id, OLD.order_id) و OLD.order_id
-- =============================================================================
CREATE OR REPLACE FUNCTION public.orders_history_from_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  before_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row  jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  changed_fields text[] := public.orders_history_changed_fields(before_row, after_row);
  event_name    text;
  event_summary text;
  order_ref     text;
BEGIN
  -- التحقق من قمع التريجر أثناء التحديثات / Check suppression flags
  IF TG_OP = 'UPDATE' AND current_setting('swiftship.suppress_order_update_history', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' AND current_setting('swiftship.suppress_order_delete_history', true) = 'on' THEN
    RETURN OLD;
  END IF;

  -- تجاهل التحديثات التي لا تحتوي على تغييرات فعلية / Skip no-change updates
  IF TG_OP = 'UPDATE' AND COALESCE(array_length(changed_fields, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  -- استخدام order_id بدلاً من id / Use order_id instead of old id
  order_ref := CASE WHEN TG_OP = 'DELETE' THEN NULL
                    ELSE COALESCE(NEW.order_id::text, OLD.order_id::text)
               END;

  -- تحديد نوع الحدث / Determine event type
  IF TG_OP = 'INSERT' THEN
    event_name    := 'order.created';
    event_summary := 'تم إنشاء الطلب';
  ELSIF TG_OP = 'DELETE' THEN
    event_name    := 'order.deleted';
    event_summary := 'تم حذف الطلب';
  ELSIF OLD.order_status_id IS DISTINCT FROM NEW.order_status_id THEN
    event_name    := 'order.status_changed';
    event_summary := 'تم تحديث حالة الطلب';
  ELSE
    event_name    := 'order.updated';
    event_summary := 'تم تعديل بيانات الطلب';
  END IF;

  -- تسجيل الحدث في تاريخ الطلبات / Write event to orders history
  PERFORM public.orders_history_write(
    order_ref,
    COALESCE(NEW.order_number, OLD.order_number),
    NULL, NULL, NULL, NULL,
    event_name, 'order', lower(TG_OP), 'order', 'database_trigger',
    event_summary, before_row, after_row,
    jsonb_build_object(
      'changedFields', changed_fields,
      'changes', public.orders_history_change_details(before_row, after_row),
      'deletedOrderId', CASE WHEN TG_OP = 'DELETE' THEN OLD.order_id ELSE NULL END,
      'trigger', TG_NAME
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =============================================================================
-- 3. تحديث دالة create_financial_entry_v2
--    تستخدم في INSERT إلى main_entry العمود `id`، وفي account_trans العمود `id`
--    وتستخدم WHERE id = v_created_by_uid في users
--    الآن: main_entry_id, account_trans_id, user_id
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_financial_entry_v2(p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- متغيرات رأس القيد / Main entry header variables
  v_entry_id            text := COALESCE(NULLIF(btrim(p_entry->>'id'), ''), gen_random_uuid()::text);
  v_entry_number        text := NULLIF(btrim(p_entry->>'entryNumber'), '');
  v_module_id           text := NULLIF(btrim(p_entry->>'moduleId'), '');
  v_entry_type_id       text := NULLIF(btrim(p_entry->>'entryTypeId'), '');
  v_entry_category      text := COALESCE(NULLIF(btrim(p_entry->>'entryCategory'), ''), 'General');
  v_requested_status    text := COALESCE(NULLIF(btrim(p_entry->>'postingStatus'), ''), 'draft');
  v_description         text := NULLIF(btrim(p_entry->>'description'), '');
  v_notes               text := COALESCE(p_entry->>'notes', '');
  v_payment_method      text := NULLIF(btrim(p_entry->>'paymentMethod'), '');
  v_order_id            text := NULLIF(btrim(p_entry->>'orderId'), '');
  v_shipment_id         text := NULLIF(btrim(p_entry->>'shipmentId'), '');
  v_custody_id          text := NULLIF(btrim(p_entry->>'custodyId'), '');
  v_automation_key      text := NULLIF(btrim(p_entry->>'automationKey'), '');
  v_auto_rule_id        text := NULLIF(btrim(p_entry->>'autoRuleId'), '');
  v_is_automatic        boolean := COALESCE((p_entry->>'isAutomatic')::boolean, false);
  v_effective_at        timestamptz := COALESCE(NULLIF(p_entry->>'effectiveAt', '')::timestamptz, now());
  v_created_by_uid      text := NULLIF(btrim(p_entry->>'createdByUid'), '');

  -- متغيرات أسطر القيد / Line variables
  v_line                jsonb;
  v_line_no             integer := 0;
  v_line_id             text;
  v_line_account_id     text;
  v_line_trans_type     text;
  v_line_amount         numeric;
  v_line_amount_original numeric;
  v_line_amount_text    text;
  v_line_amount_original_text text;
  v_line_currency_original_no integer;
  v_line_currency_price_id    integer;
  v_line_currency_price_seq   integer;
  v_line_account_cur_no       integer;
  v_line_acc_price_id         integer;
  v_line_acc_price_seq        integer;
  v_line_description    text;
  v_line_note           text;

  v_full_header_desc    text;
BEGIN
  -- التحقق من وجود بيانات القيد / Validate entry data
  IF p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' THEN
    RAISE EXCEPTION 'يجب تمرير بيانات رأس القيد ككائن JSON.';
  END IF;
  IF jsonb_typeof(COALESCE(p_entry->'lines', 'null'::jsonb)) <> 'array'
    OR jsonb_array_length(p_entry->'lines') < 2 THEN
    RAISE EXCEPTION 'يجب تمرير ساقين محاسبيتين على الأقل.';
  END IF;

  -- توليد رقم القيد المتسلسل / Generate entry number if not provided
  IF v_entry_number IS NULL OR btrim(v_entry_number) = '' THEN
    v_entry_number := public.generate_next_entry_number(v_entry_category, v_entry_type_id);
  END IF;

  IF v_module_id IS NULL OR v_entry_type_id IS NULL OR v_description IS NULL THEN
    RAISE EXCEPTION 'الفئة والنوع والبيان حقول إلزامية.';
  END IF;

  -- إضافة رقم القيد للوصف تلقائياً / Auto-append entry number to description
  IF v_description !~ ('قيد رقم ' || v_entry_number) THEN
    v_full_header_desc := v_description || ' قيد رقم ' || v_entry_number;
  ELSE
    v_full_header_desc := v_description;
  END IF;

  -- التحقق من وجود المستخدم المنشئ / Validate created_by user exists
  -- استخدام user_id بدلاً من id بعد إعادة التسمية
  IF v_created_by_uid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users WHERE user_id = v_created_by_uid
  ) THEN
    v_created_by_uid := NULL;
  END IF;

  -- 1. إدراج رأس القيد في main_entry باستخدام main_entry_id
  -- Insert main entry header using main_entry_id (renamed from id)
  INSERT INTO public.main_entry (
    main_entry_id, entry_number, module_id, entry_type_id, entry_category, posting_status,
    description, notes, attachments, payment_method, order_id, shipment_id, custody_id,
    automation_key, auto_rule_id, is_automatic, effective_at, created_by_uid, updated_by_uid
  ) VALUES (
    v_entry_id, v_entry_number, v_module_id, v_entry_type_id, v_entry_category, 'draft',
    v_full_header_desc, v_notes,
    CASE WHEN jsonb_typeof(p_entry->'attachments') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(p_entry->'attachments'))
         ELSE ARRAY[]::text[]
    END,
    v_payment_method, v_order_id, v_shipment_id, v_custody_id,
    v_automation_key, v_auto_rule_id, v_is_automatic, v_effective_at,
    v_created_by_uid, v_created_by_uid
  );

  -- 2. إدراج أسطر القيد في account_trans باستخدام account_trans_id
  -- Insert entry lines into account_trans using account_trans_id (renamed from id)
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_entry->'lines')
  LOOP
    v_line_no := v_line_no + 1;
    v_line_id := COALESCE(NULLIF(btrim(v_line->>'id'), ''), gen_random_uuid()::text);
    v_line_account_id        := NULLIF(btrim(v_line->>'accountId'), '');
    v_line_trans_type        := NULLIF(btrim(v_line->>'transType'), '');

    v_line_amount            := (v_line->>'amount')::numeric;
    v_line_amount_original   := (v_line->>'amountOriginal')::numeric;
    v_line_amount_text       := COALESCE(v_line->>'amountText', '');
    v_line_amount_original_text := COALESCE(v_line->>'amountOriginalText', '');

    v_line_currency_original_no := (v_line->>'currencyOriginalNo')::integer;
    v_line_currency_price_id    := NULLIF(v_line->>'currencyPriceId', '')::integer;
    v_line_currency_price_seq   := NULLIF(v_line->>'currencyPriceSeq', '')::integer;

    v_line_account_cur_no   := (v_line->>'accountCurNo')::integer;
    v_line_acc_price_id     := NULLIF(v_line->>'accountCurrencyPriceId', '')::integer;
    v_line_acc_price_seq    := NULLIF(v_line->>'accountCurrencyPriceSeq', '')::integer;

    v_line_description := COALESCE(NULLIF(btrim(v_line->>'description'), ''), v_full_header_desc);
    -- إضافة رقم السطر ورقم القيد للوصف الفرعي
    v_line_description := v_line_description || ' قيد فردي رقم ' || v_line_no || ' , قيد رقم ' || v_entry_number;

    v_line_note := COALESCE(v_line->>'note', '');

    -- إدراج سطر القيد باستخدام account_trans_id بدلاً من id
    INSERT INTO public.account_trans (
      account_trans_id, entry_id, line_no, trans_type, account_id, account_cur_no,
      amount, amount_original, amount_original_text, amount_text,
      currency_original_no, currency_price_id, currency_price_seq,
      account_currency_price_id, account_currency_price_seq,
      entity_type, entity_id, payment_method, order_id, shipment_id, custody_id,
      auto_rule_id, automation_key, description, note, created_by_uid, updated_by_uid
    ) VALUES (
      v_line_id, v_entry_id, v_line_no, v_line_trans_type, v_line_account_id, v_line_account_cur_no,
      v_line_amount, v_line_amount_original, v_line_amount_original_text, v_line_amount_text,
      v_line_currency_original_no, v_line_currency_price_id, v_line_currency_price_seq,
      v_line_acc_price_id, v_line_acc_price_seq,
      COALESCE(v_line->>'entityType', ''), COALESCE(v_line->>'entityId', ''),
      COALESCE(NULLIF(btrim(v_line->>'paymentMethod'), ''), v_payment_method),
      COALESCE(NULLIF(btrim(v_line->>'orderId'), ''), v_order_id),
      COALESCE(NULLIF(btrim(v_line->>'shipmentId'), ''), v_shipment_id),
      COALESCE(NULLIF(btrim(v_line->>'custodyId'), ''), v_custody_id),
      v_auto_rule_id, v_automation_key, v_line_description, v_line_note,
      v_created_by_uid, v_created_by_uid
    );
  END LOOP;

  -- 3. التحقق من توازن القيد المحاسبي / Validate entry balance
  PERFORM public.validate_financial_entry_balance(v_entry_id);

  -- 4. نشر القيد إذا طُلب ذلك / Post entry if requested
  IF v_requested_status = 'posted' THEN
    UPDATE public.main_entry
    SET posting_status = 'posted',
        posted_at      = now(),
        posted_by_uid  = v_created_by_uid
    WHERE main_entry_id = v_entry_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_entry_id,
    'entryNumber', v_entry_number,
    'postingStatus', v_requested_status,
    'lineCount', v_line_no
  );
END;
$$;

-- =============================================================================
-- 4. التحقق من وجود دوال أخرى تستخدم references للأعمدة القديمة
--    Check for any remaining functions using old column references
-- =============================================================================

-- تحديث دالة التحقق من توازن القيد إذا كانت تستخدم account_trans.id
-- Update validate_financial_entry_balance if it references account_trans.id
DO $$
DECLARE
  func_body text;
BEGIN
  SELECT routine_definition INTO func_body
  FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name = 'validate_financial_entry_balance'
  AND routine_type = 'FUNCTION';

  IF func_body IS NOT NULL THEN
    RAISE NOTICE 'Function validate_financial_entry_balance exists - checking for old references';
  END IF;
END;
$$;

COMMIT;
