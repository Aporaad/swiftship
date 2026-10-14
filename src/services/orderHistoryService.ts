import { ApiClient } from '../data/http/api-client';

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_ALX_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
  accessTokenFactory: () => (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token')),
  maxReadRetries: 0,
});

type ApiEnvelope<T> = { success: true; data: T };
type ApiRow = Record<string, unknown>;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) return value;
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function readTime(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

function readEvent(row: ApiRow): OrderHistoryEvent {
  return {
    id: readText(row.historyId ?? row.ordersHistoryId ?? row.id) ?? '',
    orderId: readText(row.orderId ?? row.order_id),
    orderNumber: readText(row.orderNumber ?? row.order_number),
    shipmentId: readText(row.shipmentId ?? row.shipment_id),
    mainEntryId: readText(row.mainEntryId ?? row.main_entry_id),
    accountTransId: readText(row.accountTransId ?? row.account_trans_id),
    activityLogId: readText(row.activityLogId ?? row.activity_log_id),
    eventType: readText(row.eventType ?? row.event_type) ?? 'legacy.unknown',
    eventCategory: readText(row.eventCategory ?? row.event_category) ?? 'legacy',
    operation: readText(row.operation) ?? 'unknown',
    entityType: readText(row.entityType ?? row.entity_type) ?? 'unknown',
    actorId: readText(row.actorId ?? row.actor_id),
    actorName: readText(row.actorName ?? row.actor_name),
    actorRole: readText(row.actorRole ?? row.actor_role),
    source: readText(row.source),
    summary: readText(row.summary),
    beforeData: readRecord(row.beforeData ?? row.before_data),
    afterData: readRecord(row.afterData ?? row.after_data),
    metadata: readRecord(row.metadata),
    occurredAt: readTime(row.occurredAt ?? row.occurred_at),
    createdAt: readTime(row.createdAt ?? row.created_at),
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

async function fetchHistoryRows(path: string, query?: Record<string, string | number>): Promise<ApiRow[]> {
  const response = await client.get<ApiEnvelope<ApiRow[] | { items?: ApiRow[] }>>(path, query);
  const data = response.data;
  return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
}

async function resolveOrderIdByNumber(orderNumber: string): Promise<string | null> {
  const rows = await fetchHistoryRows('/api/v1/orders', { search: orderNumber, limit: 20, offset: 0 });
  const match = rows.find((row) => readText(row.orderNumber) === orderNumber);
  return match ? readText(match.orderId) ?? null : null;
}

class OrderHistoryService {
  async listForContext(context: OrderHistoryContext): Promise<OrderHistoryEvent[]> {
    const reads: Promise<ApiRow[]>[] = [];

    if (context.shipmentId) {
      reads.push(fetchHistoryRows(`/api/v1/shipments/${encodeURIComponent(context.shipmentId)}/tracking`));
    }

    const orderId = context.orderId
      ?? (context.orderNumber ? await resolveOrderIdByNumber(context.orderNumber) : null);

    if (orderId) {
      reads.push(fetchHistoryRows(`/api/v1/orders/${encodeURIComponent(orderId)}/history`));
    }

    if (reads.length === 0) return [];
    const rows = (await Promise.all(reads)).flat();
    return deduplicate(rows.map(readEvent).filter((event) => event.id));
  }
}

export const orderHistoryService = new OrderHistoryService();
