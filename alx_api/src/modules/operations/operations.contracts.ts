export interface OperationsRepository {
  listOrders(input: PageQuery): Promise<PageResult<Record<string, unknown>>>;
  getOrder(orderId: string): Promise<Record<string, unknown> | null>;
  listOrderHistory(orderId: string): Promise<readonly Record<string, unknown>[]>;
  listShipments(input: PageQuery): Promise<PageResult<Record<string, unknown>>>;
  getShipment(shipmentId: string): Promise<Record<string, unknown> | null>;
  listTracking(shipmentId: string): Promise<readonly Record<string, unknown>[]>;
  listProducts(input: PageQuery): Promise<PageResult<Record<string, unknown>>>;
  getProduct(productId: string): Promise<Record<string, unknown> | null>;
}
export interface PageQuery {
  limit: number;
  offset: number;
  search?: string | undefined;
}
export interface PageResult<T> {
  items: readonly T[];
  total: number;
}
