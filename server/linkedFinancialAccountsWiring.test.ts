import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('linked financial accounts wiring', () => {
  it('defines separate accounting sections and entity types for sources, carriers and assets', () => {
    const accountTypes = read('../src/services/financialAccountTypes.ts');
    const chart = read('../src/components/ChartOfAccounts.tsx');
    expect(accountTypes).toContain('source: "2140"');
    expect(accountTypes).toContain('shipping_company: "2150"');
    expect(accountTypes).toContain('asset: "1240"');
    expect(chart).toContain("code: '2140'");
    expect(chart).toContain("code: '2150'");
    expect(chart).toContain("code: '1240'");
    expect(chart).toContain("code: '1250'");
    // دليل الحسابات يعمل على API فقط — the chart reads/writes through alx_api, never the legacy client.
    expect(chart).not.toContain('legacy-compat');
    expect(chart).not.toContain('onSnapshot(');
    expect(chart).toContain("from '../services/financialAccountAdmin'");
    expect(chart).toContain('listAccountMovements(');
  });

  it('creates accounts from every source, carrier and asset entry path', () => {
    const sources = read('../src/features/sources/pages/SourcesPage.tsx');
    const orders = read('../src/features/orders/services/orderEntityHandlers.ts');
    const assets = read('../src/components/AssetsPortfolio.tsx');
    const assetsService = read('../src/services/financeAssetsService.ts');
    expect(sources).toContain("ensureFinancialAccount('source'");
    expect(sources).toContain("ensureFinancialAccount('shipping_company'");
    expect(orders).toContain('"source"');
    expect(orders).toContain('"shipping_company"');
    expect(assets).toContain('financeAssetsService.register(');
    expect(assets).toContain('ASSET_ACCOUNTING');
    expect(assets).not.toContain('legacy-compat');
    // إنشاء حساب الأصل انتقل من المكوّن إلى الخدمة — asset account creation now lives in the service layer.
    expect(assetsService).toContain("'asset',");
    expect(assetsService).toContain('createAccountForEntity(');
    expect(assetsService).toContain("accountType: 'Asset'");
    expect(assetsService).toContain("'/api/v1/finance/assets'");
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
