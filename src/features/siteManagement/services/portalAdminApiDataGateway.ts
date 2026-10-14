import { ApiClient } from '../../../data/http/api-client';

type Envelope<T> = { success: true; data: T };
const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () => typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token'),
  maxReadRetries: 0,
});
const normalize = (row: Record<string, unknown>) => ({
  ...row,
  id: String(row.id ?? ''),
  portal_role: row.role === 'customer' ? 'client' : row.role,
  approval_status: row.approvalStatus,
  linkedCustomerId: row.linkedCustomerId,
  customerDetails: row.customerDetails ?? {},
});
export const portalAdminApiDataGateway = {
  // قائمة البوابة محدّدة بـ 200 صف لكل صفحة — the portal list endpoint caps pages at 200 rows,
  // so the admin table collects every page instead of silently truncating.
  async listUsers(): Promise<any[]> {
    const rows: any[] = [];
    for (let offset = 0; ; offset += 200) {
      const response = await client.get<Envelope<any[]>>('/api/v1/portal/admin/users', { limit: 200, offset });
      const pageRows = Array.isArray(response.data) ? response.data : [];
      rows.push(...pageRows.map(normalize));
      if (pageRows.length < 200) break;
    }
    return rows;
  },
  async createUser(input: Record<string, unknown>): Promise<any> {
    const response = await client.post<Envelope<any>>('/api/v1/portal/admin/users', {
      ...input,
      role: input.role === 'client' ? 'customer' : input.role,
      approvalStatus: input.approvalStatus ?? input.approval_status,
    });
    return normalize(response.data);
  },
  async updateUser(id: string, input: Record<string, unknown>): Promise<any> {
    const response = await client.patch<Envelope<any>>(`/api/v1/portal/admin/users/${encodeURIComponent(id)}`, input);
    return normalize(response.data);
  },
  async setApproval(id: string, approvalStatus: string): Promise<any> {
    const response = await client.post<Envelope<any>>(`/api/v1/portal/admin/users/${encodeURIComponent(id)}/approval`, { approvalStatus });
    return normalize(response.data);
  },
  async setDisabled(id: string, disabled: boolean): Promise<any> {
    const response = await client.post<Envelope<any>>(`/api/v1/portal/admin/users/${encodeURIComponent(id)}/disabled`, { disabled });
    return normalize(response.data);
  },
  async deleteUser(id: string): Promise<void> {
    await client.delete<Envelope<{ deleted: boolean }>>(`/api/v1/portal/admin/users/${encodeURIComponent(id)}`);
  },
  async saveCustomerDetails(customerId: string, details: Record<string, unknown>, userUid = ''): Promise<Record<string, unknown>> {
    const response = await client.requestWithBodyForGateway<Envelope<Record<string, unknown>>>('PUT', `/api/v1/portal/admin/customers/${encodeURIComponent(customerId)}/details`, { ...details, userUid });
    return response.data;
  },
};
