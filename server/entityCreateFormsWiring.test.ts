import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('shared entity create forms wiring', () => {
  it('uses the same customer, source, and shipping company create modals from the entity pages and the order flow', () => {
    const sharedForms = projectFile('src/components/entities/EntityCreateModals.tsx');
    const orders = projectFile('src/pages/Orders.tsx');
    const customers = projectFile('src/pages/Customers.tsx');
    const sources = projectFile('src/pages/Sources.tsx');

    expect(sharedForms).toContain('export function CustomerCreateModal');
    expect(sharedForms).toContain('export function SourceCreateModal');
    expect(sharedForms).toContain('export function ShippingCompanyCreateModal');
    expect(sharedForms).toContain("getNextAccountIdentifiers('customer')");
    expect(sharedForms).toContain("accountPrefix: '2140'");
    expect(sharedForms).toContain("accountPrefix: '2150'");

    expect(orders).toContain('<CustomerCreateModal');
    expect(orders).toContain('<SourceCreateModal');
    expect(orders).toContain('<ShippingCompanyCreateModal');
    expect(customers).toContain('<CustomerCreateModal');
    expect(sources).toContain('<SourceCreateModal');
    expect(sources).toContain('<ShippingCompanyCreateModal');
  });
});
