import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('database write failure guard', () => {
  it('raises database write failures for all core adapter operations before local cache mutation', () => {
    const adapter = projectFile('src/lib/supabase-firebase-adapter.ts');
    expect(adapter).toContain("export function createWriteError(operation: 'insert' | 'upsert' | 'update' | 'delete'");
    expect(adapter).toContain("throw createWriteError('insert', table, error);");
    expect(adapter).toContain("throw createWriteError('upsert', table, error);");
    expect(adapter).toContain("throw createWriteError('update', table, error);");
    expect(adapter).toContain("throw createWriteError('delete', table, error);");
  });

  it('places the primary order write before its products, shipments, history, and notifications', () => {
    const orders = projectFile('src/pages/Orders.tsx');
    const primaryWrite = orders.indexOf("await addDoc(payload.orderNumber, collection(db, 'orders'), payload);");
    expect(primaryWrite).toBeGreaterThan(-1);
    expect(orders.indexOf('// Save products to products table')).toBeGreaterThan(primaryWrite);
    expect(orders.indexOf('// Save shipments to shipments table')).toBeGreaterThan(primaryWrite);
    expect(orders.indexOf("activityLogService.log('add_order'")).toBeGreaterThan(primaryWrite);
    expect(orders.indexOf('await notificationService.notify({')).toBeGreaterThan(primaryWrite);
  });
});
