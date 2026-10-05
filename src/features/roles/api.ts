import type { RoleListFilters, RoleViewModel, SaveRoleInput } from './types';

export interface RolesFeatureApi {
  listRoles(filters?: RoleListFilters): Promise<RoleViewModel[]>;
  getRole(roleId: string): Promise<RoleViewModel | null>;
  saveRole(input: SaveRoleInput): Promise<RoleViewModel>;
  deleteRole(roleId: string): Promise<void>;
}
