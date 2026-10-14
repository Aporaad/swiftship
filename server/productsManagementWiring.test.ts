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

  it('delegates product and order-item CRUD to the API-backed service', () => {
    const productsTab = projectFile('src/components/orders/ProductsManagementTab.tsx');
    const productService = projectFile('src/services/productService.ts');

    expect(productsTab).toContain("from '../../services/productService'");
    expect(productsTab).toContain('await fetchProducts()');
    expect(productsTab).toContain('await fetchOrderItems()');
    expect(productsTab).toContain('await serviceCreateProduct(');
    expect(productsTab).toContain('await serviceUpdateProduct(');
    expect(productsTab).toContain('await serviceDeleteProduct(');
    expect(productsTab).toContain('await updateOrderItem(');
    expect(productsTab).toContain('await serviceDeleteOrderItem(');
    expect(productsTab).toContain('productCategoryFilter');
    expect(productsTab).toContain('productSortBy');
    expect(productsTab).toContain('product_name_ar');
    expect(productsTab).toContain('item_category_id');
    expect(productsTab).toContain('tracking_number');

    expect(productService).toContain("'/api/v1/products'");
    expect(productService).toContain("'/api/v1/operations/order-items'");
    expect(productService).not.toContain('console.warn');
    const operationsRoutes = projectFile('alx_api/src/modules/operations/operations.routes.ts');
    expect(operationsRoutes).toContain("app.get('/api/v1/products'");
    expect(operationsRoutes).toContain("app.delete('/api/v1/products/:id'");
    expect(operationsRoutes).toContain("app.get('/api/v1/operations/order-items'");
    expect(operationsRoutes).toContain("app.post('/api/v1/operations/order-items'");
    expect(operationsRoutes).toContain("app.patch('/api/v1/operations/order-items/:id'");
    expect(operationsRoutes).toContain("app.delete('/api/v1/operations/order-items/:id'");
    expect(productsTab).not.toContain('data/legacy/legacy-compat');
    expect(productService).not.toContain('data/legacy/legacy-compat');
  });
});
