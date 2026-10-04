-- Customers read boundary: expose only canonical non-sensitive fields to the API runtime.
CREATE OR REPLACE VIEW alx_api_private.customers_read AS
SELECT
  c.customer_id,
  c.account_id,
  c.is_active,
  c.join_by,
  c.referrer_id,
  c.full_name,
  c.name_ar,
  c.name_en,
  c.customer_level,
  c.created_at,
  c.updated_at,
  c.acquisition_source,
  c.preferred_categories,
  c.location,
  c.address,
  c.onboarding_completed
FROM public.customers AS c;

REVOKE ALL ON alx_api_private.customers_read FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON alx_api_private.customers_read TO alx_api_runtime;
