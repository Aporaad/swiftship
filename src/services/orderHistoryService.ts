import { collection, getDocs, limit, orderBy, query, where } from '../data/legacy/legacy-adapter';
import { db } from '../data/legacy/legacy-adapter';

export type OrderHistoryContext = {
  orderId?: string;
  orderNumber?: string;
  shipmentId?: string;
  entityType: 'order' | 'shipment';
  label: string;
};

export type OrderHistoryEvent = {
  id: string;
  orderId?: string;
  orderNumber?: string;
  shipmentId?: string;
  mainEntryId?: string;
  accountTransId?: string;
  activityLogId?: string;
  eventType: string;
  eventCategory: string;
  operation: string;
  entityType: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  source?: string;
  summary?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt?: string | number;
  createdAt?: string | number;
};

const REDUNDANT_LEGACY_ACTIVITY_EVENTS = new Set([
  'activity.add_order',
  'activity.edit_order',
  'activity.edit_delivered_order',
  'activity.delete_order',
]);

type OrderHistoryDocument = { id: string; data: () => unknown };
type OrderHistorySnapshot = { docs?: OrderHistoryDocument[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

type TimestampLike = { toDate: () => Date };

function isTimestampLike(value: unknown): value is TimestampLike {
  return isRecord(value) && typeof value.toDate === 'function';
}

function readTime(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (value instanceof Date) return value.toISOString();
  return isTimestampLike(value) ? value.toDate().toISOString() : undefined;
}

function readEvent(doc: OrderHistoryDocument): OrderHistoryEvent {
  const data = doc.data();
  const event = isRecord(data) ? data : {};
  return {
    id: doc.id,
    orderId: readText(event.orderId ?? event.order_id),
    orderNumber: readText(event.orderNumber ?? event.order_number),
    shipmentId: readText(event.shipmentId ?? event.shipment_id),
    mainEntryId: readText(event.mainEntryId ?? event.main_entry_id),
    accountTransId: readText(event.accountTransId ?? event.account_trans_id),
    activityLogId: readText(event.activityLogId ?? event.activity_log_id),
    eventType: readText(event.eventType ?? event.event_type) ?? 'legacy.unknown',
    eventCategory: readText(event.eventCategory ?? event.event_category) ?? 'legacy',
    operation: readText(event.operation) ?? 'unknown',
    entityType: readText(event.entityType ?? event.entity_type) ?? 'unknown',
    actorId: readText(event.actorId ?? event.actor_id),
    actorName: readText(event.actorName ?? event.actor_name),
    actorRole: readText(event.actorRole ?? event.actor_role),
    source: readText(event.source),
    summary: readText(event.summary),
    beforeData: readRecord(event.beforeData ?? event.before_data),
    afterData: readRecord(event.afterData ?? event.after_data),
    metadata: readRecord(event.metadata),
    occurredAt: readTime(event.occurredAt ?? event.occurred_at),
    createdAt: readTime(event.createdAt ?? event.created_at),
  };
}

function eventTime(event: OrderHistoryEvent): number {
  const raw = event.occurredAt ?? event.createdAt;
  if (typeof raw === 'number') return raw;
  const parsed = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function deduplicate(events: OrderHistoryEvent[]): OrderHistoryEvent[] {
  return Array.from(new Map(events.map((event) => [event.id, event])).values())
    .filter((event) => !REDUNDANT_LEGACY_ACTIVITY_EVENTS.has(event.eventType))
    .sort((left, right) => eventTime(right) - eventTime(left));
}

class OrderHistoryService {
  async listForContext(context: OrderHistoryContext): Promise<OrderHistoryEvent[]> {
    const history = collection(db, 'orders_history');
    const reads: Promise<OrderHistorySnapshot>[] = [];

    if (context.orderId) {
      reads.push(getDocs(query(history, where('orderId', '==', context.orderId), orderBy('occurredAt', 'desc'), limit(250))));
    }

    if (context.orderNumber && context.orderNumber !== context.orderId) {
      reads.push(getDocs(query(history, where('orderNumber', '==', context.orderNumber), orderBy('occurredAt', 'desc'), limit(250))));
    }

    if (context.shipmentId) {
      reads.push(getDocs(query(history, where('shipmentId', '==', context.shipmentId), orderBy('occurredAt', 'desc'), limit(250))));
    }

    if (reads.length === 0) return [];
    const snapshots = await Promise.all(reads);
    return deduplicate(snapshots.flatMap((snapshot) => (snapshot?.docs ? snapshot.docs.map(readEvent) : [])));
  }
}

export const orderHistoryService = new OrderHistoryService();
