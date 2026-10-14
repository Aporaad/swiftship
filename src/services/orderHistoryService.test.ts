import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());

vi.mock('../data/http/api-client', () => ({
  ApiClient: vi.fn(() => ({ get })),
}));

import { orderHistoryService } from './orderHistoryService';

const envelope = (rows: Array<Record<string, unknown>>) => ({ success: true as const, data: rows });

describe('orderHistoryService', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('يحمل أحداث الطلب عبر API مرتبة من الأحدث إلى الأقدم', async () => {
    get.mockResolvedValueOnce(envelope([
      { historyId: 'older', eventType: 'order.created', occurredAt: '2026-08-20T09:00:00.000Z' },
      { historyId: 'newer', eventType: 'order.status_changed', occurredAt: '2026-08-21T09:00:00.000Z' },
    ]));

    const events = await orderHistoryService.listForContext({ entityType: 'order', orderId: 'ord_1', orderNumber: 'ALX-1', label: 'ALX-1' });

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/api/v1/orders/ord_1/history', undefined);
    expect(events.map((event) => event.id)).toEqual(['newer', 'older']);
  });

  it('يدمج سجل الشحنة عبر مسار التتبع مع سجل الطلب دون تكرار', async () => {
    get
      .mockResolvedValueOnce(envelope([
        { historyId: 'shipment-created', eventType: 'shipment.created', occurredAt: '2026-08-20T10:00:00.000Z' },
        { historyId: 'shipment-status', eventType: 'shipment.status_changed', occurredAt: '2026-08-22T10:00:00.000Z' },
      ]))
      .mockResolvedValueOnce(envelope([
        { historyId: 'linked-finance', eventType: 'financial.journal_insert', occurredAt: '2026-08-21T10:00:00.000Z' },
        { historyId: 'shipment-created', eventType: 'shipment.created', occurredAt: '2026-08-20T10:00:00.000Z' },
      ]));

    const events = await orderHistoryService.listForContext({ entityType: 'shipment', orderId: 'ord_1', shipmentId: 'sh_1', label: 'TRK-1' });

    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledWith('/api/v1/shipments/sh_1/tracking', undefined);
    expect(events.map((event) => event.id)).toEqual(['shipment-status', 'linked-finance', 'shipment-created']);
  });

  it('يخفي تكرارات نشاط الواجهة القديمة ويحتفظ بالحدث الأصلي', async () => {
    get.mockResolvedValueOnce(envelope([
      { historyId: 'duplicate-ui-log', eventType: 'activity.edit_order', occurredAt: '2026-08-22T10:00:01.000Z' },
      { historyId: 'canonical-change', eventType: 'order.updated', occurredAt: '2026-08-22T10:00:00.000Z' },
    ]));

    const events = await orderHistoryService.listForContext({ entityType: 'order', orderId: 'ord_1', label: 'ALX-1' });

    expect(events.map((event) => event.id)).toEqual(['canonical-change']);
  });

  it('يرتقي من رقم الطلب إلى معرف الطلب عبر بحث API عند غياب المعرف', async () => {
    get
      .mockResolvedValueOnce(envelope([
        { orderId: 'ord_9', orderNumber: 'ALX-9' },
        { orderId: 'ord_1', orderNumber: 'ALX-1' },
      ]))
      .mockResolvedValueOnce(envelope([
        { historyId: 'created', eventType: 'order.created', occurredAt: '2026-08-20T09:00:00.000Z' },
      ]));

    const events = await orderHistoryService.listForContext({ entityType: 'order', orderNumber: 'ALX-1', label: 'ALX-1' });

    expect(get).toHaveBeenCalledWith('/api/v1/orders', { search: 'ALX-1', limit: 20, offset: 0 });
    expect(get).toHaveBeenCalledWith('/api/v1/orders/ord_1/history', undefined);
    expect(events.map((event) => event.id)).toEqual(['created']);
  });
});
