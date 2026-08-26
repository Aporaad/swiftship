-- السياسة: الحدث الدلالي الصادر عن الجدول الأصلي هو السجل المعتمد.
-- لا نكرر أنشطة واجهة المستخدم التي تصف التعديل نفسه (add/edit/delete order).

CREATE OR REPLACE FUNCTION public.orders_history_change_details(p_before jsonb, p_after jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, auth
AS $$
  WITH base_changes AS (
    SELECT
      COALESCE(before_row.key, after_row.key) AS key,
      before_row.value AS before_value,
      after_row.value AS after_value
    FROM jsonb_each(COALESCE(p_before, '{}'::jsonb)) AS before_row
    FULL OUTER JOIN jsonb_each(COALESCE(p_after, '{}'::jsonb)) AS after_row
      ON before_row.key = after_row.key
    WHERE COALESCE(before_row.key, after_row.key) <> 'data'
      AND before_row.value IS DISTINCT FROM after_row.value
  ),
  data_changes AS (
    SELECT
      'data.' || COALESCE(before_row.key, after_row.key) AS key,
      before_row.value AS before_value,
      after_row.value AS after_value
    FROM jsonb_each(
      CASE WHEN jsonb_typeof(p_before->'data') = 'object' THEN p_before->'data' ELSE '{}'::jsonb END
    ) AS before_row
    FULL OUTER JOIN jsonb_each(
      CASE WHEN jsonb_typeof(p_after->'data') = 'object' THEN p_after->'data' ELSE '{}'::jsonb END
    ) AS after_row
      ON before_row.key = after_row.key
    WHERE before_row.value IS DISTINCT FROM after_row.value
  ),
  combined AS (
    SELECT * FROM base_changes
    UNION ALL
    SELECT * FROM data_changes
  )
  SELECT COALESCE(
    jsonb_object_agg(
      key,
      jsonb_build_object('before', before_value, 'after', after_value)
      ORDER BY key
    ),
    '{}'::jsonb
  )
  FROM combined;
$$;

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
  -- تجاهل UPDATE الذي لا يغير أي حقل فعليًا.
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
  ELSIF OLD.order_status IS DISTINCT FROM NEW.order_status OR OLD.order_status_id IS DISTINCT FROM NEW.order_status_id THEN
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

CREATE OR REPLACE FUNCTION public.orders_history_from_shipments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
DECLARE
  before_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  changed_fields text[] := public.orders_history_changed_fields(before_row, after_row);
  resolved_order record;
  order_ref text := COALESCE(NEW.order_id, OLD.order_id);
  shipment_ref text := COALESCE(NEW.id, OLD.id);
  event_name text;
  event_summary text;
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(array_length(changed_fields, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO resolved_order FROM public.orders_history_resolve_order(order_ref);

  IF TG_OP = 'INSERT' THEN
    event_name := 'shipment.created';
    event_summary := 'تم إنشاء شحنة مرتبطة بالطلب';
  ELSIF TG_OP = 'DELETE' THEN
    event_name := 'shipment.deleted';
    event_summary := 'تم حذف الشحنة';
  ELSIF OLD.shipment_status IS DISTINCT FROM NEW.shipment_status THEN
    event_name := 'shipment.status_changed';
    event_summary := 'تم تحديث حالة الشحنة';
  ELSE
    event_name := 'shipment.updated';
    event_summary := 'تم تعديل بيانات الشحنة';
  END IF;

  PERFORM public.orders_history_write(
    resolved_order.order_id,
    resolved_order.order_number,
    shipment_ref, NULL, NULL, NULL,
    event_name, 'shipment', lower(TG_OP), 'shipment', 'database_trigger', event_summary,
    before_row, after_row,
    jsonb_build_object(
      'changedFields', changed_fields,
      'changes', public.orders_history_change_details(before_row, after_row),
      'orderReference', order_ref,
      'trigger', TG_NAME
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_history_from_activity_logs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
DECLARE
  activity_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  activity_action text := lower(COALESCE(activity_row->>'action', ''));
  order_ref text := COALESCE(
    activity_row->'data'->'details'->>'orderId',
    activity_row->'data'->'details'->>'order_id',
    activity_row->'data'->'details'->>'orderNumber',
    activity_row->'data'->>'orderId',
    activity_row->'data'->>'order_id',
    activity_row->'data'->>'orderNumber',
    activity_row->>'target'
  );
  resolved_order record;
  event_summary text;
BEGIN
  -- هذه الأنشطة تعيد وصف عملية تحفزها جداول orders نفسها؛ لذا لا تسجل مرتين.
  IF activity_action = ANY (ARRAY['add_order', 'edit_order', 'edit_delivered_order', 'delete_order']) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT * INTO resolved_order FROM public.orders_history_resolve_order(order_ref);
  IF resolved_order.order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  event_summary := CASE activity_action
    WHEN 'add_payment' THEN 'تم تسجيل دفعة مرتبطة بالطلب'
    WHEN 'financial_transaction' THEN 'تم تسجيل حركة مالية مرتبطة بالطلب'
    WHEN 'account_order_charge' THEN 'تم تسجيل استحقاق مالي مرتبط بالطلب'
    WHEN 'account_payment_received' THEN 'تم تسجيل تحصيل مالي مرتبط بالطلب'
    ELSE 'تم تسجيل نشاط تشغيلي مرتبط بالطلب'
  END;

  PERFORM public.orders_history_write(
    resolved_order.order_id, resolved_order.order_number, NULL, NULL, NULL, COALESCE(NEW.id, OLD.id),
    'activity.' || COALESCE(NULLIF(activity_action, ''), lower(TG_OP)), 'activity', lower(TG_OP), 'activity_log', 'activity_log',
    event_summary,
    CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END,
    jsonb_build_object(
      'activityAction', activity_action,
      'activityTarget', activity_row->>'target',
      'activityDetails', COALESCE(activity_row->'data'->'details', activity_row->'data', '{}'::jsonb),
      'trigger', TG_NAME
    ),
    activity_row->>'userId',
    activity_row->'data'->>'userName',
    activity_row->'data'->>'userRole'
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- إزالة آثار أنشطة الواجهة القديمة التي كانت تكرر حدث الطلب الدلالي نفسه.
DELETE FROM public.orders_history
WHERE event_category = 'activity'
  AND event_type = ANY (ARRAY[
    'activity.add_order',
    'activity.edit_order',
    'activity.edit_delivered_order',
    'activity.delete_order'
  ]);

-- علاقات فعلية، مع الاحتفاظ بسجل التدقيق عند حذف الكيان الأصلي.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_history_order_id_fkey'
      AND conrelid = 'public.orders_history'::regclass
  ) THEN
    ALTER TABLE public.orders_history
      ADD CONSTRAINT orders_history_order_id_fkey
      FOREIGN KEY (order_id)
      REFERENCES public.orders(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_history_shipment_id_fkey'
      AND conrelid = 'public.orders_history'::regclass
  ) THEN
    ALTER TABLE public.orders_history
      ADD CONSTRAINT orders_history_shipment_id_fkey
      FOREIGN KEY (shipment_id)
      REFERENCES public.shipments(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END;
$$;
