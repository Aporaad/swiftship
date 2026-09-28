import type { AuditDto, IsoUtcString } from './common.dto';

export interface AuthDatabaseRow {
  session_id: string;
  user_id: string | null;
  created_at: string;
  last_seen: string | null;
  force_logout: boolean;
  device_info: string | null;
  role: string | null;
  full_name: string | null;
  email: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface AuthApiDto {
  sessionId: string;
  userId: string | null;
  role: string | null;
  fullName: string | null;
  email: string | null;
  deviceInfo: string | null;
  forceLogout: boolean;
  createdAt: IsoUtcString;
  lastSeen: IsoUtcString | null;
  updatedAt: IsoUtcString | null;
}

export interface AuthCreateInput {
  userId: string;
  deviceInfo?: string | null;
}

export interface AuthUpdateInput {
  forceLogout?: boolean;
  lastSeen?: IsoUtcString | null;
}

export type AuthViewModel = Partial<AuthApiDto> & { id: string };

export type AuthAudit = AuditDto;

export interface CurrentUserDto {
  id: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  username: string | null;
  role: string | null;
  isRoot: boolean;
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: CurrentUserDto }
  | { status: 'unauthenticated' }
  | { status: 'expired' }
  | { status: 'locked' };
