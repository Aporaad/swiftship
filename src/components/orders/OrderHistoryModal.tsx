import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Clock3, FileText, Filter, PackageCheck, ReceiptText, RefreshCw, RotateCcw, Search, ScrollText, UserRound, X } from 'lucide-react';
import { orderHistoryService, type OrderHistoryContext, type OrderHistoryEvent } from '../../services/orderHistoryService';
import {
  appliedOrderHistoryFilterCount,
  defaultOrderHistoryFilters,
  filterOrderHistoryEvents,
  historyActorKey,
  type OrderHistoryFilters,
} from '../../services/orderHistoryFilters';

type OrderHistoryModalProps = {
  isOpen: boolean;
  context: OrderHistoryContext | null;
  onClose: () => void;
  isAr: boolean;
};

type ChangeValue = { before?: unknown; after?: unknown };

const fieldLabels: Record<string, { ar: string; en: string }> = {
  order_status: { ar: 'حالة الطلب', en: 'Order status' },
  order_status_id: { ar: 'معرّف حالة الطلب', en: 'Order status ID' },
  orderStatus: { ar: 'حالة الطلب', en: 'Order status' },
  orderStatusId: { ar: 'معرّف حالة الطلب', en: 'Order status ID' },
  shipment_status: { ar: 'حالة الشحنة', en: 'Shipment status' },
  shipmentStatus: { ar: 'حالة الشحنة', en: 'Shipment status' },
  tracking_number: { ar: 'رقم التتبع', en: 'Tracking number' },
  trackingNumber: { ar: 'رقم التتبع', en: 'Tracking number' },
  order_number: { ar: 'رقم الطلب', en: 'Order number' },
  orderNumber: { ar: 'رقم الطلب', en: 'Order number' },
  order_id: { ar: 'معرّف الطلب', en: 'Order ID' },
  orderId: { ar: 'معرّف الطلب', en: 'Order ID' },
  shipment_id: { ar: 'معرّف الشحنة', en: 'Shipment ID' },
  shipmentId: { ar: 'معرّف الشحنة', en: 'Shipment ID' },
  shipping_cost: { ar: 'تكلفة الشحن', en: 'Shipping cost' },
  weight: { ar: 'الوزن', en: 'Weight' },
  customer_id: { ar: 'معرّف العميل', en: 'Customer ID' },
  customerName: { ar: 'اسم العميل', en: 'Customer name' },
  customerPhone: { ar: 'هاتف العميل', en: 'Customer phone' },
  customerAddress: { ar: 'عنوان العميل', en: 'Customer address' },
  amountPaid: { ar: 'المبلغ المدفوع', en: 'Paid amount' },
  amountRemaining: { ar: 'المبلغ المتبقي', en: 'Remaining amount' },
  totalCostYER: { ar: 'إجمالي التكلفة بالريال اليمني', en: 'Total cost (YER)' },
  totalCostSAR: { ar: 'إجمالي التكلفة بالريال السعودي', en: 'Total cost (SAR)' },
  deliveryStatus: { ar: 'حالة التوصيل', en: 'Delivery status' },
  locationYemen: { ar: 'الموقع في اليمن', en: 'Yemen location' },
  data: { ar: 'البيانات التفصيلية', en: 'Detailed data' },
  createdAt: { ar: 'تاريخ الإنشاء', en: 'Created at' },
  created_at: { ar: 'تاريخ الإنشاء', en: 'Created at' },
};

function asDate(value?: string | number): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function summaryLabel(event: OrderHistoryEvent, isAr: boolean): string {
  if (event.summary) return event.summary;
  const labels: Record<string, string> = {
    'order.created': isAr ? 'تم إنشاء الطلب' : 'Order created',
    'order.updated': isAr ? 'تم تعديل بيانات الطلب' : 'Order updated',
    'order.status_changed': isAr ? 'تم تحديث حالة الطلب' : 'Order status updated',
    'order.deleted': isAr ? 'تم حذف الطلب' : 'Order deleted',
    'shipment.created': isAr ? 'تم إنشاء الشحنة' : 'Shipment created',
    'shipment.updated': isAr ? 'تم تعديل بيانات الشحنة' : 'Shipment updated',
    'shipment.status_changed': isAr ? 'تم تحديث حالة الشحنة' : 'Shipment status updated',
    'shipment.deleted': isAr ? 'تم حذف الشحنة' : 'Shipment deleted',
  };
  return labels[event.eventType] || event.eventType;
}

