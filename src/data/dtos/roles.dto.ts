import type { AuditDto, IsoUtcString } from './common.dto';

export interface RolesDatabaseRow {
  role_id: string;
  title: string | null;
  is_default: boolean;
  // الصلاحيات لم تعد عمودًا في roles؛ تأتي صفوفًا من role_permission (role_id, permission_code).
  // Permissions are no longer a roles column; they come from role_permission (role_id, permission_code) rows.
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  code: string | null;
  description: string | null;
}

export interface RolesApiDto {
  roleId: string;
  title: string | null;
  code: string | null;
  description: string | null;
  isDefault: boolean;
  permissions: string[];
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface RolesCreateInput {
  roleId: string;
  title: string;
  code?: string | null;
  description?: string | null;
  isDefault?: boolean;
  permissions: string[];
}

export interface RolesUpdateInput {
  title?: string | null;
  code?: string | null;
  description?: string | null;
  isDefault?: boolean;
  permissions?: string[];
}

export type RolesViewModel = Omit<RolesApiDto, 'code' | 'description'> & Partial<Pick<RolesApiDto, 'code' | 'description'>>;
export type RolesAudit = AuditDto;
