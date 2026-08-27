-- يمنع سجل orders_history من إعادة إدراج مرجع شحنة بعد أن يحذفها إجراء حذف الطلب الذري.
-- لا يغيّر سلوك إنشاء الشحنة أو تعديلها ولا يغيّر RLS.

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
  -- في الحذف الذري: سجل الشحنة وorders_history سيحذفان معًا، ولا يجوز إدراج shipment_id غير موجود.
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(array_length(changed_fields, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO resolved_order FROM public.orders_history_resolve_order(order_ref);

  IF TG_OP = 'INSERT' THEN
    event_name := 'shipment.created';
    event_summary := 'تم إنشاء شحنة مرتبطة بالطلب';
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

  RETURN NEW;
END;
$$;
