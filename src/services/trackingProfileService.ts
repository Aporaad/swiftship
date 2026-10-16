// بوابة ملف التتبع العام بعد التسطيح: كل حقل عمود مستقل في public.public_tracking، ولا توجد حمولة jsonb.
// Public tracking profile after flattening: every field is its own column in public.public_tracking — no jsonb payload.
// المنتجات وسجل الأحداث تأتي من جداولها الخاصة (order_items و orders_history) لا من نسخة داخل الملف.
// Products and the logistics log come from their own tables (order_items, orders_history), never a copy inside the profile.

import { historyChangeValue, toOrderHistoryEvent, type OrderHistoryEvent } from './orderHistoryService';

export type TrackingApiRow = Record<string, unknown>;

// عنصر الخط الزمني المعروض في صفحة التتبع، مشتق من حدث سجل مسطّح.
// A timeline entry shown on the tracking page, derived from a flat history event.
export type TrackingMilestone = {
  status: string;
  timestamp: number;
  location: string;
  notes?: string;
  createdBy?: string;
};

export type TrackingProfileView = {
  id: string;
  trackingNumber: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  weight: number;
  cbm: number;
  shippingCompany: string;
  amountPaid: number;
  amountRemaining: number;
  totalCostYER: number;
  currency: string;
  locationYemen: string;
  products: TrackingApiRow[];
  history: TrackingMilestone[];
};

function readText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNumberValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readArray(value: unknown): TrackingApiRow[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'object' && item !== null) as TrackingApiRow[] : [];
}

