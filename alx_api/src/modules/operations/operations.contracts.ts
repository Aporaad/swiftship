export interface OperationsRepository {
  listOrders(input: PageQuery): Promise<PageResult<Record<string, unknown>>>;
  getOrder(orderId: string): Promise<Record<string, unknown> | null>;
  listOrderHistory(orderId: string): Promise<readonly Record<string, unknown>[]>;
  listShipments(input: PageQuery): Promise<PageResult<Record<string, unknown>>>;
  getShipment(shipmentId: string): Promise<Record<string, unknown> | null>;
  listTracking(shipmentId: string): Promise<readonly Record<string, unknown>[]>;
  listProducts(input: PageQuery): Promise<PageResult<Record<string, unknown>>>;
  getProduct(productId: string): Promise<Record<string, unknown> | null>;
  createOrder(input: CreateOrderInput): Promise<Record<string, unknown>>;
  updateOrderStatus(input: UpdateOrderStatusInput): Promise<Record<string, unknown>>;
  createProduct(input: CreateProductInput): Promise<Record<string, unknown>>;
  updateProduct(input: UpdateProductInput): Promise<Record<string, unknown> | null>;
  updateShipment(input: UpdateShipmentInput): Promise<Record<string, unknown> | null>;
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

export interface CreateOrderInput {
  orderNumber: string;
  customerId?: string | undefined;
  status?: string | undefined;
  orderStatusId?: string | undefined;
  trackingNumber?: string | undefined;
  currency?: string | undefined;
  orderCurrency?: string | undefined;
  orderCurrencyPrice?: number | undefined;
  externalOrderNumber?: string | undefined;
  items: readonly OrderItemInput[];
  shipment?: ShipmentInput | undefined;
  actorId: string;
  idempotencyKey: string;
}
export interface OrderItemInput {
  productId?: string | undefined;
  productName?: string | undefined;
  productNameAr?: string | undefined;
  productNameEn?: string | undefined;
  productUrl?: string | undefined;
  quantity: number;
  unitPrice: number;
  weight?: number | undefined;
  cbm?: number | undefined;
  notes?: string | undefined;
}
export interface ShipmentInput {
  trackingNumber?: string | undefined;
  shippingCompanyId?: string | undefined;
  courierId?: string | undefined;
  shipmentStatus?: string | undefined;
  shippingCost?: number | undefined;
  weight?: number | undefined;
  shippingType?: string | undefined;
  shippingSource?: string | undefined;
  shippingDestination?: string | undefined;
  cartonCount?: number | undefined;
}
export interface UpdateOrderStatusInput {
  orderId: string;
  status: string;
  actorId: string;
  note?: string | undefined;
}
export interface CreateProductInput {
  productId: string;
  productNameAr?: string | undefined;
  productNameEn?: string | undefined;
  productUrl?: string | undefined;
  productPriceCurrency?: string | undefined;
  unitPrice?: number | undefined;
  itemCategoryId?: string | undefined;
  cbm?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  length?: number | undefined;
  weight?: number | undefined;
  actorId: string;
}
export interface UpdateProductInput extends CreateProductInput {
  productId: string;
}
export interface UpdateShipmentInput {
  shipmentId: string;
  actorId: string;
  shipmentStatus?: string | undefined;
  courierId?: string | undefined;
  trackingNumber?: string | undefined;
  shippingCost?: number | undefined;
  weight?: number | undefined;
  shippingType?: string | undefined;
  shippingSource?: string | undefined;
  shippingDestination?: string | undefined;
  cartonCount?: number | undefined;
}
