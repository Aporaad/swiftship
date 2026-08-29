/**
 * CompoundEntryForm.tsx
 * نموذج القيود المركبة (Compound Entries)
 *
 * التحديثات الجديدة:
 * 1. جعل "رقم القيد المركب" تلقائياً وغير قابل للتعديل (Read-only) مطلقا.
 * 2. إضافة وتوليد شرائح "له مقابل:" (للمدين) و "عليه مقابل:" (للدائن) تلقائياً في بداية البيان الفرعي.
 * 3. المزامنة والتحديث المستمر والآلي لسعر صرف العملة من `cur_price`.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Save, Trash2, ArrowRight, ArrowLeft, Calendar, User } from 'lucide-react';
import {
  financialEntryService,
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
  balance?: number;
}
export interface FinanceModule { id: string; code: string; nameAr: string; isActive?: boolean; }
export interface FinanceEntryType { id: string; moduleId: string; code: string; nameAr: string; isActive?: boolean; }

export type CompoundFormLine = {
  id: string;
  accountId: string;
  transType: 'Debit' | 'Credit';
  amountAccountCurrency: string;
  exchangeRate: string;
  lineDescription: string;
};

export interface EditableCompoundDraft {
  id: string;
  entryNumber: string;
  moduleId: string;
  entryTypeId: string;
  currencyOriginalNo: number;
  description: string;
  notes?: string;
  amountText?: string;
  effectiveAt?: string;
  lines: Array<{
    id: string;
    accountId: string;
    transType: 'Debit' | 'Credit';
    amountOriginal: string;
    lineDescription?: string;
  }>;
}

interface CompoundEntryFormProps {
  accounts: FinanceAccount[];
  currencies: FinanceCurrency[];
  modules: FinanceModule[];
  entryTypes: FinanceEntryType[];
  canCreate: boolean;
  canPost: boolean;
  createdByUid?: string;
  initialModuleCode?: string;
  initialTypeCode?: string;
  editingEntry?: EditableCompoundDraft;
  onSaved: () => void;
  onCancel: () => void;
}

const asNumber = (val: string) => Number(val || 0);

const createLine = (transType: 'Debit' | 'Credit'): CompoundFormLine => ({
  id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  accountId: '',
  transType,
  amountAccountCurrency: '',
  exchangeRate: '1',
  lineDescription: '',
});

export default function CompoundEntryForm({
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
}: CompoundEntryFormProps) {
  const systemCurrency = useMemo(
    () => currencies.find((c) => c.isDefault) || currencies[0],
    [currencies]
  );
  const initialModule = useMemo(
    () => modules.find((m) => m.code === initialModuleCode) || modules[0],
    [modules, initialModuleCode]
  );

  const entryUserName = useMemo(() => createdByUid || 'مدير النظام (مستخدم الجلسة)', [createdByUid]);

  // ── رقم القيد المركب محمي وغير قابل للتعديل (Read-only) ──
  const [entryNumber] = useState(
    () => editingEntry?.entryNumber || `JV-CMP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-5)}`
  );

  const [effectiveAt, setEffectiveAt] = useState<string>(
    () => editingEntry?.effectiveAt
      ? new Date(editingEntry.effectiveAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );

  const [moduleId, setModuleId] = useState(() => editingEntry?.moduleId || '');
  const [entryTypeId, setEntryTypeId] = useState(() => editingEntry?.entryTypeId || '');
  const [currencyId, setCurrencyId] = useState<number | ''>(() => editingEntry?.currencyOriginalNo || systemCurrency?.id || '');
  const [description, setDescription] = useState(() => editingEntry?.description || '');
  const [notes, setNotes] = useState(() => editingEntry?.notes || '');

  const [saveAsPosted, setSaveAsPosted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [lines, setLines] = useState<CompoundFormLine[]>(() => {
    if (editingEntry?.lines?.length) {
      return editingEntry.lines.map((l) => ({
        id: l.id,
        accountId: l.accountId,
        transType: l.transType,
        amountAccountCurrency: l.amountOriginal,
        exchangeRate: '1',
        lineDescription: l.lineDescription || '',
      }));
    }
    return [createLine('Debit'), createLine('Credit'), createLine('Credit')];
  });

  useEffect(() => {
    if (!moduleId && initialModule?.id) setModuleId(initialModule.id);
    if (currencyId === '' && systemCurrency?.id) setCurrencyId(systemCurrency.id);
  }, [currencyId, systemCurrency?.id, initialModule?.id, moduleId]);

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

  const selectedCurrency = currencies.find((c) => c.id === currencyId) || systemCurrency;

  const updateLine = async (index: number, patch: Partial<CompoundFormLine>) => {
    let updatedRate = patch.exchangeRate;

    if (patch.accountId) {
      const acc = accounts.find((a) => a.id === patch.accountId);
      if (acc) {
        if (acc.curNo === systemCurrency?.id) {
          updatedRate = '1';
        } else {
          const { data } = await (supabase as any)
            .from('cur_price')
            .select('price')
            .eq('cur_no', acc.curNo)
            .order('day_date', { ascending: false })
            .order('seq', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data?.price) {
            updatedRate = String(data.price);
          } else {
            updatedRate = '1';
          }
        }
      }
    }

    setLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, ...patch, ...(updatedRate !== undefined ? { exchangeRate: updatedRate } : {}) } : line
      )
    );
  };

  const addLine = (type: 'Debit' | 'Credit') => {
    setLines((prev) => [...prev, createLine(type)]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 3) {
      setError('القيد المركب يلزم أن يحتوي على 3 أسطر على الأقل.');
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const calculatedLines = useMemo(() => {
    return lines.map((line) => {
      const acc = accounts.find((a) => a.id === line.accountId);
      const isSystemCurrency = acc ? acc.curNo === systemCurrency?.id : true;
      const rate = isSystemCurrency ? 1 : asNumber(line.exchangeRate) || 1;
      const amtAccount = asNumber(line.amountAccountCurrency);
      const amtSystem = amtAccount * rate;

      return {
        ...line,
        accountObj: acc,
        accountName: acc?.nameAr || '',
        currencyCode: acc?.currencyCode || '—',
        isSystemCurrency,
        rate,
        amtAccount,
        amtSystem,
      };
    });
  }, [lines, accounts, systemCurrency]);

  const debitSystemTotal = calculatedLines
    .filter((l) => l.transType === 'Debit')
    .reduce((s, l) => s + l.amtSystem, 0);

  const creditSystemTotal = calculatedLines
    .filter((l) => l.transType === 'Credit')
    .reduce((s, l) => s + l.amtSystem, 0);

  const diffSystem = Math.abs(debitSystemTotal - creditSystemTotal);
  const isBalanced = debitSystemTotal > 0 && diffSystem < 0.001;

  const autoAmountText = useMemo(() => {
    if (!debitSystemTotal || debitSystemTotal <= 0) return '';
    return amountInWords(debitSystemTotal, systemCurrency?.code || 'YER', 'ar');
  }, [debitSystemTotal, systemCurrency?.code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!canCreate) return setError('ليس لديك تصريح إنشاء القيود المركبة.');
    if (!selectedCurrency || !entryTypeId || !moduleId || !description.trim()) {
      return setError('أكمل رقم القيد والفئة والنوع والبيان العام.');
    }
    if (!isBalanced) {
      return setError(`القيد غير متوازن: مجموع المدين بعملة النظام (${debitSystemTotal.toLocaleString()}) لا يساوي الدائن (${creditSystemTotal.toLocaleString()}). الفرق: ${diffSystem.toLocaleString()}`);
    }
    if (calculatedLines.some((l) => !l.accountId || l.amtAccount <= 0)) {
      return setError('تأكد من اختيار الحساب المالي وإدخال مبلغ موجب لكل أسطر القيد المركب.');
    }

    try {
      setSaving(true);

      const payloadLines: FinancialEntryLineInput[] = calculatedLines.map((l) => {
        const acc = accounts.find((a) => a.id === l.accountId)!;
        const isDebit = l.transType === 'Debit';
        const autoPrefix = isDebit ? 'له مقابل:' : 'عليه مقابل:';
        const fullLineDesc = `${autoPrefix} ${l.lineDescription || description.trim()}`.trim();

        return {
          id: l.id,
          accountId: acc.id,
          accountCurNo: acc.curNo,
          transType: l.transType,
          amount: Number(l.amtSystem.toFixed(4)),
          amountOriginal: l.amtAccount,
          description: fullLineDesc,
        };
      });

      const entryPayload: FinancialEntryInput = {
        entryNumber: entryNumber.trim(),
        moduleId,
        entryTypeId,
        entryCategory: 'Compound',
        postingStatus: saveAsPosted ? 'posted' : 'draft',
        amountOriginal: debitSystemTotal,
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
      setError(err?.message || 'تعذر حفظ القيد المركب.');
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

      {/* ── التفاصيل العلوية للقيد المركب (رقم القيد محمي غير قابل للتعديل) ── */}
      <div className="grid gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-md sm:grid-cols-2 lg:grid-cols-4 ring-1 ring-slate-800">
        <div>
          <label className="block text-xs font-black text-slate-200">رقم القيد المركب (محمي تلقائياً)</label>
          <input
            readOnly
            value={entryNumber}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono font-black text-amber-400 outline-none cursor-not-allowed opacity-90"
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
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-cyan-200 transition-all duration-200 focus:scale-[1.01] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-200">الفئة المالية</label>
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white transition-all duration-200 focus:scale-[1.01] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
          >
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.nameAr}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-200">نوع القيد المركب</label>
          <select
            value={entryTypeId}
            onChange={(e) => setEntryTypeId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white transition-all duration-200 focus:scale-[1.01] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
          >
            {availableTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.nameAr}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── البيان العام والتفقيط ── */}
      <div className="grid gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-md md:grid-cols-3 ring-1 ring-slate-800">
        <div>
          <label className="block text-xs font-black text-slate-200">عملة النظام المعيارية</label>
          <input
            readOnly
            value={`${systemCurrency?.code || 'YER'} (عملة الموازنة)`}
            className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-black text-amber-300 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-200">البيان العام للقيد المركب</label>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="شرح وتوضيح القيد المحاسبي المركب…"
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:scale-[1.008] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-cyan-300">إجمالي القيد كتابةً (تلقائي)</label>
          <input
            readOnly
            value={autoAmountText}
            placeholder="يتم التفقيط تلقائياً بناءً على إجمالي عملة النظام…"
            className="mt-1.5 w-full rounded-xl border border-cyan-500/40 bg-cyan-950/30 px-3.5 py-2 text-sm font-bold text-cyan-200 outline-none"
          />
        </div>
      </div>

      {/* ── جدول أسطر القيد المركب ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-950 shadow-lg ring-1 ring-slate-800">
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-black text-slate-100">جدول أسطر القيد المركب</h4>
            <span className="text-[10px] text-slate-400"> أدخل المبلغ بعملة الحساب وسيقوم النظام بمصارفته تلقائياً</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addLine('Debit')}
              className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-black text-emerald-300 hover:bg-emerald-500/25 transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> إضافة مدين (من حـ)
            </button>
            <button
              type="button"
              onClick={() => addLine('Credit')}
              className="inline-flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-black text-amber-300 hover:bg-amber-500/25 transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> إضافة دائن (إلى حـ)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-700/80">
              <tr>
                <th className="px-3.5 py-3 w-32 text-center border-l border-slate-800">الطرف</th>
                <th className="px-3.5 py-3 w-52 border-l border-slate-800">رقم الحساب</th>
                <th className="px-3.5 py-3 min-w-[160px] border-l border-slate-800">اسم الحساب</th>
                <th className="px-3.5 py-3 w-28 text-center border-l border-slate-800">عملة الحساب</th>
                <th className="px-3.5 py-3 w-28 text-center border-l border-slate-800">سعر الصرف الآلي</th>
                <th className="px-3.5 py-3 w-36 bg-cyan-950/30 text-cyan-300 border-l border-slate-800">المبلغ بعملة النظام</th>
                <th className="px-3.5 py-3 w-36 bg-amber-950/30 text-amber-300 border-l border-slate-800">المبلغ بعملة الحساب</th>
                <th className="px-3.5 py-3 w-36 bg-emerald-950/20 text-emerald-300 border-l border-slate-800">رصيد الحساب الحقيقي</th>
                <th className="px-3.5 py-3 border-l border-slate-800">البيان الفرعي التلقائي</th>
                <th className="px-3.5 py-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {calculatedLines.map((line, index) => {
                const isDebit = line.transType === 'Debit';
                const accBalance = line.accountObj?.balance !== undefined ? line.accountObj.balance : 0;
                const autoPrefix = isDebit ? 'له مقابل:' : 'عليه مقابل:';

                return (
                  <tr key={line.id} className="hover:bg-slate-900/60 transition-colors">
                    {/* نوع الطرف */}
                    <td className="px-3.5 py-3 text-center border-l border-slate-800/60">
                      <select
                        value={line.transType}
                        onChange={(e) => updateLine(index, { transType: e.target.value as 'Debit' | 'Credit' })}
                        className={`rounded-xl px-2.5 py-1.5 text-xs font-black border outline-none bg-slate-950 transition-all duration-200 ${
                          isDebit ? 'border-emerald-500/40 text-emerald-300' : 'border-amber-500/40 text-amber-300'
                        }`}
                      >
                        <option value="Debit">من حـ (مدين)</option>
                        <option value="Credit">إلى حـ (دائن)</option>
                      </select>
                    </td>

                    {/* اختيار الحساب */}
                    <td className="px-3.5 py-3 border-l border-slate-800/60">
                      <AccountPickerModal
                        accounts={accounts.filter((a) => a.isActive && a.isPosting)}
                        selectedAccountId={line.accountId}
                        label="اختر حساب القيد"
                        placeholder="اختر الحساب…"
                        onSelect={(id) => updateLine(index, { accountId: id })}
                      />
                    </td>

                    {/* اسم الحساب */}
                    <td className="px-3.5 py-3 font-bold text-slate-100 border-l border-slate-800/60">
                      {line.accountName || <span className="text-slate-500 italic">اختر الحساب</span>}
                    </td>

                    {/* عملة الحساب */}
                    <td className="px-3.5 py-3 text-center font-mono font-black text-cyan-300 border-l border-slate-800/60">
                      {line.currencyCode}
                    </td>

                    {/* سعر الصرف */}
                    <td className="px-3.5 py-3 text-center border-l border-slate-800/60">
                      <input
                        type="number"
                        step="any"
                        disabled={line.isSystemCurrency}
                        value={line.exchangeRate}
                        onChange={(e) => updateLine(index, { exchangeRate: e.target.value })}
                        className="w-20 rounded-xl border border-slate-700 bg-slate-900 px-2 py-1 text-center font-mono text-xs font-bold text-white transition-all duration-200 focus:border-cyan-400 focus:outline-none disabled:opacity-50"
                      />
                    </td>

                    {/* المبلغ بعملة النظام */}
                    <td className="px-3.5 py-3 bg-cyan-950/15 border-l border-slate-800/60 font-mono font-bold text-cyan-300">
                      <input
                        readOnly
                        value={line.amtSystem ? line.amtSystem.toFixed(2) : ''}
                        placeholder="تلقائي"
                        className="w-full bg-transparent font-mono font-bold text-cyan-300 outline-none"
                      />
                    </td>

                    {/* المبلغ بعملة الحساب */}
                    <td className="px-3.5 py-3 bg-amber-950/15 border-l border-slate-800/60">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={line.amountAccountCurrency}
                        onChange={(e) => updateLine(index, { amountAccountCurrency: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-amber-500/40 bg-slate-900 px-3 py-1.5 text-sm font-mono font-black text-amber-200 transition-all duration-200 focus:scale-[1.01] focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                      />
                    </td>

                    {/* رصيد الحساب الحقيقي */}
                    <td className="px-3.5 py-3 bg-emerald-950/15 border-l border-slate-800/60 font-mono font-bold text-emerald-300">
                      {accBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-emerald-500/80">{line.currencyCode}</span>
                    </td>

                    {/* البيان الفرعي التلقائي (له مقابل / عليه مقابل) */}
                    <td className="px-3.5 py-3 border-l border-slate-800/60">
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-[11px] font-black text-amber-400">
                          {autoPrefix}
                        </span>
                        <input
                          type="text"
                          value={line.lineDescription}
                          onChange={(e) => updateLine(index, { lineDescription: e.target.value })}
                          placeholder="تفاصيل الملاحظة الفرعية…"
                          className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:border-slate-600 focus:outline-none"
                        />
                      </div>
                    </td>

                    {/* حذف الساق */}
                    <td className="px-3.5 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/20 transition"
                        title="حذف الساق"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── الشريط السفلي وإظهار اسم المستخدم المدخل ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 p-4 border border-slate-700 shadow-md ring-1 ring-slate-800">
        <div className="flex items-center gap-6 text-xs font-black">
          <div className="flex items-center gap-1.5 text-slate-300 border-l border-slate-800 pl-4">
            <User className="h-4 w-4 text-emerald-400" />
            <span>المستخدم القائم بالإدخال:</span>
            <span className="font-black text-emerald-300">{entryUserName}</span>
          </div>

          <div className="text-emerald-400">
            إجمالي المدين بعمله النظام: <span className="text-sm font-mono">{debitSystemTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> {systemCurrency?.code}
          </div>
          <div className="text-amber-400">
            إجمالي الدائن بعمله النظام: <span className="text-sm font-mono">{creditSystemTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> {systemCurrency?.code}
          </div>
          <div className={`px-3 py-1.5 rounded-xl border font-mono ${isBalanced ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/15 border-rose-500/40 text-rose-300'}`}>
            {isBalanced ? '✓ القيد متوازن' : `الفرق: ${diffSystem.toLocaleString()}`}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={saveAsPosted}
              onChange={(e) => setSaveAsPosted(e.target.checked)}
              disabled={Boolean(editingEntry) || !canPost}
              className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0"
            />
            <span>اعتماد وترحيل مباشرة</span>
          </label>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            إلغاء
          </button>

          <button
            disabled={saving || !canCreate || !isBalanced}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-black text-slate-950 transition shadow-lg disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'جارٍ الحفظ…' : editingEntry ? 'حفظ التعديل' : 'حفظ القيد المركب'}
          </button>
        </div>
      </div>
    </form>
  );
}
