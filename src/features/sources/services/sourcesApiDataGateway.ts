import { ApiClient } from '../../../data/http/api-client';

type ApiEnvelope<T> = { success: true; data: T };
type SourceRow = Record<string, unknown> & { id: string };
type ShippingCompanyRow = Record<string, unknown> & { id: string };

type SourceWriteInput = {
  sourceName: string;
  type?: string;
  sourceUrl?: string;
  contactInfo?: string;
  location?: string;
  notes?: string;
};

type ShippingCompanyWriteInput = {
  name: string;
  contactPerson?: string;
  phone?: string;
  trackingUrl?: string;
  address?: string;
  notes?: string;
};

type SourcesHandlers = {
  onData: (data: { sources: SourceRow[]; shippingCompanies: ShippingCompanyRow[] }) => void;
  onError?: (error: unknown) => void;
};

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () =>
    typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('alx_api_access_token'),
  maxReadRetries: 0,
});

export const sourcesApiDataGateway = {
  isEnabled: () => import.meta.env.VITE_SOURCES_API_READS === 'true' || import.meta.env.VITE_USE_HTTP_API === 'true',
  isWriteEnabled: () => import.meta.env.VITE_SOURCES_API_WRITES === 'true' || import.meta.env.VITE_USE_HTTP_API === 'true',

  async getSources(): Promise<SourceRow[]> {
    const response = await client.get<ApiEnvelope<SourceRow[]>>('/api/v1/reporting/sources', { limit: 100, offset: 0 });
    return (Array.isArray(response.data) ? response.data : []).map(r => ({
      ...r,
      id: String(r.sourceId ?? r.id ?? ''),
    }));
  },

  async getShippingCompanies(): Promise<ShippingCompanyRow[]> {
    const response = await client.get<ApiEnvelope<ShippingCompanyRow[]>>('/api/v1/reporting/shipping-companies', { limit: 100, offset: 0 });
    return (Array.isArray(response.data) ? response.data : []).map(r => ({
      ...r,
      id: String(r.companyId ?? r.id ?? ''),
    }));
  },

  async createSource(input: SourceWriteInput): Promise<SourceRow> {
    const response = await client.post<ApiEnvelope<SourceRow>>('/api/v1/operations/sources', input);
    return response.data;
  },

  async updateSource(id: string, input: Partial<SourceWriteInput>): Promise<SourceRow> {
    const response = await client.patch<ApiEnvelope<SourceRow>>(`/api/v1/operations/sources/${encodeURIComponent(id)}`, input);
    return response.data;
  },

  async deleteSource(id: string): Promise<void> {
    await client.delete<ApiEnvelope<{ deleted: boolean }>>(`/api/v1/operations/sources/${encodeURIComponent(id)}`);
  },

  async createShippingCompany(input: ShippingCompanyWriteInput): Promise<ShippingCompanyRow> {
    const response = await client.post<ApiEnvelope<ShippingCompanyRow>>('/api/v1/operations/shipping-companies', input);
    return response.data;
  },

  async updateShippingCompany(id: string, input: Partial<ShippingCompanyWriteInput>): Promise<ShippingCompanyRow> {
    const response = await client.patch<ApiEnvelope<ShippingCompanyRow>>(`/api/v1/operations/shipping-companies/${encodeURIComponent(id)}`, input);
    return response.data;
  },

  async deleteShippingCompany(id: string): Promise<void> {
    await client.delete<ApiEnvelope<{ deleted: boolean }>>(`/api/v1/operations/shipping-companies/${encodeURIComponent(id)}`);
  },

  subscribe(handlers: SourcesHandlers): () => void {
    let disposed = false;
    const refresh = async () => {
      try {
        const [sources, shippingCompanies] = await Promise.all([
          this.getSources().catch(() => []),
          this.getShippingCompanies().catch(() => []),
        ]);
        if (!disposed) handlers.onData({ sources, shippingCompanies });
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
