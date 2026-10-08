import { ApiClient } from '../../../data/http/api-client';

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
  const response = await client.get<ApiEnvelope<ApiUser[]>>('/api/v1/users', { limit: 100, offset: 0 });
  return Array.isArray(response.data) ? response.data.map(toApiUser) : [];
};

export const usersApiDataGateway = {
  isReadEnabled: () => import.meta.env.VITE_USERS_API_READS === 'true',
  isWriteEnabled: () => import.meta.env.VITE_USERS_API_WRITES === 'true',

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
  }): Promise<ApiUser> {
    const response = await client.post<ApiEnvelope<ApiUser>>('/api/v1/users', input);
    return toApiUser(response.data);
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
   * مراقبة قائمة المستخدمين بالتحديث التلقائي.
   * Subscribe to users list with periodic refresh.
   */
  subscribe(handlers: UsersHandlers): () => void {
    let disposed = false;
    const refresh = async () => {
      try {
        const users = await readUsers();
        if (!disposed) handlers.onData({ users });
      } catch (error) {
        if (!disposed) handlers.onError?.(error);
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  },
};
