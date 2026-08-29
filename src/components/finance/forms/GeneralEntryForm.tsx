/**
 * GeneralEntryForm.tsx
 * نموذج القيود العامة والمؤقتة (General / Temp Entries)
 *
 * التحديثات الجديدة:
 * 1. إظهار حقل التاريخ ووقت القيد (effectiveAt) في القسم العلوي.
 * 2. تقوية المحتوى البصري والتباين، وألوان الإطارات والفواصل بين العناصر وجدول أسطر القيد.
 * 3. خلوه التام من حقول تفاصيل الدفع مع التفقيط التلقائي.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save, ArrowRight, ArrowLeft, Calendar } from 'lucide-react';
import {
  financialEntryService,
  type FinancialEntryCategory,
  type FinancialEntryInput,
  type FinancialEntryLineInput,
} from '../../../services/financialEntryService';
import { supabase } from '../../../lib/supabase-firebase-adapter';
import AccountPickerModal from '../AccountPickerModal';
import { amountInWords } from '../../../lib/numberToWords';

export interface FinanceCurrency { id: number; code: string; isDefault: boolean; }
export interface FinanceAccount {
  id: string;
  nameAr: string;
  nameEn?: string;
  curNo: number;
  currencyCode: string;
  isActive: boolean;
  isPosting: boolean;
  accSubId?: string;
  entityId?: string;
  entityType?: string;
}
export interface FinanceModule { id: string; code: string; nameAr: string; isActive?: boolean; }
export interface FinanceEntryType { id: string; moduleId: string; code: string; nameAr: string; isActive?: boolean; }

export type GeneralFormLine = {
  id: string;
  accountId: string;
  transType: 'Debit' | 'Credit';
  amountOriginal: string;
  lineDescription: string;
};

export interface EditableGeneralDraft {
  id: string;
  entryNumber: string;
  moduleId: string;
  entryTypeId: string;
  currencyOriginalNo: number;
  description: string;
  notes?: string;
  amountText?: string;
  effectiveAt?: string;
  lines: Array<GeneralFormLine>;
}

interface GeneralEntryFormProps {
  category: FinancialEntryCategory; // 'General' | 'Temp'
  accounts: FinanceAccount[];
  currencies: FinanceCurrency[];
  modules: FinanceModule[];
  entryTypes: FinanceEntryType[];
  canCreate: boolean;
  canPost: boolean;
  createdByUid?: string;
  initialModuleCode?: string;
  initialTypeCode?: string;
  editingEntry?: EditableGeneralDraft;
  onSaved: () => void;
  onCancel: () => void;
}

const asNumber = (val: string) => Number(val || 0);

const createLine = (transType: 'Debit' | 'Credit'): GeneralFormLine => ({
  id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  accountId: '',
  transType,
  amountOriginal: '',
  lineDescription: '',
});

export default function GeneralEntryForm({
  category,
  accounts,
  currencies,
  modules,
  entryTypes,
  canCreate,
  canPost,
  createdByUid,
  initialModuleCode,
  initialTypeCode,
  editingEntry,
  onSaved,
  onCancel,
}: GeneralEntryFormProps) {
  const defaultCurrency = useMemo(
    () => currencies.find((c) => c.isDefault) || currencies[0],
    [currencies],
  );
  const initialModule = useMemo(
    () => modules.find((m) => m.code === initialModuleCode) || modules[0],
    [modules, initialModuleCode],
  );

  // ── حالات القيد ──
  const [entryNumber, setEntryNumber] = useState(
    () => editingEntry?.entryNumber || `JV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-6)}`
  );
  const [effectiveAt, setEffectiveAt] = useState<string>(
    () => editingEntry?.effectiveAt
      ? new Date(editingEntry.effectiveAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );

  const [moduleId, setModuleId] = useState(() => editingEntry?.moduleId || '');
  const [entryTypeId, setEntryTypeId] = useState(() => editingEntry?.entryTypeId || '');
  const [currencyId, setCurrencyId] = useState<number | ''>(() => editingEntry?.currencyOriginalNo || '');
  const [description, setDescription] = useState(() => editingEntry?.description || '');
  const [notes, setNotes] = useState(() => editingEntry?.notes || '');

  const [exchangeRate, setExchangeRate] = useState<string>('1');
  const [exchangeRatePriceRef, setExchangeRatePriceRef] = useState<{ id: number; seq: number } | null>(null);

  const [saveAsPosted, setSaveAsPosted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── أسطر القيد البسيط (مدين ودائن) ──
  const [lines, setLines] = useState<GeneralFormLine[]>(
    () => editingEntry?.lines || [createLine('Debit'), createLine('Credit')]
  );

  useEffect(() => {
    if (!moduleId && initialModule?.id) setModuleId(initialModule.id);
    if (currencyId === '' && defaultCurrency?.id) setCurrencyId(defaultCurrency.id);
  }, [currencyId, defaultCurrency?.id, initialModule?.id, moduleId]);

  const availableTypes = useMemo(
    () => entryTypes.filter((t) => t.moduleId === moduleId),
    [entryTypes, moduleId]
  );

  useEffect(() => {
    const preferred = availableTypes.find((t) => t.code === initialTypeCode) || availableTypes[0];
    if (preferred && !availableTypes.some((t) => t.id === entryTypeId)) {
      setEntryTypeId(preferred.id);
    }
  }, [availableTypes, entryTypeId, initialTypeCode]);

  const selectedCurrency = currencies.find((c) => c.id === currencyId);

  useEffect(() => {
    if (!selectedCurrency || selectedCurrency.isDefault) {
      setExchangeRate('1');
      setExchangeRatePriceRef(null);
      return;
    }
    const fetchRate = async () => {
      const { data } = await (supabase as any)
        .from('cur_price')
        .select('id, seq, price')
        .eq('cur_no', selectedCurrency.id)
        .order('day_date', { ascending: false })
        .order('seq', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.price) {
        setExchangeRate(String(data.price));
        setExchangeRatePriceRef({ id: Number(data.id), seq: Number(data.seq) });
      } else {
        setExchangeRate('1');
        setExchangeRatePriceRef(null);
      }
    };
    void fetchRate();
  }, [selectedCurrency?.id]);

  const debitAmount = asNumber(lines.find((l) => l.transType === 'Debit')?.amountOriginal || '0');
  const creditAmount = asNumber(lines.find((l) => l.transType === 'Credit')?.amountOriginal || '0');
  const mainAmount = debitAmount > 0 ? debitAmount : creditAmount;

  const autoAmountText = useMemo(() => {
    if (!mainAmount || mainAmount <= 0) return '';
    return amountInWords(mainAmount, selectedCurrency?.code || 'YER', 'ar');
  }, [mainAmount, selectedCurrency?.code]);

  const updateLine = (index: number, patch: Partial<GeneralFormLine>) => {
    setLines((prev) => prev.map((line, i) => {
      if (i !== index) return line;
      const updated = { ...line, ...patch };
      if ('amountOriginal' in patch) {
        const otherIndex = index === 0 ? 1 : 0;
        setTimeout(() => {
          setLines((curr) => curr.map((l, idx) => idx === otherIndex ? { ...l, amountOriginal: patch.amountOriginal! } : l));
        }, 0);
      }
      return updated;
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!canCreate) return setError('ليس لديك تصريح إنشاء القيود.');
    if (!selectedCurrency || !entryTypeId || !moduleId || !description.trim()) {
      return setError('أكمل رقم القيد والفئة والنوع والعملة والبيان العام.');
    }
    if (debitAmount <= 0 || creditAmount <= 0 || debitAmount !== creditAmount) {
      return setError('يجب إدخال مبلغ موجب ومتساوٍ لكل من طرفي المدين والدائن.');
    }

    const lineDebit = lines.find((l) => l.transType === 'Debit');
    const lineCredit = lines.find((l) => l.transType === 'Credit');
    if (!lineDebit?.accountId || !lineCredit?.accountId) {
      return setError('يرجى تحديد حساب مالي صالح لكل من طرف المدين وطرف الدائن.');
    }

    try {
      setSaving(true);

      const payloadLines: FinancialEntryLineInput[] = lines.map((line) => {
        const acc = accounts.find((a) => a.id === line.accountId);
        if (!acc) throw new Error(`الحساب المالي رقم ${line.accountId} غير موجود.`);

        return {
          id: line.id,
          accountId: acc.id,
          accountCurNo: acc.curNo,
          transType: line.transType,
          amount: asNumber(line.amountOriginal),
          amountOriginal: asNumber(line.amountOriginal),
          description: line.lineDescription || description.trim(),
          currencyPrice: exchangeRatePriceRef || undefined,
        };
      });

      const entryPayload: FinancialEntryInput = {
        entryNumber: entryNumber.trim(),
        moduleId,
        entryTypeId,
        entryCategory: category,
        postingStatus: saveAsPosted ? 'posted' : 'draft',
        amountOriginal: mainAmount,
        amountText: autoAmountText,
        currencyOriginalNo: selectedCurrency.id,
        description: description.trim(),
        notes,
        effectiveAt: new Date(effectiveAt).toISOString(),
        createdByUid,
        lines: payloadLines,
      };

      if (editingEntry) {
        await financialEntryService.replaceDraft(editingEntry.id, entryPayload);
      } else {
        await financialEntryService.create(entryPayload);
      }

      onSaved();
    } catch (err: any) {
      setError(err?.message || 'تعذر حفظ القيد.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6" dir="rtl">
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-500/50 bg-rose-500/15 p-4 text-xs font-bold text-rose-200 shadow-md">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* ── التفاصيل العلوية للقيد: رقم القيد، تاريخ القيد، الفئة، النوع، العملة ── */}
      <div className="grid gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-md sm:grid-cols-2 lg:grid-cols-5 ring-1 ring-slate-800">
        <div>
          <label className="block text-xs font-black text-slate-200">رقم القيد</label>
          <input
            required
            value={entryNumber}
            onChange={(e) => setEntryNumber(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono font-black text-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-200 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-cyan-400" />
            <span>تاريخ ووقت القيد</span>
          </label>
          <input
            required
            type="datetime-local"
            value={effectiveAt}
            onChange={(e) => setEffectiveAt(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-cyan-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-200">الفئة المالية</label>
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white focus:border-cyan-500 focus:outline-none"
          >
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.nameAr}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-200">نوع القيد</label>
          <select
            value={entryTypeId}
            onChange={(e) => setEntryTypeId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white focus:border-cyan-500 focus:outline-none"
          >
            {availableTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.nameAr}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-200">عملة القيد الرئيسية</label>
          <select
            value={currencyId}
            onChange={(e) => setCurrencyId(Number(e.target.value))}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-black text-emerald-300 focus:border-cyan-500 focus:outline-none"
          >
            {currencies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.isDefault ? ' (العملة الافتراضية)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── البيان العام والتفقيط التلقائي ── */}
      <div className="grid gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-md md:grid-cols-2 ring-1 ring-slate-800">
        <div>
          <label className="block text-xs font-black text-slate-200">البيان العام للقيد</label>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="وصف المحاسبي للقيد العام…"
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-cyan-300">المبلغ كتابةً (تلقائي)</label>
          <input
            readOnly
            value={autoAmountText}
            placeholder="يتم التفقيط تلقائياً بناءً على المبلغ…"
            className="mt-1.5 w-full rounded-xl border border-cyan-500/40 bg-cyan-950/30 px-3.5 py-2 text-sm font-bold text-cyan-200 placeholder-slate-600 outline-none"
          />
        </div>
      </div>

      {/* ── جدول أسطر القيد البسيط بدقة وتباين بصري عالٍ ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-950 shadow-lg ring-1 ring-slate-800">
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-100">جدول أسطر القيد (طرف مدين وطرف دائن)</h4>
          <span className="text-[11px] font-bold text-slate-400">القيد البسيط يحوي ساقين متوازيتين متساويتين</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-700/80">
              <tr>
                <th className="px-3.5 py-3 w-32 text-center border-l border-slate-800">الطرف (من/إلى)</th>
                <th className="px-3.5 py-3 w-56 border-l border-slate-800">رقم الحساب</th>
                <th className="px-3.5 py-3 min-w-[180px] border-l border-slate-800">اسم الحساب</th>
                <th className="px-3.5 py-3 w-28 text-center border-l border-slate-800">عملة الحساب</th>
                <th className="px-3.5 py-3 w-28 text-center border-l border-slate-800">سعر الصرف</th>
                <th className="px-3.5 py-3 w-40 border-l border-slate-800">المبلغ ({selectedCurrency?.code})</th>
                <th className="px-3.5 py-3">البيان الفرعي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {lines.map((line, index) => {
                const acc = accounts.find((a) => a.id === line.accountId);
                const isDebit = line.transType === 'Debit';

                return (
                  <tr key={line.id} className="hover:bg-slate-900/60 transition-colors">
                    {/* نوع الطرف */}
                    <td className="px-3.5 py-3 text-center border-l border-slate-800/60">
                      <div className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black border ${
                        isDebit
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      }`}>
                        {isDebit ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
                        <span>{isDebit ? 'من حـ (مدين)' : 'إلى حـ (دائن)'}</span>
                      </div>
                    </td>

                    {/* اختيار الحساب */}
                    <td className="px-3.5 py-3 border-l border-slate-800/60">
                      <AccountPickerModal
                        accounts={accounts.filter((a) => a.isActive && a.isPosting)}
                        selectedAccountId={line.accountId}
                        label="اختيار الحساب المالي"
                        placeholder="اختر حساباً…"
                        onSelect={(id) => updateLine(index, { accountId: id })}
                      />
                    </td>

                    {/* اسم الحساب */}
                    <td className="px-3.5 py-3 font-bold text-slate-100 border-l border-slate-800/60">
                      {acc ? acc.nameAr : <span className="text-slate-500 italic">حدد الحساب</span>}
                    </td>

                    {/* عملة الحساب */}
                    <td className="px-3.5 py-3 text-center font-mono font-black text-cyan-300 border-l border-slate-800/60">
                      {acc ? acc.currencyCode : '—'}
                    </td>

                    {/* سعر الصرف */}
                    <td className="px-3.5 py-3 text-center font-mono text-slate-400 border-l border-slate-800/60">
                      {exchangeRate}
                    </td>

                    {/* المبلغ */}
                    <td className="px-3.5 py-3 border-l border-slate-800/60">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={line.amountOriginal}
                        onChange={(e) => updateLine(index, { amountOriginal: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-mono font-black text-white focus:border-cyan-500 focus:outline-none"
                      />
                    </td>

                    {/* البيان الفرعي */}
                    <td className="px-3.5 py-3">
                      <input
                        type="text"
                        value={line.lineDescription}
                        onChange={(e) => updateLine(index, { lineDescription: e.target.value })}
                        placeholder="ملاحظات الساق…"
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-200 placeholder-slate-600 focus:border-slate-600 focus:outline-none"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── شريط الموازنة والتوازن وتأكيد التمييز البصري ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 p-4 border border-slate-700 shadow-md ring-1 ring-slate-800">
        <div className="flex items-center gap-6 text-xs font-black">
          <div className="text-emerald-400">
            إجمالي المدين: <span className="text-sm font-mono">{debitAmount.toLocaleString()}</span> {selectedCurrency?.code}
          </div>
          <div className="text-amber-400">
            إجمالي الدائن: <span className="text-sm font-mono">{creditAmount.toLocaleString()}</span> {selectedCurrency?.code}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={saveAsPosted}
              onChange={(e) => setSaveAsPosted(e.target.checked)}
              disabled={Boolean(editingEntry) || !canPost || category === 'Temp'}
              className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0"
            />
            <span>اعتماد وترحيل القيد مباشرة</span>
          </label>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            إلغاء
          </button>

          <button
            disabled={saving || !canCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-black text-slate-950 transition shadow-lg disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'جارٍ الحفظ…' : editingEntry ? 'حفظ التعديل' : 'حفظ القيد'}
          </button>
        </div>
      </div>
    </form>
  );
}
