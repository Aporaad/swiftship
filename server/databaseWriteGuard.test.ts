import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('database write failure guard', () => {
  it('raises database write failures for all core adapter operations before local cache mutation', () => {
    const adapter = projectFile('src/lib/supabase-adapter.ts');
    expect(adapter).toContain("export function createWriteError(operation: 'insert' | 'upsert' | 'update' | 'delete'");
    expect(adapter).toContain("throw createWriteError('insert', table, error);");
    expect(adapter).toContain("throw createWriteError('upsert', table, error);");
    expect(adapter).toContain("throw createWriteError('update', table, error);");
    expect(adapter).toContain("throw createWriteError('delete', table, error);");
  });

  it('places the primary order write before its products, shipments, history, and notifications', () => {
    const createOrderHandler = projectFile('src/features/orders/services/createOrderHandler.ts');
    const primaryWrite = createOrderHandler.indexOf('await createOrderRecord(payload.orderNumber, payload);');
    expect(primaryWrite).toBeGreaterThan(-1);
    expect(createOrderHandler.indexOf('حفظ المنتجات الرئيسية في products')).toBeGreaterThan(primaryWrite);
    expect(createOrderHandler.indexOf('حفظ شحنات الطلب في جدول الشحنات')).toBeGreaterThan(primaryWrite);
    expect(createOrderHandler.indexOf('activityLogService.log("add_order"')).toBeGreaterThan(primaryWrite);
    expect(createOrderHandler.indexOf('await notificationService.notify({', primaryWrite)).toBeGreaterThan(primaryWrite);
  });
});
