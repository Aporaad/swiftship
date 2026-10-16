import type { AuditDto, IsoUtcString } from './common.dto';

/**
 * أعمدة notifications الحقيقية بعد إسقاط عمود jsonb (الترحيل 0034).
 * Real notifications columns after the jsonb payload column was dropped (migration 0034).
 * لا يوجد عمود link ولا order_id؛ هذان الحقلان بقيا في شكل الواجهة فقط.
 * There is no link or order_id column; those fields remain in the API/UI shape only.
 */
export interface NotificationsDatabaseRow {
  notification_id: string;
  user_id: string | null;
  category: string | null;
  is_public: boolean;
  /** حالة القراءة المسطّحة بدل عمود read المفهرس. Flat read state replacing the legacy read column. */
  is_read: boolean;
  /** مستلمو الإشعار: نص مصفوفي + صفوف notification_recipient. Recipients: text array plus notification_recipient rows. */
  recipient_ids: string[] | null;
  title: string | null;
  message: string | null;
  type: string | null;
  creator_id: string | null;
  creator_name: string | null;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * أعمدة activity_logs بعد الإسقاط: التفاصيل النصية في عمود details وصفوف activity_log_detail لكل حقل.
 * activity_logs columns after the drop: free text in details plus one activity_log_detail row per field.
 */
export interface ActivityLogDatabaseRow {
  activity_log_id: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  action: string | null;
  category: string | null;
  target: string | null;
  type: string | null;
  summary: string | null;
  /** نص حر (عمود text)، وليس حمولة jsonb. Free text (a text column), never a jsonb payload. */
  details: string | null;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

/** صف activity_log_detail ابن: حقل واحد باسمه وقيمته النصية. One child activity_log_detail row: field name and text value. */
export interface ActivityLogDetailRow {
  field_name?: unknown;
  field_value?: unknown;
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
