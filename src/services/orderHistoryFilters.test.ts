import { describe, expect, it } from 'vitest';
import {
  appliedOrderHistoryFilterCount,
  defaultOrderHistoryFilters,
  filterOrderHistoryEvents,
} from './orderHistoryFilters';
import type { OrderHistoryEvent } from './orderHistoryService';

const events: OrderHistoryEvent[] = [
  {
    id: 'order-change', eventType: 'order.status_changed', eventCategory: 'order', operation: 'update', entityType: 'order',
    actorId: 'user-1', actorName: 'أحمد', summary: 'تم تحديث حالة الطلب إلى تم الشحن', occurredAt: '2026-08-22T09:30:00.000Z',
    metadata: { changes: { 'data.orderStatus': { before: 'قيد المعالجة', after: 'تم الشحن' } } },
  },
  {
    id: 'shipment-change', eventType: 'shipment.created', eventCategory: 'shipment', operation: 'insert', entityType: 'shipment',
    actorId: 'user-2', actorName: 'سارة', summary: 'تم إنشاء شحنة مرتبطة بالطلب', occurredAt: '2026-08-20T17:45:00.000Z', shipmentId: 'SHP-9',
  },
  {
    id: 'finance-change', eventType: 'financial.journal_insert', eventCategory: 'financial', operation: 'insert', entityType: 'journal_entry',
    actorName: 'النظام', summary: 'تم إنشاء قيد مالي مرتبط بالطلب', occurredAt: '2026-07-15T21:15:00.000Z', journalEntryId: 'JE-3',
  },
];

describe('filterOrderHistoryEvents', () => {
  it('filters by exact event type and actor', () => {
    const result = filterOrderHistoryEvents(events, {
      ...defaultOrderHistoryFilters,
      eventType: 'order.status_changed',
      actorKey: 'user-1',
    }, new Date('2026-08-22T12:00:00.000Z'));

    expect(result.map((event) => event.id)).toEqual(['order-change']);
  });

  it('searches summary and nested event details', () => {
    const bySummary = filterOrderHistoryEvents(events, { ...defaultOrderHistoryFilters, query: 'شحنة مرتبطة' });
    const byNestedChange = filterOrderHistoryEvents(events, { ...defaultOrderHistoryFilters, query: 'تم الشحن' });

    expect(bySummary.map((event) => event.id)).toEqual(['shipment-change']);
    expect(byNestedChange.map((event) => event.id)).toEqual(['order-change']);
  });

  it('combines relative time, date, and time-of-day filters', () => {
    const lastWeek = filterOrderHistoryEvents(events, { ...defaultOrderHistoryFilters, timeRange: 'last_7_days' }, new Date('2026-08-22T12:00:00.000Z'));
    const eventHour = String(new Date(events[0].occurredAt!).getHours()).padStart(2, '0');
    const dateAndTime = filterOrderHistoryEvents(events, {
      ...defaultOrderHistoryFilters,
      dateFrom: '2026-08-20', dateTo: '2026-08-22', timeFrom: `${eventHour}:00`, timeTo: `${eventHour}:59`,
    }, new Date('2026-08-22T12:00:00.000Z'));

    expect(lastWeek.map((event) => event.id)).toEqual(['order-change', 'shipment-change']);
    expect(dateAndTime.map((event) => event.id)).toEqual(['order-change']);
  });

  it('counts all applied filters and supports a reset to zero', () => {
    const filters = { ...defaultOrderHistoryFilters, query: 'قيد', eventType: 'financial.journal_insert', dateFrom: '2026-07-01' };
    expect(appliedOrderHistoryFilterCount(filters)).toBe(3);
    expect(appliedOrderHistoryFilterCount(defaultOrderHistoryFilters)).toBe(0);
  });
});
