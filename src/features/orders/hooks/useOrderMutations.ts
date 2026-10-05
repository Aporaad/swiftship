import { useCallback } from 'react';
import type { OrdersFeatureApi, OrdersWritePayload } from '../api';
import { legacyOrdersApi } from '../services/legacyOrdersApi';
import type { OrderFeatureRecord } from '../types';
import type { OrderCreateInput } from '../../../data/dtos/orders.dto';

export interface OrderMutations {
  createOrderAggregate?(input: { order: OrderCreateInput; items: readonly OrdersWritePayload[]; shipments: readonly OrdersWritePayload[] }): Promise<Record<string, unknown>>;
  createOrderRecord(id: string, payload: OrdersWritePayload): Promise<{ id: string }>;
  updateOrderRecord(id: string, changes: OrdersWritePayload): Promise<void>;
  createCustomerRecord(id: string, payload: OrdersWritePayload): Promise<{ id: string }>;
  createSourceRecord(id: string, payload: OrdersWritePayload): Promise<{ id: string }>;
  createShippingCompanyRecord(id: string, payload: OrdersWritePayload): Promise<{ id: string }>;
  createProductRecord(id: string, payload: OrdersWritePayload): Promise<{ id: string }>;
  createOrderItem(id: string, payload: OrdersWritePayload): Promise<{ id: string }>;
  createShipmentRecord(id: string, payload: OrdersWritePayload): Promise<{ id: string }>;
  upsertShipment(id: string, payload: OrdersWritePayload): Promise<void>;
  updateShipment(id: string, changes: OrdersWritePayload): Promise<void>;
  updateShipmentStatus(id: string, status: string, updatedAt?: number): Promise<void>;
  deleteShipment(id: string): Promise<void>;
  findOrdersByNumberPrefix(prefix: string): Promise<readonly OrderFeatureRecord[]>;
}

/**
 * Exposes injectable feature commands while preserving the legacy call sequence.
 * Orchestration stays with the existing handlers until each workflow has parity tests.
 */
export function useOrderMutations(api: OrdersFeatureApi = legacyOrdersApi): OrderMutations {
  const createOrderAggregate = useCallback(
    (input: { order: OrderCreateInput; items: readonly OrdersWritePayload[]; shipments: readonly OrdersWritePayload[] }) =>
      api.commands.createOrderAggregate
        ? api.commands.createOrderAggregate(input)
        : Promise.reject(new Error('ORDER_AGGREGATE_UNAVAILABLE')),
    [api],
  );
  const createOrderRecord = useCallback(
    (id: string, payload: OrdersWritePayload) => api.commands.createOrderRecord(id, payload),
    [api],
  );
  const updateOrderRecord = useCallback(
    (id: string, changes: OrdersWritePayload) => api.commands.updateOrderRecord(id, changes),
    [api],
  );
  const createCustomerRecord = useCallback(
    (id: string, payload: OrdersWritePayload) => api.collections.customers.create(id, payload),
    [api],
  );
  const createSourceRecord = useCallback(
    (id: string, payload: OrdersWritePayload) => api.collections.sources.create(id, payload),
    [api],
  );
  const createShippingCompanyRecord = useCallback(
    (id: string, payload: OrdersWritePayload) =>
      api.collections.shippingCompanies.create(id, payload),
    [api],
  );
  const createProductRecord = useCallback(
    (id: string, payload: OrdersWritePayload) => api.collections.products.create(id, payload),
    [api],
  );
  const createOrderItem = useCallback(
    (id: string, payload: OrdersWritePayload) => api.commands.createOrderItem(id, payload),
    [api],
  );
  const createShipmentRecord = useCallback(
    (id: string, payload: OrdersWritePayload) => api.commands.createShipmentRecord(id, payload),
    [api],
  );
  const upsertShipment = useCallback(
    (id: string, payload: OrdersWritePayload) => api.commands.upsertShipment(id, payload),
    [api],
  );
  const updateShipment = useCallback(
    (id: string, changes: OrdersWritePayload) => api.commands.updateShipment(id, changes),
    [api],
  );
  const updateShipmentStatus = useCallback(
    (id: string, status: string, updatedAt?: number) =>
      api.commands.updateShipmentStatus(id, status, updatedAt),
    [api],
  );
  const deleteShipment = useCallback(
    (id: string) => api.commands.deleteShipment(id),
    [api],
  );
  const findOrdersByNumberPrefix = useCallback(
    (prefix: string) => api.commands.findOrdersByNumberPrefix(prefix),
    [api],
  );

  return {
    ...(api.commands.createOrderAggregate ? { createOrderAggregate } : {}),
    createOrderRecord,
    updateOrderRecord,
    createCustomerRecord,
    createSourceRecord,
    createShippingCompanyRecord,
    createProductRecord,
    createOrderItem,
    createShipmentRecord,
    upsertShipment,
    updateShipment,
    updateShipmentStatus,
    deleteShipment,
    findOrdersByNumberPrefix,
  };
}
