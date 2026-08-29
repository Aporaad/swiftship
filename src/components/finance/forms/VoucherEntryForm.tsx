/**
 * VoucherEntryForm.tsx
 * نموذج سندات القبض والصرف (Receipt & Payment Vouchers)
 *
 * التحديثات الجديدة:
 * 1. إظهار حقل تاريخ ووقت السند (effectiveAt) في التفاصيل العلوية.
 * 2. تقوية التباين البصري، وألوان الحدود والإطارات والفواصل بين الأطراف المحاسبية.
 * 3. تحديد أطراف الصندوق والبنك والطرف الآخر بدون خيار "آجل".
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save, ArrowRight, ArrowLeft, Wallet, Building, CreditCard, Calendar } from 'lucide-react';
import {
  financialEntryService,
  type FinancialEntryInput,
  type FinancialEntryLineInput,
  type FinancialPaymentDetailInput,
  type FinancialPaymentMethod,
} from '../../../services/financialEntryService';
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

export interface EditableVoucherDraft {
  id: string;
  entryNumber: string;
  moduleId: string;
  entryTypeId: string;
  currencyOriginalNo: number;
  description: string;
  notes?: string;
  amountText?: string;
  effectiveAt?: string;
  paymentMethod?: FinancialPaymentMethod;
  paymentDetails?: Array<{
    id: string;
    paymentMethod: Exclude<FinancialPaymentMethod, 'mixed'>;
    accountId: string;
    amountOriginal: string;
    bankReference: string;
    note: string;
  }>;
  lines: Array<{
    id: string;
    accountId: string;
    transType: 'Debit' | 'Credit';
    amountOriginal: string;
  }>;
}

interface VoucherEntryFormProps {
  voucherType: 'receipt' | 'payment'; // سند قبض أم سند صرف
  accounts: FinanceAccount[];
  currencies: FinanceCurrency[];
  modules: FinanceModule[];
  entryTypes: FinanceEntryType[];
  canCreate: boolean;
  canPost: boolean;
  createdByUid?: string;
  initialModuleCode?: string;
  initialTypeCode?: string;
  editingEntry?: EditableVoucherDraft;
  onSaved: () => void;
  onCancel: () => void;
}

const asNumber = (val: string) => Number(val || 0);

const VOUCHER_METHODS: Array<{ id: Exclude<FinancialPaymentMethod, 'deferred'>; label: string; icon: any }> = [
  { id: 'cash', label: 'نقدًا (صندوق)', icon: Wallet },
  { id: 'bank', label: 'بنك / حوالة مصرفية', icon: Building },
  { id: 'mixed', label: 'مختلط', icon: CreditCard },
];

export default function VoucherEntryForm({
  voucherType,
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
}: VoucherEntryFormProps) {
  const defaultCurrency = useMemo(
    () => currencies.find((c) => c.isDefault) || currencies[0],
    [currencies]
  );
  const initialModule = useMemo(
    () => modules.find((m) => m.code === initialModuleCode) || modules[0],
    [modules, initialModuleCode]
  );

  const isReceipt = voucherType === 'receipt';

  // ── حالات نموذج السند وتاريخ السند ──
  const [entryNumber, setEntryNumber] = useState(
    () => editingEntry?.entryNumber || `${isReceipt ? 'RV' : 'PV'}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-5)}`
  );
  const [effectiveAt, setEffectiveAt] = useState<string>(
    () => editingEntry?.effectiveAt
      ? new Date(editingEntry.effectiveAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );

  const [moduleId, setModuleId] = useState(() => editingEntry?.moduleId || '');
  const [entryTypeId, setEntryTypeId] = useState(() => editingEntry?.entryTypeId || '');
  const [currencyId, setCurrencyId] = useState<number | ''>(() => editingEntry?.currencyOriginalNo || defaultCurrency?.id || '');

  const [paymentMethod, setPaymentMethod] = useState<Exclude<FinancialPaymentMethod, 'deferred'>>('cash');
  const [cashBankAccountId, setCashBankAccountId] = useState(() => editingEntry?.paymentDetails?.[0]?.accountId || '');
  const [otherPartyAccountId, setOtherPartyAccountId] = useState(() => {
    if (!editingEntry?.lines) return '';
    const pAcc = editingEntry.paymentDetails?.[0]?.accountId;
    const other = editingEntry.lines.find((l) => l.accountId !== pAcc);
    return other?.accountId || '';
  });

  const [amount, setAmount] = useState(() => editingEntry?.paymentDetails?.[0]?.amountOriginal || '');
  const [bankRef, setBankRef] = useState(() => editingEntry?.paymentDetails?.[0]?.bankReference || '');
  const [description, setDescription] = useState(() => editingEntry?.description || '');
  const [notes, setNotes] = useState(() => editingEntry?.notes || '');

  const [saveAsPosted, setSaveAsPosted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const selectedCurrency = currencies.find((c) => c.id === currencyId) || defaultCurrency;

  const cashBankAccounts = useMemo(() => {
    return accounts.filter(
      (a) =>
        a.isActive &&
        a.isPosting &&
        (paymentMethod === 'cash' ? a.accSubId === '111' : paymentMethod === 'bank' ? a.accSubId === '112' : true)
    );
  }, [accounts, paymentMethod]);

  const autoAmountText = useMemo(() => {
    const num = asNumber(amount);
    if (!num || num <= 0) return '';
    return amountInWords(num, selectedCurrency?.code || 'YER', 'ar');
  }, [amount, selectedCurrency?.code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!canCreate) return setError(`ليس لديك تصريح إنشاء سندات ${isReceipt ? 'القبض' : 'الصرف'}.`);
    if (!selectedCurrency || !entryTypeId || !moduleId || !description.trim()) {
      return setError('أكمل رقم السند والفئة والنوع والعملة والبيان.');
    }
    if (!cashBankAccountId) {
      return setError('يرجى اختيار حساب الصندوق أو البنك للعملية المالية.');
    }
    if (!otherPartyAccountId) {
      return setError('يرجى اختيار حساب الطرف الآخر (المستفيد / الدائن).');
    }
    const numAmount = asNumber(amount);
    if (numAmount <= 0) {
      return setError('يرجى إدخال مبلغ موجب صحيح للسند.');
    }

    try {
      setSaving(true);

      const cashBankTransType: 'Debit' | 'Credit' = isReceipt ? 'Debit' : 'Credit';
      const otherPartyTransType: 'Debit' | 'Credit' = isReceipt ? 'Credit' : 'Debit';

      const cashBankAccObj = accounts.find((a) => a.id === cashBankAccountId)!;
      const otherPartyAccObj = accounts.find((a) => a.id === otherPartyAccountId)!;

      const payloadLines: FinancialEntryLineInput[] = [
        {
          accountId: cashBankAccObj.id,
          accountCurNo: cashBankAccObj.curNo,
          transType: cashBankTransType,
          amount: numAmount,
          amountOriginal: numAmount,
          description: description.trim(),
        },
        {
          accountId: otherPartyAccObj.id,
          accountCurNo: otherPartyAccObj.curNo,
          transType: otherPartyTransType,
          amount: numAmount,
          amountOriginal: numAmount,
          description: description.trim(),
        },
      ];

      const paymentDetail: FinancialPaymentDetailInput = {
        paymentMethod: paymentMethod === 'mixed' ? 'cash' : paymentMethod,
        accountId: cashBankAccObj.id,
        amountOriginal: numAmount,
        bankReference: bankRef.trim() || undefined,
      };

      const entryPayload: FinancialEntryInput = {
        entryNumber: entryNumber.trim(),
        moduleId,
        entryTypeId,
        entryCategory: 'General',
        postingStatus: saveAsPosted ? 'posted' : 'draft',
        amountOriginal: numAmount,
        amountText: autoAmountText,
        currencyOriginalNo: selectedCurrency.id,
        description: description.trim(),
        notes,
        effectiveAt: new Date(effectiveAt).toISOString(),
        paymentMethod,
        paymentDetails: [paymentDetail],
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
      setError(err?.message || 'تعذر حفظ السند.');
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

      {/* ── الرأس والمعلومات الأساسية للسند وتاريخ ووقت السند ── */}
      <div className="grid gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-md sm:grid-cols-2 lg:grid-cols-5 ring-1 ring-slate-800">
        <div>
          <label className="block text-xs font-black text-slate-200">رقم السند</label>
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
            <span>تاريخ ووقت السند</span>
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
          <label className="block text-xs font-black text-slate-200">نوع السند</label>
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
          <label className="block text-xs font-black text-slate-200">عملة السند</label>
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

      {/* ── طريقة الدفع والمبلغ والتفقيط ببروز بصري قوي ── */}
      <div className="grid gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-md md:grid-cols-3 ring-1 ring-slate-800">
        <div>
          <label className="block text-xs font-black text-slate-200 mb-1.5">طريقة الدفع</label>
          <div className="grid grid-cols-3 gap-2">
            {VOUCHER_METHODS.map((m) => {
              const Icon = m.icon;
              const isSelected = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(m.id);
                    setCashBankAccountId('');
                  }}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition shadow-sm ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/50'
                      : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 mb-1" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-200">مبلغ السند ({selectedCurrency?.code})</label>
          <input
            required
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-base font-mono font-black text-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none"
          />
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
      </div>

      {/* ── أطراف السند المحاسبية (صندوق/بنك + الطرف الآخر) بتحديد حدود بارز ── */}
      <div className="space-y-4 rounded-2xl border border-slate-700/90 bg-slate-950 p-5 shadow-lg ring-1 ring-slate-800">
        <h4 className="text-xs font-black text-slate-100 border-b border-slate-700 pb-2.5">
          أطراف {isReceipt ? 'سند القبض' : 'سند الصرف'} المحاسبية
        </h4>

        <div className="grid gap-4 md:grid-cols-2">
          {/* 1. طرف الصندوق / البنك */}
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-sm">
            <div className="mb-2.5 flex items-center justify-between">
              <span className={`text-xs font-black flex items-center gap-1.5 ${isReceipt ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isReceipt ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                {isReceipt ? 'من حـ (مدين)' : 'إلى حـ (دائن)'} — الصندوق / البنك
              </span>
              <span className="text-[10px] font-bold text-slate-400">حساب وسيط الدفع</span>
            </div>

            <AccountPickerModal
              accounts={cashBankAccounts}
              selectedAccountId={cashBankAccountId}
              label="اختر حساب الصندوق أو البنك"
              placeholder="اختر حساب الصندوق / البنك…"
              onSelect={setCashBankAccountId}
            />

            {paymentMethod === 'bank' && (
              <div className="mt-3">
                <label className="block text-[11px] font-bold text-slate-300">مرجع الحوالة / العملية البنكية</label>
                <input
                  type="text"
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                  placeholder="رقم العملية أو الحوالة…"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* 2. طرف الحساب الآخر */}
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-sm">
            <div className="mb-2.5 flex items-center justify-between">
              <span className={`text-xs font-black flex items-center gap-1.5 ${isReceipt ? 'text-amber-400' : 'text-emerald-400'}`}>
                {!isReceipt ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                {!isReceipt ? 'من حـ (مدين)' : 'إلى حـ (دائن)'} — الطرف الآخر
              </span>
              <span className="text-[10px] font-bold text-slate-400">الحساب المستفيد / الدافع</span>
            </div>

            <AccountPickerModal
              accounts={accounts.filter((a) => a.isActive && a.isPosting)}
              selectedAccountId={otherPartyAccountId}
              label="اختر حساب الطرف الآخر"
              placeholder="اختر حساب المستفيد / الطرف الآخر…"
              onSelect={setOtherPartyAccountId}
            />
          </div>
        </div>
      </div>

      {/* ── البيان العام والملاحظات ── */}
      <div className="grid gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-md md:grid-cols-2 ring-1 ring-slate-800">
        <div>
          <label className="block text-xs font-black text-slate-200">البيان الشامل للسند</label>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`وصف ورقي لـ${isReceipt ? 'سند القبض' : 'سند الصرف'}…`}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-200">ملاحظات إضافية</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات اختيارية…"
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* ── الشريط السفلي ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 p-4 border border-slate-700 shadow-md ring-1 ring-slate-800">
        <div className="text-xs font-black text-emerald-400">
          مبلغ {isReceipt ? 'القبض' : 'الصرف'}: <span className="text-sm font-mono">{asNumber(amount).toLocaleString()}</span> {selectedCurrency?.code}
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
            <span>اعتماد وترحيل السند مباشرة</span>
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
            {saving ? 'جارٍ الحفظ…' : editingEntry ? 'حفظ التعديل' : `حفظ ${isReceipt ? 'سند القبض' : 'سند الصرف'}`}
          </button>
        </div>
      </div>
    </form>
  );
}
