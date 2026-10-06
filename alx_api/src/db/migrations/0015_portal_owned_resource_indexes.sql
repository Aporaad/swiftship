BEGIN;

CREATE INDEX IF NOT EXISTS idx_portal_tickets_user_uid_created_at
  ON public.portal_tickets (user_uid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cust_details_user_uid_created_at
  ON public.cust_details (user_uid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id_created_at
  ON public.orders (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_party_customer_created_at
  ON public.orders (order_party_type, order_party_id, created_at DESC);

COMMIT;
