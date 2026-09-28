import type { AuditDto, IsoUtcString } from './common.dto';

/** JSON payload written by the legacy notification service; credentials are not present here. */
export interface NotificationPayload {
  title?: string | null;
  message?: string | null;
  link?: string | null;
  orderId?: string | null;
  userId?: string | null;
  associatedUserIds?: string[] | null;
  isPublic?: boolean | null;
  read?: boolean | null;
  category?: 'order' | 'finance' | 'system' | string | null;
  type?: 'info' | 'success' | 'warning' | 'error' | string | null;
  creatorId?: string | null;
  creatorName?: string | null;
}

export interface ActivityLogPayload {
  userName?: string | null;
  userRole?: string | null;
  details?: Record<string, unknown> | null;
  timestamp?: IsoUtcString | number | string | null;
}

export interface NotificationsDatabaseRow {
  notification_id: string;
  data: NotificationPayload | null;
  user_id: string | null;
  category: string | null;
  is_public: boolean;
  read: boolean;
  type: string | null;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface ActivityLogDatabaseRow {
  activity_log_id: string;
  data: ActivityLogPayload | null;
  user_id: string | null;
  action: string | null;
  category: string | null;
  target: string | null;
  type: string | null;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface NotificationsApiDto {
  notificationId: string;
  userId: string | null;
  category: string | null;
  isPublic: boolean;
  read: boolean;
  type: string | null;
  title: string | null;
  message: string | null;
  link: string | null;
  orderId: string | null;
  associatedUserIds: string[];
  creatorId: string | null;
  creatorName: string | null;
  createdAt: IsoUtcString;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ActivityLogApiDto {
  activityLogId: string;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  action: string | null;
  category: string | null;
  target: string | null;
  type: string | null;
  details: Record<string, unknown>;
  eventAt: IsoUtcString | null;
  createdAt: IsoUtcString;
  updatedAt: IsoUtcString | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface NotificationsCreateInput {
  userId?: string | null;
  category: string;
  type: string;
  isPublic?: boolean;
  title?: string | null;
  message: string;
  link?: string | null;
  orderId?: string | null;
  associatedUserIds?: string[];
}
export interface NotificationsUpdateInput {
  read?: boolean;
  title?: string | null;
  message?: string | null;
  link?: string | null;
}
export type NotificationsViewModel = Partial<NotificationsApiDto> & { id: string };
export type NotificationsAudit = AuditDto;
