-- Admin-controlled password reset for internal system users.
-- The API receives the password over HTTPS, hashes it with Argon2id, and only
-- this SECURITY DEFINER function writes the hash. Plaintext is never persisted.

CREATE OR REPLACE FUNCTION alx_api_private.admin_update_password_hash(
  p_user_id text,
  p_password_hash text,
  p_changed_at timestamptz,
  p_actor_user_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $admin_update_password$
DECLARE
  target_exists boolean;
BEGIN
  IF p_user_id IS NULL OR p_password_hash IS NULL
     OR p_password_hash NOT LIKE '$argon2id$v=19$%'
     OR p_changed_at IS NULL OR p_actor_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users AS source
    WHERE source.user_id = p_user_id
    FOR UPDATE
  ) INTO target_exists;
  IF NOT target_exists THEN
    RETURN false;
  END IF;

  INSERT INTO alx_api_private.user_credentials
    (user_id, password_hash, password_algorithm, password_version, updated_at)
  VALUES (p_user_id, p_password_hash, 'argon2id', 1, p_changed_at)
  ON CONFLICT (user_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        password_algorithm = EXCLUDED.password_algorithm,
        password_version = alx_api_private.user_credentials.password_version + 1,
        updated_at = EXCLUDED.updated_at;

  INSERT INTO alx_api_private.user_security
    (user_id, failed_login_attempts, locked_until, last_password_change_at, updated_at)
  VALUES (p_user_id, 0, NULL, p_changed_at, p_changed_at)
  ON CONFLICT (user_id) DO UPDATE
    SET failed_login_attempts = 0,
        locked_until = NULL,
        last_password_change_at = EXCLUDED.last_password_change_at,
        updated_at = EXCLUDED.updated_at;

  UPDATE alx_api_private.api_sessions
    SET revoked_at = p_changed_at, revoke_reason = 'admin_password_reset'
    WHERE user_id = p_user_id AND revoked_at IS NULL;
  UPDATE alx_api_private.api_refresh_tokens
    SET revoked_at = p_changed_at
    WHERE user_id = p_user_id AND revoked_at IS NULL;

  INSERT INTO alx_api_private.auth_events (user_id, event_type, success, metadata, created_at)
  VALUES (
    p_user_id,
    'password.admin_reset',
    true,
    jsonb_build_object('actor_user_id', p_actor_user_id),
    p_changed_at
  );
  RETURN true;
END;
$admin_update_password$;

ALTER FUNCTION alx_api_private.admin_update_password_hash(text, text, timestamptz, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION alx_api_private.admin_update_password_hash(text, text, timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION alx_api_private.admin_update_password_hash(text, text, timestamptz, text) TO alx_api_runtime;
