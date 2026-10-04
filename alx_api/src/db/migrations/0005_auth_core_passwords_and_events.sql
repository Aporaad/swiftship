-- Auth Core additions. Apply only after reviewing scope and testing on an isolated PostgreSQL database.
-- The runtime never selects reset tokens or writes password hashes directly.

REVOKE ALL ON alx_api_private.auth_events FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY api_runtime_auth_events_insert
  ON alx_api_private.auth_events
  FOR INSERT TO alx_api_runtime
  WITH CHECK (true);
GRANT INSERT ON alx_api_private.auth_events TO alx_api_runtime;

CREATE FUNCTION alx_api_private.update_password_hash(
  p_user_id text,
  p_password_hash text,
  p_changed_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $update_password$
DECLARE
  user_is_active boolean;
BEGIN
  IF p_user_id IS NULL OR p_password_hash IS NULL
     OR p_password_hash NOT LIKE '$argon2id$v=19$%' OR p_changed_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT NOT source.disabled
    INTO user_is_active
  FROM public.users AS source
  WHERE source.user_id = p_user_id
  LIMIT 1
  FOR UPDATE;

  IF NOT coalesce(user_is_active, false) THEN
    RETURN false;
  END IF;

  INSERT INTO alx_api_private.user_credentials (user_id, password_hash, password_algorithm, password_version, updated_at)
  VALUES (p_user_id, p_password_hash, 'argon2id', 1, p_changed_at)
  ON CONFLICT (user_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        password_algorithm = 'argon2id',
        password_version = alx_api_private.user_credentials.password_version + 1,
        updated_at = EXCLUDED.updated_at;

  INSERT INTO alx_api_private.user_security (user_id, failed_login_attempts, locked_until, last_password_change_at, updated_at)
  VALUES (p_user_id, 0, NULL, p_changed_at, p_changed_at)
  ON CONFLICT (user_id) DO UPDATE
    SET failed_login_attempts = 0,
        locked_until = NULL,
        last_password_change_at = EXCLUDED.last_password_change_at,
        updated_at = EXCLUDED.updated_at;

  UPDATE alx_api_private.api_sessions
    SET revoked_at = p_changed_at, revoke_reason = 'password_change'
    WHERE user_id = p_user_id AND revoked_at IS NULL;
  UPDATE alx_api_private.api_refresh_tokens
    SET revoked_at = p_changed_at
    WHERE user_id = p_user_id AND revoked_at IS NULL;

  INSERT INTO alx_api_private.auth_events (user_id, event_type, success, metadata, created_at)
  VALUES (p_user_id, 'password.changed', true, '{}'::jsonb, p_changed_at);
  RETURN true;
END;
$update_password$;

CREATE FUNCTION alx_api_private.create_password_reset_token(
  p_user_id text,
  p_token_hash text,
  p_created_at timestamptz,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $create_reset$
DECLARE
  user_is_active boolean;
BEGIN
  IF p_user_id IS NULL OR p_token_hash IS NULL
     OR p_token_hash !~ '^[a-f0-9]{64}$'
     OR p_created_at IS NULL OR p_expires_at <= p_created_at THEN
    RETURN false;
  END IF;

  SELECT NOT source.disabled
    INTO user_is_active
  FROM public.users AS source
  WHERE source.user_id = p_user_id
  LIMIT 1;
  IF NOT coalesce(user_is_active, false) THEN
    RETURN false;
  END IF;

  UPDATE alx_api_private.password_reset_tokens
    SET used_at = p_created_at
    WHERE user_id = p_user_id AND used_at IS NULL;

  INSERT INTO alx_api_private.password_reset_tokens (user_id, token_hash, created_at, expires_at)
  VALUES (p_user_id, p_token_hash, p_created_at, p_expires_at);
  RETURN true;
END;
$create_reset$;

CREATE FUNCTION alx_api_private.complete_password_reset(
  p_token_hash text,
  p_password_hash text,
  p_completed_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $complete_reset$
DECLARE
  reset_user_id text;
  user_is_active boolean;
BEGIN
  IF p_token_hash IS NULL OR p_password_hash IS NULL
     OR p_password_hash NOT LIKE '$argon2id$v=19$%'
     OR p_completed_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT reset.user_id
    INTO reset_user_id
  FROM alx_api_private.password_reset_tokens AS reset
  WHERE reset.token_hash = p_token_hash
    AND reset.used_at IS NULL
    AND reset.expires_at > p_completed_at
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT NOT source.disabled
    INTO user_is_active
  FROM public.users AS source
  WHERE source.user_id = reset_user_id
  LIMIT 1
  FOR UPDATE;
  IF NOT coalesce(user_is_active, false) THEN
    RETURN false;
  END IF;

  INSERT INTO alx_api_private.user_credentials (user_id, password_hash, password_algorithm, password_version, updated_at)
  VALUES (reset_user_id, p_password_hash, 'argon2id', 1, p_completed_at)
  ON CONFLICT (user_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        password_algorithm = 'argon2id',
        password_version = alx_api_private.user_credentials.password_version + 1,
        updated_at = EXCLUDED.updated_at;

  UPDATE alx_api_private.password_reset_tokens
    SET used_at = p_completed_at
    WHERE token_hash = p_token_hash;
  UPDATE alx_api_private.user_security
    SET failed_login_attempts = 0, locked_until = NULL,
        last_password_change_at = p_completed_at, updated_at = p_completed_at
    WHERE user_id = reset_user_id;
  UPDATE alx_api_private.api_sessions
    SET revoked_at = p_completed_at, revoke_reason = 'password_reset'
    WHERE user_id = reset_user_id AND revoked_at IS NULL;
  UPDATE alx_api_private.api_refresh_tokens
    SET revoked_at = p_completed_at
    WHERE user_id = reset_user_id AND revoked_at IS NULL;

  INSERT INTO alx_api_private.auth_events (user_id, event_type, success, metadata, created_at)
  VALUES (reset_user_id, 'password.reset.completed', true, '{}'::jsonb, p_completed_at);
  RETURN true;
END;
$complete_reset$;

CREATE FUNCTION alx_api_private.revoke_password_reset_token(
  p_token_hash text,
  p_revoked_at timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $revoke_reset$
  UPDATE alx_api_private.password_reset_tokens
    SET used_at = p_revoked_at
    WHERE token_hash = p_token_hash AND used_at IS NULL;
$revoke_reset$;

ALTER FUNCTION alx_api_private.update_password_hash(text, text, timestamptz) OWNER TO postgres;
ALTER FUNCTION alx_api_private.create_password_reset_token(text, text, timestamptz, timestamptz) OWNER TO postgres;
ALTER FUNCTION alx_api_private.complete_password_reset(text, text, timestamptz) OWNER TO postgres;
ALTER FUNCTION alx_api_private.revoke_password_reset_token(text, timestamptz) OWNER TO postgres;

REVOKE ALL ON FUNCTION alx_api_private.update_password_hash(text, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION alx_api_private.create_password_reset_token(text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION alx_api_private.complete_password_reset(text, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION alx_api_private.revoke_password_reset_token(text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION alx_api_private.update_password_hash(text, text, timestamptz) TO alx_api_runtime;
GRANT EXECUTE ON FUNCTION alx_api_private.create_password_reset_token(text, text, timestamptz, timestamptz) TO alx_api_runtime;
GRANT EXECUTE ON FUNCTION alx_api_private.complete_password_reset(text, text, timestamptz) TO alx_api_runtime;
GRANT EXECUTE ON FUNCTION alx_api_private.revoke_password_reset_token(text, timestamptz) TO alx_api_runtime;
