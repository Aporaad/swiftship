/**
 * notificationsApiDataGateway.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * بوابة بيانات الإشعارات عبر alx_api فقط (API-only notifications data gateway).
 * لا Firestore ولا Supabase: كل قراءة أو كتابة تمر عبر REST، وكل حقل عمود رئيسي مسطّح.
 * No Firestore and no Supabase: every read/write goes through REST and every field is a flat column.
 */
import { appApiClient, type ApiEnvelope } from '../../../data/http/app-api-client';

// سجل إشعار كما تُرجعه الواجهة الخلفية (أعمدة مسطّحة، بلا payload)
// Notification record as returned by alx_api — flat columns, no payload bag.
export interface ApiNotification {
  notificationId: string;
  userId: string | null;
  title: string;
  message: string;
  type: string;
  category: string | null;
  isPublic: boolean;
  isRead: boolean;
  creatorId: string | null;
  creatorName: string | null;
  associatedUserIds: string[];
  createdAt: string;
  updatedAt: string | null;
}

// سجل حدث إرسال خارجي من جدول الـ Outbox
// External delivery event read from the outbox delivery log.
export interface ApiDeliveryLog {
  outboxId: string;
  channel: string;
  recipient: string;
  templateId: string | null;
  message: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptedAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface NotificationListQuery {
  limit?: number;
  offset?: number;
  isRead?: boolean;
  category?: string;
  search?: string;
  /**
   * 'all' يستخدم مسار مدير الإشعارات غير المحد النطاق — requires manage_notifications server-side.
   */
  scope?: 'mine' | 'all';
}

// بناء سلسلة الاستعلام بدل تمرير كائن غير معلوم الأنواع
// Query string is built explicitly so untyped keys cannot leak into the request.
function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const asNotification = (value: unknown): ApiNotification => {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    notificationId: String(row.notificationId ?? ''),
    userId: row.userId === null || row.userId === undefined ? null : String(row.userId),
    title: String(row.title ?? ''),
    message: String(row.message ?? ''),
    type: String(row.type ?? 'system'),
    category: row.category === null || row.category === undefined ? null : String(row.category),
    isPublic: Boolean(row.isPublic),
    isRead: Boolean(row.isRead),
    creatorId: row.creatorId === null || row.creatorId === undefined ? null : String(row.creatorId),
    creatorName: row.creatorName === null || row.creatorName === undefined ? null : String(row.creatorName),
    associatedUserIds: asArray<unknown>(row.associatedUserIds).map((item) => String(item)),
    createdAt: String(row.createdAt ?? ''),
    updatedAt: row.updatedAt === null || row.updatedAt === undefined ? null : String(row.updatedAt),
  };
};

const asDeliveryLog = (value: unknown): ApiDeliveryLog => {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    outboxId: String(row.outboxId ?? ''),
    channel: String(row.channel ?? ''),
    recipient: String(row.recipient ?? ''),
    templateId: row.templateId === null || row.templateId === undefined ? null : String(row.templateId),
    message: String(row.message ?? ''),
    status: String(row.status ?? 'queued'),
    attemptCount: Number(row.attemptCount ?? 0),
    maxAttempts: Number(row.maxAttempts ?? 0),
    lastAttemptedAt: row.lastAttemptedAt === null || row.lastAttemptedAt === undefined ? null : String(row.lastAttemptedAt),
    sentAt: row.sentAt === null || row.sentAt === undefined ? null : String(row.sentAt),
    errorMessage: row.errorMessage === null || row.errorMessage === undefined ? null : String(row.errorMessage),
    createdAt: String(row.createdAt ?? ''),
    updatedAt: row.updatedAt === null || row.updatedAt === undefined ? null : String(row.updatedAt),
  };
};

export interface CreateNotificationInput {
  title: string;
  message: string;
  userId?: string | null;
  type?: 'system' | 'order' | 'shipment' | 'finance' | 'alert' | 'info' | 'success' | 'warning' | 'error';
  category?: 'order' | 'finance' | 'system' | 'shipment' | 'alert';
  isPublic?: boolean;
  associatedUserIds?: readonly string[];
}

export const notificationsApiDataGateway = {
  /** قائمة الإشعارات المرئية للمستخدم المصادق عليه + العدد الكلي من الـ meta. */
  async listNotifications(query: NotificationListQuery = {}): Promise<{ items: ApiNotification[]; total: number }> {
    const path = query.scope === 'all' ? '/api/v1/notifications/all' : '/api/v1/notifications';
    const response = await appApiClient.get<ApiEnvelope<unknown>>(
      `${path}${toQueryString({
        limit: query.limit ?? 200,
        offset: query.offset ?? 0,
        isRead: query.isRead,
        category: query.category,
        search: query.search,
      })}`,
    );
    const items = asArray<unknown>(response.data).map(asNotification);
    return { items, total: Number(response.meta?.total ?? items.length) };
  },

  /** عدد الإشعارات غير المقروءة من العدّاد الخادمي، لا من طول الصفحة. */
  async getUnreadCount(scope: 'mine' | 'all' = 'mine'): Promise<number> {
    const { total } = await this.listNotifications({ limit: 1, offset: 0, isRead: false, scope });
    return total;
  },

  /** إنشاء إشعار داخلي — كل الحقول أعمدة رئيسية ولا حقل payload. */
  async createNotification(input: CreateNotificationInput): Promise<ApiNotification> {
    const response = await appApiClient.post<ApiEnvelope<unknown>>('/api/v1/notifications', input);
    return asNotification(response.data);
  },

  /** تعليم إشعار كمقروء لهذا المستخدم (حالة القراءة لكل مستلم في الجدول العلائقي). */
  async markAsRead(notificationId: string): Promise<ApiNotification> {
    const response = await appApiClient.patch<ApiEnvelope<unknown>>(
      `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
      {},
    );
    return asNotification(response.data);
  },

  /** تعليم كل إشعارات المستخدم الحالي كمقروءة؛ يُرجع عدد السطور المحدّثة. */
  async markAllAsRead(): Promise<number> {
    const response = await appApiClient.post<ApiEnvelope<{ updatedCount?: number }>>(
      '/api/v1/notifications/read-all',
      {},
    );
    return Number(response.data?.updatedCount ?? 0);
  },

  /** سجل أحداث الإرسال الخارجي (WhatsApp/Email/SMS) من جدول الـ Outbox. */
  async listDeliveryLogs(query: { limit?: number; offset?: number; status?: string; channel?: string } = {}): Promise<{ items: ApiDeliveryLog[]; total: number }> {
    const response = await appApiClient.get<ApiEnvelope<unknown>>(
      `/api/v1/notifications/delivery-logs${toQueryString({
        limit: query.limit ?? 150,
        offset: query.offset ?? 0,
        status: query.status,
        channel: query.channel,
      })}`,
    );
    return {
      items: asArray<unknown>(response.data).map(asDeliveryLog),
      total: Number(response.meta?.total ?? asArray(response.data).length),
    };
  },

  /** تسجيل رسالة واتساب في قائمة انتظار الإرسال؛ الإرسال الفعلي يتم من العامل الخلفي. */
  async sendExternal(input: {
    recipient: string;
    channel: 'whatsapp' | 'email' | 'sms';
    message: string;
    templateId?: string;
    idempotencyKey?: string;
  }): Promise<{ outboxId: string; status: string }> {
    const response = await appApiClient.post<ApiEnvelope<{ outboxId?: string; status?: string }>>(
      '/api/v1/notifications/send-external',
      input,
    );
    return { outboxId: String(response.data?.outboxId ?? ''), status: String(response.data?.status ?? 'queued') };
  },
};
