-- حذف الطلبات عملية دائمة: يحذف فقط الطلبات المختارة وكل البيانات التابعة لها،
-- ويبقي activity_logs كما هو لأغراض تدقيق نشاط المستخدم.

CREATE OR REPLACE FUNCTION public.orders_history_from_orders()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
DECLARE
  before_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  changed_fields text[] := public.orders_history_changed_fields(before_row, after_row);
  event_name text;
  event_summary text;
  order_ref text;
BEGIN
  -- الحذف الذري ينظف orders_history قبل حذف الطلب؛ لا تضف سجل حذف جديدًا بعد اختفاء الأب.
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(array_length(changed_fields, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  order_ref := COALESCE(NEW.id, OLD.id);
  IF TG_OP = 'INSERT' THEN
    event_name := 'order.created';
    event_summary := 'تم إنشاء الطلب';
  ELSIF OLD.order_status IS DISTINCT FROM NEW.order_status OR OLD.order_status_id IS DISTINCT FROM NEW.order_status_id THEN
    event_name := 'order.status_changed';
    event_summary := 'تم تحديث حالة الطلب';
  ELSE
    event_name := 'order.updated';
    event_summary := 'تم تعديل بيانات الطلب';
  END IF;

  PERFORM public.orders_history_write(
    order_ref, COALESCE(NEW.order_number, OLD.order_number),
    NULL, NULL, NULL, NULL,
    event_name, 'order', lower(TG_OP), 'order', 'database_trigger', event_summary,
    before_row, after_row,
    jsonb_build_object(
      'changedFields', changed_fields,
      'changes', public.orders_history_change_details(before_row, after_row),
      'trigger', TG_NAME
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_orders_with_dependents(p_order_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  target_ids text[];
  target_numbers text[];
  shipment_ids text[];
  journal_entry_ids text[];
  account_transaction_ids text[];
  requested_count integer;
  actual_count integer;
  deleted_shipments integer := 0;
  deleted_products integer := 0;
  deleted_journal_entries integer := 0;
  deleted_account_transactions integer := 0;
  deleted_expenses integer := 0;
  deleted_notifications integer := 0;
  deleted_whatsapp_logs integer := 0;
  deleted_orders_history integer := 0;
  deleted_orders integer := 0;
BEGIN
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

  SELECT count(*), COALESCE(array_agg(order_number), ARRAY[]::text[])
    INTO actual_count, target_numbers
  FROM public.orders
  WHERE id = ANY(target_ids);

  IF actual_count <> requested_count THEN
    RAISE EXCEPTION 'One or more selected orders no longer exist; no deletion was performed.';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO shipment_ids
  FROM public.shipments
  WHERE order_id = ANY(target_ids);

  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO journal_entry_ids
  FROM public.journal_entries
  WHERE order_id = ANY(target_ids)
     OR order_number = ANY(target_numbers)
     OR data ->> 'orderId' = ANY(target_ids)
     OR data ->> 'order_id' = ANY(target_ids)
     OR data ->> 'orderNumber' = ANY(target_numbers);

  SELECT COALESCE(array_agg(id), ARRAY[]::text[]) INTO account_transaction_ids
  FROM public.account_transactions
  WHERE order_id = ANY(target_ids)
     OR order_number = ANY(target_numbers)
     OR shipment_id = ANY(shipment_ids)
     OR data ->> 'orderId' = ANY(target_ids)
     OR data ->> 'order_id' = ANY(target_ids)
     OR data ->> 'orderNumber' = ANY(target_numbers);

  DELETE FROM public.notifications
  WHERE data ->> 'orderId' = ANY(target_ids)
     OR data ->> 'order_id' = ANY(target_ids)
     OR data ->> 'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

  DELETE FROM public.whatsapp_logs
  WHERE data ->> 'orderId' = ANY(target_ids)
     OR data ->> 'order_id' = ANY(target_ids)
     OR data ->> 'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_whatsapp_logs = ROW_COUNT;

  DELETE FROM public.expenses
  WHERE data ->> 'orderId' = ANY(target_ids)
     OR data ->> 'order_id' = ANY(target_ids)
     OR data ->> 'orderNumber' = ANY(target_numbers);
  GET DIAGNOSTICS deleted_expenses = ROW_COUNT;

  DELETE FROM public.account_transactions WHERE id = ANY(account_transaction_ids);
  GET DIAGNOSTICS deleted_account_transactions = ROW_COUNT;

  DELETE FROM public.journal_entries WHERE id = ANY(journal_entry_ids);
  GET DIAGNOSTICS deleted_journal_entries = ROW_COUNT;

  DELETE FROM public.shipments WHERE id = ANY(shipment_ids);
  GET DIAGNOSTICS deleted_shipments = ROW_COUNT;

  DELETE FROM public.products WHERE order_id = ANY(target_ids);
  GET DIAGNOSTICS deleted_products = ROW_COUNT;

  DELETE FROM public.orders_history
  WHERE order_id = ANY(target_ids)
     OR order_number = ANY(target_numbers)
     OR shipment_id = ANY(shipment_ids)
     OR journal_entry_id = ANY(journal_entry_ids)
     OR account_transaction_id = ANY(account_transaction_ids);
  GET DIAGNOSTICS deleted_orders_history = ROW_COUNT;

  -- لا يحذف هذا الإجراء أي سجل من public.activity_logs.
  DELETE FROM public.orders WHERE id = ANY(target_ids);
  GET DIAGNOSTICS deleted_orders = ROW_COUNT;

  RETURN jsonb_build_object(
    'orderIds', target_ids,
    'orders', deleted_orders,
    'shipments', deleted_shipments,
    'products', deleted_products,
    'journalEntries', deleted_journal_entries,
    'accountTransactions', deleted_account_transactions,
    'expenses', deleted_expenses,
    'notifications', deleted_notifications,
    'whatsappLogs', deleted_whatsapp_logs,
    'ordersHistory', deleted_orders_history,
    'activityLogsDeleted', 0
  );
END;
$$;
