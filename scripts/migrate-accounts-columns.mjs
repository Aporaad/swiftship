/**
 * Migration Script: Fix accounts table columns
 * ترحيل: تصحيح أعمدة جدول الحسابات
 *
 * - يحذف الأعمدة غير المطلوبة: parent_code, debit_total, credit_total, monthly_salary
 * - يرحّل البيانات من حقل data إلى الأعمدة الأصلية الجديدة
 * - يحذف حقل data نهائياً
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// تحميل المتغيرات البيئية
// Load environment variables
let SUPABASE_URL, SUPABASE_KEY;
try {
  const envPath = join(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [k, ...rest] = trimmed.split('=');
    const v = rest.join('=').replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    if (k.trim() === 'VITE_SUPABASE_URL') SUPABASE_URL = v.trim();
    if (k.trim() === 'VITE_SUPABASE_ANON_KEY') SUPABASE_KEY = v.trim();
  }
} catch (e) {
  console.error('فشل تحميل .env:', e.message);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function execSQL(sql, description) {
  console.log(`\n⏳ ${description}...`);
  const { data, error } = await supabase.rpc('execute_migration_sql', { sql_text: sql }).maybeSingle();
  if (error) {
    // حاول طريقة أخرى
    console.log(`  ⚠️  rpc failed: ${error.message}`);
    return { error };
  }
  console.log(`  ✅ نجح`);
  return { data };
}

async function main() {
  console.log('='.repeat(60));
  console.log('بدء ترحيل جدول accounts');
  console.log('Starting accounts table migration');
  console.log('='.repeat(60));

  // --- الخطوة 1: التحقق من الأعمدة الحالية ---
  console.log('\n📋 الخطوة 1: التحقق من الأعمدة الحالية...');
  const { data: cols, error: colsErr } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', 'accounts')
    .eq('table_schema', 'public');
  
  if (colsErr) {
    console.log('  لا يمكن استعلام information_schema مباشرة - سنتابع');
  } else {
    console.log('  الأعمدة الموجودة:', cols?.map(c => c.column_name).join(', '));
  }

  // استخدام الـ raw query عبر Supabase REST API
  const queries = [
    // ============================================================
    // 1. حذف الأعمدة غير المطلوبة التي أضيفت في migration سابق
    // Drop unwanted columns added in previous migration
    // ============================================================
    {
      q: `ALTER TABLE accounts DROP COLUMN IF EXISTS parent_code`,
      desc: 'حذف عمود parent_code'
    },
    {
      q: `ALTER TABLE accounts DROP COLUMN IF EXISTS debit_total`,
      desc: 'حذف عمود debit_total'
    },
    {
      q: `ALTER TABLE accounts DROP COLUMN IF EXISTS credit_total`,
      desc: 'حذف عمود credit_total'
    },
    {
      q: `ALTER TABLE accounts DROP COLUMN IF EXISTS monthly_salary`,
      desc: 'حذف عمود monthly_salary'
    },
    // ============================================================
    // 2. ترحيل البيانات من data إلى الأعمدة الأصلية الجديدة
    // Migrate data from JSONB to native columns
    // ============================================================
    {
      q: `UPDATE accounts SET
  account_number = COALESCE(account_number, data->>'accountNumber', LPAD(account_seq::text, 4, '0')),
  account_prefix = COALESCE(
    account_prefix,
    data->>'accountPrefix',
    CASE WHEN account_code LIKE '%-%' THEN SPLIT_PART(account_code, '-', 1) ELSE NULL END
  ),
  entity_name = COALESCE(entity_name, data->>'entityName', data->>'accNameAr', acc_name_ar),
  notes = COALESCE(notes, data->>'notes'),
  acc_name_ar = COALESCE(acc_name_ar, data->>'accNameAr', data->>'entityName'),
  acc_name_en = COALESCE(acc_name_en, data->>'accNameEn', data->>'entityName')
WHERE data IS NOT NULL`,
      desc: 'ترحيل البيانات من data إلى الأعمدة الأصلية'
    },
    // ============================================================
    // 3. حذف حقل data نهائياً
    // Drop data column permanently
    // ============================================================
    {
      q: `ALTER TABLE accounts DROP COLUMN IF EXISTS data`,
      desc: 'حذف عمود data نهائياً'
    }
  ];

  let allSuccess = true;

  for (const { q, desc } of queries) {
    const result = await execSQL(q, desc);
    if (result.error) {
      console.error(`  ❌ فشل: ${result.error.message}`);
      allSuccess = false;
    }
  }

  // --- التحقق النهائي ---
  console.log('\n📋 التحقق النهائي: فحص الأعمدة بعد الترحيل...');
  const { data: finalCols } = await supabase.rpc('execute_migration_sql', {
    sql_text: `SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND table_schema='public' ORDER BY ordinal_position`
  }).maybeSingle();

  if (allSuccess) {
    console.log('\n✅ اكتمل الترحيل بنجاح!');
  } else {
    console.log('\n⚠️  اكتمل الترحيل مع بعض الأخطاء - راجع الرسائل أعلاه');
  }
}

main().catch(console.error);
