import type { AuditDto, IsoUtcString } from './common.dto';

/** Safe projection of public.users; password and system_pin are intentionally excluded. */
export interface UsersDatabaseRow {
  user_id: string;
  role: string;
  username: string | null;
  email: string | null;
  disabled: boolean;
  linked_type: string | null;
  linked_entity: string | null;
  full_name: string | null;
  is_root: boolean;
  phone: string | null;
  address: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_seen: string | null;
  last_seen_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface UsersApiDto {
  userId: string;
  roleId: string;
  username: string | null;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  address: string | null;
  disabled: boolean;
  isRoot: boolean;
  linkedType: string | null;
  linkedEntity: string | null;
  lastSeenAt: IsoUtcString | null;
  lastSeenLabel: string | null;
  createdAt: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface UsersCreateInput {
  roleId: string;
  username: string;
  email?: string | null;
  fullName: string;
  phone?: string | null;
  address?: string | null;
  linkedType?: string | null;
  linkedEntity?: string | null;
}

export interface UsersUpdateInput {
  roleId?: string;
  username?: string;
  email?: string | null;
  fullName?: string;
  phone?: string | null;
  address?: string | null;
  disabled?: boolean;
  linkedType?: string | null;
  linkedEntity?: string | null;
}

export type UsersViewModel = Partial<UsersApiDto> & { id: string };
export type UsersAudit = AuditDto;
