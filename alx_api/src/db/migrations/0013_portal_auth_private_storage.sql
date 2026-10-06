-- Portal Auth private storage.
-- Portal identities remain independent from public.users and system Auth.
-- Plaintext passwords are never stored; the API writes Argon2id hashes only.

CREATE TABLE IF NOT EXISTS alx_api_private.portal_credentials (
  portal_user_id text PRIMARY KEY REFERENCES public.portal_users(portal_user_id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_algorithm text NOT NULL DEFAULT 'argon2id',
  password_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_credentials_algorithm_check CHECK (password_algorithm = 'argon2id'),
  CONSTRAINT portal_credentials_version_check CHECK (password_version >= 1),
  CONSTRAINT portal_credentials_hash_check CHECK (password_hash LIKE '$argon2id$v=19$%')
);

CREATE TABLE IF NOT EXISTS alx_api_private.portal_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id text NOT NULL REFERENCES public.portal_users(portal_user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  CONSTRAINT portal_sessions_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS portal_sessions_user_expiry_idx
  ON alx_api_private.portal_sessions (portal_user_id, expires_at);

CREATE TABLE IF NOT EXISTS alx_api_private.portal_refresh_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES alx_api_private.portal_sessions(session_id) ON DELETE CASCADE,
  portal_user_id text NOT NULL REFERENCES public.portal_users(portal_user_id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  parent_token_id uuid REFERENCES alx_api_private.portal_refresh_tokens(token_id) ON DELETE SET NULL,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  replaced_by_token_id uuid REFERENCES alx_api_private.portal_refresh_tokens(token_id) ON DELETE SET NULL,
  CONSTRAINT portal_refresh_hash_check CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT portal_refresh_expiry_check CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_refresh_tokens_hash_uidx
  ON alx_api_private.portal_refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS portal_refresh_tokens_family_idx
  ON alx_api_private.portal_refresh_tokens (family_id);

CREATE TABLE IF NOT EXISTS alx_api_private.portal_auth_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id text REFERENCES public.portal_users(portal_user_id) ON DELETE SET NULL,
  event_type text NOT NULL,
  success boolean NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal_auth_events_user_created_idx
  ON alx_api_private.portal_auth_events (portal_user_id, created_at DESC);

ALTER TABLE alx_api_private.portal_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_refresh_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_auth_events FORCE ROW LEVEL SECURITY;

CREATE POLICY portal_runtime_credentials_select
  ON alx_api_private.portal_credentials FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY portal_runtime_credentials_insert
  ON alx_api_private.portal_credentials FOR INSERT TO alx_api_runtime WITH CHECK (true);
CREATE POLICY portal_runtime_credentials_update
  ON alx_api_private.portal_credentials FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);
CREATE POLICY portal_runtime_sessions_select
  ON alx_api_private.portal_sessions FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY portal_runtime_sessions_insert
  ON alx_api_private.portal_sessions FOR INSERT TO alx_api_runtime WITH CHECK (true);
CREATE POLICY portal_runtime_sessions_update
  ON alx_api_private.portal_sessions FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);
CREATE POLICY portal_runtime_refresh_select
  ON alx_api_private.portal_refresh_tokens FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY portal_runtime_refresh_insert
  ON alx_api_private.portal_refresh_tokens FOR INSERT TO alx_api_runtime WITH CHECK (true);
CREATE POLICY portal_runtime_refresh_update
  ON alx_api_private.portal_refresh_tokens FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);
CREATE POLICY portal_runtime_events_insert
  ON alx_api_private.portal_auth_events FOR INSERT TO alx_api_runtime WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON alx_api_private.portal_credentials TO alx_api_runtime;
GRANT SELECT, INSERT, UPDATE ON alx_api_private.portal_sessions TO alx_api_runtime;
GRANT SELECT, INSERT, UPDATE ON alx_api_private.portal_refresh_tokens TO alx_api_runtime;
GRANT INSERT ON alx_api_private.portal_auth_events TO alx_api_runtime;
