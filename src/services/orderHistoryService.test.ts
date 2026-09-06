import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getDocs: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  db: {},
  collection: vi.fn(() => ({ path: 'orders_history' })),
  getDocs: mocks.getDocs,
  limit: vi.fn((value: number) => ({ type: 'limit', value })),
  orderBy: vi.fn((field: string, direction: string) => ({ type: 'orderBy', field, direction })),
  query: vi.fn((...parts: unknown[]) => ({ parts })),
  where: vi.fn((field: string, operation: string, value: string) => ({ type: 'where', field, operation, value })),
}));

import { orderHistoryService } from './orderHistoryService';

function snapshot(rows: Array<Record<string, unknown>>) {
  return { docs: rows.map((row) => ({ id: String(row.id), data: () => ({ ...row, id: undefined }) })) };
}

describe('orderHistoryService', () => {
  beforeEach(() => {
    mocks.getDocs.mockReset();
  });

  it('loads order events newest first', async () => {
    mocks.getDocs
      .mockResolvedValueOnce(snapshot([
        { id: 'older', eventType: 'order.created', occurredAt: '2026-08-20T09:00:00.000Z' },
        { id: 'newer', eventType: 'order.status_changed', occurredAt: '2026-08-21T09:00:00.000Z' },
      ]))
      .mockResolvedValueOnce(snapshot([]));

    const events = await orderHistoryService.listForContext({ entityType: 'order', orderId: 'ord_1', orderNumber: 'ALX-1', label: 'ALX-1' });

    expect(mocks.getDocs).toHaveBeenCalledTimes(2);
    expect(events.map((event) => event.id)).toEqual(['newer', 'older']);
  });

  it('merges linked order and shipment activity without duplicating an event', async () => {
    mocks.getDocs
      .mockResolvedValueOnce(snapshot([
        { id: 'linked-finance', eventType: 'financial.journal_insert', occurredAt: '2026-08-21T10:00:00.000Z' },
        { id: 'shipment-created', eventType: 'shipment.created', occurredAt: '2026-08-20T10:00:00.000Z' },
      ]))
      .mockResolvedValueOnce(snapshot([
        { id: 'shipment-created', eventType: 'shipment.created', occurredAt: '2026-08-20T10:00:00.000Z' },
        { id: 'shipment-status', eventType: 'shipment.status_changed', occurredAt: '2026-08-22T10:00:00.000Z' },
      ]));

    const events = await orderHistoryService.listForContext({ entityType: 'shipment', orderId: 'ord_1', shipmentId: 'sh_1', label: 'TRK-1' });

    expect(mocks.getDocs).toHaveBeenCalledTimes(2);
    expect(events.map((event) => event.id)).toEqual(['shipment-status', 'linked-finance', 'shipment-created']);
  });

  it('hides legacy UI activity duplicates and retains the canonical database event', async () => {
    mocks.getDocs.mockResolvedValueOnce(snapshot([
      { id: 'duplicate-ui-log', eventType: 'activity.edit_order', occurredAt: '2026-08-22T10:00:01.000Z' },
      { id: 'canonical-change', eventType: 'order.updated', occurredAt: '2026-08-22T10:00:00.000Z' },
    ]));

    const events = await orderHistoryService.listForContext({ entityType: 'order', orderId: 'ord_1', label: 'ALX-1' });

    expect(events.map((event) => event.id)).toEqual(['canonical-change']);
  });
});
