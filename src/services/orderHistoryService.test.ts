import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());

vi.mock('../data/http/api-client', () => ({
  ApiClient: vi.fn(() => ({ get })),
}));

import {
  historyChangeValue,
  historyChangesAsRecord,
  historyEventChanges,
  historyEventDetailFields,
  orderHistoryService,
} from './orderHistoryService';

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

  it('يقرأ الحقول المسطّحة من API بدل لقطات jsonb المحذوفة', async () => {
    get.mockResolvedValueOnce(envelope([
      {
        historyId: 'hist_flat',
        eventType: 'order.status_changed',
        eventCategory: 'order',
        summary: 'تم تغيير حالة الطلب.',
        changedFields: ['status', 'orderStatusId'],
        changes: [
          { fieldName: 'status', oldValue: 'قيد الطلب', newValue: 'تم الشحن' },
          { fieldName: 'orderStatusId', oldValue: '2', newValue: '5' },
        ],
        triggerName: 'orders_activity',
        orderReference: 'ALX-1',
        occurredAt: '2026-08-22T09:00:00.000Z',
      },
    ]));

    const [event] = await orderHistoryService.listForContext({ entityType: 'order', orderId: 'ord_1', label: 'ALX-1' });

    expect(event.changedFields).toEqual(['status', 'orderStatusId']);
    expect(event.changes).toHaveLength(2);
    expect(event.triggerName).toBe('orders_activity');
    expect(event.orderReference).toBe('ALX-1');
    expect(historyChangeValue(event, 'order_status_id')).toBe('5');
    expect(historyChangesAsRecord(event, 'oldValue')).toEqual({ status: 'قيد الطلب', orderStatusId: '2' });
    expect(historyEventDetailFields(event)).toMatchObject({ triggerName: 'orders_activity', orderReference: 'ALX-1' });
  });

  it('يقبل القراءة المباشرة بكتابة قاعدة البيانات: changed_fields وصفوف orders_history_change', async () => {
    get.mockResolvedValueOnce(envelope([
      {
        orders_history_id: 'oh_direct',
        event_type: 'order.updated',
        event_category: 'order',
        operation: 'update',
        entity_type: 'order',
        changed_fields: '{weight,customerName}',
        orders_history_change: [
          { field_name: 'data.weight', old_value: '12', new_value: '18' },
        ],
        activity_details: '{"userName":"سارة"}',
        is_automatic: false,
        occurred_at: '2026-08-23T09:00:00.000Z',
      },
    ]));

    const [event] = await orderHistoryService.listForContext({ entityType: 'order', orderId: 'ord_1', label: 'ALX-1' });

    expect(event.id).toBe('oh_direct');
    expect(event.eventType).toBe('order.updated');
    expect(event.changedFields).toEqual(['weight', 'customerName']);
    expect(event.changes).toEqual([{ fieldName: 'data.weight', oldValue: '12', newValue: '18' }]);
    expect(event.activityDetails).toEqual({ userName: 'سارة' });
    expect(event.isAutomatic).toBe(false);
    // الحقل المعلن بلا صف تغيير يظهر بقيم فارغة، والمسار القديم data. لا يكرّر الصف الموجود.
    // A declared field with no change row still shows (empty values), and the legacy data. path does not duplicate it.
    expect(historyEventChanges(event).map((change) => change.fieldName)).toEqual(['data.weight', 'customerName']);
  });
});
