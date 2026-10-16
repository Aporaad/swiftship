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

// صف تغيير واحد بعد تسطيح السجل: اسم الحقل مع قيمتيه قبل وبعد، بدل لقطات jsonb.
// One history change after flattening: the field name plus its old/new value, replacing the jsonb snapshots.
export type OrderHistoryChange = {
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
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
  // الأعمدة المسطّحة التي حلّت محل beforeData/afterData/metadata المحذوفة.
  // Flat columns that replaced the dropped beforeData/afterData/metadata payloads.
  changedFields: string[];
  changes: OrderHistoryChange[];
  triggerName?: string;
  deletedOrderId?: string;
  orderReference?: string;
  activityTarget?: string;
  activityAction?: string;
  activityDetails?: Record<string, unknown>;
  automationKey?: string;
  autoRuleId?: string;
  statusId?: string;
  isAutomatic?: boolean;
  accountTransCount?: number;
  occurredAt?: string | number;
  createdAt?: string | number;
};

export type HistoryChangeSide = 'oldValue' | 'newValue';

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

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function readTime(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

// مصفوفة النصوص تقبل شكل API (مصفوفة) وأشكال القراءة المباشرة من Postgres: نص [] أو مصفوفة JSON.
// Text lists accept the API array plus direct-Postgres shapes: a {} array literal or a JSON array string.
function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : item === null || item === undefined ? '' : String(item)))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  const text = value.trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      return readStringList(JSON.parse(text));
    } catch {
      return [];
    }
  }
  const inner = text.startsWith('{') && text.endsWith('}') ? text.slice(1, -1) : text;
  return inner
    .split(',')
    .map((item) => item.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'))
    .filter(Boolean);
}

// الاسم الطبيعي لحقل التغيير: يسقط مسار data. القديم ويوحّد snake_case مع camelCase.
// Normalised change-field name: drops the legacy "data." path and unifies snake_case with camelCase.
export function normalizeHistoryFieldName(fieldName: string): string {
  return fieldName
    .replace(/^data\./, '')
    .replace(/_+([a-z0-9])/g, (_match, character: string) => character.toUpperCase());
}

function readChangeRow(value: unknown): OrderHistoryChange | null {
  if (!isRecord(value)) return null;
  const fieldName = readText(value.fieldName ?? value.field_name);
  if (!fieldName) return null;
  return {
    fieldName,
    oldValue: value.oldValue ?? value.old_value ?? null,
    newValue: value.newValue ?? value.new_value ?? null,
  };
}

// صفوف التغيير: changes من API، أو جدول orders_history_change المضمّن في قراءة Supabase المباشرة.
// Change rows: `changes` from the API, or the embedded orders_history_change rows of a direct Supabase read.
function readChangeList(row: ApiRow): OrderHistoryChange[] {
  const source = row.changes ?? row.ordersHistoryChange ?? row.orders_history_change;
  if (!Array.isArray(source)) return [];
  return source.map(readChangeRow).filter((change): change is OrderHistoryChange => change !== null);
}

export function toOrderHistoryEvent(row: ApiRow): OrderHistoryEvent {
  return {
    id: readText(row.historyId ?? row.ordersHistoryId ?? row.orders_history_id ?? row.id) ?? '',
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
    changedFields: readStringList(row.changedFields ?? row.changed_fields),
    changes: readChangeList(row),
    triggerName: readText(row.triggerName ?? row.trigger_name),
    deletedOrderId: readText(row.deletedOrderId ?? row.deleted_order_id),
    orderReference: readText(row.orderReference ?? row.order_reference),
    activityTarget: readText(row.activityTarget ?? row.activity_target),
    activityAction: readText(row.activityAction ?? row.activity_action),
    activityDetails: readRecord(row.activityDetails ?? row.activity_details),
    automationKey: readText(row.automationKey ?? row.automation_key),
    autoRuleId: readText(row.autoRuleId ?? row.auto_rule_id),
    statusId: readText(row.statusId ?? row.status_id),
    isAutomatic: readBoolean(row.isAutomatic ?? row.is_automatic),
    accountTransCount: readNumber(row.accountTransCount ?? row.account_trans_count),
    occurredAt: readTime(row.occurredAt ?? row.occurred_at),
    createdAt: readTime(row.createdAt ?? row.created_at),
  };
}

// قيمة حقل من صفوف التغيير بصرف النظر عن كتابة اسمه أو مساره القديم.
// Reads a field's value from the flat change rows, tolerant of naming and the legacy "data." path.
export function historyChangeValue(
  event: OrderHistoryEvent,
  fieldName: string,
  side: HistoryChangeSide = 'newValue',
): unknown {
  const wanted = normalizeHistoryFieldName(fieldName);
  const change = event.changes.find((item) => normalizeHistoryFieldName(item.fieldName) === wanted);
  return change ? change[side] : undefined;
}

// سجل {اسم الحقل: القيمة} مشتق من صفوف التغيير للعرض والمقارنة، لا من حمولة مخزّنة.
// A {fieldName: value} record derived from the change rows for display/comparison — never a stored payload.
export function historyChangesAsRecord(event: OrderHistoryEvent, side: HistoryChangeSide): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const change of event.changes) {
    const value = change[side];
    if (value === null || value === undefined) continue;
    record[normalizeHistoryFieldName(change.fieldName)] = value;
  }
  return record;
}

// كل الحقول المعدّلة: صفوف التغيير زائدًا الحقول المعلنة في changed_fields بلا قيمة محسوبة.
// Every touched field: the change rows plus any changed_fields names that carry no diffed value.
export function historyEventChanges(event: OrderHistoryEvent): OrderHistoryChange[] {
  const changes = [...event.changes];
  const seen = new Set(changes.map((change) => normalizeHistoryFieldName(change.fieldName)));
  for (const fieldName of event.changedFields) {
    const key = normalizeHistoryFieldName(fieldName);
    if (seen.has(key)) continue;
    seen.add(key);
    changes.push({ fieldName, oldValue: null, newValue: null });
  }
  return changes;
}

// الحقول الوصفية المسطّحة للحدث، تباعًا من أعمدة حقيقية وتُعرض كما هي.
// The event's descriptive flat fields: read straight from real columns, shown as-is.
export function historyEventDetailFields(event: OrderHistoryEvent): Record<string, unknown> {
  const entries: Array<[string, unknown]> = [
    ['orderReference', event.orderReference],
    ['triggerName', event.triggerName],
    ['activityTarget', event.activityTarget],
    ['activityAction', event.activityAction],
    ['automationKey', event.automationKey],
    ['autoRuleId', event.autoRuleId],
    ['statusId', event.statusId],
    ['isAutomatic', event.isAutomatic],
    ['deletedOrderId', event.deletedOrderId],
    ['mainEntryId', event.mainEntryId],
    ['accountTransId', event.accountTransId],
    ['accountTransCount', event.accountTransCount],
    ['activityLogId', event.activityLogId],
    ['changedFields', event.changedFields.length > 0 ? event.changedFields : undefined],
  ];
  const details: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (value === null || value === undefined || value === '') continue;
    details[key] = value;
  }
  return details;
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
    return deduplicate(rows.map(toOrderHistoryEvent).filter((event) => event.id));
  }
}

export const orderHistoryService = new OrderHistoryService();
