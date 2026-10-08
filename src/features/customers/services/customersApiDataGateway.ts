import { ApiClient } from '../../../data/http/api-client';

type ApiEnvelope<T> = { success: true; data: T };
type CustomerApiRow = Record<string, unknown> & { customerId?: string; id?: string };

type CustomerWriteInput = {
  customerId?: string;
  fullName: string;
  phone?: string;
  email?: string;
  city?: string;
  address?: string;
  notes?: string;
  currency?: string;
};

type CustomersHandlers = {
  onData: (customers: CustomerApiRow[]) => void;
  onError?: (error: unknown) => void;
};

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () =>
    typeof sessionStorage === 'undefined' ? null : (sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

export const customersApiDataGateway = {
  isEnabled: () => import.meta.env.VITE_CUSTOMERS_API_READS === 'true' || import.meta.env.VITE_USE_HTTP_API === 'true',
  isWriteEnabled: () => import.meta.env.VITE_CUSTOMERS_API_WRITES === 'true' || import.meta.env.VITE_USE_HTTP_API === 'true',

  async getCustomers(): Promise<CustomerApiRow[]> {
    const response = await client.get<ApiEnvelope<CustomerApiRow[]>>('/api/v1/customers', {
      limit: 100,
      offset: 0,
    });
    return (Array.isArray(response.data) ? response.data : []).map((row) => ({
      ...row,
      id: String(row.customerId ?? row.id ?? ''),
    }));
  },

  async createCustomer(input: CustomerWriteInput): Promise<CustomerApiRow> {
    const response = await client.post<ApiEnvelope<CustomerApiRow>>('/api/v1/customers', input);
    return response.data;
  },

  async updateCustomer(customerId: string, input: Partial<CustomerWriteInput>): Promise<CustomerApiRow> {
    const response = await client.patch<ApiEnvelope<CustomerApiRow>>(`/api/v1/customers/${encodeURIComponent(customerId)}`, input);
    return response.data;
  },

  async deleteCustomer(customerId: string): Promise<void> {
    await client.delete<ApiEnvelope<{ deleted: boolean }>>(`/api/v1/customers/${encodeURIComponent(customerId)}`);
  },

  subscribe(handlers: CustomersHandlers): () => void {
    let disposed = false;

    const refresh = async () => {
      try {
        const customers = await this.getCustomers();
        if (!disposed) {
          handlers.onData(customers);
        }
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
