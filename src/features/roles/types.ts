export interface RoleViewModel {
  roleId: string;
  title: string | null;
  isDefault: boolean;
  permissions: string[];
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface RoleListFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SaveRoleInput {
  roleId: string;
  title: string | null;
  isDefault: boolean;
  permissions: string[];
}