function entityLabel(event: OrderHistoryEvent, isAr: boolean): string {
  if (event.eventCategory === 'financial') return isAr ? 'قيد مالي' : 'Financial entry';
  if (event.eventCategory === 'shipment') return isAr ? 'شحنة' : 'Shipment';
  if (event.eventCategory === 'activity') return isAr ? 'نشاط مرتبط' : 'Related activity';
  return isAr ? 'طلب' : 'Order';
}

function eventIcon(event: OrderHistoryEvent) {
  if (event.eventCategory === 'financial') return ReceiptText;
  if (event.eventCategory === 'shipment') return PackageCheck;
  if (event.eventCategory === 'activity') return FileText;
  return ScrollText;
}

function fieldLabel(field: string, isAr: boolean) {
  const normalized = field.replace(/^data\./, '');
  return fieldLabels[normalized]?.[isAr ? 'ar' : 'en'] || normalized.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
}

function formatValue(value: unknown, isAr: boolean) {
  if (value === null || value === undefined || value === '') return isAr ? '—' : '—';
  if (typeof value === 'boolean') return value ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function changeEntries(event: OrderHistoryEvent): Array<[string, ChangeValue]> {
  const changes = event.metadata?.changes;
  if (isObject(changes)) {
    return Object.entries(changes).map(([field, value]) => [field, isObject(value) ? value : { after: value }]);
  }

  const fields = Array.isArray(event.metadata?.changedFields) ? event.metadata.changedFields : [];
  return fields.map((field) => {
    const key = String(field);
    return [key, { before: event.beforeData?.[key], after: event.afterData?.[key] }];
  });
}

function actorLabel(event: OrderHistoryEvent, isAr: boolean) {
  const name = event.actorName || (isAr ? 'النظام' : 'System');
  return event.actorRole ? `${name} · ${event.actorRole}` : name;
}

function Snapshot({ title, value, isAr }: { title: string; value: Record<string, unknown> | undefined; isAr: boolean }) {
  if (!value || Object.keys(value).length === 0) return null;
  return (
    <details className="group rounded-xl border border-slate-800 bg-black/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-slate-300">
        <span>{title}</span>
        <span className="text-[11px] font-medium text-slate-500">{isAr ? 'عرض البيانات المصدرية' : 'View source data'}</span>
        <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" />
      </summary>
      <pre dir="ltr" className="max-h-80 overflow-auto border-t border-slate-800 bg-slate-950/70 p-4 text-left text-xs leading-6 text-slate-300">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

function DetailsGrid({ value, isAr }: { value: Record<string, unknown>; isAr: boolean }) {
  const entries = Object.entries(value);
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map(([key, item]) => (
        <div key={key} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5">
          <dt className="text-[11px] font-semibold text-slate-500">{fieldLabel(key, isAr)}</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-xs font-bold leading-5 text-slate-200">{formatValue(item, isAr)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EventDetails({ event, isAr }: { event: OrderHistoryEvent; isAr: boolean }) {
  const changes = changeEntries(event);
  const activityDetails = isObject(event.metadata?.activityDetails) ? event.metadata.activityDetails : null;

  return (
    <div className="space-y-5 border-t border-slate-800 bg-black/15 px-5 py-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3"><p className="text-[11px] font-semibold text-slate-500">{isAr ? 'نوع الحدث' : 'Event type'}</p><p className="mt-1 break-all font-mono text-xs font-bold text-[#e7c75d]">{event.eventType}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3"><p className="text-[11px] font-semibold text-slate-500">{isAr ? 'مصدر التسجيل' : 'Recorded by'}</p><p className="mt-1 text-xs font-bold text-slate-200">{event.source || (isAr ? 'النظام' : 'System')}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3"><p className="text-[11px] font-semibold text-slate-500">{isAr ? 'المرجع' : 'Reference'}</p><p className="mt-1 break-all font-mono text-xs font-bold text-slate-200">{event.shipmentId || event.orderNumber || event.orderId || '—'}</p></div>
      </div>

      {changes.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-black text-white">{isAr ? 'تفاصيل التغييرات' : 'Change details'}</h3><span className="rounded-md border border-[#d4af37]/25 bg-[#d4af37]/10 px-2 py-1 text-[11px] font-bold text-[#e7c75d]">{changes.length} {isAr ? 'حقل' : 'fields'}</span></div>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-[620px] w-full text-right text-xs" dir={isAr ? 'rtl' : 'ltr'}>
              <thead className="bg-slate-900/90 text-[11px] font-black text-slate-400"><tr><th className="px-4 py-3">{isAr ? 'الحقل' : 'Field'}</th><th className="w-[38%] px-4 py-3">{isAr ? 'القيمة السابقة' : 'Previous value'}</th><th className="w-[38%] px-4 py-3">{isAr ? 'القيمة الجديدة' : 'New value'}</th></tr></thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/35">
                {changes.map(([field, change]) => <tr key={field}><td className="px-4 py-3 font-bold text-slate-200">{fieldLabel(field, isAr)}</td><td className="whitespace-pre-wrap break-words px-4 py-3 text-slate-400">{formatValue(change.before, isAr)}</td><td className="whitespace-pre-wrap break-words px-4 py-3 font-semibold text-emerald-300">{formatValue(change.after, isAr)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activityDetails && <div><h3 className="mb-3 text-sm font-black text-white">{isAr ? 'تفاصيل النشاط المرتبط' : 'Related activity details'}</h3><DetailsGrid value={activityDetails} isAr={isAr} /></div>}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Snapshot title={isAr ? 'لقطة قبل التغيير' : 'Before change snapshot'} value={event.beforeData} isAr={isAr} />
        <Snapshot title={isAr ? 'لقطة بعد التغيير' : 'After change snapshot'} value={event.afterData} isAr={isAr} />
        <Snapshot title={isAr ? 'بيانات التسجيل الإضافية' : 'Additional event data'} value={event.metadata} isAr={isAr} />
      </div>
    </div>
  );
}

export default function OrderHistoryModal({ isOpen, context, onClose, isAr }: OrderHistoryModalProps) {
  const [events, setEvents] = useState<OrderHistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderHistoryFilters>(defaultOrderHistoryFilters);

  useEffect(() => {
    if (!isOpen || !context) return;
    let active = true;
    setLoading(true);
    setError('');
    setExpandedId(null);
    setFilters(defaultOrderHistoryFilters);
    orderHistoryService.listForContext(context)
      .then((nextEvents) => { if (active) setEvents(nextEvents); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load history'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, context?.orderId, context?.shipmentId]);

  const title = useMemo(() => context?.entityType === 'shipment'
    ? (isAr ? 'سجل حركة الشحنة' : 'Shipment activity history')
    : (isAr ? 'سجل الطلب المالي والتشغيلي' : 'Order financial & activity history'), [context?.entityType, isAr]);

  const eventTypes = useMemo(() => Array.from(new Set(events.map((event) => event.eventType))).sort(), [events]);
  const actors = useMemo(() => Array.from(new Map(events.map((event) => [historyActorKey(event), actorLabel(event, isAr)])).entries()), [events, isAr]);
  const filteredEvents = useMemo(() => filterOrderHistoryEvents(events, filters), [events, filters]);
  const appliedFilters = useMemo(() => appliedOrderHistoryFilterCount(filters), [filters]);

  useEffect(() => {
    if (expandedId && !filteredEvents.some((event) => event.id === expandedId)) setExpandedId(null);
  }, [expandedId, filteredEvents]);

  if (!isOpen || !context) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-[#111114] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 bg-gradient-to-l from-[#d4af37]/15 to-transparent px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-center gap-4">
            <div className="rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-3 text-[#e4c551]"><ScrollText className="h-6 w-6" /></div>
            <div className="min-w-0"><h2 className="text-base font-black text-white sm:text-lg">{title}</h2><p className="mt-1 truncate font-mono text-xs font-bold text-[#d4af37]">{context.label}</p><p className="mt-1 text-xs text-slate-400">{isAr ? 'كل صف يمثل حدثًا واحدًا؛ اضغط على الصف لعرض التفاصيل واللقطات الكاملة.' : 'Each row is one event; select a row for complete details and snapshots.'}</p></div>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-400 transition hover:text-white" title={isAr ? 'إغلاق' : 'Close'}><X className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          {loading ? <div className="flex items-center justify-center gap-2 py-20 text-sm font-bold text-slate-400"><RefreshCw className="h-5 w-5 animate-spin" />{isAr ? 'جاري تحميل السجل...' : 'Loading history...'}</div>
            : error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
              : events.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-12 text-center text-sm font-bold text-slate-500">{isAr ? 'لا توجد حركات مسجلة لهذا العنصر حتى الآن.' : 'No activity has been recorded for this item yet.'}</div>
                : <>
                  <section className="mb-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5" aria-label={isAr ? 'فلاتر سجل الأحداث' : 'History filters'}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-black text-white"><Filter className="h-4 w-4 text-[#d4af37]" />{isAr ? 'تصفية وبحث السجل' : 'Filter & search history'}</div><button type="button" onClick={() => setFilters(defaultOrderHistoryFilters)} disabled={appliedFilters === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-[#d4af37]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />{isAr ? 'مسح الفلاتر' : 'Clear filters'}</button></div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label className="xl:col-span-2"><span className="mb-1.5 block text-[11px] font-bold text-slate-500">{isAr ? 'البحث عن حدث أو قيمة أو مرجع' : 'Search events, values, or references'}</span><span className="relative block"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder={isAr ? 'مثال: تم الشحن، رقم التتبع، قيد مالي...' : 'e.g. shipped, tracking number, journal...'} className="w-full rounded-xl border border-slate-700 bg-black/30 py-2.5 pr-10 pl-3 text-xs font-semibold text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-[#d4af37]/60" /></span></label>
                      <label><span className="mb-1.5 block text-[11px] font-bold text-slate-500">{isAr ? 'نوع الحدث' : 'Event type'}</span><select value={filters.eventType} onChange={(event) => setFilters((current) => ({ ...current, eventType: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-black/30 px-3 py-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-[#d4af37]/60"><option value="">{isAr ? 'كل الأنواع' : 'All event types'}</option>{eventTypes.map((type) => <option key={type} value={type}>{summaryLabel({ eventType: type } as OrderHistoryEvent, isAr)} — {type}</option>)}</select></label>
                      <label><span className="mb-1.5 block text-[11px] font-bold text-slate-500">{isAr ? 'القائم بالحدث' : 'Actor'}</span><select value={filters.actorKey} onChange={(event) => setFilters((current) => ({ ...current, actorKey: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-black/30 px-3 py-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-[#d4af37]/60"><option value="">{isAr ? 'كل المستخدمين' : 'All users'}</option>{actors.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                      <label><span className="mb-1.5 block text-[11px] font-bold text-slate-500">{isAr ? 'الفترة الزمنية' : 'Time period'}</span><select value={filters.timeRange} onChange={(event) => setFilters((current) => ({ ...current, timeRange: event.target.value as OrderHistoryFilters['timeRange'] }))} className="w-full rounded-xl border border-slate-700 bg-black/30 px-3 py-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-[#d4af37]/60"><option value="all">{isAr ? 'كل الفترات' : 'All time'}</option><option value="today">{isAr ? 'اليوم' : 'Today'}</option><option value="last_24_hours">{isAr ? 'آخر 24 ساعة' : 'Last 24 hours'}</option><option value="last_7_days">{isAr ? 'آخر 7 أيام' : 'Last 7 days'}</option><option value="last_30_days">{isAr ? 'آخر 30 يومًا' : 'Last 30 days'}</option></select></label>
                      <label><span className="mb-1.5 block text-[11px] font-bold text-slate-500">{isAr ? 'من تاريخ' : 'From date'}</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-black/30 px-3 py-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-[#d4af37]/60" /></label>
                      <label><span className="mb-1.5 block text-[11px] font-bold text-slate-500">{isAr ? 'إلى تاريخ' : 'To date'}</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-black/30 px-3 py-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-[#d4af37]/60" /></label>
                      <label><span className="mb-1.5 block text-[11px] font-bold text-slate-500">{isAr ? 'من وقت' : 'From time'}</span><input type="time" value={filters.timeFrom} onChange={(event) => setFilters((current) => ({ ...current, timeFrom: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-black/30 px-3 py-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-[#d4af37]/60" /></label>
                      <label><span className="mb-1.5 block text-[11px] font-bold text-slate-500">{isAr ? 'إلى وقت' : 'To time'}</span><input type="time" value={filters.timeTo} onChange={(event) => setFilters((current) => ({ ...current, timeTo: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-black/30 px-3 py-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-[#d4af37]/60" /></label>
                    </div>
                  </section>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-400"><span>{isAr ? `عرض ${filteredEvents.length} من ${events.length} حدث` : `Showing ${filteredEvents.length} of ${events.length} events`}</span>{appliedFilters > 0 && <span className="rounded-md border border-[#d4af37]/25 bg-[#d4af37]/10 px-2 py-1 text-[#e7c75d]">{appliedFilters} {isAr ? 'فلاتر مطبقة' : 'filters applied'}</span>}</div>
                  {filteredEvents.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-12 text-center"><Search className="mx-auto h-6 w-6 text-slate-600" /><p className="mt-3 text-sm font-bold text-slate-400">{isAr ? 'لا توجد أحداث تطابق معايير البحث والتصفية.' : 'No events match the current search and filters.'}</p><button type="button" onClick={() => setFilters(defaultOrderHistoryFilters)} className="mt-4 text-xs font-black text-[#e7c75d] hover:text-[#f0d77e]">{isAr ? 'مسح الفلاتر وعرض كل الأحداث' : 'Clear filters and show all events'}</button></div>
                    : <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-inner"><table className="min-w-[940px] w-full border-collapse text-right" aria-label={isAr ? 'سجل الأحداث والتغييرات' : 'Events and changes history'} dir={isAr ? 'rtl' : 'ltr'}>
                  <thead className="sticky top-0 z-10 bg-slate-900 text-xs font-black text-slate-400"><tr><th className="px-5 py-4">{isAr ? 'الحدث' : 'Event'}</th><th className="px-4 py-4">{isAr ? 'النوع' : 'Type'}</th><th className="px-4 py-4">{isAr ? 'القائم بالحدث' : 'Actor'}</th><th className="px-4 py-4">{isAr ? 'التوقيت' : 'Time'}</th><th className="px-4 py-4 text-center">{isAr ? 'التفاصيل' : 'Details'}</th></tr></thead>
                  <tbody className="divide-y divide-slate-800 bg-[#101014]">{filteredEvents.map((event) => {
                    const Icon = eventIcon(event);
                    const occurred = asDate(event.occurredAt ?? event.createdAt);
                    const expanded = expandedId === event.id;
                    const changes = changeEntries(event);
                    return <Fragment key={event.id}>
                      <tr key={event.id} className={`cursor-pointer transition hover:bg-slate-900/80 ${expanded ? 'bg-slate-900/70' : ''}`} onClick={() => setExpandedId(expanded ? null : event.id)}>
                        <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-[#d4af37]"><Icon className="h-4 w-4" /></span><div><p className="text-sm font-black text-white">{summaryLabel(event, isAr)}</p><p className="mt-1 font-mono text-[11px] text-slate-500">{event.eventType}</p></div></div></td>
                        <td className="px-4 py-4"><span className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-300">{entityLabel(event, isAr)}</span></td>
                        <td className="px-4 py-4"><div className="inline-flex items-center gap-2 text-xs font-bold text-slate-300"><UserRound className="h-4 w-4 text-slate-500" />{event.actorName || (isAr ? 'النظام' : 'System')}</div>{event.actorRole && <p className="mt-1 text-[11px] text-slate-500">{event.actorRole}</p>}</td>
                        <td className="px-4 py-4 text-xs font-semibold text-slate-300"><div className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-500" />{occurred ? occurred.toLocaleString(isAr ? 'ar-EG' : 'en-US') : '—'}</div></td>
                        <td className="px-4 py-4 text-center"><button onClick={(click) => { click.stopPropagation(); setExpandedId(expanded ? null : event.id); }} className="inline-flex items-center gap-2 rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-2 text-xs font-black text-[#e7c75d] hover:bg-[#d4af37]/20"><span>{changes.length || (isAr ? 'عرض' : 'View')}</span><ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} /></button></td>
                      </tr>
                      {expanded && <tr><td colSpan={5} className="p-0"><EventDetails event={event} isAr={isAr} /></td></tr>}
                    </Fragment>;
                  })}</tbody>
                </table></div>}
                </>}
        </div>
      </section>
    </div>
  );
}
