import { ApiClient } from '../../../data/http/api-client';
import { subscribePollingChannel } from '../../../data/http/polling-channel';

type ApiEnvelope<T> = { success: true; data: T };
type SourceRow = Record<string, unknown> & { id: string };
type ShippingCompanyRow = Record<string, unknown> & { id: string };

type SourceWriteInput = {
  name: string;
  type?: string;
  sourceUrl?: string;
  nameAr?: string;
  nameEn?: string;
  isActive?: boolean;
  accountId?: string;
};

type ShippingCompanyWriteInput = {
  name: string;
  contactPerson?: string;
  phone?: string;
  trackingUrlTemplate?: string;
  address?: string;
  code?: string;
  countryId?: string;
  email?: string;
  apiUrl?: string;
  apiEnabled?: boolean;
  supportsTracking?: boolean;
  supportsWebhook?: boolean;
};

type SourcesHandlers = {
  onData: (data: { sources: SourceRow[]; shippingCompanies: ShippingCompanyRow[] }) => void;
  onError?: (error: unknown) => void;
};

type SourcesSnapshot = Parameters<SourcesHandlers['onData']>[0];

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () =>
    typeof sessionStorage === 'undefined' ? null : (sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

const normalizeSource = (row: SourceRow): SourceRow => ({
  ...row,
  id: String(row.sourceId ?? row.id ?? ''),
  source_name: row.source_name ?? row.name,
  source_url: row.source_url ?? row.sourceUrl,
  financialAccountCode: row.financialAccountCode ?? row.accountCode,
});

const normalizeShippingCompany = (row: ShippingCompanyRow): ShippingCompanyRow => ({
  ...row,
  id: String(row.companyId ?? row.shippingCompanyId ?? row.id ?? ''),
  contact_person: row.contact_person ?? row.contactPerson,
  tracking_url: row.tracking_url ?? row.trackingUrlTemplate ?? row.url,
  financialAccountCode: row.financialAccountCode ?? row.accountCode,
});

export const sourcesApiDataGateway = {
  isEnabled: () => import.meta.env.VITE_SOURCES_API_READS === 'true' || import.meta.env.VITE_USE_HTTP_API === 'true',
  isWriteEnabled: () => import.meta.env.VITE_SOURCES_API_WRITES === 'true' || import.meta.env.VITE_USE_HTTP_API === 'true',

  async getSources(): Promise<SourceRow[]> {
    const response = await client.get<ApiEnvelope<SourceRow[]>>('/api/v1/reporting/sources', { page: 1, pageSize: 100 });
    return (Array.isArray(response.data) ? response.data : []).map(normalizeSource);
  },

  async getShippingCompanies(): Promise<ShippingCompanyRow[]> {
    const response = await client.get<ApiEnvelope<ShippingCompanyRow[]>>('/api/v1/reporting/shipping-companies', { page: 1, pageSize: 100 });
    return (Array.isArray(response.data) ? response.data : []).map(normalizeShippingCompany);
  },

  async createSource(input: SourceWriteInput): Promise<SourceRow> {
    const response = await client.post<ApiEnvelope<SourceRow>>('/api/v1/operations/sources', input);
    return normalizeSource(response.data);
  },

  async updateSource(id: string, input: Partial<SourceWriteInput>): Promise<SourceRow> {
    const response = await client.patch<ApiEnvelope<SourceRow>>(`/api/v1/operations/sources/${encodeURIComponent(id)}`, input);
    return normalizeSource(response.data);
  },

  async deleteSource(id: string): Promise<void> {
    await client.delete<ApiEnvelope<{ deleted: boolean }>>(`/api/v1/operations/sources/${encodeURIComponent(id)}`);
  },

  async createShippingCompany(input: ShippingCompanyWriteInput): Promise<ShippingCompanyRow> {
    const response = await client.post<ApiEnvelope<ShippingCompanyRow>>('/api/v1/operations/shipping-companies', input);
    return normalizeShippingCompany(response.data);
  },

  async updateShippingCompany(id: string, input: Partial<ShippingCompanyWriteInput>): Promise<ShippingCompanyRow> {
    const response = await client.patch<ApiEnvelope<ShippingCompanyRow>>(`/api/v1/operations/shipping-companies/${encodeURIComponent(id)}`, input);
    return normalizeShippingCompany(response.data);
  },

  async deleteShippingCompany(id: string): Promise<void> {
    await client.delete<ApiEnvelope<{ deleted: boolean }>>(`/api/v1/operations/shipping-companies/${encodeURIComponent(id)}`);
  },

  subscribe(handlers: SourcesHandlers): () => void {
    // مصدر واحد للمصادر وشركات الشحن يغذّي كل الشاشات المشتركة فيهما.
    // One load of sources and shipping companies feeds every screen that shows them.
    return subscribePollingChannel<SourcesSnapshot>(
      'sources-and-shipping-companies',
      async () => {
        const [sources, shippingCompanies] = await Promise.all([
          this.getSources().catch(() => [] as SourceRow[]),
          this.getShippingCompanies().catch(() => [] as ShippingCompanyRow[]),
        ]);
        return { sources, shippingCompanies };
      },
      handlers.onData,
      handlers.onError ?? (() => undefined),
    );
  },
};
