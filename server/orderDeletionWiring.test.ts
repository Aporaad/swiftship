import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

describe('حذف الطلبات الذري', () => {
  it('ينظف التبعيات ويمنع إنشاء سجل orders_history بعد حذف الأب مع إبقاء activity_logs', () => {
    const migration = read('supabase/migrations/202608270090_add_atomic_order_deletion.sql');
    const shipmentTriggerMigration = read('supabase/migrations/202608270091_fix_atomic_order_shipment_history_trigger.sql');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.delete_orders_with_dependents');
    expect(migration).toContain('DELETE FROM public.account_transactions');
    expect(migration).toContain('DELETE FROM public.journal_entries');
    expect(migration).toContain('DELETE FROM public.shipments');
    expect(migration).toContain('DELETE FROM public.products');
    expect(migration).toContain('DELETE FROM public.orders_history');
    expect(migration).toContain('DELETE FROM public.orders WHERE id = ANY(target_ids)');
    expect(migration).toContain("IF TG_OP = 'DELETE' THEN");
    expect(migration).toContain('activityLogsDeleted');
    expect(migration).not.toContain('DELETE FROM public.activity_logs');
    expect(shipmentTriggerMigration).toContain('CREATE OR REPLACE FUNCTION public.orders_history_from_shipments()');
    expect(shipmentTriggerMigration).toContain("IF TG_OP = 'DELETE' THEN");
    expect(shipmentTriggerMigration).toContain('RETURN OLD;');
  });

  it('يستدعي الإجراء الذري من واجهة الخدمة ولا يعتمد حذف جدول orders مباشرةً', () => {
    const service = read('src/services/orderDeletionService.ts');
    const ordersPage = read('src/pages/Orders.tsx');
    const modal = read('src/components/orders/DeleteOrderModal.tsx');
    expect(service).toContain("supabase.rpc('delete_orders_with_dependents'");
    expect(service).toContain('normalizeOrderIds');
    expect(service).toContain('activityLogsDeleted');
    expect(ordersPage).toContain('handleOpenBatchDelete');
    expect(ordersPage).toContain('ordersPendingDelete');
    expect(ordersPage).toContain('deleteOrdersWithDependents');
    expect(ordersPage).toContain('orderCount={ordersPendingDelete.length || 1}');
    expect(modal).toContain('orderCount?: number');
    expect(modal).toContain('activity_logs will be preserved');
  });
});
