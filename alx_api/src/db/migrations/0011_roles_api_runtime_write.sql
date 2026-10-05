-- Roles API runtime write access
-- The HTTP API remains the only caller; the browser never receives database credentials.

GRANT SELECT, INSERT, UPDATE, DELETE ON alx_api_private.roles TO alx_api_runtime;
GRANT SELECT ON alx_api_private.permissions TO alx_api_runtime;
GRANT SELECT, INSERT, DELETE ON alx_api_private.user_roles TO alx_api_runtime;
GRANT SELECT, INSERT, DELETE ON alx_api_private.role_permissions TO alx_api_runtime;

DROP POLICY IF EXISTS api_runtime_roles_insert ON alx_api_private.roles;
CREATE POLICY api_runtime_roles_insert ON alx_api_private.roles
  FOR INSERT TO alx_api_runtime WITH CHECK (true);
DROP POLICY IF EXISTS api_runtime_roles_update ON alx_api_private.roles;
CREATE POLICY api_runtime_roles_update ON alx_api_private.roles
  FOR UPDATE TO alx_api_runtime USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS api_runtime_roles_delete ON alx_api_private.roles;
CREATE POLICY api_runtime_roles_delete ON alx_api_private.roles
  FOR DELETE TO alx_api_runtime USING (true);

DROP POLICY IF EXISTS api_runtime_user_roles_insert ON alx_api_private.user_roles;
CREATE POLICY api_runtime_user_roles_insert ON alx_api_private.user_roles
  FOR INSERT TO alx_api_runtime WITH CHECK (true);
DROP POLICY IF EXISTS api_runtime_user_roles_delete ON alx_api_private.user_roles;
CREATE POLICY api_runtime_user_roles_delete ON alx_api_private.user_roles
  FOR DELETE TO alx_api_runtime USING (true);

DROP POLICY IF EXISTS api_runtime_role_permissions_insert ON alx_api_private.role_permissions;
CREATE POLICY api_runtime_role_permissions_insert ON alx_api_private.role_permissions
  FOR INSERT TO alx_api_runtime WITH CHECK (true);
DROP POLICY IF EXISTS api_runtime_role_permissions_delete ON alx_api_private.role_permissions;
CREATE POLICY api_runtime_role_permissions_delete ON alx_api_private.role_permissions
  FOR DELETE TO alx_api_runtime USING (true);
