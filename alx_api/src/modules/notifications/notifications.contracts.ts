/**
 * notifications.contracts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * عقود ومواصفات وحدة الإشعارات (Notifications Module Contracts).
 * Defines DTOs, interfaces, and repository contract for Notifications.
 * Follows exactOptionalPropertyTypes strictness.
 */

// DTO للإشعار الداخلي كما يُرجع من الـ API
// Internal notification record DTO
export interface NotificationRecord {
  notificationId: string;
  userId: string | null;
  title: string;
  body: string;
  /** نوع الإشعار: system | order | shipment | finance | alert */
  type: string;
  isRead: boolean;
  /** قناة الإشعار: in_app | whatsapp | email | sms */
  channel: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
}

// مدخلات إنشاء إشعار داخلي
// Input for creating an in-app notification
export interface CreateNotificationInput {
  userId?: string | null;
  title: string;
  body: string;
  type?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
  actorId?: string;
}

// مدخلات إرسال إشعار خارجي (WhatsApp / Email / SMS) عبر Outbox
// Input for sending an external notification via outbox pattern
export interface SendExternalNotificationInput {
  /** رقم الهاتف أو البريد الإلكتروني للمستلم */
  recipient: string;
  channel: 'whatsapp' | 'email' | 'sms';
  templateId?: string;
  message: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

// معاملات ترقيم وفلترة الإشعارات
// Pagination + filter query parameters
export interface PageQuery {
  limit: number;
  offset: number;
  userId?: string;
  isRead?: boolean;
}

// نتيجة قائمة مُرقَّمة
// Paginated list result
export interface PageResult<T> {
  items: T[];
  total: number;
}

// عقد مستودع الإشعارات
// Notifications repository contract
export interface NotificationsRepository {
  listNotifications(query: PageQuery): Promise<PageResult<NotificationRecord>>;
  getNotification(notificationId: string): Promise<NotificationRecord | null>;
  createNotification(input: CreateNotificationInput): Promise<NotificationRecord>;
  markAsRead(notificationId: string, userId?: string): Promise<NotificationRecord | null>;
  markAllAsRead(userId: string): Promise<number>;
  recordOutboxEvent(input: SendExternalNotificationInput): Promise<{ outboxId: string; status: string }>;
}
