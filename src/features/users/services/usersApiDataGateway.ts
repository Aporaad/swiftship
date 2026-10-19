import { ApiClient } from '../../../data/http/api-client';
import { subscribePollingChannel } from '../../../data/http/polling-channel';

type ApiEnvelope<T> = { success: true; data: T };
type ApiUser = Record<string, unknown> & { userId?: string };
type UsersState = { users: ApiUser[] };
type UsersHandlers = { onData: (state: UsersState) => void; onError?: (error: unknown) => void };

/** عميل HTTP مشترك لجميع عمليات المستخدمين */
const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () => (typeof sessionStorage === 'undefined' ? null : (sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token'))),
  maxReadRetries: 0,
});

const toApiUser = (user: ApiUser): ApiUser => ({
  ...user,
  userId: String(user.userId ?? ''),
});

const readUsers = async (): Promise<ApiUser[]> => {
    const response = await client.get<ApiEnvelope<ApiUser[]>>('/api/v1/users', { page: 1, pageSize: 100 });
  return Array.isArray(response.data) ? response.data.map(toApiUser) : [];
};

export const usersApiDataGateway = {
  isReadEnabled: () => import.meta.env.VITE_USERS_API_READS === 'true' || import.meta.env.VITE_USE_HTTP_API === 'true',
  isWriteEnabled: () => import.meta.env.VITE_USERS_API_WRITES === 'true' || import.meta.env.VITE_USE_HTTP_API === 'true',

  /**
   * إنشاء مستخدم جديد عبر alx_api.
   * Create a new user through alx_api with Argon2id password hashing.
   */
  async createUser(input: {
    username: string;
    email?: string;
    fullName?: string;
    password: string;
    role?: string;
    systemPin?: string;
    phone?: string;
    address?: string;
    linkedType?: string;
    linkedEntity?: string;
  }): Promise<ApiUser> {
    const response = await client.post<ApiEnvelope<ApiUser>>('/api/v1/users', {
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      phone: input.phone,
      address: input.address,
      linkedType: input.linkedType,
      linkedEntity: input.linkedEntity,
    });
    const user = toApiUser(response.data);
    if (input.password) await this.adminResetPassword(String(user.userId), input.password);
    return user;
  },

  /**
   * تعديل بيانات مستخدم.
   * Update user data.
   */
  async updateUser(userId: string, input: Record<string, unknown>): Promise<ApiUser> {
    const response = await client.patch<ApiEnvelope<ApiUser>>(`/api/v1/users/${encodeURIComponent(userId)}`, input);
    return toApiUser(response.data);
  },

  /**
   * تعطيل مستخدم (Soft Delete).
   * Disable a user (Soft Delete).
   */
  async disableUser(userId: string): Promise<void> {
    await client.delete<ApiEnvelope<{ disabled: boolean; userId: string }>>(`/api/v1/users/${encodeURIComponent(userId)}`);
  },

  /**
   * إعادة تعيين كلمة مرور مستخدم.
   * Admin reset user password.
   */
  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    await client.post<ApiEnvelope<{ changed: boolean; sessionsRevoked: boolean }>>(
      `/api/v1/users/${encodeURIComponent(userId)}/password`,
      { newPassword },
    );
  },

  /**
   * إنهاء جميع جلسات المستخدم.
   * Revoke all active sessions for a user.
   */
  async revokeUserSessions(userId: string): Promise<void> {
    await client.post<ApiEnvelope<{ revoked: boolean; userId: string }>>(
      `/api/v1/users/${encodeURIComponent(userId)}/revoke-sessions`,
      {},
    );
  },

  /**
   * إنهاء جلسة محددة بأي مستخدم (صلاحيات إدارية).
   * Admin termination of any specific session (not limited to the caller's own session).
   */
  async terminateSession(sessionId: string): Promise<void> {
    // المسار الإداري الجديد يخوّل إنهاء جلسة أي مستخدم — admin route allows terminating any user's session
    await client.delete<ApiEnvelope<{ revoked: boolean }>>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    );
  },

  /**
   * الجلسات الحية لكل المستخدمين — عرض إداري بأسماء أصحابها وأجهزتهم.
   * Every live session across all users with their name, role, and device info (admin view).
   */
  async listAllSessions(): Promise<Record<string, unknown>[]> {
    const response = await client.get<ApiEnvelope<Record<string, unknown>[]>>('/api/v1/sessions', {
      limit: 1000,
      offset: 0,
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * سجل النشاط المسطّح لكل المستخدمين (view_users).
   * Flat activity-log feed across all users (requires view_users permission).
   */
  async listActivityLogs(options?: { userId?: string; action?: string; search?: string; limit?: number }): Promise<Record<string, unknown>[]> {
    const params: Record<string, unknown> = { limit: options?.limit ?? 200, offset: 0 };
    if (options?.userId) params['userId'] = options.userId;
    if (options?.action) params['action'] = options.action;
    if (options?.search) params['search'] = options.search;
    const response = await client.get<ApiEnvelope<Record<string, unknown>[]>>('/api/v1/activity-logs', params);
    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * مراقبة قائمة المستخدمين بالتحديث التلقائي.
   * Subscribe to users list with periodic refresh.
   */
  subscribe(handlers: UsersHandlers): () => void {
    // قناة واحدة لقائمة المستخدمين: كل شاشة مفتوحة عليها تتغذى من الطلب نفسه.
    // One channel for the users list: every screen open on it is fed by the same request.
    return subscribePollingChannel<UsersState>(
      'users',
      async () => ({ users: await readUsers() }),
      handlers.onData,
      handlers.onError ?? (() => undefined),
    );
  },
};
