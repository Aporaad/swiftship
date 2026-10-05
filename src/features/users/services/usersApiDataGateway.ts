import { ApiClient } from '../../../data/http/api-client';

type ApiEnvelope<T> = { success: true; data: T };
type ApiUser = Record<string, unknown> & { userId?: string };
type UsersState = { users: ApiUser[] };
type UsersHandlers = { onData: (state: UsersState) => void; onError?: (error: unknown) => void };

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () => (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('alx_api_access_token')),
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
  async updateUser(userId: string, input: Record<string, unknown>): Promise<ApiUser> {
    const response = await client.patch<ApiEnvelope<ApiUser>>(`/api/v1/users/${encodeURIComponent(userId)}`, input);
    return toApiUser(response.data);
  },
  async disableUser(userId: string): Promise<void> {
    await client.delete<ApiEnvelope<{ disabled: boolean; userId: string }>>(`/api/v1/users/${encodeURIComponent(userId)}`);
  },
  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    await client.post<ApiEnvelope<{ changed: boolean; sessionsRevoked: boolean }>>(
      `/api/v1/users/${encodeURIComponent(userId)}/password`,
      { newPassword },
    );
  },
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
