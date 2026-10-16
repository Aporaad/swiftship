import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const ordersPage = readFileSync(path.join(projectRoot, 'src/features/orders/pages/OrdersPage.tsx'), 'utf8');
const statusHandler = readFileSync(path.join(projectRoot, 'src/features/orders/services/updateOrderStatusHandler.ts'), 'utf8');
const ordersShell = readFileSync(path.join(projectRoot, 'src/features/orders/pages/subcomponents/OrdersPageShell.tsx'), 'utf8');
const ordersDialogs = readFileSync(path.join(projectRoot, 'src/features/orders/pages/subcomponents/OrdersPageDialogs.tsx'), 'utf8');
const ordersTable = readFileSync(path.join(projectRoot, 'src/features/orders/components/OrdersTable.tsx'), 'utf8');
const shipmentsTable = readFileSync(path.join(projectRoot, 'src/features/orders/components/ShipmentsTable.tsx'), 'utf8');
const historyModal = readFileSync(path.join(projectRoot, 'src/components/orders/OrderHistoryModal.tsx'), 'utf8');

describe('orders history UI wiring', () => {
  it('provides a history action for both orders and shipments', () => {
    expect(ordersPage).toContain('const handleOpenOrderHistory');
    expect(ordersPage).toContain('const handleOpenShipmentHistory');
    expect(ordersShell).toContain('onOpenOrderHistory={handleOpenOrderHistory}');
    expect(ordersShell).toContain('onOpenHistory={handleOpenShipmentHistory}');
    expect(ordersTable).toContain('onClick={() => onOpenOrderHistory(ord)}');
    expect(shipmentsTable).toContain('onClick={() => onOpenHistory(ship)}');
  });

  it('mounts the history modal with the active context and renders a clear event table with detailed snapshots', () => {
    expect(ordersDialogs).toContain('<OrderHistoryModal');
    expect(ordersDialogs).toContain('context={orderHistoryContext}');
    expect(historyModal).toContain('سجل الأحداث والتغييرات');
    expect(historyModal).toContain('تفاصيل التغييرات');
    expect(historyModal).toContain('كل صف يمثل حدثًا واحدًا');
    // الصفوف المسطّحة هي المصدر: changes بـ fieldName/oldValue/newValue و changedFields للحقول المعلنة.
    // The flat rows are the source: changes carry fieldName/oldValue/newValue, changedFields names the touched fields.
    expect(historyModal).toContain('historyEventChanges');
    expect(historyModal).toContain('change.fieldName');
    expect(historyModal).toContain('change.oldValue');
    expect(historyModal).toContain('change.newValue');
    expect(historyModal).toContain('القيمة السابقة');
    expect(historyModal).toContain('القيمة الجديدة');
    expect(historyModal).toContain('aria-label={isAr ? \'سجل الأحداث والتغييرات\'');
    // لقطات jsonb لم تعد تُقرأ في الواجهة بعد إسقاط before_data/after_data/metadata.
    // The UI no longer reads jsonb snapshots now that before_data/after_data/metadata are dropped.
    expect(historyModal).not.toContain('beforeData');
    expect(historyModal).not.toContain('afterData');
    expect(historyModal).not.toContain('event.metadata');
    expect(historyModal).toContain('historyChangesAsRecord');
    expect(historyModal).toContain('historyEventDetailFields');
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
    expect(statusHandler).toContain('orderHistoryService.listForContext');
    expect(statusHandler).toContain('getProcessedStatusIds(statusHistory)');
    expect(statusHandler).toContain('planOrderStatusTransition');
    expect(statusHandler).toContain('transitionPlan.stagesToProcess');
    expect(statusHandler).toContain('for (const stage of transitionPlan.stagesToProcess)');
    expect(statusHandler).toContain('purchaseSource');
    expect(statusHandler).toContain('shippingCompany');
  });
});
