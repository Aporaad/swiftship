import type { RolesFeatureApi } from '../api';
import type { RoleListFilters, RoleViewModel, SaveRoleInput } from '../types';
import { validateSaveRoleInput } from '../schemas/roleSchema';

export class RoleApplicationService {
  constructor(private readonly api: RolesFeatureApi) {}

  list(filters?: RoleListFilters): Promise<RoleViewModel[]> {
    return this.api.listRoles(filters);
  }

  get(roleId: string): Promise<RoleViewModel | null> {
    if (!roleId.trim()) throw new Error('roleId is required');
    return this.api.getRole(roleId);
  }

  save(input: SaveRoleInput): Promise<RoleViewModel> {
    validateSaveRoleInput(input);
    return this.api.saveRole({
      ...input,
      roleId: input.roleId.trim(),
      title: input.title?.trim() || '',
      permissions: [...new Set(input.permissions.map((permission) => permission.trim()))].sort(),
    });
  }
}
