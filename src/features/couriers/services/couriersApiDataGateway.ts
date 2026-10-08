import { ApiClient } from '../../../data/http/api-client';

type ApiEnvelope<T> = { success: true; data: T };
type CourierRow = Record<string, unknown> & { id: string };

type CourierWriteInput = {
  courierId?: string;
  fullName: string;
  nameAr?: string;
  nameEn?: string;
  courierType?: string;
  commissionRate?: number;
  currency?: string;
  isActive?: boolean;
  accountId?: string;
};

type CouriersHandlers = {
  onData: (couriers: CourierRow[]) => void;
  onError?: (error: unknown) => void;
};

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () =>
    typeof sessionStorage === 'undefined' ? null : (sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

export const couriersApiDataGateway = {
  isEnabled: () => import.meta.env.VITE_COURIERS_API_READS === 'true' || import.meta.env.VITE_USE_HTTP_API === 'true',
  isWriteEnabled: () => import.meta.env.VITE_COURIERS_API_WRITES === 'true' || import.meta.env.VITE_USE_HTTP_API === 'true',

  async getCouriers(): Promise<CourierRow[]> {
    const response = await client.get<ApiEnvelope<CourierRow[]>>('/api/v1/reporting/couriers', { limit: 100, offset: 0 });
    return (Array.isArray(response.data) ? response.data : []).map(r => ({
      ...r,
      id: String(r.courierId ?? r.id ?? ''),
    }));
  },

  async createCourier(input: CourierWriteInput): Promise<CourierRow> {
    const response = await client.post<ApiEnvelope<CourierRow>>('/api/v1/operations/couriers', input);
    return response.data;
  },

  async updateCourier(courierId: string, input: Partial<CourierWriteInput>): Promise<CourierRow> {
    const response = await client.patch<ApiEnvelope<CourierRow>>(`/api/v1/operations/couriers/${encodeURIComponent(courierId)}`, input);
    return response.data;
  },

  async deleteCourier(courierId: string): Promise<void> {
    await client.delete<ApiEnvelope<{ deleted: boolean }>>(`/api/v1/operations/couriers/${encodeURIComponent(courierId)}`);
  },

  subscribe(handlers: CouriersHandlers): () => void {
    let disposed = false;
    const refresh = async () => {
      try {
        const couriers = await this.getCouriers();
        if (!disposed) handlers.onData(couriers);
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
