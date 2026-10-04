-- Normalized RBAC foundation. No system roles or permission matrix are seeded here.
-- Authorization is deny-by-default until reviewed role/permission assignments are created.

CREATE TABLE alx_api_private.roles (
  role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system_role boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_roles_code_check CHECK (code ~ '^[a-z][a-z0-9_-]{1,63}$')
);

CREATE TABLE alx_api_private.permissions (
  permission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_permissions_code_check CHECK (code ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  CONSTRAINT api_permissions_resource_check CHECK (resource ~ '^[a-z][a-z0-9_-]{1,63}$'),
  CONSTRAINT api_permissions_action_check CHECK (action ~ '^[a-z][a-z0-9_-]{1,63}$'),
  CONSTRAINT api_permissions_resource_action_unique UNIQUE (resource, action)
);

CREATE TABLE alx_api_private.user_roles (
  user_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES alx_api_private.roles(role_id) ON DELETE RESTRICT,
  assigned_by text REFERENCES public.users(user_id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT api_user_roles_expiry_check CHECK (expires_at IS NULL OR expires_at > assigned_at)
);
CREATE INDEX api_user_roles_active_idx ON alx_api_private.user_roles(user_id, expires_at);

CREATE TABLE alx_api_private.role_permissions (
  role_id uuid NOT NULL REFERENCES alx_api_private.roles(role_id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES alx_api_private.permissions(permission_id) ON DELETE CASCADE,
  assigned_by text REFERENCES public.users(user_id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE alx_api_private.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alx_api_private.role_permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY api_runtime_roles_select ON alx_api_private.roles
  FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_permissions_select ON alx_api_private.permissions
  FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_user_roles_select ON alx_api_private.user_roles
  FOR SELECT TO alx_api_runtime USING (true);
CREATE POLICY api_runtime_role_permissions_select ON alx_api_private.role_permissions
  FOR SELECT TO alx_api_runtime USING (true);

REVOKE ALL ON alx_api_private.roles, alx_api_private.permissions, alx_api_private.user_roles, alx_api_private.role_permissions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON alx_api_private.roles, alx_api_private.permissions, alx_api_private.user_roles, alx_api_private.role_permissions
  TO alx_api_runtime;

-- Intentionally no role, permission, or assignment seed: the frontend currently defines conflicting
-- default Employee/Accountant permission sets; decide and reconcile that matrix before production cutover.
