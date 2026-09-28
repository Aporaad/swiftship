export type { RolesViewModel as RoleViewModel } from '../../data/dtos/roles.dto';

export interface RoleListFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export type { RolesCreateInput as SaveRoleInput } from '../../data/dtos/roles.dto';
