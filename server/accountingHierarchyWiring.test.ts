import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

describe('عقد إعادة هيكلة شجرة الحسابات', () => {
  it('يحتوي ترحيل الهيكل على جميع طبقات الشجرة والعملة المرجعية وحد الحساب', () => {
    const migration = read('supabase/migrations/202608270030_create_accounting_hierarchy_schema.sql');
    const directBalanceMigration = read('supabase/migrations/202608270045_add_accounts_balance_column.sql');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.account');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.acc_main');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.acc_sub');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.acc_sub_group');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.default_accounts');
    expect(migration).toContain('cur_no integer REFERENCES public.currency(cur_id)');
    expect(migration).toContain('limited_balance numeric NOT NULL DEFAULT 0');
    expect(directBalanceMigration).toContain('ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0');
  });

  it('يدعم ربط المجموعات القابل للإدارة بطبيعة الكيان وطبيعة الحساب الرئيسية', () => {
    const bindings = read('supabase/migrations/202608270035_add_account_group_entity_bindings.sql');
    const nature = read('supabase/migrations/202608270040_add_accounting_nature.sql');
    expect(bindings).toContain('entity_type text');
    expect(bindings).toContain('acc_sub_group_entity_type_unique_idx');
    expect(nature).toContain('account_type text');
    expect(nature).toContain("'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'");
  });

  it('يستخدم معرّف الحساب المالي كوده ويحل الحسابات الافتراضية من قاعدة البيانات', () => {
    const service = read('src/services/financialAccountService.ts');
    expect(service).toContain('const candidateId = candidateCode;');
    expect(service).toContain('accountingHierarchyService.getDefaultAccount(acc.id)');
    expect(service).toContain('limitedBalance');
    expect(service).toContain('hasHierarchyStructure()');
    expect(service).toContain('const newId = `salary_${params.employeeId}_');
  });

  it('يعرض إدارة الشجرة والحسابات الافتراضية ويمنع اختيار العقد التنظيمية', () => {
    const component = read('src/components/AccountingHierarchyManagement.tsx');
    const accountingPage = read('src/components/FinanceAccounting.tsx');
    expect(component).toContain("setActiveTab('defaults')");
    expect(component).toContain("['default_accounts', setDefaultAccounts]");
    expect(component).toContain('filterPostingAccounts(accounts, true)');
    expect(component).toContain('onSnapshot(collection(db, table)');
    expect(component).toContain("dataLoadState === 'ready'");
    expect(component).toContain('rootsForSelectedNature');
    expect(component).toContain('availableMains');
    expect(component).toContain('availableSubs');
    expect(component).toContain('defaultAccountOptions');
    expect(component).toContain('const expandAll');
    expect(component).toContain('const collapseAll');
    expect(component).toContain('const openStatement');
    expect(component).toContain('statementAccount');
    expect(component).toContain('كشف حساب مالي');
    expect(component).toContain('const compareByAccountingCode');
    expect(component).toContain('const codeBadge');
    expect(component).toContain("sort(compareByAccountingCode)");
    expect(component).toContain('اختيار أقسام الطباعة');
    expect(component).toContain('printSections');
    expect(component).toContain('printableRows');
    expect(component).toContain('الرصيد الأصلي');
    expect(component).toContain('حساب جديد');
    expect(component).toContain('isUnifiedAccountCreate');
    expect(component).toContain('switchUnifiedAccountKind');
    expect(accountingPage).toContain('AccountingHierarchyManagement');
    expect(accountingPage).toContain('filterPostingAccounts(financialAccounts)');
    expect(accountingPage).toContain('postingFinancialAccounts.filter');
  });

  it('يحافظ على خريطة تدقيق للمعرفات ويضع ضمانات الترحيل والعملة داخل قاعدة البيانات', () => {
    const rekeyMigration = read('supabase/migrations/202608270070_rekey_accounts_to_account_codes.sql');
    const guardMigration = read('supabase/migrations/202608270075_enforce_accounting_posting_guards.sql');
    const adapter = read('src/lib/supabase-firebase-adapter.ts');
    expect(rekeyMigration).toContain('CREATE TABLE IF NOT EXISTS public.account_id_migration_map');
    expect(rekeyMigration).toContain("id !~ '^\\d{4}-\\d{4}$' OR id <> account_code");
    expect(rekeyMigration).toContain('ON UPDATE CASCADE');
    expect(guardMigration).toContain('enforce_account_transaction_posting_rules');
    expect(guardMigration).toContain('sync_account_balance_after_transaction');
    expect(guardMigration).toContain('accounting_to_system_currency');
    expect(guardMigration).toContain('limited_balance');
    expect(adapter).toContain("balance: 'balance'");
    expect(adapter).toContain("account_id_migration_map");
    expect(adapter).toContain('const collectionCaches');
    expect(adapter).toContain('async function ensureCache(table: string)');
  });

  it('يعيد ملء بيانات الحسابات القديمة من الشجرة دون تغيير معرّفات الحسابات أو سياسات RLS', () => {
    const repairMigration = read('supabase/migrations/202608270080_repair_account_hierarchy_metadata.sql');
    expect(repairMigration).toContain('BEGIN;');
    expect(repairMigration).toContain('acc_sub_id = resolved.resolved_acc_sub_id');
    expect(repairMigration).toContain('group_id = resolved.resolved_group_id');
    expect(repairMigration).toContain('account_seq = resolved.resolved_sequence');
    expect(repairMigration).toContain('cur_no = resolved.resolved_cur_no');
    expect(repairMigration).toContain("'accountCode', target.account_code");
    expect(repairMigration).not.toContain('SET id =');
    expect(repairMigration).not.toContain('ROW LEVEL SECURITY');
    expect(repairMigration).toContain('COMMIT;');
  });
});
