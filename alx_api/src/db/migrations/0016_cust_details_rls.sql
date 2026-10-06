BEGIN;

ALTER TABLE public.cust_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cust_details FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cust_details FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cust_details TO authenticated, alx_api_runtime;

DROP POLICY IF EXISTS cust_details_owner_policy ON public.cust_details;
CREATE POLICY cust_details_owner_policy ON public.cust_details
  FOR ALL TO authenticated
  USING (user_uid = auth.uid()::text)
  WITH CHECK (user_uid = auth.uid()::text);

DROP POLICY IF EXISTS cust_details_api_runtime_policy ON public.cust_details;
CREATE POLICY cust_details_api_runtime_policy ON public.cust_details
  FOR ALL TO alx_api_runtime
  USING (true)
  WITH CHECK (true);

COMMIT;
