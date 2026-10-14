import { ApiClient } from '../../../../../data/http/api-client';
import {
  createReturnedProduct,
  deleteReturnedProduct,
  fetchReturnedProducts,
  updateReturnedProduct,
  type ReturnedProduct,
} from '../../../../../services/returnedProductService';
import { fetchOrderItems, updateOrderItem, type OrderItem } from '../../../../../services/productService';

type OrderRow = { id: string } & Record<string, unknown>;
type OrderItemRow = { items_id: string } & Record<string, unknown>;
type ApiRow = Record<string, unknown>;

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () =>
    typeof sessionStorage === 'undefined'
      ? null
      : (sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

const extractRows = (data: ApiRow[] | { items?: ApiRow[] } | undefined): ApiRow[] =>
  Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

const loadOrders = async (): Promise<OrderRow[]> => {
  const res = await client.get<{ success: boolean; data: ApiRow[] | { items?: ApiRow[] } }>(
    '/api/v1/orders',
    { limit: 500, offset: 0 },
  );
  return extractRows(res.data).map((row) => ({
    ...row,
    id: String(row.orderId ?? row.id ?? ''),
    customerName: row.customerName ?? row.customerId ?? row.customer ?? '',
    orderNumber: row.orderNumber ?? row.order_number ?? row.id ?? '',
  }));
};

/**
 * مجموعة تستعلم من alx_api وتُحدّث المشتركين عند الجلب وعند كل كتابة ناجحة.
 * A polled alx_api collection that notifies subscribers on fetch and after writes.
 */
function makeCollection<T>(load: () => Promise<T[]>) {
  type Subscriber = { onData: (rows: T[]) => void; onError?: (error: unknown) => void };
  const subscribers = new Set<Subscriber>();
  let timer: ReturnType<typeof setInterval> | null = null;

  const refresh = async () => {
    try {
      const rows = await load();
      subscribers.forEach((subscriber) => subscriber.onData(rows));
    } catch (error) {
      subscribers.forEach((subscriber) => subscriber.onError?.(error));
    }
  };

  return {
    subscribe(onData: (rows: T[]) => void, onError?: (error: unknown) => void) {
      const subscriber: Subscriber = { onData, onError };
      subscribers.add(subscriber);
      if (!timer) {
        void refresh();
        timer = setInterval(() => void refresh(), 30_000);
      }
      let disposed = false;
      return () => {
        if (disposed) return;
        disposed = true;
        subscribers.delete(subscriber);
        if (subscribers.size === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    notify: refresh,
  };
}

const returnsCollection = makeCollection<ReturnedProduct>(() => fetchReturnedProducts());
const orderItemsCollection = makeCollection<OrderItemRow>(
  async () => (await fetchOrderItems()) as unknown as OrderItemRow[],
);
const ordersCollection = makeCollection<OrderRow>(loadOrders);

export const returnedProductsGateway = {
  subscribeOrders(onData: (rows: OrderRow[]) => void) {
    return ordersCollection.subscribe(onData);
  },
  subscribeOrderItems(onData: (rows: OrderItemRow[]) => void) {
    return orderItemsCollection.subscribe(onData);
  },
  subscribeReturns(
    onData: (rows: ReturnedProduct[]) => void,
    onError: (error: unknown) => void,
  ) {
    return returnsCollection.subscribe(onData, onError);
  },
  async updateReturn(returnId: string, payload: Record<string, unknown>) {
    await updateReturnedProduct(returnId, payload as Partial<ReturnedProduct>);
    await returnsCollection.notify();
  },
  async createReturn(returnId: string, payload: Record<string, unknown>) {
    await createReturnedProduct({ ...(payload as Record<string, unknown>), return_id: returnId } as never);
    await returnsCollection.notify();
  },
  async updateOrderItem(orderItemId: string, payload: Record<string, unknown>) {
    await updateOrderItem(orderItemId, payload as Partial<OrderItem>);
    await orderItemsCollection.notify();
  },
  async deleteReturn(returnId: string) {
    await deleteReturnedProduct(returnId);
    await returnsCollection.notify();
  },
};
