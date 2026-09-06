-- =============================================================================
-- Migration 202609060001: إصلاح دالة حذف الطلبات ومُشغّل تاريخ الطلبات
-- Fix order deletion RPC and orders_history delete trigger
-- 1. Update delete_orders_with_dependents: delete from order_items instead of products (which has no order_id column).
-- 2. Update orders_history_from_orders: pass NULL for order_id on DELETE operation to avoid FK violation (orders_history_order_id_fkey).
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
  IF TG_OP = 'DELETE' AND current_setting('swiftship.suppress_order_delete_history', true) = 'on' THEN
    RETURN OLD;
  END IF;

  -- تجاهل التحديثات التي لا تمس أي حقل فعلي
  -- Ignore updates that change no tracked fields
  IF TG_OP = 'UPDATE' AND COALESCE(array_length(changed_fields, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  -- بالنسبة لعملية الحذف: نمرر NULL لـ order_id لأن الصف حُذف من جدول orders
  -- حتى لا ينتهك القيد المرجعي orders_history_order_id_fkey
  order_ref := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE COALESCE(NEW.id, OLD.id) END;

  IF TG_OP = 'INSERT' THEN
    event_name := 'order.created';
    event_summary := 'تم إنشاء الطلب';
  ELSIF TG_OP = 'DELETE' THEN
    event_name := 'order.deleted';
    event_summary := 'تم حذف الطلب';
  ELSIF OLD.order_status_id IS DISTINCT FROM NEW.order_status_id THEN
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
      'deletedOrderId', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END,
      'trigger', TG_NAME
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

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
  deleted_order_items integer := 0;
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

  -- حذف منتجات الطلبات من جدول order_items
  -- Delete order items from order_items table
  DELETE FROM public.order_items WHERE order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_order_items = ROW_COUNT;

  -- حذف سجل التاريخ المرتبط بالطلبات والشحنات
  -- Delete orders history records linked to these orders/shipments
  DELETE FROM public.orders_history
  WHERE order_id = ANY(target_ids)
     OR order_number = ANY(target_numbers)
     OR shipment_id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_orders_history = ROW_COUNT;

  -- كبت مشغل قاعدة البيانات لسجل الحذف قبل حذف سجلات الطلبات
  -- Suppress the orders_history AFTER DELETE trigger to prevent FK violation.
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
$function$;

GRANT EXECUTE ON FUNCTION public.delete_orders_with_dependents(text[]) TO anon, authenticated, service_role, public;
