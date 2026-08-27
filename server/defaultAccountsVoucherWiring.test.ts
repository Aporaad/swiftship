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

  it('يحل الحسابات النظامية من default_accounts ولا يسمح بفallback إن كانت الشجرة جاهزة', () => {
    const service = read('src/services/financialAccountService.ts');
    expect(service).toContain('const configuredDefault = await accountingHierarchyService.getDefaultAccount(acc.id)');
    expect(service).toContain('الحساب الافتراضي «${acc.id}» غير مربوط أو معطّل في جدول default_accounts');
    expect(service).toContain('defaultKey: account.defaultKey || account.id');
  });

  it('يعرض ويحرر قواعد auto_entries باستخدام الحسابات الافتراضية والأطراف الديناميكية الموسعة', () => {
    const component = read('src/components/AutoVoucherRulesManager.tsx');
    const hook = read('src/hooks/useAutoVoucherRules.ts');
    expect(component).toContain("collection(db, 'default_accounts')");
    expect(component).toContain("doc(db, 'auto_entries', ruleId)");
    expect(component).toContain('shipping_company_linked');
    expect(component).toContain('product_cost_source');
    expect(hook).toContain("collection(db, 'auto_entries')");
    expect(hook).not.toContain("'settings', 'automatic_voucher_rules'");
  });
});