function milestoneTime(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

// مجموع حقول عناصر الطلب الرقمية: الوزن والحجم لم يعودا داخل حمولة الطلب.
// Sum of the numeric order-item fields: weight and volume no longer live inside an order payload.
function sumItemField(items: TrackingApiRow[], fields: string[]): number {
  return items.reduce((total, item) => {
    const value = fields.map((field) => item[field]).find((candidate) => candidate !== undefined && candidate !== null);
    return total + readNumberValue(value);
  }, 0);
}

// الخط الزمني مرتّب من الأقدم إلى الأحدث: الصفحة تعكسه ليعرض الحدث الحالي أولاً.
// The timeline is oldest-first: the page reverses it so the current milestone renders first.
function sortMilestonesByTime(milestones: TrackingMilestone[]): TrackingMilestone[] {
  return [...milestones].sort((left, right) => left.timestamp - right.timestamp);
}

export function trackingMilestoneFromEvent(event: OrderHistoryEvent, fallbackLocation = ''): TrackingMilestone {
  const status = readText(historyChangeValue(event, 'status')) || event.summary || event.eventType;
  const location = readText(historyChangeValue(event, 'locationYemen'))
    || readText(historyChangeValue(event, 'location'))
    || fallbackLocation;
  const notes = readText(historyChangeValue(event, 'note')) || readText(historyChangeValue(event, 'notes'));
  return {
    status,
    timestamp: milestoneTime(event.occurredAt ?? event.createdAt),
    location,
    ...(notes ? { notes } : {}),
    ...(event.actorName ? { createdBy: event.actorName } : {}),
  };
}

// صفوف سجل الأحداث المسطّحة (camelCase من API أو snake_case من قراءة مباشرة) إلى خط زمني.
// Flat history rows — API camelCase or a direct snake_case read — become the timeline.
export function trackingMilestonesFromHistoryRows(rows: unknown[], fallbackLocation = ''): TrackingMilestone[] {
  return sortMilestonesByTime(rows
    .filter((row): row is TrackingApiRow => typeof row === 'object' && row !== null)
    .map((row) => trackingMilestoneFromEvent(toOrderHistoryEvent(row), fallbackLocation)));
}

// أحداث السجل (مرتّبة من الأحدث عادةً) إلى خط زمني للتتبع.
// History events (usually newest-first) become the tracking timeline.
export function trackingMilestonesFromEvents(events: OrderHistoryEvent[], fallbackLocation = ''): TrackingMilestone[] {
  return sortMilestonesByTime(events.map((event) => trackingMilestoneFromEvent(event, fallbackLocation)));
}

// قراءة ملف تتبع منشور: تُقرأ الحقول من الصف نفسه مباشرة.
// Published profile read: the flat fields are taken straight off the returned row.
export function readTrackingProfileRow(row: TrackingApiRow, fallbackTrackingId: string): TrackingProfileView {
  const trackingId = readText(row.trackingId) || fallbackTrackingId;
  const locationYemen = readText(row.locationYemen) || 'مستودع الفرز والتبريد';
  const status = readText(row.status) || 'تم تسجيل الطلب';
  return {
    id: trackingId,
    trackingNumber: trackingId,
    orderNumber: readText(row.orderNumber),
    status,
    customerName: readText(row.customerName),
    customerPhone: readText(row.customerPhone),
    customerAddress: readText(row.customerAddress) || 'صنعاء، اليمن',
    weight: readNumberValue(row.weight),
    cbm: readNumberValue(row.cbm),
    shippingCompany: readText(row.shippingCompany),
    amountPaid: readNumberValue(row.amountPaid),
    amountRemaining: readNumberValue(row.amountRemaining),
    totalCostYER: readNumberValue(row.totalCostYER),
    currency: readText(row.currency) || 'YER',
    locationYemen,
    products: readArray(row.products),
    history: trackingMilestonesFromHistoryRows(readArray(row.history), locationYemen),
  };
}

// قراءة طلب داخلي غير منشور: الحقول من أعمدة الطلب، والمنتجات من عناصر الطلب، والخط الزمني من سجل الطلبات.
// Internal (unpublished) order read: fields from the order columns, products from its items, timeline from order history.
export function readOrderTrackingRow(
  row: TrackingApiRow,
  fallbackTrackingId: string,
  historyEvents: OrderHistoryEvent[] = [],
): TrackingProfileView {
  const items = readArray(row.items);
  const trackingNumber = readText(row.trackingNumber) || readText(row.orderNumber) || fallbackTrackingId;
  const status = readText(row.orderStatus) || readText(row.orderStatusNameAr) || 'تم تسجيل الطلب';
  const locationYemen = readText(row.locationYemen) || 'مستودع الفرز والتبريد';
  return {
    id: readText(row.orderId),
    trackingNumber,
    orderNumber: readText(row.orderNumber),
    status,
    customerName: readText(row.customerName),
    customerPhone: readText(row.customerPhone),
    customerAddress: readText(row.customerAddress) || readText(row.recipientAddress) || readText(row.deliveryCity) || 'صنعاء، اليمن',
    weight: sumItemField(items, ['totalWeight', 'total__weight']) || readNumberValue(row.totalWeight),
    cbm: sumItemField(items, ['totalCbm', 'total_cbm']) || readNumberValue(row.totalCBM),
    shippingCompany: readText(row.shippingCompany),
    amountPaid: readNumberValue(row.amountPaid),
    amountRemaining: readNumberValue(row.amountRemaining),
    totalCostYER: readNumberValue(row.totalCostYER),
    currency: readText(row.currency) || 'YER',
    locationYemen,
    products: items,
    history: trackingMilestonesFromEvents(historyEvents, locationYemen),
  };
}

// كتابة ملف التتبع: مفاتيح مسطّحة فقط مطابقة لأعمدة public_tracking؛ المنتجات والسجل ليست أعمدة هنا.
// Tracking profile writes: flat keys matching the public_tracking columns only — products and the log are not columns here.
export function trackingProfileWritePayload(profile: TrackingProfileView): Record<string, unknown> {
  return {
    orderNumber: profile.orderNumber,
    status: profile.status,
    locationYemen: profile.locationYemen,
    customerName: profile.customerName,
    customerPhone: profile.customerPhone,
    customerAddress: profile.customerAddress,
    weight: profile.weight,
    cbm: profile.cbm,
    shippingCompany: profile.shippingCompany,
    amountPaid: profile.amountPaid,
    amountRemaining: profile.amountRemaining,
    totalCostYER: profile.totalCostYER,
    currency: profile.currency,
    isPublished: true,
  };
}
