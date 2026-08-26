import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const ordersPage = readFileSync(path.join(projectRoot, 'src/pages/Orders.tsx'), 'utf8');
const historyModal = readFileSync(path.join(projectRoot, 'src/components/orders/OrderHistoryModal.tsx'), 'utf8');

describe('orders history UI wiring', () => {
  it('provides a history action for both orders and shipments', () => {
    expect(ordersPage).toContain('const handleOpenOrderHistory');
    expect(ordersPage).toContain('const handleOpenShipmentHistory');
    expect(ordersPage).toContain('onClick={() => handleOpenOrderHistory(ord)}');
    expect(ordersPage).toContain('onClick={() => handleOpenShipmentHistory(ship)}');
  });

  it('mounts the history modal with the active context and renders a clear event table with detailed snapshots', () => {
    expect(ordersPage).toContain('<OrderHistoryModal');
    expect(ordersPage).toContain('context={orderHistoryContext}');
    expect(historyModal).toContain('سجل الأحداث والتغييرات');
    expect(historyModal).toContain('تفاصيل التغييرات');
    expect(historyModal).toContain('كل صف يمثل حدثًا واحدًا');
    expect(historyModal).toContain('metadata?.changes');
    expect(historyModal).toContain('القيمة السابقة');
    expect(historyModal).toContain('القيمة الجديدة');
    expect(historyModal).toContain('aria-label={isAr ? \'سجل الأحداث والتغييرات\'');
    expect(historyModal).toContain('beforeData');
    expect(historyModal).toContain('afterData');
    expect(historyModal).toContain('actorName');
  });

  it('provides search and filters for event type, actor, and date/time with result feedback', () => {
    expect(historyModal).toContain('فلاتر سجل الأحداث');
    expect(historyModal).toContain('البحث عن حدث أو قيمة أو مرجع');
    expect(historyModal).toContain('نوع الحدث');
    expect(historyModal).toContain('القائم بالحدث');
    expect(historyModal).toContain('الفترة الزمنية');
    expect(historyModal).toContain('من تاريخ');
    expect(historyModal).toContain('إلى وقت');
    expect(historyModal).toContain('filteredEvents');
    expect(historyModal).toContain('لا توجد أحداث تطابق معايير البحث والتصفية.');
    expect(historyModal).toContain('مسح الفلاتر');
  });

  it('keeps the audit policy and referential constraints in the migration source', () => {
    const migration = readFileSync(path.join(projectRoot, 'supabase/migrations/202608222330_unify_orders_history_events_and_relationships.sql'), 'utf8');
    expect(migration).toContain("'edit_order'");
    expect(migration).toContain('orders_history_order_id_fkey');
    expect(migration).toContain('orders_history_shipment_id_fkey');
    expect(migration).toContain('ON DELETE SET NULL');
  });

  it('checks the order audit history before a status change and executes every skipped stage in order', () => {
    expect(ordersPage).toContain('orderHistoryService.listForContext');
    expect(ordersPage).toContain('getProcessedStatusIds(statusHistory)');
    expect(ordersPage).toContain('planOrderStatusTransition');
    expect(ordersPage).toContain('transitionPlan.stagesToProcess');
    expect(ordersPage).toContain('for (const stage of transitionPlan.stagesToProcess)');
    expect(ordersPage).toContain('purchaseSource');
    expect(ordersPage).toContain('shippingCompany');
  });
});
