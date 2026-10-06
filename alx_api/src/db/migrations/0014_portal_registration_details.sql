-- Portal registration details that should not be exposed through public portal_users.data.
-- The API runtime is the only application role granted access; browser credentials are not used.

CREATE TABLE IF NOT EXISTS alx_api_private.portal_registration_details (
  portal_user_id text PRIMARY KEY
    REFERENCES public.portal_users (portal_user_id) ON DELETE CASCADE,
  address text,
  company_name text,
  commercial_register text,
  courier_type text,
  identity_doc_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_registration_details_courier_type_check
    CHECK (courier_type IS NULL OR courier_type IN ('local', 'sourcing'))
);

COMMENT ON TABLE alx_api_private.portal_registration_details IS
  'Private role-specific Portal registration details; do not expose through public browser database access.';

REVOKE ALL ON TABLE alx_api_private.portal_registration_details
  FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE alx_api_private.portal_registration_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_registration_details FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_registration_details_runtime_select
  ON alx_api_private.portal_registration_details;
CREATE POLICY portal_registration_details_runtime_select
  ON alx_api_private.portal_registration_details
  FOR SELECT TO alx_api_runtime USING (true);

DROP POLICY IF EXISTS portal_registration_details_runtime_insert
  ON alx_api_private.portal_registration_details;
CREATE POLICY portal_registration_details_runtime_insert
  ON alx_api_private.portal_registration_details
  FOR INSERT TO alx_api_runtime WITH CHECK (true);

DROP POLICY IF EXISTS portal_registration_details_runtime_update
  ON alx_api_private.portal_registration_details;
CREATE POLICY portal_registration_details_runtime_update
  ON alx_api_private.portal_registration_details
  FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE
  ON TABLE alx_api_private.portal_registration_details TO alx_api_runtime;
GRANT USAGE ON SCHEMA alx_api_private TO alx_api_runtime;
