import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('items categories wiring', () => {
  it('defines the categories table, category relationships and shipment fee fields', () => {
    const migration = read('../supabase/migrations/202608230130_create_items_category_and_shipment_fees.sql');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.items_category');
    expect(migration).toContain('products_item_category_id_fkey');
    expect(migration).toContain('shipments_content_category_id_fkey');
    expect(migration).toContain('customs_per_carton');
    expect(migration).toContain('tax_per_carton');
    expect(migration).toContain('category_fees_total');
    expect((migration.match(/\('cat_/g) || [])).toHaveLength(18);
  });

  it('mounts the independent categories tab and passes categories to product and shipment forms', () => {
    const orders = read('../src/pages/Orders.tsx');
    const create = read('../src/components/orders/CreateOrderModal.tsx');
    const edit = read('../src/components/orders/EditOrderModal.tsx');
    const shipment = read('../src/components/shipments/ShipmentFormModal.tsx');
    expect(orders).toContain("'item-categories'");
    expect(orders).toContain('<ItemCategoriesManagementTab');
    expect(orders).toContain('itemCategories={activeItemCategories}');
    expect(create).toContain('itemCategoryId');
    expect(edit).toContain('itemCategoryId');
    expect(create).toContain('ShipmentFeeCell');
    expect(create).toContain('Shipment content category');
    expect(edit).toContain('FeeSummary');
    expect(edit).toContain('Shipment content category');
    expect(shipment).toContain('shipment-content-category-fees');
    expect(shipment).toContain('calculateShipmentCategoryFees');
  });
});
