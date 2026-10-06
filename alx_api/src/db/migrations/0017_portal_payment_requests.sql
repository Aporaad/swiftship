-- Customer portal payment requests are evidence for staff review only.
-- Creating a request never posts a journal entry or changes any account balance.

CREATE TABLE IF NOT EXISTS alx_api_private.portal_payment_requests (
  payment_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id text NOT NULL REFERENCES public.portal_users (portal_user_id) ON DELETE CASCADE,
  amount numeric(20, 4) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency IN ('YER', 'USD', 'SAR')),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'wallet', 'check')),
  reference text,
  notes text,
  status text NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'settled', 'rejected')),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  finance_entry_id text,
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_payment_request_review_check CHECK (
    (status = 'pending_verification' AND reviewed_at IS NULL AND reviewed_by IS NULL AND finance_entry_id IS NULL)
    OR (status = 'rejected' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND review_note IS NOT NULL AND finance_entry_id IS NULL)
    OR (status = 'settled' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND finance_entry_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_payment_request_idempotency_uidx
  ON alx_api_private.portal_payment_requests (portal_user_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS portal_payment_request_finance_entry_uidx
  ON alx_api_private.portal_payment_requests (finance_entry_id)
  WHERE finance_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS portal_payment_requests_user_created_idx
  ON alx_api_private.portal_payment_requests (portal_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS portal_payment_requests_pending_created_idx
  ON alx_api_private.portal_payment_requests (created_at DESC)
  WHERE status = 'pending_verification';

COMMENT ON TABLE alx_api_private.portal_payment_requests IS
  'Portal payment claims awaiting staff verification; never a ledger posting by itself.';

REVOKE ALL ON TABLE alx_api_private.portal_payment_requests
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE alx_api_private.portal_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_payment_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY portal_payment_requests_runtime_select
  ON alx_api_private.portal_payment_requests
  FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY portal_payment_requests_runtime_insert
  ON alx_api_private.portal_payment_requests
  FOR INSERT TO alx_api_runtime WITH CHECK (true);
CREATE POLICY portal_payment_requests_runtime_update
  ON alx_api_private.portal_payment_requests
  FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON TABLE alx_api_private.portal_payment_requests TO alx_api_runtime;
GRANT USAGE ON SCHEMA alx_api_private TO alx_api_runtime;
