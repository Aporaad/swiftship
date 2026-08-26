import { collection, getDocs, limit, orderBy, query, where } from '../lib/supabase';
import { db } from '../lib/supabase';

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
  journalEntryId?: string;
  accountTransactionId?: string;
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

function readEvent(doc: any): OrderHistoryEvent {
  return { ...doc.data(), id: doc.id } as OrderHistoryEvent;
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
    const reads: Promise<any>[] = [];

    if (context.orderId) {
      reads.push(getDocs(query(history, where('orderId', '==', context.orderId), orderBy('occurredAt', 'desc'), limit(250))));
    }

    if (context.shipmentId) {
      reads.push(getDocs(query(history, where('shipmentId', '==', context.shipmentId), orderBy('occurredAt', 'desc'), limit(250))));
    }

    if (reads.length === 0) return [];
    const snapshots = await Promise.all(reads);
    return deduplicate(snapshots.flatMap((snapshot) => snapshot.docs.map(readEvent)));
  }
}

export const orderHistoryService = new OrderHistoryService();
