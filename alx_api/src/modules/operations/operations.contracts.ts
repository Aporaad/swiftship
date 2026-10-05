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
  createCourier(input: CreateCourierInput): Promise<Record<string, unknown>>;
  updateCourier(input: UpdateCourierInput): Promise<Record<string, unknown> | null>;
  deleteCourier(courierId: string): Promise<boolean>;
  createEmployee(input: CreateEmployeeInput): Promise<Record<string, unknown>>;
  updateEmployee(input: UpdateEmployeeInput): Promise<Record<string, unknown> | null>;
  deleteEmployee(employeeId: string): Promise<boolean>;
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

export interface CreateCourierInput {
  fullName: string;
  nameAr?: string | undefined;
  nameEn?: string | undefined;
  courierType?: string | undefined;
  courierLevel?: string | undefined;
  commissionRate?: number | undefined;
  currency?: string | undefined;
  isActive?: boolean | undefined;
  accountId?: string | undefined;
  actorId: string;
}

export interface UpdateCourierInput {
  courierId: string;
  fullName?: string | undefined;
  nameAr?: string | undefined;
  nameEn?: string | undefined;
  courierType?: string | undefined;
  courierLevel?: string | undefined;
  commissionRate?: number | undefined;
  currency?: string | undefined;
  isActive?: boolean | undefined;
  accountId?: string | undefined;
  actorId: string;
}

export interface CreateEmployeeInput {
  fullName: string;
  nameAr?: string | undefined;
  nameEn?: string | undefined;
  jobType?: string | undefined;
  monthlySalary?: number | undefined;
  commissionRate?: number | undefined;
  currency?: string | undefined;
  accountId?: string | undefined;
  actorId: string;
}

export interface UpdateEmployeeInput {
  employeeId: string;
  fullName?: string | undefined;
  nameAr?: string | undefined;
  nameEn?: string | undefined;
  jobType?: string | undefined;
  monthlySalary?: number | undefined;
  commissionRate?: number | undefined;
  currency?: string | undefined;
  accountId?: string | undefined;
  actorId: string;
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
