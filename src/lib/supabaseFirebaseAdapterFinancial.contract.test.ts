import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('عقد محول Supabase للجداول المالية الصريحة', () => {
  const source = readFileSync(resolve(process.cwd(), 'src', 'lib', 'supabase-firebase-adapter.ts'), 'utf8');

  it('يعرف الجداول المالية الجديدة وخرائط أعمدتها المباشرة', () => {
    for (const table of ['entry_module', 'entry_type', 'main_entry', 'account_trans', 'custody_advances']) {
      expect(source).toContain(`${table}: {`);
      expect(source).toContain(`'${table}'`);
    }
    expect(source).toContain("conversionRate: 'conversion_rate'");
    expect(source).toContain('usesExplicitFinancialColumns');
  });

  it('يفصل حمولة الكتابة المالية عن data في الإضافة والحفظ والتعديل', () => {
    expect(source).toContain('usesExplicitFinancialColumns(table) ? { id, ...directCols } : { id, ...directCols, data }');
    expect(source).toContain('usesExplicitFinancialColumns(table) ? directCols : { ...directCols, data }');
  });
});
