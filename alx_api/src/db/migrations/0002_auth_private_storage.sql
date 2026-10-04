-- alx_api Auth persistence foundation.
-- Intentionally creates objects only in a non-public schema.
-- No RLS/GRANTS statements and no legacy credential data is copied.

CREATE SCHEMA alx_api_private;

CREATE TABLE alx_api_private.user_credentials (
  user_id text PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_algorithm text NOT NULL DEFAULT 'argon2id',
  password_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_credentials_algorithm_check CHECK (password_algorithm = 'argon2id'),
  CONSTRAINT user_credentials_password_version_check CHECK (password_version >= 1),
  CONSTRAINT user_credentials_argon2id_hash_check CHECK (password_hash LIKE '$argon2id$%')
);

CREATE TABLE alx_api_private.user_security (
  user_id text PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  last_password_change_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_security_failed_attempts_check CHECK (failed_login_attempts >= 0)
);

CREATE TABLE alx_api_private.api_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  device_name text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  CONSTRAINT api_sessions_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX api_sessions_user_expiry_idx ON alx_api_private.api_sessions(user_id, expires_at);

CREATE TABLE alx_api_private.api_refresh_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES alx_api_private.api_sessions(session_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  parent_token_id uuid REFERENCES alx_api_private.api_refresh_tokens(token_id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  replaced_by_token_id uuid REFERENCES alx_api_private.api_refresh_tokens(token_id) ON DELETE SET NULL,
  CONSTRAINT api_refresh_tokens_hash_check CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT api_refresh_tokens_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX api_refresh_tokens_family_idx ON alx_api_private.api_refresh_tokens(family_id);
CREATE INDEX api_refresh_tokens_session_idx ON alx_api_private.api_refresh_tokens(session_id, created_at);

CREATE TABLE alx_api_private.password_reset_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_password_reset_tokens_hash_check CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT api_password_reset_tokens_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX api_password_reset_tokens_user_idx ON alx_api_private.password_reset_tokens(user_id, expires_at);

CREATE TABLE alx_api_private.auth_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES public.users(user_id) ON DELETE SET NULL,
  event_type text NOT NULL,
  success boolean NOT NULL,
  ip_address text,
  user_agent text,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_events_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX api_auth_events_user_time_idx ON alx_api_private.auth_events(user_id, created_at);
