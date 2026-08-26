import type { OrderHistoryEvent } from './orderHistoryService';

export type HistoryTimeRange = 'all' | 'today' | 'last_24_hours' | 'last_7_days' | 'last_30_days';

export type OrderHistoryFilters = {
  query: string;
  eventType: string;
  actorKey: string;
  timeRange: HistoryTimeRange;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
};

export const defaultOrderHistoryFilters: OrderHistoryFilters = {
  query: '',
  eventType: '',
  actorKey: '',
  timeRange: 'all',
  dateFrom: '',
  dateTo: '',
  timeFrom: '',
  timeTo: '',
};

export function historyEventDate(event: OrderHistoryEvent): Date | null {
  const value = event.occurredAt ?? event.createdAt;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function historyActorKey(event: OrderHistoryEvent): string {
  return event.actorId || `system:${event.actorName || 'system'}`;
}

function normalizedText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.toLocaleLowerCase();
  try {
    return JSON.stringify(value).toLocaleLowerCase();
  } catch {
    return String(value).toLocaleLowerCase();
  }
}

function matchesTimeRange(eventDate: Date, timeRange: HistoryTimeRange, now: Date): boolean {
  if (timeRange === 'all') return true;
  const timestamp = eventDate.getTime();
  if (timeRange === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return timestamp >= start.getTime() && timestamp <= now.getTime();
  }

  const durationMs = timeRange === 'last_24_hours'
    ? 24 * 60 * 60 * 1000
    : timeRange === 'last_7_days'
      ? 7 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;
  return timestamp >= now.getTime() - durationMs && timestamp <= now.getTime();
}

function matchesDateAndTime(eventDate: Date, filters: OrderHistoryFilters): boolean {
  if (filters.dateFrom) {
    const from = new Date(`${filters.dateFrom}T00:00:00`);
    if (eventDate.getTime() < from.getTime()) return false;
  }

  if (filters.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59.999`);
    if (eventDate.getTime() > to.getTime()) return false;
  }

  if (!filters.timeFrom && !filters.timeTo) return true;
  const minute = eventDate.getHours() * 60 + eventDate.getMinutes();
  const toMinute = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
  };
  const from = filters.timeFrom ? toMinute(filters.timeFrom) : null;
  const to = filters.timeTo ? toMinute(filters.timeTo) : null;

  if (from !== null && to !== null) {
    return from <= to ? minute >= from && minute <= to : minute >= from || minute <= to;
  }
  if (from !== null) return minute >= from;
  return to === null || minute <= to;
}

function matchesSearch(event: OrderHistoryEvent, query: string): boolean {
  const search = query.trim().toLocaleLowerCase();
  if (!search) return true;
  const searchable = [
    event.id,
    event.eventType,
    event.eventCategory,
    event.operation,
    event.entityType,
    event.summary,
    event.actorName,
    event.actorRole,
    event.actorId,
    event.orderId,
    event.orderNumber,
    event.shipmentId,
    event.journalEntryId,
    event.accountTransactionId,
    event.activityLogId,
    event.beforeData,
    event.afterData,
    event.metadata,
  ].map(normalizedText).join(' ');
  return searchable.includes(search);
}

export function filterOrderHistoryEvents(
  events: OrderHistoryEvent[],
  filters: OrderHistoryFilters,
  now = new Date(),
): OrderHistoryEvent[] {
  return events.filter((event) => {
    if (filters.eventType && event.eventType !== filters.eventType) return false;
    if (filters.actorKey && historyActorKey(event) !== filters.actorKey) return false;
    if (!matchesSearch(event, filters.query)) return false;

    const eventDate = historyEventDate(event);
    const needsDate = filters.timeRange !== 'all' || Boolean(filters.dateFrom || filters.dateTo || filters.timeFrom || filters.timeTo);
    if (needsDate && !eventDate) return false;
    if (!eventDate) return true;

    return matchesTimeRange(eventDate, filters.timeRange, now) && matchesDateAndTime(eventDate, filters);
  });
}

export function appliedOrderHistoryFilterCount(filters: OrderHistoryFilters): number {
  return [
    filters.query,
    filters.eventType,
    filters.actorKey,
    filters.timeRange === 'all' ? '' : filters.timeRange,
    filters.dateFrom,
    filters.dateTo,
    filters.timeFrom,
    filters.timeTo,
  ].filter(Boolean).length;
}
