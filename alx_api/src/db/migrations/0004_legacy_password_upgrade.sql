-- Progressive legacy password upgrade for the API only.
-- The legacy value is compared inside a SECURITY DEFINER function and is never returned to the runtime role.
-- The original public.users.password field is intentionally preserved for the separate legacy clients.

CREATE FUNCTION alx_api_private.verify_legacy_password(
  p_user_id text,
  p_password text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $verify$
  SELECT EXISTS (
    SELECT 1
    FROM public.users AS source
    WHERE source.user_id = p_user_id
      AND source.password IS NOT NULL
      AND source.password <> ''
      AND source.password COLLATE pg_catalog."C" = p_password COLLATE pg_catalog."C"
    LIMIT 1
  );
$verify$;

ALTER FUNCTION alx_api_private.verify_legacy_password(text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION alx_api_private.verify_legacy_password(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION alx_api_private.verify_legacy_password(text, text)
  TO alx_api_runtime;

CREATE FUNCTION alx_api_private.migrate_legacy_password(
  p_user_id text,
  p_password text,
  p_password_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $migrate$
DECLARE
  stored_legacy_password text;
BEGIN
  IF p_user_id IS NULL OR p_password IS NULL OR p_password = ''
     OR p_password_hash IS NULL OR p_password_hash NOT LIKE '$argon2id$v=19$%' THEN
    RETURN false;
  END IF;

  SELECT source.password
    INTO stored_legacy_password
  FROM public.users AS source
  WHERE source.user_id = p_user_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND
     OR stored_legacy_password IS NULL
     OR stored_legacy_password = ''
     OR stored_legacy_password COLLATE pg_catalog."C" <> p_password COLLATE pg_catalog."C" THEN
    RETURN false;
  END IF;

  INSERT INTO alx_api_private.user_credentials (user_id, password_hash)
  VALUES (p_user_id, p_password_hash)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN FOUND;
END;
$migrate$;

ALTER FUNCTION alx_api_private.migrate_legacy_password(text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION alx_api_private.migrate_legacy_password(text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION alx_api_private.migrate_legacy_password(text, text, text)
  TO alx_api_runtime;
