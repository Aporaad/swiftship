import { ApiClient } from '../../../data/http/api-client';

type ApiEnvelope<T> = { success: true; data: T };
type ApiRole = { roleId: string; code: string; name: string; description?: string | null; permissions: string[]; isSystemRole?: boolean };
type RoleView = { id: string; title: string; permissions: string[]; code?: string; description?: string | null; isDefault?: boolean };

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () => (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});
const toView = (role: ApiRole): RoleView => ({
  id: role.roleId,
  title: role.name,
  code: role.code,
  description: role.description,
  permissions: Array.isArray(role.permissions) ? role.permissions : [],
  isDefault: role.isSystemRole === true,
});

export const rolesApiDataGateway = {
  isReadEnabled: () => import.meta.env.VITE_ROLES_API_READS === 'true',
  isWriteEnabled: () => import.meta.env.VITE_ROLES_API_WRITES === 'true',
  async list(): Promise<RoleView[]> {
    const response = await client.get<ApiEnvelope<ApiRole[]>>('/api/v1/roles', { limit: 200, offset: 0 });
    return Array.isArray(response.data) ? response.data.map(toView) : [];
  },
  async create(input: { code: string; name: string; description?: string; permissionCodes: string[] }): Promise<RoleView> {
    const response = await client.post<ApiEnvelope<ApiRole>>('/api/v1/roles', input);
    return toView(response.data);
  },
  async update(roleId: string, input: { name?: string; description?: string; permissionCodes?: string[] }): Promise<RoleView> {
    const response = await client.patch<ApiEnvelope<ApiRole>>(`/api/v1/roles/${encodeURIComponent(roleId)}`, input);
    return toView(response.data);
  },
  async remove(roleId: string): Promise<void> {
    await client.delete<ApiEnvelope<{ deleted: boolean }>>(`/api/v1/roles/${encodeURIComponent(roleId)}`);
  },
};
