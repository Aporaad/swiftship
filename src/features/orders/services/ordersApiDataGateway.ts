import { ApiClient, ApiClientError } from '../../../data/http/api-client';
import type { OrdersFeatureApi, OrdersCollectionRepository, OrdersWritePayload } from '../api';
import { legacyOrdersApi } from './legacyOrdersApi';

type ApiEnvelope<T> = { success: true; data: T };
type ApiRow = Record<string, unknown> & { id?: string };

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () =>
    typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('alx_api_access_token'),
  maxReadRetries: 0,
});

export const isOrdersApiReadEnabled = () => import.meta.env.VITE_ORDERS_API_READS === 'true';
export const isOrdersApiWriteEnabled = () => import.meta.env.VITE_ORDERS_API_WRITES === 'true';

function normalizeRow(row: ApiRow, key: string): ApiRow & { id: string } {
  return { ...row, id: String(row[key] ?? row.id ?? '') };
}

function apiCollection<T extends ApiRow>(path: string, key: string): OrdersCollectionRepository<T> {
  const read = async (): Promise<readonly T[]> => {
    const response = await client.get<ApiEnvelope<ApiRow[]>>(path, { limit: 100, offset: 0 });
    return (Array.isArray(response.data) ? response.data : []).map(row => normalizeRow(row, key) as T);
  };
  return {
    subscribe(onData, onError) {
      let disposed = false;
      const refresh = async () => {
        try {
          const records = await read();
          if (!disposed) onData({ records });
        } catch (error) {
          if (!disposed) onError?.(error);
        }
      };
      void refresh();
      const timer = setInterval(() => void refresh(), 30_000);
      return () => {
        disposed = true;
        clearInterval(timer);
      };
    },
    list: read,
    async get(id) {
      const response = await client.get<ApiEnvelope<ApiRow>>(`${path}/${id}`);
      return normalizeRow(response.data, key) as T;
    },
    create: (id, payload) => legacyOrdersApi.collections.orders.create(id, payload as never),
    set: (id, payload) => legacyOrdersApi.collections.orders.set(id, payload as never),
    update: (id, payload) => legacyOrdersApi.collections.orders.update(id, payload as never),
    delete: id => legacyOrdersApi.collections.orders.delete(id),
  };
}

function canonicalProduct(payload: OrdersWritePayload, id: string): Record<string, unknown> {
  return {
    productId: id,
    productNameAr: payload.productNameAr ?? payload.product_name_ar,
    productNameEn: payload.productNameEn ?? payload.product_name_en,
    productUrl: payload.productUrl ?? payload.product_url,
    productPriceCurrency: payload.productPriceCurrency ?? payload.product_price_currency,
    unitPrice: payload.unitPrice ?? payload.unit_price,
    itemCategoryId: payload.itemCategoryId ?? payload.item_category_id,
    cbm: payload.cbm,
    width: payload.width,
    height: payload.height,
    length: payload.length,
    weight: payload.weight,
  };
}

export const ordersApiDataGateway: OrdersFeatureApi = {
  collections: {
    ...legacyOrdersApi.collections,
    orders: apiCollection('/api/v1/orders', 'orderId') as OrdersFeatureApi['collections']['orders'],
    shipments: apiCollection('/api/v1/shipments', 'shipmentId') as OrdersFeatureApi['collections']['shipments'],
    products: {
      ...apiCollection('/api/v1/products', 'productId'),
      ...(isOrdersApiWriteEnabled() ? {
        create: async (id: string, payload: OrdersWritePayload) => {
          const response = await client.post<ApiEnvelope<ApiRow>>('/api/v1/products', canonicalProduct(payload, id));
          return { id: String(response.data.productId ?? id) };
        },
        update: async (id: string, payload: OrdersWritePayload) => {
          await client.patch<ApiEnvelope<ApiRow>>(`/api/v1/products/${id}`, canonicalProduct(payload, id));
        },
      } : {}),
    } as OrdersFeatureApi['collections']['products'],
  },
  commands: {
    ...legacyOrdersApi.commands,
    ...(isOrdersApiWriteEnabled() ? {
      createOrderAggregate: async (input: Parameters<NonNullable<OrdersFeatureApi['commands']['createOrderAggregate']>>[0]) => {
        const idempotencyKey = `order-create-${input.order.orderNumber}`;
        const response = await client.post<ApiEnvelope<ApiRow>>('/api/v1/orders', {
          ...input.order,
          items: input.items,
          shipments: input.shipments,
        }, { 'Idempotency-Key': idempotencyKey });
        return response.data;
      },
    } : {}),
    ...(isOrdersApiWriteEnabled() ? {
      upsertShipment: async (id: string, payload: OrdersWritePayload) => {
        const shipment = {
          shipmentId: id,
          orderId: payload.orderId ?? payload.order_id,
          trackingNumber: payload.trackingNumber ?? payload.tracking_number,
          shippingCompanyId: payload.shippingCompanyId ?? payload.shipping_company_id,
          courierId: payload.courierId ?? payload.courier_id,
          shipmentStatus: payload.shipmentStatus ?? payload.shipment_status,
          shippingCost: payload.shippingCost ?? payload.shipping_cost,
          weight: payload.weight,
          shippingType: payload.shippingType,
          shippingSource: payload.shippingSource,
          shippingDestination: payload.shippingDestination,
          cartonCount: payload.cartonCount ?? payload.carton_count,
        };
        let exists = true;
        try {
          await client.get<ApiEnvelope<ApiRow>>(`/api/v1/shipments/${id}`);
        } catch (error) {
          if (!(error instanceof ApiClientError)) throw error;
          exists = false;
        }
        if (exists) await client.patch<ApiEnvelope<ApiRow>>(`/api/v1/shipments/${id}`, shipment);
        else await client.post<ApiEnvelope<ApiRow>>('/api/v1/shipments', shipment);
      },
      updateShipment: async (id: string, changes: OrdersWritePayload) => {
        await client.patch<ApiEnvelope<ApiRow>>(`/api/v1/shipments/${id}`, {
          trackingNumber: changes.trackingNumber ?? changes.tracking_number,
          shippingCompanyId: changes.shippingCompanyId ?? changes.shipping_company_id,
          courierId: changes.courierId ?? changes.courier_id,
          shipmentStatus: changes.shipmentStatus ?? changes.shipment_status,
          shippingCost: changes.shippingCost ?? changes.shipping_cost,
          weight: changes.weight,
          shippingType: changes.shippingType,
          shippingSource: changes.shippingSource,
          shippingDestination: changes.shippingDestination,
          cartonCount: changes.cartonCount ?? changes.carton_count,
        });
      },
      updateShipmentStatus: async (id: string, status: string) => {
        await client.patch<ApiEnvelope<ApiRow>>(`/api/v1/shipments/${id}`, { shipmentStatus: status });
      },
    } : {}),
  },
};
