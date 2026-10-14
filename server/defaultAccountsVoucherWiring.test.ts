import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

describe('ربط الحسابات الافتراضية بالقيود التلقائية', () => {
  it('يعرّف ترحيلًا يربط المفاتيح النظامية بحسابات قائمة من دون إنشاء حسابات مالية', () => {
    const migration = read('supabase/migrations/202608270060_bind_default_accounts.sql');
    expect(migration).toContain('INSERT INTO public.default_accounts');
    expect(migration).toContain('INNER JOIN public.accounts ON accounts.entity_id = defaults.default_key');
    expect(migration).toContain('sys_cash_account');
    expect(migration).toContain('sys_shipping_costs');
  });

  it('يحل الحسابات النظامية من default_accounts ولا يسمح بفfallback إن كانت الشجرة جاهزة', () => {
    const service = read('src/services/financialAccountService.ts');
    const rules = read('src/services/financialAccountVoucherRules.ts');
    expect(service).toContain('const configuredDefault = await accountingHierarchyService.getDefaultAccount(acc.id)');
    expect(service).toContain('الحساب الافتراضي «${acc.id}» غير مربوط أو معطّل في جدول default_accounts');
    expect(rules).toContain('defaultKey: account.defaultKey || account.id');
  });

  it('يعرض ويحرر قواعد auto_entries باستخدام الحسابات الافتراضية والأطراف الديناميكية الموسعة', () => {
    const component = read('src/components/AutoVoucherRulesManager.tsx');
    const hook = read('src/hooks/useAutoVoucherRules.ts');
    const hierarchy = read('src/services/accountingHierarchyService.ts');
    // المكوّن والخطاف API-only: الحسابات الافتراضية والقواعد تُقرأ وتُكتب عبر alx_api وحده.
    expect(component).toContain('accountingHierarchyService');
    expect(component).toContain('.listDefaultAccounts()');
    expect(component).toContain('autoEntryService.saveAutoEntry(');
    expect(component).not.toContain('legacy-compat');
    expect(component).not.toContain('onSnapshot(');
    expect(component).not.toContain("collection(db, 'default_accounts')");
    expect(component).not.toContain("doc(db, 'auto_entries'");
    expect(component).toContain('shipping_company_linked');
    expect(component).toContain('product_cost_source');
    // الخطاف يفوّض القراءة للخدمة (خريطة واحدة للصفوف) ولا يلمس مجموعات Supabase القديمة.
    // The hook delegates reads to the service so the row mapping lives in one place.
    expect(hook).toContain('autoEntryService.loadRules()');
    expect(hook).toContain('autoEntryService.ensureAutoEntries()');
    expect(hook).not.toContain('collection(db');
    expect(hook).not.toContain('legacy-compat');
    expect(hook).not.toContain("'settings', 'automatic_voucher_rules'");
    // الحسابات الافتراضية نفسها تُقرأ من مسار alx_api داخل الخدمة.
    expect(hierarchy).toContain("'/api/v1/finance/default-accounts'");
    expect(hierarchy).toContain('async listDefaultAccounts()');
  });
});
