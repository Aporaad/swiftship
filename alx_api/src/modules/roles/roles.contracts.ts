import type { PageQuery, PageResult } from '../operations/operations.contracts';

export interface RoleRecord {
  roleId: string;
  code: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionRecord {
  code: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface RoleInput {
  code: string;
  name: string;
  description?: string | null;
  permissionCodes: readonly string[];
  actorId?: string;
}

export interface RoleUpdateInput {
  roleId: string;
  name?: string;
  description?: string | null;
  permissionCodes?: readonly string[];
  actorId?: string;
}

export interface RolesRepository {
  listRoles(input: PageQuery): Promise<PageResult<RoleRecord>>;
  listPermissions(): Promise<readonly PermissionRecord[]>;
  createRole(input: RoleInput): Promise<RoleRecord>;
  updateRole(input: RoleUpdateInput): Promise<RoleRecord | null>;
  deleteRole(roleId: string, actorId?: string): Promise<boolean>;
}
