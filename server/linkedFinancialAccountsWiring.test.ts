import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('linked financial accounts wiring', () => {
  it('defines separate accounting sections and entity types for sources, carriers and assets', () => {
    const service = read('../src/services/financialAccountService.ts');
    const chart = read('../src/components/ChartOfAccounts.tsx');
    expect(service).toContain('source: "2140"');
    expect(service).toContain('shipping_company: "2150"');
    expect(service).toContain('asset: "1240"');
    expect(chart).toContain("code: '2140'");
    expect(chart).toContain("code: '2150'");
    expect(chart).toContain("code: '1240'");
    expect(chart).toContain("code: '1250'");
  });

  it('creates accounts from every source, carrier and asset entry path', () => {
    const sources = read('../src/pages/Sources.tsx');
    const orders = read('../src/pages/Orders.tsx');
    const assets = read('../src/components/AssetsPortfolio.tsx');
    expect(sources).toContain("ensureFinancialAccount('source'");
    expect(sources).toContain("ensureFinancialAccount('shipping_company'");
    expect(orders).toContain("'source',");
    expect(orders).toContain("'shipping_company',");
    expect(assets).toContain("'asset',");
    expect(assets).toContain('ASSET_ACCOUNTING');
  });

  it('creates foreign keys, indexes and database-side automatic linking', () => {
    const migration = read('../supabase/migrations/202608230200_link_sources_shipping_assets_financial_accounts.sql');
    expect(migration).toContain('sources_account_id_fkey');
    expect(migration).toContain('shipping_companies_account_id_fkey');
    expect(migration).toContain('assets_account_id_fkey');
    expect(migration).toContain('sources_link_financial_account_trigger');
    expect(migration).toContain('shipping_companies_link_financial_account_trigger');
    expect(migration).toContain('assets_link_financial_account_trigger');
    expect(migration).toContain("'2140', 'Liability'");
    expect(migration).toContain("'2150', 'Liability'");
    expect(migration).toContain("'Asset'");
  });
});
