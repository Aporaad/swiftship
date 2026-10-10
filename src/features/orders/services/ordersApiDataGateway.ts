import { ApiClient, ApiClientError } from '../../../data/http/api-client';
import type { OrdersFeatureApi, OrdersCollectionRepository, OrdersWritePayload } from '../api';
import type { OrderFeatureRecord, ShipmentFeatureRecord } from '../types';

type ApiEnvelope<T> = { success: true; data: T };
type ApiRow = Record<string, unknown> & { id?: string };
type ApiCollectionConfig = { readPath: string; writePath?: string; idKey: string };

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () => (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

const unsupported = (operation: string): never => {
  throw new Error(`ORDERS_API_OPERATION_UNSUPPORTED:${operation}`);
};
const normalize = <T extends ApiRow>(row: T, idKey: string): T & { id: string } => ({ ...row, id: String(row[idKey] ?? row.id ?? '') });
const extractRows = <T extends ApiRow>(data: T[] | { items?: T[] } | undefined): T[] => Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

function makeApiCollection<T extends ApiRow>(config: ApiCollectionConfig): OrdersCollectionRepository<T> {
  const list = async (): Promise<readonly T[]> => {
    const response = await client.get<ApiEnvelope<T[] | { items?: T[] }>>(config.readPath, { limit: 100, offset: 0 });
    return extractRows(response.data).map((row) => normalize(row, config.idKey) as T);
  };
  const pathFor = (id: string) => `${config.writePath ?? config.readPath}/${encodeURIComponent(id)}`;
  return {
    subscribe(onData: (snapshot: { records: readonly T[] }) => void, onError?: (error: unknown) => void) {
      let disposed = false;
      const refresh = async () => {
        try { const records = await list(); if (!disposed) onData({ records }); }
        catch (error) { if (!disposed) onError?.(error); }
      };
      void refresh();
      const timer = setInterval(() => void refresh(), 30_000);
      return () => { disposed = true; clearInterval(timer); };
    },
    list,
    async get(id) {
      const response = await client.get<ApiEnvelope<T>>(`${config.readPath}/${encodeURIComponent(id)}`);
      return normalize(response.data, config.idKey) as T;
    },
    async create(id, payload) {
      if (!config.writePath) return unsupported(`create:${config.readPath}`);
      const response = await client.post<ApiEnvelope<ApiRow>>(config.writePath, { ...payload, [config.idKey]: id });
      return { id: String(response.data[config.idKey] ?? response.data.id ?? id) };
    },
    async set(id, payload) {
      if (!config.writePath) return unsupported(`set:${config.readPath}`);
      await client.patch<ApiEnvelope<ApiRow>>(pathFor(id), payload);
    },
    async update(id, payload) {
      if (!config.writePath) return unsupported(`update:${config.readPath}`);
      await client.patch<ApiEnvelope<ApiRow>>(pathFor(id), payload);
    },
    async delete(id) {
      if (!config.writePath) return unsupported(`delete:${config.readPath}`);
      await client.delete<ApiEnvelope<ApiRow>>(pathFor(id));
    },
  };
}

const orders = makeApiCollection<OrderFeatureRecord>({ readPath: '/api/v1/orders', idKey: 'orderId' });
const shipments = makeApiCollection<ShipmentFeatureRecord>({ readPath: '/api/v1/shipments', idKey: 'shipmentId' });
const products = makeApiCollection<ApiRow>({ readPath: '/api/v1/products', idKey: 'productId', writePath: '/api/v1/products' });
const customers = makeApiCollection<ApiRow>({ readPath: '/api/v1/customers', idKey: 'customerId', writePath: '/api/v1/customers' });
const employees = makeApiCollection<ApiRow>({ readPath: '/api/v1/reporting/employees', idKey: 'employeeId', writePath: '/api/v1/operations/employees' });
const couriers = makeApiCollection<ApiRow>({ readPath: '/api/v1/reporting/couriers', idKey: 'courierId', writePath: '/api/v1/operations/couriers' });
const sources = makeApiCollection<ApiRow>({ readPath: '/api/v1/reporting/sources', idKey: 'sourceId', writePath: '/api/v1/operations/sources' });
const shippingCompanies = makeApiCollection<ApiRow>({ readPath: '/api/v1/reporting/shipping-companies', idKey: 'companyId', writePath: '/api/v1/operations/shipping-companies' });
const accounts = makeApiCollection<ApiRow>({ readPath: '/api/v1/finance/accounts', idKey: 'accountId' });

const shipmentPayload = (payload: OrdersWritePayload): Record<string, unknown> => ({
  shipmentId: payload.shipmentId ?? payload.id,
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
});
const canonicalProduct = (payload: OrdersWritePayload, id: string): Record<string, unknown> => ({
  productId: id,
  productNameAr: payload.productNameAr ?? payload.product_name_ar,
  productNameEn: payload.productNameEn ?? payload.product_name_en,
  productUrl: payload.productUrl ?? payload.product_url,
  productPriceCurrency: payload.productPriceCurrency ?? payload.product_price_currency,
  unitPrice: payload.unitPrice ?? payload.unit_price,
  itemCategoryId: payload.itemCategoryId ?? payload.item_category_id,
  cbm: payload.cbm, width: payload.width, height: payload.height, length: payload.length, weight: payload.weight,
});

const settings = {
  subscribe(onData: (record: ApiRow | null) => void, onError?: (error: unknown) => void) {
    let disposed = false;
    const refresh = async () => {
      try {
        const response = await client.get<ApiEnvelope<ApiRow[] | { items?: ApiRow[] }>>('/api/v1/finance/auto-entry-rules', { limit: 100, offset: 0 });
        if (!disposed) onData({ id: 'automatic-voucher-rules', data: extractRows(response.data) });
      } catch (error) { if (!disposed) onError?.(error); }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => { disposed = true; clearInterval(timer); };
  },
  async get() {
    const response = await client.get<ApiEnvelope<ApiRow[] | { items?: ApiRow[] }>>('/api/v1/finance/auto-entry-rules', { limit: 100, offset: 0 });
    return { id: 'automatic-voucher-rules', data: extractRows(response.data) };
  },
  set: async () => unsupported('settings:set'),
  update: async () => unsupported('settings:update'),
  delete: async () => unsupported('settings:delete'),
};

export const ordersApiDataGateway: OrdersFeatureApi = {
  collections: {
    orders: orders as unknown as OrdersFeatureApi['collections']['orders'],
    customers: customers as unknown as OrdersFeatureApi['collections']['customers'],
    employees: employees as unknown as OrdersFeatureApi['collections']['employees'],
    couriers: couriers as unknown as OrdersFeatureApi['collections']['couriers'],
    accounts: accounts as unknown as OrdersFeatureApi['collections']['accounts'],
    sources: sources as unknown as OrdersFeatureApi['collections']['sources'],
    shippingCompanies: shippingCompanies as unknown as OrdersFeatureApi['collections']['shippingCompanies'],
    products: products as unknown as OrdersFeatureApi['collections']['products'],
    shipments: shipments as unknown as OrdersFeatureApi['collections']['shipments'],
    orderItems: makeApiCollection<ApiRow>({ readPath: '/api/v1/orders', idKey: 'orderItemId' }) as unknown as OrdersFeatureApi['collections']['orderItems'],
    settings: settings as unknown as OrdersFeatureApi['collections']['settings'],
  },
  commands: {
    async createOrderAggregate(input) {
      const response = await client.post<ApiEnvelope<ApiRow>>('/api/v1/orders', { ...input.order, items: input.items, shipments: input.shipments }, { 'Idempotency-Key': `order-create-${input.order.orderNumber}` });
      return response.data;
    },
    async createOrderRecord(id, payload) {
      const response = await client.post<ApiEnvelope<ApiRow>>('/api/v1/orders', payload, { 'Idempotency-Key': `order-create-${id}` });
      return { id: String(response.data.orderId ?? id) };
    },
    async updateOrderRecord(id, changes) {
      const status = changes.status ?? changes.orderStatus;
      if (typeof status !== 'string') return unsupported('orders:update');
      await client.patch<ApiEnvelope<ApiRow>>(`/api/v1/orders/${encodeURIComponent(id)}/status`, { status });
    },
    async createOrderItem() { return unsupported('orderItems:create'); },
    async createShipmentRecord(id, payload) {
      const response = await client.post<ApiEnvelope<ApiRow>>('/api/v1/shipments', shipmentPayload({ ...payload, shipmentId: id }));
      return { id: String(response.data.shipmentId ?? id) };
    },
    async upsertShipment(id, payload) {
      const body = shipmentPayload({ ...payload, shipmentId: id });
      try {
        await client.get<ApiEnvelope<ApiRow>>(`/api/v1/shipments/${encodeURIComponent(id)}`);
        await client.patch<ApiEnvelope<ApiRow>>(`/api/v1/shipments/${encodeURIComponent(id)}`, body);
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.code !== 'ENTITY_NOT_FOUND') throw error;
        await client.post<ApiEnvelope<ApiRow>>('/api/v1/shipments', body);
      }
    },
    async updateShipment(id, changes) { await client.patch<ApiEnvelope<ApiRow>>(`/api/v1/shipments/${encodeURIComponent(id)}`, shipmentPayload({ ...changes, shipmentId: id })); },
    async updateShipmentStatus(id, status) { await client.patch<ApiEnvelope<ApiRow>>(`/api/v1/shipments/${encodeURIComponent(id)}`, { shipmentStatus: status }); },
    async deleteShipment() { return unsupported('shipments:delete'); },
    async findOrdersByNumberPrefix(prefix) {
      const response = await client.get<ApiEnvelope<ApiRow[] | { items?: ApiRow[] }>>('/api/v1/orders', { limit: 100, offset: 0, search: prefix });
      return extractRows(response.data).map((row) => normalize(row, 'orderId')) as unknown as OrderFeatureRecord[];
    },
  },
};
