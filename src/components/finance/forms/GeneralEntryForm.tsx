/**
 * GeneralEntryForm.tsx
 * نموذج القيود العامة والمؤقتة (General / Temp Entries)
 *
 * التحديثات الجديدة:
 * - حل وتفادي خطأ "الساق متعددة العملات تحتاج مرجع سعر صرف مثبتًا قبل الحفظ" بإنشاء وجلب المرجع المالي لأسعار الصرف المتعددة تلقائياً.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save, ArrowRight, ArrowLeft, Calendar, User, Calculator } from 'lucide-react';
import {
  financialEntryService,
  type FinancialEntryCategory,
  type FinancialEntryInput,
  type FinancialEntryLineInput,
} from '../../../services/financialEntryService';
import { supabase } from '../../../lib/supabase-firebase-adapter';
import AccountPickerModal from '../AccountPickerModal';
import FinancialCalculatorModal from '../FinancialCalculatorModal';
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

export type GeneralFormLine = {
  id: string;
  accountId: string;
  transType: 'Debit' | 'Credit';
  lineNote: string;
  accountExchangeRate: string;
  priceRef?: { id: number; seq: number };
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
  amountOriginal?: number;
  lines: Array<{
    id: string;
    accountId: string;
    transType: 'Debit' | 'Credit';
    amountOriginal: string;
    lineDescription?: string;
  }>;
}

interface GeneralEntryFormProps {
  category: FinancialEntryCategory;
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
  lineNote: '',
  accountExchangeRate: '1',
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

  const entryUserName = useMemo(() => createdByUid || 'مدير النظام (مستخدم الجلسة)', [createdByUid]);

  const [entryNumber] = useState(
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

  const [entryAmount, setEntryAmount] = useState<string>(() => editingEntry?.amountOriginal ? String(editingEntry.amountOriginal) : (editingEntry?.lines?.[0]?.amountOriginal || ''));

  const [description, setDescription] = useState(() => editingEntry?.description || '');
  const [notes, setNotes] = useState(() => editingEntry?.notes || '');

  const [entryExchangeRate, setEntryExchangeRate] = useState<string>('1');
  const [entryPriceRef, setEntryPriceRef] = useState<{ id: number; seq: number } | null>(null);

  const [saveAsPosted, setSaveAsPosted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [lines, setLines] = useState<GeneralFormLine[]>(() => {
    if (editingEntry?.lines?.length) {
      return editingEntry.lines.map((l) => ({
        id: l.id,
        accountId: l.accountId,
        transType: l.transType,
        lineNote: l.lineDescription?.replace(/^(له مقابل:|عليه مقابل:)\s*/, '') || '',
        accountExchangeRate: '1',
      }));
    }
    return [createLine('Debit'), createLine('Credit')];
  });

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

  const selectedEntryCurrency = currencies.find((c) => c.id === currencyId) || defaultCurrency;

  useEffect(() => {
    if (!selectedEntryCurrency || selectedEntryCurrency.isDefault) {
      setEntryExchangeRate('1');
      setEntryPriceRef(null);
      return;
    }
    const fetchLatestRate = async () => {
      const { data } = await (supabase as any)
        .from('cur_price')
        .select('id, seq, price')
        .eq('cur_no', selectedEntryCurrency.id)
        .order('day_date', { ascending: false })
        .order('seq', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.price) {
        setEntryExchangeRate(String(data.price));
        setEntryPriceRef({ id: Number(data.id), seq: Number(data.seq) });
      } else {
        setEntryExchangeRate('1');
        setEntryPriceRef(null);
      }
    };
    void fetchLatestRate();
  }, [selectedEntryCurrency?.id]);

  const updateLineAccount = async (index: number, accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    let fetchedRate = '1';
    let refObj: { id: number; seq: number } | undefined = undefined;

    if (acc && acc.curNo !== defaultCurrency?.id) {
      const { data } = await (supabase as any)
        .from('cur_price')
        .select('id, seq, price')
        .eq('cur_no', acc.curNo)
        .order('day_date', { ascending: false })
        .order('seq', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.price) {
        fetchedRate = String(data.price);
        refObj = { id: Number(data.id), seq: Number(data.seq) };
      }
    }

    setLines((prev) => prev.map((l, i) => i === index ? { ...l, accountId, accountExchangeRate: fetchedRate, priceRef: refObj } : l));
  };

  const updateLineNote = (index: number, note: string) => {
    setLines((prev) => prev.map((l, i) => i === index ? { ...l, lineNote: note } : l));
  };

  const numericMainAmount = Number(entryAmount || 0);
  const numEntryRate = asNumber(entryExchangeRate) || 1;

  const autoAmountText = useMemo(() => {
    if (!numericMainAmount || numericMainAmount <= 0) return '';
    return amountInWords(numericMainAmount, selectedEntryCurrency?.code || 'YER', 'ar');
  }, [numericMainAmount, selectedEntryCurrency?.code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!canCreate) return setError('ليس لديك تصريح إنشاء القيود.');
    if (!selectedEntryCurrency || !entryTypeId || !moduleId || !description.trim()) {
      return setError('أكمل بيانات القيد العامة والفئة والنوع والعملة والبيان.');
    }
    if (numericMainAmount <= 0) {
      return setError('يرجى إدخال مبلغ موجب صحيح للقيد.');
    }

    const lineDebit = lines.find((l) => l.transType === 'Debit');
    const lineCredit = lines.find((l) => l.transType === 'Credit');
    if (!lineDebit?.accountId || !lineCredit?.accountId) {
      return setError('يرجى تحديد حساب مالي صالح لكل من طرف المدين وطرف الدائن.');
    }

    const accDebit = accounts.find((a) => a.id === lineDebit.accountId);
    const accCredit = accounts.find((a) => a.id === lineCredit.accountId);

    try {
      setSaving(true);

      const payloadLines: FinancialEntryLineInput[] = lines.map((line) => {
        const acc = accounts.find((a) => a.id === line.accountId)!;
        const isDebit = line.transType === 'Debit';
        const otherAccName = isDebit ? accCredit?.nameAr : accDebit?.nameAr;
        const autoPrefix = isDebit ? 'له مقابل:' : 'عليه مقابل:';
        const noteText = line.lineNote || otherAccName || description.trim();
        const fullLineDesc = `${autoPrefix} ${noteText}`.trim();

        const accRate = asNumber(line.accountExchangeRate) || 1;
        // معادلة المصارفة: get_account_amount(entryPrice, amountOriginal, accountPrice) = (amountOriginal * entryPrice) / accountPrice
        const lineAmountInAccountCurrency = Number(((numericMainAmount * numEntryRate) / accRate).toFixed(5));
        
        const accCurCode = currencies.find((c) => c.id === acc.curNo)?.code || 'YER';
        const lineAmountText = amountInWords(lineAmountInAccountCurrency, accCurCode, 'ar');
        const lineAmountOriginalText = autoAmountText;

        return {
          id: line.id,
          accountId: acc.id,
          accountCurNo: acc.curNo,
          accountCurrencyPrice: line.priceRef || undefined,
          transType: line.transType,
          amount: lineAmountInAccountCurrency,
          amountText: lineAmountText,
          amountOriginal: numericMainAmount,
          amountOriginalText: lineAmountOriginalText,
          currencyOriginalNo: selectedEntryCurrency.id,
          currencyPrice: entryPriceRef || undefined,
          description: fullLineDesc,
        };
      });

      const entryPayload: FinancialEntryInput = {
        entryNumber: entryNumber.trim(),
        moduleId,
        entryTypeId,
        entryCategory: category,
        postingStatus: saveAsPosted ? 'posted' : 'draft',
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

  const [isCalcOpen, setIsCalcOpen] = useState(false);

  return (
    <form onSubmit={submit} className="space-y-6" dir="rtl">
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-500/50 bg-rose-500/15 p-4 text-xs font-bold text-rose-200 shadow-md">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* ── التفاصيل العلوية للقيد ── */}
      <div className="grid gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-md sm:grid-cols-2 lg:grid-cols-4 ring-1 ring-slate-800">
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-black text-slate-200">رقم القيد (محمي تلقائياً)</label>
            {/* زر أيقونة آلة حاسبة ومصارفة صغيرة أنيقة بدون حجز مساحة كاملة */}
            <button
              type="button"
              onClick={() => setIsCalcOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 hover:bg-[#d4af37]/25 px-2 py-0.5 text-[11px] font-bold text-[#f4d870] transition active:scale-95"
              title="فتح الآلة الحاسبة والمصارفة"
            >
              <Calculator className="h-3.5 w-3.5 text-[#f4d870]" />
              <span>حاسبة ومصارفة</span>
            </button>
          </div>
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
          <label className="block text-xs font-black text-slate-200">نوع القيد</label>
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

      {/* ── حقل (مبلغ القيد | عملة القيد | سعر صرف عملة القيد) ── */}
      <div className="grid gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-md lg:grid-cols-4 ring-1 ring-slate-800">
        <div>
          <label className="block text-xs font-black text-slate-200">
            مبلغ القيد الرئيسي
          </label>
          <input
            required
            type="number"
            step="any"
            min="0"
            value={entryAmount}
            onChange={(e) => setEntryAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base font-mono font-black text-emerald-400 transition-all duration-200 focus:scale-[1.01] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-200">عملة القيد وسعر صرفها</label>
          <div className="flex items-center gap-2 mt-1.5">
            <select
              value={currencyId}
              onChange={(e) => setCurrencyId(Number(e.target.value))}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-emerald-300 transition-all duration-200 focus:scale-[1.01] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
            >
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.isDefault ? ' (الافتراضية)' : ''}
                </option>
              ))}
            </select>

            <input
              type="number"
              step="any"
              value={entryExchangeRate}
              onChange={(e) => setEntryExchangeRate(e.target.value)}
              className="w-20 rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-center font-mono text-xs font-bold text-cyan-200 transition-all duration-200 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-cyan-300">المبلغ كتابةً (تلقائي)</label>
          <input
            readOnly
            value={autoAmountText}
            placeholder="يتم التفقيط تلقائياً…"
            className="mt-1.5 w-full rounded-xl border border-cyan-500/40 bg-cyan-950/30 px-3.5 py-2 text-xs font-bold text-cyan-200 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-200">البيان العام للقيد</label>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="البيان العام للقيد المحاسبي…"
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 transition-all duration-200 focus:scale-[1.008] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
          />
        </div>
      </div>

      {/* ── جدول الأطراف (عملة الحساب الأصلية | سعر صرف الحساب الأصلي | المبلغ مصارفةً بعمله الحساب) ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-950 shadow-lg ring-1 ring-slate-800">
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-100">جدول أسطر القيد ومصارفة الحسابات</h4>
          <span className="text-[11px] font-bold text-slate-400">عملة الحساب وسعر صرفها منفصلان ومصارفة المبلغ تلقائية</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-700/80">
              <tr>
                <th className="px-3.5 py-3 w-32 text-center border-l border-slate-800">الطرف (من/إلى)</th>
                <th className="px-3.5 py-3 w-56 border-l border-slate-800">رقم الحساب</th>
                <th className="px-3.5 py-3 min-w-[160px] border-l border-slate-800">اسم الحساب</th>
                <th className="px-3.5 py-3 w-28 text-center border-l border-slate-800">عملة الحساب الأصلية</th>
                <th className="px-3.5 py-3 w-32 text-center border-l border-slate-800">سعر صرف عملة الحساب</th>
                <th className="px-3.5 py-3 w-40 bg-emerald-950/20 text-emerald-300 border-l border-slate-800">المبلغ بعملة الحساب (مصارفةً)</th>
                <th className="px-3.5 py-3 w-36 bg-amber-950/20 text-amber-300 border-l border-slate-800">رصيد الحساب الحقيقي</th>
                <th className="px-3.5 py-3">البيان الفرعي (قابل للتعديل)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {lines.map((line, index) => {
                const acc = accounts.find((a) => a.id === line.accountId);
                const isDebit = line.transType === 'Debit';
                const accBalance = acc?.balance !== undefined ? acc.balance : 0;

                const otherLine = lines.find((_, i) => i !== index);
                const otherAcc = accounts.find((a) => a.id === otherLine?.accountId);
                const autoPrefix = isDebit ? 'له مقابل:' : 'عليه مقابل:';
                const currentNote = line.lineNote !== undefined ? line.lineNote : `${otherAcc?.nameAr || ''}`;

                const accRate = asNumber(line.accountExchangeRate) || 1;
                const convertedAccAmount = accRate > 0 ? (numericMainAmount * numEntryRate) / accRate : numericMainAmount;

                return (
                  <tr key={line.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="px-3.5 py-3 text-center border-l border-slate-800/60">
                      <div className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black border ${
                        isDebit ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      }`}>
                        {isDebit ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
                        <span>{isDebit ? 'من حـ (مدين)' : 'إلى حـ (دائن)'}</span>
                      </div>
                    </td>

                    <td className="px-3.5 py-3 border-l border-slate-800/60">
                      <AccountPickerModal
                        accounts={accounts.filter((a) => a.isActive && a.isPosting)}
                        selectedAccountId={line.accountId}
                        label="اختيار الحساب المالي"
                        placeholder="اختر حساباً…"
                        onSelect={(id) => void updateLineAccount(index, id)}
                      />
                    </td>

                    <td className="px-3.5 py-3 font-bold text-slate-100 border-l border-slate-800/60">
                      {acc ? acc.nameAr : <span className="text-slate-500 italic">حدد الحساب</span>}
                    </td>

                    <td className="px-3.5 py-3 text-center font-mono font-black text-cyan-300 border-l border-slate-800/60">
                      {acc ? acc.currencyCode : '—'}
                    </td>

                    <td className="px-3.5 py-3 text-center font-mono font-bold text-cyan-200 border-l border-slate-800/60">
                      {line.accountExchangeRate}
                    </td>

                    <td className="px-3.5 py-3 border-l border-slate-800/60 font-mono font-black text-emerald-300 bg-emerald-950/15">
                      <input
                        readOnly
                        value={convertedAccAmount ? convertedAccAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        className="w-full bg-transparent font-mono font-black text-emerald-300 outline-none cursor-not-allowed"
                      />
                    </td>

                    <td className="px-3.5 py-3 bg-amber-950/15 border-l border-slate-800/60 font-mono font-bold text-amber-300">
                      {accBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-amber-500/80">{acc?.currencyCode || ''}</span>
                    </td>

                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-[11px] font-black text-amber-400">
                          {autoPrefix}
                        </span>
                        <input
                          type="text"
                          value={currentNote}
                          onChange={(e) => updateLineNote(index, e.target.value)}
                          placeholder="اكتب وتعديل البيان الفرعي بحرية…"
                          className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-100 placeholder-slate-600 transition-all duration-200 focus:scale-[1.005] focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── الشريط السفلي ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 p-4 border border-slate-700 shadow-md ring-1 ring-slate-800">
        <div className="flex items-center gap-6 text-xs font-black">
          <div className="flex items-center gap-1.5 text-slate-300 border-l border-slate-800 pl-4">
            <User className="h-4 w-4 text-emerald-400" />
            <span>المستخدم القائم بالإدخال:</span>
            <span className="font-black text-emerald-300">{entryUserName}</span>
          </div>

          <div className="text-emerald-400">
            مبلغ القيد العام: <span className="text-sm font-mono">{numericMainAmount.toLocaleString()}</span> {selectedEntryCurrency?.code}
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

      <FinancialCalculatorModal
        isOpen={isCalcOpen}
        onClose={() => setIsCalcOpen(false)}
        currencies={currencies}
      />
    </form>
  );
}
