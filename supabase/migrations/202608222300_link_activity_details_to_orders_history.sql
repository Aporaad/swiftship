CREATE OR REPLACE FUNCTION public.orders_history_from_activity_logs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  activity_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
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
BEGIN
  SELECT * INTO resolved_order FROM public.orders_history_resolve_order(order_ref);
  IF resolved_order.order_id IS NOT NULL THEN
    PERFORM public.orders_history_write(
      resolved_order.order_id, resolved_order.order_number, NULL, NULL, NULL, COALESCE(NEW.id, OLD.id),
      'activity.' || COALESCE(activity_row->>'action', lower(TG_OP)), 'activity', lower(TG_OP), 'activity_log', 'activity_log',
      COALESCE(activity_row->>'action', 'تم تسجيل نشاط مرتبط بالطلب'),
      CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END,
      CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END,
      jsonb_build_object(
        'target', activity_row->>'target',
        'details', COALESCE(activity_row->'data'->'details', activity_row->'data', '{}'::jsonb),
        'trigger', TG_NAME
      ),
      activity_row->>'userId', NULL, NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
