import { ApiClient } from '../../../data/http/api-client';

type ApiEnvelope<T> = { success: true; data: T };
type CustomerApiRow = Record<string, unknown> & { customerId?: string; id?: string };

type CustomersHandlers = {
  onData: (customers: CustomerApiRow[]) => void;
  onError?: (error: unknown) => void;
};

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () =>
    typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('alx_api_access_token'),
  maxReadRetries: 0,
});

export const customersApiDataGateway = {
  isEnabled: () => import.meta.env.VITE_CUSTOMERS_API_READS === 'true',
  subscribe(handlers: CustomersHandlers): () => void {
    let disposed = false;

    const refresh = async () => {
      try {
        const response = await client.get<ApiEnvelope<CustomerApiRow[]>>('/api/v1/customers', {
          limit: 100,
          offset: 0,
        });
        if (!disposed) {
          handlers.onData(
            (Array.isArray(response.data) ? response.data : []).map((row) => ({
              ...row,
              id: String(row.customerId ?? row.id ?? ''),
            })),
          );
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
