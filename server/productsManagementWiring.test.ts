import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('products management tab wiring', () => {
  it('registers a dedicated products tab in the orders interface', () => {
    const orders = projectFile('src/pages/Orders.tsx');
    expect(orders).toContain("import ProductsManagementTab from '../components/orders/ProductsManagementTab'");
    expect(orders).toContain("setOrdersTab('products')");
    expect(orders).toContain('<ProductsManagementTab isAr={isAr} canManage={canManageOrders} orderCurrency={orderCurrency} />');
    expect(orders).toContain("tab === 'products'");
  });

  it('provides products CRUD, search, category filtering, and sorting through the products table', () => {
    const productsTab = projectFile('src/components/orders/ProductsManagementTab.tsx');
    expect(productsTab).toContain("collection(db, 'products')");
    expect(productsTab).toContain("addDoc(id, collection(db, 'products')");
    expect(productsTab).toContain("updateDoc(doc(db, 'products', editing.id)");
    expect(productsTab).toContain("deleteDoc(doc(db, 'products', deleting.id))");
    expect(productsTab).toContain('categoryFilter');
    expect(productsTab).toContain('sortBy');
    expect(productsTab).toContain('productName');
    expect(productsTab).toContain('itemCategoryId');
    expect(productsTab).toContain('trackingNumber');
  });
});
