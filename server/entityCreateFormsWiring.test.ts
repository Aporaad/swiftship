import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('shared entity create forms wiring', () => {
  it('uses the same customer, source, and shipping company create modals from the entity pages and the order flow', () => {
    const sharedForms = projectFile('src/components/entities/EntityCreateModals.tsx');
    const orders = projectFile('src/features/orders/pages/OrdersPage.tsx');
    const customers = projectFile('src/features/customers/pages/CustomersPage.tsx');
    const sources = projectFile('src/features/sources/pages/SourcesPage.tsx');

    expect(sharedForms).toContain('export { CustomerCreateModal }');
    expect(projectFile('src/components/entities/CustomerCreateModal.tsx')).toContain('export function CustomerCreateModal');
    expect(sharedForms).toContain('export { SourceCreateModal }');
    expect(projectFile('src/components/entities/SourceCreateModal.tsx')).toContain('export function SourceCreateModal');
    expect(sharedForms).toContain('export { ShippingCompanyCreateModal }');
    expect(projectFile('src/components/entities/ShippingCompanyCreateModal.tsx')).toContain('export function ShippingCompanyCreateModal');
    expect(projectFile('src/components/entities/CustomerCreateModal.tsx')).toContain("getNextAccountIdentifiers('customer')");
    expect(projectFile('src/components/entities/SourceCreateModal.tsx')).toContain("accountPrefix: '2140'");
    expect(projectFile('src/components/entities/ShippingCompanyCreateModal.tsx')).toContain("accountPrefix: '2150'");

    expect(orders).toContain('<CustomerCreateModal');
    expect(orders).toContain('<SourceCreateModal');
    expect(orders).toContain('<ShippingCompanyCreateModal');
    expect(customers).toContain('<CustomerCreateModal');
    expect(sources).toContain('<SourceCreateModal');
    expect(sources).toContain('<ShippingCompanyCreateModal');
  });
});
