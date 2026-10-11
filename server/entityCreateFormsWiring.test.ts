import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('shared entity create forms wiring', () => {
  it('uses the shared customer, source, and shipping-company modals in entity pages and order flow', () => {
    const sharedForms = projectFile('src/components/entities/EntityCreateModals.tsx');
    const orders = projectFile('src/features/orders/pages/subcomponents/OrdersPageDialogs.tsx');
    const customers = projectFile('src/features/customers/pages/CustomersPage.tsx');
    const sources = projectFile('src/features/sources/pages/SourcesPage.tsx');

    expect(sharedForms).toContain("export { CustomerCreateModal } from './CustomerCreateModal'");
    expect(sharedForms).toContain("export { SourceCreateModal } from './SourceCreateModal'");
    expect(sharedForms).toContain("export { ShippingCompanyCreateModal } from './ShippingCompanyCreateModal'");
    expect(projectFile('src/components/entities/CustomerCreateModal.tsx')).toContain('export function CustomerCreateModal');
    expect(projectFile('src/components/entities/SourceCreateModal.tsx')).toContain('export function SourceCreateModal');
    expect(projectFile('src/components/entities/ShippingCompanyCreateModal.tsx')).toContain('export function ShippingCompanyCreateModal');

    const customerModal = projectFile('src/components/entities/CustomerCreateModal.tsx');
    const sourceModal = projectFile('src/components/entities/SourceCreateModal.tsx');
    const shippingCompanyModal = projectFile('src/components/entities/ShippingCompanyCreateModal.tsx');

    expect(customerModal).toContain('customersApiDataGateway.createCustomer');
    expect(customerModal).toContain('portalUserService.createPortalUser');
    expect(sourceModal).toContain('sourcesApiDataGateway.createSource');
    expect(shippingCompanyModal).toContain('sourcesApiDataGateway.createShippingCompany');
    for (const modal of [customerModal, sourceModal, shippingCompanyModal]) {
      expect(modal).not.toContain('data/legacy/legacy-compat');
    }

    expect(orders).toContain('<CustomerCreateModal');
    expect(orders).toContain('<SourceCreateModal');
    expect(orders).toContain('<ShippingCompanyCreateModal');
    expect(customers).toContain('<CustomerCreateModal');
    expect(sources).toContain('<SourceCreateModal');
    expect(sources).toContain('<ShippingCompanyCreateModal');
  });
});
