-- alx_api Auth least-privilege runtime access.
-- No password/secret is stored in this migration; LOGIN is provisioned separately.

CREATE ROLE alx_api_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA alx_api_private REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;

CREATE VIEW alx_api_private.api_login_users WITH (security_barrier = true) AS
SELECT user_id, username, email, role, disabled FROM public.users;

REVOKE ALL ON SCHEMA alx_api_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA alx_api_private FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE alx_api_private.user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.user_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.user_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.user_security FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.api_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.api_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.api_refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.api_refresh_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.password_reset_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.auth_events FORCE ROW LEVEL SECURITY;

CREATE POLICY api_runtime_credentials_select ON alx_api_private.user_credentials FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_security_select ON alx_api_private.user_security FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_security_insert ON alx_api_private.user_security FOR INSERT TO alx_api_runtime WITH CHECK (true);
CREATE POLICY api_runtime_security_update ON alx_api_private.user_security FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);
CREATE POLICY api_runtime_sessions_select ON alx_api_private.api_sessions FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_sessions_insert ON alx_api_private.api_sessions FOR INSERT TO alx_api_runtime WITH CHECK (true);
CREATE POLICY api_runtime_sessions_update ON alx_api_private.api_sessions FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);
CREATE POLICY api_runtime_refresh_select ON alx_api_private.api_refresh_tokens FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_refresh_insert ON alx_api_private.api_refresh_tokens FOR INSERT TO alx_api_runtime WITH CHECK (true);
CREATE POLICY api_runtime_refresh_update ON alx_api_private.api_refresh_tokens FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA alx_api_private TO alx_api_runtime;
GRANT SELECT ON alx_api_private.api_login_users, alx_api_private.user_credentials TO alx_api_runtime;
GRANT SELECT, INSERT, UPDATE ON alx_api_private.user_security, alx_api_private.api_sessions, alx_api_private.api_refresh_tokens TO alx_api_runtime;
