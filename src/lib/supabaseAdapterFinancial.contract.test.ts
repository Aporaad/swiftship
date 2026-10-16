import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractDirectColumns,
  sanitizeDataPayload,
} from './supabase-adapter';

describe('عقد محول Supabase للجداول المالية الصريحة', () => {
  const adapterSource = readFileSync(resolve(process.cwd(), 'src', 'lib', 'supabase-adapter.ts'), 'utf8');
  const columnsSource = readFileSync(resolve(process.cwd(), 'src', 'lib', 'supabase-adapter-columns.ts'), 'utf8');

  it('يحافظ على مخطط الجداول المالية الصريحة والخرائط المباشرة', () => {
    for (const table of ['entry_module', 'entry_type', 'main_entry', 'account_trans', 'custody_advances']) {
      expect(columnsSource).toContain(`${table}: {`);
    }
    expect(columnsSource).toContain("conversionRate: 'conversion_rate'");
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

  it('يفصل الحقول ذات الأعمدة المباشرة عن بقية المفاتيح', () => {
    expect(sanitizeDataPayload('main_entry', {
      entryNumber: 'JV-123',
      amountOriginal: 125,
      description: 'direct column',
      customMemo: 'retained in payload',
    })).toEqual({ customMemo: 'retained in payload' });
  });

  // لا عمود payload في قاعدة البيانات: مسار الكتابة يرسل الأعمدة الرئيسية وحدها.
  // No payload column exists in the database: every write path sends first-class columns only.
  it('يمنع كتابة أي عمود حمولة في أي مسار من مسارات الحفظ', () => {
    for (const dropped of ['before_data', 'after_data', 'metadata', 'permissions', 'associated_user_ids', 'exchange_rates']) {
      expect(columnsSource).not.toContain(`: '${dropped}'`);
    }
    expect(adapterSource).not.toMatch(/\.(insert|upsert|update)\([^)]*\bdata\b/);
  });
});
