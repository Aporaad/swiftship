ALTER FUNCTION public.orders_history_resolve_order(text) SET search_path = public, auth;
ALTER FUNCTION public.orders_history_changed_fields(jsonb, jsonb) SET search_path = public, auth;
ALTER FUNCTION public.orders_history_actor(text, text, text) SET search_path = public, auth;
ALTER FUNCTION public.orders_history_write(text, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, text, text) SET search_path = public, auth;
ALTER FUNCTION public.orders_history_from_orders() SET search_path = public, auth;
ALTER FUNCTION public.orders_history_from_shipments() SET search_path = public, auth;
ALTER FUNCTION public.orders_history_from_journal_entries() SET search_path = public, auth;
ALTER FUNCTION public.orders_history_from_activity_logs() SET search_path = public, auth;
