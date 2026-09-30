import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('products management tab wiring', () => {
  it('registers a dedicated products tab in the orders interface', () => {
    const ordersShell = projectFile('src/features/orders/pages/subcomponents/OrdersPageShell.tsx');
    expect(ordersShell).toContain("import ProductsManagementTab from '../../../../components/orders/ProductsManagementTab'");
    expect(ordersShell).toContain('<ProductsManagementTab');
    expect(ordersShell).toContain('canManage={canManageOrders}');
    expect(ordersShell).toContain("ordersTab === 'products'");
  });

  it('provides products CRUD, search, category filtering, and sorting through the products table', () => {
    const productsTab = projectFile('src/components/orders/ProductsManagementTab.tsx');
    expect(productsTab).toContain("collection(db, 'products')");
    expect(productsTab).toContain("addDoc(newId, collection(db, 'products')");
    expect(productsTab).toContain("updateDoc(doc(db, 'products', editingProduct.product_id)");
    expect(productsTab).toContain("deleteDoc(doc(db, 'products', p.product_id))");
    expect(productsTab).toContain('productCategoryFilter');
    expect(productsTab).toContain('productSortBy');
    expect(productsTab).toContain('product_name_ar');
    expect(productsTab).toContain('item_category_id');
    expect(productsTab).toContain('tracking_number');
  });
});
