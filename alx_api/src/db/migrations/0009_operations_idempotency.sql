-- Phase 7: durable idempotency records for sensitive operations.
-- Apply only after reviewing runtime grants against the target PostgreSQL schema.
BEGIN;
CREATE TABLE IF NOT EXISTS alx_api_private.operation_idempotency (
  idempotency_key text PRIMARY KEY,
  operation text NOT NULL,
  response_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operation_idempotency_key_check CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  CONSTRAINT operation_idempotency_response_check CHECK (jsonb_typeof(response_data) = 'object')
);
ALTER TABLE alx_api_private.operation_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.operation_idempotency FORCE ROW LEVEL SECURITY;
REVOKE ALL ON alx_api_private.operation_idempotency FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON alx_api_private.operation_idempotency TO alx_api_runtime;
CREATE POLICY operation_idempotency_runtime_policy ON alx_api_private.operation_idempotency
  FOR ALL TO alx_api_runtime USING (true) WITH CHECK (true);
COMMIT;
