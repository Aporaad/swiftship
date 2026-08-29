import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = (name: string) => readFileSync(
  resolve(process.cwd(), 'supabase', 'migrations', name),
  'utf8',
);

describe('عقود ترحيلات القيود المالية الجديدة', () => {
  it('ينشئ النموذج المالي الصريح بلا أعمدة data ويستخدم مرجع سعر الصرف المركب', () => {
    const sql = migration('202608270100_create_financial_entry_core.sql');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.main_entry');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.account_trans');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.custody_advances');
    expect(sql).not.toMatch(/\bdata\s+(json|jsonb)/i);
    expect(sql).toContain('FOREIGN KEY (currency_price_id, currency_price_seq)');
    expect(sql).toContain('REFERENCES public.cur_price(id, seq)');
    expect(sql).toContain("entry_category IN ('General', 'Compound', 'Temp', 'Reversing')");
  });

  it('يسند عملة الحسابات من رمز صريح وحيد فقط ولا يمس الأرصدة أو RLS', () => {
    const sql = migration('202608270101_backfill_postable_account_currency_refs.sql');

    expect(sql).toContain('resolved_currency.currency_matches <> 1');
    expect(sql).toContain('SET cur_no = c.cur_id');
    expect(sql).toContain('a.acc_sub_id IS NOT NULL');
    expect(sql).not.toMatch(/\b(delete|truncate)\b/i);
    expect(sql).not.toMatch(/\b(balance|debit_total|credit_total)\s*=/i);
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('ينقل فقط القيود المتحققة ويعزل الاستثناءات ويبقي الجداول التاريخية والمصروفات', () => {
    const sql = migration('202608270102_migrate_verified_financial_history.sql');

    expect(sql).toContain('CREATE TEMP TABLE financial_legacy_qualified_entries');
    expect(sql).toContain('debit_original = credit_original');
    expect(sql).toContain('declared_amount_original = debit_original');
    expect(sql).toContain('cross_currency_count = matched_cross_currency_count');
    expect(sql).toContain("'UNPROVEN_FX_RATE'");
    expect(sql).toContain("'MISSING_LEGACY_HEADER'");
    expect(sql).toContain('financial_legacy_migration_map');
    expect(sql).toContain('financial_migration_exceptions');
    expect(sql).toContain('financial_legacy_qualified_custody');
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.(journal_entries|account_transactions|expenses)\b/i);
    expect(sql).not.toMatch(/\btruncate\s+(table\s+)?public\.(journal_entries|account_transactions|expenses)\b/i);
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يحرس الحذف المؤكد ويحذف فقط المصروفات وأسطر القيود القديمة المرتبطة بها', () => {
    const sql = migration('202608270103_delete_confirmed_expenses_and_linked_legacy_transactions.sql');

    expect(sql).toContain('expense_count <> 31 OR transaction_count <> 44');
    expect(sql).toContain("e.expense_number = NULLIF(btrim(at.data->>'refNumber'), '')");
    expect(sql).toContain('DELETE FROM public.account_transactions');
    expect(sql).toContain('DELETE FROM public.expenses');
    expect(sql).toContain('remaining_expenses <> 0 OR remaining_transactions <> 0');
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.(journal_entries|main_entry|account_trans|activity_logs)\b/i);
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يوفر إنشاء وترحيل القيود كعمليات ذرية مع توازن amount_original وحماية سعر الصرف', () => {
    const sql = migration('202608270104_add_financial_entry_atomic_rpcs.sql');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_financial_entry(p_entry jsonb)');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.post_financial_entry');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.validate_financial_entry_balance');
    expect(sql).toContain("SUM(amount_original) FILTER (WHERE trans_type = 'Debit')");
    expect(sql).toContain("SUM(amount_original) FILTER (WHERE trans_type = 'Credit')");
    expect(sql).toContain("entry_record.amount_original <> debit_total");
    expect(sql).toContain('كل ساق تختلف عملتها عن عملة الرأس تحتاج مرجع سعر صرف مثبت');
    expect(sql).toContain('main_entry_currency_price_pair_check');
    expect(sql).toContain('account_trans_currency_price_pair_check');
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يثبت عامل التحويل الصريح للسجلات المرحلة من دون اختراع سعر صرف', () => {
    const sql = migration('202608270105_add_account_trans_conversion_rate.sql');

    expect(sql).toContain('SET conversion_rate = round(amount / amount_original, 8)');
    expect(sql).toContain('account_trans_conversion_rate_positive');
    expect(sql).not.toMatch(/\b(insert|delete|truncate)\b/i);
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يشتق عامل التحويل من المبالغ ويمنع الساق متعددة العملات بلا سعر صرف موثق', () => {
    const sql = migration('202608270106_enforce_account_trans_conversion_rate.sql');

    expect(sql).toContain('NEW.conversion_rate := round(NEW.amount / NEW.amount_original, 8)');
    expect(sql).toContain('الساق متعددة العملات تحتاج مرجع سعر صرف موثق');
    expect(sql).toContain('trg_account_trans_derive_conversion_rate');
    expect(sql).not.toMatch(/\b(delete\s+from|truncate\s+(table\s+)?)\b/i);
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يدعم القيد المركب ومراجع أسعار الصرف لعملة الرأس أو الحساب في الإجراء الذري المحسن', () => {
    const sql = migration('202608270107_add_financial_entry_v2_rpc.sql');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_financial_entry_v2(p_entry jsonb)');
    expect(sql).toContain("cp.cur_no IN (v_currency_original_no, v_line_account_cur_no)");
    expect(sql).toContain('v_debit_total <> v_credit_total OR v_debit_total <> v_amount_original');
    expect(sql).toContain('القيد المركب يجب أن يحتوي على ثلاثة أسطر على الأقل');
    expect(sql).toContain('jsonb_array_elements_text(p_entry->\'attachments\')');
    expect(sql).not.toMatch(/\b(delete\s+from|truncate\s+(table\s+)?)\b/i);
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يحسب الرصيد من account_trans.amount للقيود المرحلة فقط ويستثني Temp', () => {
    const sql = migration('202608270108_switch_balances_to_account_trans.sql');

    expect(sql).toContain('FROM public.account_trans tx');
    expect(sql).toContain("entry.posting_status = 'posted'");
    expect(sql).toContain("entry.entry_category <> 'Temp'");
    expect(sql).toContain('validate_financial_entry_account_limits');
    expect(sql).toContain('trg_account_trans_after_balance_sync');
    expect(sql).toContain('trg_main_entry_after_posting_balance_sync');
    expect(sql).toContain('DROP TRIGGER IF EXISTS trg_account_transactions_after_posting');
    expect(sql).not.toMatch(/\b(delete\s+from|truncate\s+(table\s+)?)\b/i);
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يوحد الاسم الذري المبكر مع قواعد v2 المحسنة دون كتابة بيانات', () => {
    const sql = migration('202608270109_delegate_financial_entry_v1_to_v2.sql');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_financial_entry(p_entry jsonb)');
    expect(sql).toContain('RETURN public.create_financial_entry_v2(p_entry)');
    expect(sql).not.toMatch(/\b(insert\s+into|update\s+public|delete\s+from|truncate\s+(table\s+)?)\b/i);
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('ينشئ ويسوي العهدة مع قيد ذري ويمنع تجاوز المتبقي', () => {
    const sql = migration('202608270110_add_custody_advance_atomic_rpcs.sql');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_custody_advance');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.settle_custody_advance');
    expect(sql).toContain("v_entry_result := public.create_financial_entry_v2");
    expect(sql).toContain('مبلغ التسوية يتجاوز المتبقي من العهدة');
    expect(sql).toContain('trg_custody_advances_target');
    expect(sql).not.toMatch(/\b(delete\s+from|truncate\s+(table\s+)?)\b/i);
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يربط تحصيل دفعة الطلب بسند قبض وتحديث الطلب في معاملة واحدة', () => {
    const sql = migration('202608270111_add_order_payment_atomic_rpc.sql');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.record_order_payment_v2');
    expect(sql).toContain('SELECT * INTO order_record FROM public.orders WHERE id = p_order_id FOR UPDATE');
    expect(sql).toContain('v_entry_result := public.create_financial_entry_v2(p_entry)');
    expect(sql).toContain("SET data = v_order_data || jsonb_build_object(");
    expect(sql).toContain('مبلغ الدفعة يتجاوز المتبقي للطلب');
    expect(sql).not.toMatch(/\b(delete\s+from|truncate\s+(table\s+)?)\b/i);
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يعالج المسودة والعكس والإبطال عبر إجراءات ذرية منفصلة عن CRUD العادي', () => {
    const sql = migration('202608270112_add_financial_entry_reverse_void_rpcs.sql');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.delete_financial_entry_draft');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.reverse_financial_entry');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.void_financial_entry_draft');
    expect(sql).toContain('public.create_financial_entry_v2(reversal_payload)');
    expect(sql).toContain('لا يُبطل القيد المرحّل مباشرة؛ أنشئ قيدًا عكسيًا أولًا');
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يستبدل مسودة القيد فقط في معاملة ذرية ولا يفتح تعديل القيود المرحلة', () => {
    const sql = migration('202608270113_add_financial_entry_draft_replace_rpc.sql');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.replace_financial_entry_draft');
    expect(sql).toContain("IF entry_record.posting_status <> 'draft'");
    expect(sql).toContain('RETURN public.create_financial_entry_v2(replacement)');
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يصلح العكس والإبطال وفق عمود reverses_entry_id وقيد الوقت دون المساس بالإرث أو RLS', () => {
    const sql = migration('202608270114_fix_financial_entry_reverse_void_rpcs.sql');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.reverse_financial_entry');
    expect(sql).toContain('WHERE reverses_entry_id = p_entry_id');
    expect(sql).toContain('SET reverses_entry_id = p_entry_id');
    expect(sql).not.toContain('reversal_entry_id');
    expect(sql).toContain("voided_at = now()");
    expect(sql).not.toMatch(/\b(delete\s+from\s+public\.(journal_entries|account_transactions|expenses)|row level security|enable row level security|create policy)\b/i);
  });

  it('يحمي إدارة فئات وأنواع القيود بالجلسة والصلاحية الدقيقة ولا يغيّر RLS', () => {
    const sql = migration('202608270115_add_financial_entry_settings_permission_rpc.sql');

    expect(sql).toContain('auth.uid()::text');
    expect(sql).toContain('require_financial_entry_settings_permission');
    expect(sql).toContain("'create_entry_settings'");
    expect(sql).toContain("'edit_entry_settings'");
    expect(sql).toContain("'delete_entry_settings'");
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.manage_financial_entry_setting');
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يفرض الصلاحيات الخلفية على الإنشاء والترحيل والعكس والإبطال والتسوية ويحجب الدوال الداخلية', () => {
    const sql = migration('202608270116_enforce_financial_rpc_permissions.sql');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.require_financial_permission');
    expect(sql).toContain('auth.uid()::text');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.secure_create_financial_entry');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.secure_post_financial_entry');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.secure_reverse_financial_entry');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.secure_void_financial_entry_draft');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.secure_settle_custody_advance');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.create_financial_entry_v2(jsonb)');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.secure_create_financial_entry(jsonb)');
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يتحقق من عملة الدفع وحساب طرف الطلب داخل عملية القبض الذرية', () => {
    const sql = migration('202608270119_validate_order_payment_currency_and_party.sql');

    expect(sql).toContain("NULLIF(v_order_data->>'paidCurrency', '')");
    expect(sql).toContain("'عملة سند القبض لا تطابق عملة الدفع المسجلة للطلب.'");
    expect(sql).toContain("'الطلب لا يحمل حسابًا ماليًا لطرف التحصيل.'");
    expect(sql).toContain("'الساق الدائنة في سند القبض يجب أن تطابق حساب طرف الطلب.'");
    expect(sql).toContain("COALESCE(p_entry->>'entryTypeId', '') <> 'type_order_payment'");
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يحفظ تفاصيل وسائط الدفع صراحة ويتحقق من حساب الصندوق والبنك ومرجع الحوالة والاستحقاق', () => {
    const sql = migration('202608270120_add_financial_payment_details.sql');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.entry_payment_details');
    expect(sql).toContain("payment_method IN ('cash', 'bank', 'deferred')");
    expect(sql).toContain("v_account.acc_sub_id <> '111'");
    expect(sql).toContain("v_account.acc_sub_id <> '112'");
    expect(sql).toContain("payment_method <> 'bank' OR btrim(bank_reference) <> ''");
    expect(sql).toContain("payment_method <> 'deferred' OR due_at IS NOT NULL");
    expect(sql).toContain("'مجموع تفاصيل الدفع يجب أن يساوي مبلغ رأس القيد بعملته الأصلية.'");
    expect(sql).toContain('REVOKE ALL ON TABLE public.entry_payment_details FROM PUBLIC, anon, authenticated');
  });

  it('يحفظ تفاصيل تحصيل الطلب بعد إنشاء السند ضمن العملية المحمية نفسها', () => {
    const sql = migration('202608270121_persist_order_payment_details.sql');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.secure_record_order_payment');
    expect(sql).toContain("public.replace_financial_entry_payment_details(v_result->>'entryId', v_payload->'paymentDetails', v_actor_id)");
  });

  it('يحفظ تفاصيل دفع إصدار وتسوية العهدة ضمن المعاملات المحمية نفسها', () => {
    const sql = migration('202608270122_persist_custody_payment_details.sql');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.secure_create_custody_advance');
    expect(sql).toContain("public.replace_financial_entry_payment_details(v_result->>'issuedEntryId', v_payload->'paymentDetails', v_actor_id)");
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.secure_settle_custody_advance');
    expect(sql).toContain("public.replace_financial_entry_payment_details(v_result->>'settlementEntryId', v_payload->'paymentDetails', v_actor_id)");
  });

  it('يعالج قراءة تفاصيل الدفع بصلاحية قراءة فقط دون منح الكتابة للواجهة', () => {
    const sql = migration('202608280001_grant_entry_payment_details_read.sql');
    expect(sql).toContain('GRANT SELECT ON TABLE public.entry_payment_details TO anon, authenticated');
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.entry_payment_details FROM anon, authenticated');
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });

  it('يربط القيد المرحل بسجل الطلب بمرجع صريح ويكتم حدث تحديث الرصيد الداخلي للتحصيل', () => {
    const sql = migration('202608270123_link_financial_entries_to_orders_history.sql');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS main_entry_id text REFERENCES public.main_entry');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS account_trans_count integer');
    expect(sql).toContain("'financial.entry_posted'");
    expect(sql).toContain("current_setting('swiftship.suppress_order_update_history', true) = 'on'");
    expect(sql).toContain("set_config('swiftship.suppress_order_update_history', 'on', true)");
    expect(sql).toContain('trg_orders_history_main_entry_financial');
    expect(sql).not.toMatch(/\b(row level security|enable row level security|create policy)\b/i);
  });
});
