import type { OrderCreateInput, OrderUpdateInput } from '../../data/dtos/orders.dto';
import type { OrderFeatureRecord, ShipmentFeatureRecord } from './types';

/** A payload passed through the compatibility adapter without field normalization. */
export type OrdersWritePayload = Record<string, unknown>;
export type OrdersEntityRecord = OrdersWritePayload & { id: string };
export type OrdersUnsubscribe = () => void;
export type OrdersErrorHandler = (error: unknown) => void;

export interface OrdersCollectionSnapshot<TRecord> {
  readonly records: readonly TRecord[];
}

export interface OrdersCollectionRepository<
  TRecord,
  TCreate = OrdersWritePayload,
  TUpdate = OrdersWritePayload,
> {
  subscribe(
    onData: (snapshot: OrdersCollectionSnapshot<TRecord>) => void,
    onError?: OrdersErrorHandler,
  ): OrdersUnsubscribe;
  list(): Promise<readonly TRecord[]>;
  get(id: string): Promise<TRecord | null>;
  create(id: string, payload: TCreate): Promise<{ id: string }>;
  set(id: string, payload: TCreate): Promise<void>;
  update(id: string, changes: TUpdate): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface OrdersDocumentRepository<
  TRecord,
  TWrite = OrdersWritePayload,
> {
  subscribe(
    onData: (record: TRecord | null) => void,
    onError?: OrdersErrorHandler,
  ): OrdersUnsubscribe;
  get(): Promise<TRecord | null>;
  set(payload: TWrite): Promise<void>;
  update(changes: Partial<TWrite>): Promise<void>;
  delete(): Promise<void>;
}

export interface OrdersFeatureCollections {
  orders: OrdersCollectionRepository<OrderFeatureRecord, OrderCreateInput, OrderUpdateInput>;
  customers: OrdersCollectionRepository<OrdersEntityRecord>;
  employees: OrdersCollectionRepository<OrdersEntityRecord>;
  couriers: OrdersCollectionRepository<OrdersEntityRecord>;
  accounts: OrdersCollectionRepository<OrdersEntityRecord>;
  sources: OrdersCollectionRepository<OrdersEntityRecord>;
  shippingCompanies: OrdersCollectionRepository<OrdersEntityRecord>;
  products: OrdersCollectionRepository<OrdersEntityRecord>;
  shipments: OrdersCollectionRepository<ShipmentFeatureRecord>;
  orderItems: OrdersCollectionRepository<OrdersEntityRecord>;
  settings: OrdersDocumentRepository<OrdersEntityRecord>;
}

/** Low-level data ports only; payment, status, accounting and cascade orchestration live in feature workflows. */
export interface OrdersFeatureCommands {
  createOrderAggregate?(input: {
    order: OrderCreateInput;
    items: readonly OrdersWritePayload[];
    shipments: readonly OrdersWritePayload[];
  }): Promise<Record<string, unknown>>;
  createOrderRecord(id: string, payload: OrdersWritePayload): Promise<{ id: string }>;
  updateOrderRecord(id: string, changes: OrdersWritePayload): Promise<void>;
  createOrderItem(id: string, payload: OrdersWritePayload): Promise<{ id: string }>;
  createShipmentRecord(id: string, payload: OrdersWritePayload): Promise<{ id: string }>;
  upsertShipment(id: string, payload: OrdersWritePayload): Promise<void>;
  updateShipment(id: string, changes: OrdersWritePayload): Promise<void>;
  updateShipmentStatus(id: string, status: string, updatedAt?: number): Promise<void>;
  deleteShipment(id: string): Promise<void>;
  findOrdersByNumberPrefix(prefix: string): Promise<readonly OrderFeatureRecord[]>;
}

// Feature API boundary: orders; no SQL, Supabase, or Firebase imports.
export interface OrdersFeatureApi {
  readonly collections: OrdersFeatureCollections;
  readonly commands: OrdersFeatureCommands;
}
