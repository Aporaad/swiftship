-- Portal identities have an independent RBAC namespace and never share system user_roles.
-- The runtime can read grants for authorization but cannot assign or modify them.

DO $portal_rbac_prerequisites$
BEGIN
  IF to_regclass('public.portal_users') IS NULL THEN
    RAISE EXCEPTION 'public.portal_users is required before Portal RBAC';
  END IF;
END;
$portal_rbac_prerequisites$;

CREATE TABLE alx_api_private.portal_roles (
  portal_role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system_role boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_portal_roles_code_check CHECK (code ~ '^[a-z][a-z0-9_-]{1,63}$')
);

CREATE TABLE alx_api_private.portal_permissions (
  portal_permission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_portal_permissions_code_check CHECK (code ~ '^portal[.][a-z][a-z0-9_.:-]{1,123}$'),
  CONSTRAINT api_portal_permissions_resource_check CHECK (resource ~ '^[a-z][a-z0-9_-]{1,63}$'),
  CONSTRAINT api_portal_permissions_action_check CHECK (action ~ '^[a-z][a-z0-9_-]{1,63}$'),
  CONSTRAINT api_portal_permissions_resource_action_unique UNIQUE (resource, action)
);

CREATE TABLE alx_api_private.portal_user_roles (
  portal_user_id text NOT NULL REFERENCES public.portal_users(portal_user_id) ON DELETE CASCADE,
  portal_role_id uuid NOT NULL REFERENCES alx_api_private.portal_roles(portal_role_id) ON DELETE RESTRICT,
  assigned_by text REFERENCES public.portal_users(portal_user_id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  PRIMARY KEY (portal_user_id, portal_role_id),
  CONSTRAINT api_portal_user_roles_expiry_check CHECK (expires_at IS NULL OR expires_at > assigned_at)
);
CREATE INDEX api_portal_user_roles_active_idx
  ON alx_api_private.portal_user_roles (portal_user_id, expires_at);

CREATE TABLE alx_api_private.portal_role_permissions (
  portal_role_id uuid NOT NULL REFERENCES alx_api_private.portal_roles(portal_role_id) ON DELETE CASCADE,
  portal_permission_id uuid NOT NULL REFERENCES alx_api_private.portal_permissions(portal_permission_id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portal_role_id, portal_permission_id)
);

ALTER TABLE alx_api_private.portal_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.portal_role_permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY api_runtime_portal_roles_select ON alx_api_private.portal_roles
  FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_portal_permissions_select ON alx_api_private.portal_permissions
  FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_portal_user_roles_select ON alx_api_private.portal_user_roles
  FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_portal_role_permissions_select ON alx_api_private.portal_role_permissions
  FOR SELECT TO alx_api_runtime USING (true);

REVOKE ALL ON alx_api_private.portal_roles,
  alx_api_private.portal_permissions,
  alx_api_private.portal_user_roles,
  alx_api_private.portal_role_permissions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON alx_api_private.portal_roles,
  alx_api_private.portal_permissions,
  alx_api_private.portal_user_roles,
  alx_api_private.portal_role_permissions
  TO alx_api_runtime;
