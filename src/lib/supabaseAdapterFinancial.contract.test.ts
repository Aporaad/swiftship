import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractDirectColumns,
  sanitizeDataPayload,
  usesExplicitFinancialColumns,
} from './supabase-adapter';

describe('عقد محول Supabase للجداول المالية الصريحة', () => {
  const adapterSource = readFileSync(resolve(process.cwd(), 'src', 'lib', 'supabase-adapter.ts'), 'utf8');
  const columnsSource = readFileSync(resolve(process.cwd(), 'src', 'lib', 'supabase-adapter-columns.ts'), 'utf8');

  it('يحافظ على مخطط الجداول المالية الصريحة والخرائط المباشرة', () => {
    for (const table of ['entry_module', 'entry_type', 'main_entry', 'account_trans', 'custody_advances']) {
      expect(columnsSource).toContain(`${table}: {`);
      expect(usesExplicitFinancialColumns(table)).toBe(true);
    }
    expect(columnsSource).toContain("conversionRate: 'conversion_rate'");
    expect(usesExplicitFinancialColumns('orders')).toBe(false);
    expect(extractDirectColumns('main_entry', {
      entryNumber: 'JV-123',
      amountOriginal: 125,
      currencyOriginalNo: 2,
      notes: 'migration contract',
    })).toEqual({
      entry_number: 'JV-123',
      amount_original: 125,
      currency_original_no: 2,
      notes: 'migration contract',
    });
  });

  it('يفصل الحقول ذات الأعمدة المباشرة عن data ويحافظ على المفاتيح غير المعيّنة', () => {
    expect(sanitizeDataPayload('main_entry', {
      entryNumber: 'JV-123',
      amountOriginal: 125,
      description: 'direct column',
      customMemo: 'retained in payload',
    })).toEqual({ customMemo: 'retained in payload' });
  });

  it('يبقي مسار الكتابة في الواجهة العامة مشروطًا بمخطط الجدول الصريح', () => {
    expect(adapterSource).toContain(
      'usesExplicitFinancialColumns(table) ? { [pkCol]: id, ...directCols } : { [pkCol]: id, ...directCols, data }',
    );
  });
});
