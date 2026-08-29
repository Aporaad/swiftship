/**
 * VoucherEntryForm.tsx
 * نموذج سندات القبض والصرف الستة المستقل (Receipt & Payment Vouchers)
 *
 * النماذج الستة المدعومة:
 * 1) سند صرف نقدي   (PAYMENT_CASH)
 * 2) سند صرف بنكي   (PAYMENT_BANK)
 * 3) سند صرف متعدد  (PAYMENT_MULTI)
 * 4) سند قبض نقدي   (RECEIPT_CASH)
 * 5) سند قبض بنكي   (RECEIPT_BANK)
 * 6) سند قبض متعدد  (RECEIPT_MULTI)
 *
 * التقسيم الهيكلي:
 * أولاً: حقول السند العامة (رقم السند | التاريخ | اسم المستخدم المدخل | الفئة | نوع السند) غير قابلة للتعديل.
 *        بالإضافة لـ (مبلغ السند | عملة السند | سعر الصرف | التفقيط التلقائي).
 *        حذف حقول طرق الدفع السابقة نهائياً.
 * ثانياً: حقول أطراف السند (الطرف الأول: صندوق/بنك افتراضي تلقائياً | الطرف الثاني: الحساب المستهدف).
 * ثالثاً: جدول الأطراف بحقول: (دائن/مدين | رقم الحساب | اسم الحساب | عملة الحساب | سعر الصرف | المبلغ | رصيد الحساب الحقيقي).
 * رابعاً: إظهار اسم المستخدم المدخل أسفل القيد.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save, ArrowRight, ArrowLeft, Wallet, Building, Layers, User, Calendar } from 'lucide-react';
import {
  financialEntryService,
  type FinancialEntryInput,
  type FinancialEntryLineInput,
  type FinancialPaymentDetailInput,
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
  balance?: number;
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
  paymentDetails?: Array<{
    id: string;
    paymentMethod: 'cash' | 'bank';
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
    lineDescription?: string;
  }>;
}

interface VoucherEntryFormProps {
  voucherType: 'receipt' | 'payment'; // قبض أم صرف
  voucherSubKind?: 'cash' | 'bank' | 'multi'; // نقدي / بنكي / متعدد
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

export default function VoucherEntryForm({
  voucherType,
  voucherSubKind = 'cash',
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

  // ── تحديد كود اسم واسم نوع السند التلقائي المخصص ──
  const targetTypeCode = useMemo(() => {
    if (isReceipt) {
      return voucherSubKind === 'cash' ? 'RECEIPT_CASH' : voucherSubKind === 'bank' ? 'RECEIPT_BANK' : 'RECEIPT_MULTI';
    }
    return voucherSubKind === 'cash' ? 'PAYMENT_CASH' : voucherSubKind === 'bank' ? 'PAYMENT_BANK' : 'PAYMENT_MULTI';
  }, [isReceipt, voucherSubKind]);

  const targetTypeName = useMemo(() => {
    if (isReceipt) {
      return voucherSubKind === 'cash' ? 'سند قبض نقدي' : voucherSubKind === 'bank' ? 'سند قبض بنكي' : 'سند قبض متعدد';
    }
    return voucherSubKind === 'cash' ? 'سند صرف نقدي' : voucherSubKind === 'bank' ? 'سند صرف بنكي' : 'سند صرف متعدد';
  }, [isReceipt, voucherSubKind]);

  // ── جلب حساب الصندوق الافتراضي وحساب البنك الافتراضي ──
  const defaultCashAccount = useMemo(() => {
    // نحدد حساب 1110-0003 أو أي حساب صناديق بمجموعة 111
    return accounts.find((a) => a.id === '1110-0003') || accounts.find((a) => a.accSubId === '111' && a.isActive && a.isPosting) || accounts[0];
  }, [accounts]);

  const defaultBankAccount = useMemo(() => {
    return accounts.find((a) => a.accSubId === '112' && a.isActive && a.isPosting) || accounts.find((a) => a.id.startsWith('112')) || accounts[0];
  }, [accounts]);

  // ── أولاً: حقول السند العامة (Read-only Header Fields) ──
  const [entryNumber] = useState(
    () => editingEntry?.entryNumber || `${isReceipt ? 'RV' : 'PV'}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-5)}`
  );

  // تاريخ ووقت السند (تلقائي وغير قابل للتعديل)
  const [effectiveAtDisplay] = useState(
    () => editingEntry?.effectiveAt
      ? new Date(editingEntry.effectiveAt).toLocaleString('ar-YE', { dateStyle: 'medium', timeStyle: 'short' })
      : new Date().toLocaleString('ar-YE', { dateStyle: 'medium', timeStyle: 'short' })
  );
  const [effectiveAtIso] = useState(
    () => editingEntry?.effectiveAt ? new Date(editingEntry.effectiveAt).toISOString() : new Date().toISOString()
  );

  // اسم المستخدم المدخل التلقائي
  const entryUserName = useMemo(() => createdByUid || 'مدير النظام (مستخدم الجلسة)', [createdByUid]);

  const [moduleId, setModuleId] = useState(() => editingEntry?.moduleId || initialModule?.id || '');
  const [entryTypeId, setEntryTypeId] = useState(() => {
    if (editingEntry?.entryTypeId) return editingEntry.entryTypeId;
    const found = entryTypes.find((t) => t.code === targetTypeCode);
    return found?.id || entryTypes[0]?.id || '';
  });

  const [currencyId, setCurrencyId] = useState<number | ''>(() => editingEntry?.currencyOriginalNo || defaultCurrency?.id || '');
  const [exchangeRate, setExchangeRate] = useState<string>('1');

  // ── ثانياً: حقول أطراف السند (Leg Parties) ──
  // 1. حساب الصندوق (للنقدي والمتعدد)
  const [cashAccountId, setCashAccountId] = useState(() => {
    if (editingEntry?.paymentDetails?.[0]?.accountId) return editingEntry.paymentDetails[0].accountId;
    return defaultCashAccount?.id || '';
  });

  // 2. حساب البنك (للبنكي والمتعدد)
  const [bankAccountId, setBankAccountId] = useState(() => {
    if (editingEntry?.paymentDetails?.[1]?.accountId) return editingEntry.paymentDetails[1].accountId;
    return defaultBankAccount?.id || '';
  });

  // 3. حساب الطرف الآخر (المستهدف)
  const [otherPartyAccountId, setOtherPartyAccountId] = useState(() => {
    if (!editingEntry?.lines) return '';
    const otherLine = editingEntry.lines.find((l) => l.accountId !== cashAccountId && l.accountId !== bankAccountId);
    return otherLine?.accountId || '';
  });

  // المبالغ
  const [cashAmount, setCashAmount] = useState(() => editingEntry?.paymentDetails?.[0]?.amountOriginal || '');
  const [bankAmount, setBankAmount] = useState(() => editingEntry?.paymentDetails?.[1]?.amountOriginal || '');
  const [singleVoucherAmount, setSingleVoucherAmount] = useState(() => editingEntry?.paymentDetails?.[0]?.amountOriginal || '');

  const [bankRef, setBankRef] = useState(() => editingEntry?.paymentDetails?.[0]?.bankReference || '');
  const [description, setDescription] = useState(() => editingEntry?.description || '');
  const [notes, setNotes] = useState(() => editingEntry?.notes || '');

  const [saveAsPosted, setSaveAsPosted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // مزامنة الكود والأنواع
  useEffect(() => {
    if (!moduleId && initialModule?.id) setModuleId(initialModule.id);
    if (currencyId === '' && defaultCurrency?.id) setCurrencyId(defaultCurrency.id);
    const foundType = entryTypes.find((t) => t.code === targetTypeCode);
    if (foundType) setEntryTypeId(foundType.id);
  }, [currencyId, defaultCurrency?.id, entryTypes, initialModule?.id, moduleId, targetTypeCode]);

  // تعيين الحسابات الافتراضية التلقائية فور فتح النموذج
  useEffect(() => {
    if (!cashAccountId && defaultCashAccount?.id) {
      setCashAccountId(defaultCashAccount.id);
    }
    if (!bankAccountId && defaultBankAccount?.id) {
      setBankAccountId(defaultBankAccount.id);
    }
  }, [bankAccountId, cashAccountId, defaultBankAccount?.id, defaultCashAccount?.id]);

  const selectedCurrency = currencies.find((c) => c.id === currencyId) || defaultCurrency;

  // تفلترة الحسابات المالية الخاصة بالصناديق والبنوك
  const cashAccountsList = useMemo(() => {
    return accounts.filter((a) => a.isActive && a.isPosting && (a.accSubId === '111' || a.id.startsWith('111')));
  }, [accounts]);

  const bankAccountsList = useMemo(() => {
    return accounts.filter((a) => a.isActive && a.isPosting && (a.accSubId === '112' || a.id.startsWith('112')));
  }, [accounts]);

  // حساب إجمالي مبلغ السند بحسب النوع (نقدي/بنكي/متعدد)
  const totalVoucherAmount = useMemo(() => {
    if (voucherSubKind === 'multi') {
      return asNumber(cashAmount) + asNumber(bankAmount);
    }
    return asNumber(singleVoucherAmount);
  }, [bankAmount, cashAmount, singleVoucherAmount, voucherSubKind]);

  // التفقيط التلقائي لمبلغ السند
  const autoAmountText = useMemo(() => {
    if (!totalVoucherAmount || totalVoucherAmount <= 0) return '';
    return amountInWords(totalVoucherAmount, selectedCurrency?.code || 'YER', 'ar');
  }, [selectedCurrency?.code, totalVoucherAmount]);

  // ── بناء أسطر جدول الأطراف المحاسبية بدقة (دائن/مدين | رقم الحساب | اسم الحساب | عملة الحساب | سعر الصرف | المبلغ | رصيد الحساب) ──
  const legsTableData = useMemo(() => {
    // في سند القبض: الصندوق/البنك = مدين (من حـ)، الطرف الآخر = دائن (إلى حـ)
    // في سند الصرف: الصندوق/البنك = دائن (إلى حـ)، الطرف الآخر = مدين (من حـ)
    const firstLegType: 'Debit' | 'Credit' = isReceipt ? 'Debit' : 'Credit';
    const otherLegType: 'Debit' | 'Credit' = isReceipt ? 'Credit' : 'Debit';

    const legs: Array<{
      id: string;
      roleTitle: string;
      transType: 'Debit' | 'Credit';
      accountId: string;
      accountObj?: FinanceAccount;
      amount: number;
    }> = [];

    if (voucherSubKind === 'cash' || voucherSubKind === 'multi') {
      const amt = voucherSubKind === 'cash' ? asNumber(singleVoucherAmount) : asNumber(cashAmount);
      const accObj = accounts.find((a) => a.id === cashAccountId);
      legs.push({
        id: 'leg-cash',
        roleTitle: 'حساب الصندوق',
        transType: firstLegType,
        accountId: cashAccountId,
        accountObj: accObj,
        amount: amt,
      });
    }

    if (voucherSubKind === 'bank' || voucherSubKind === 'multi') {
      const amt = voucherSubKind === 'bank' ? asNumber(singleVoucherAmount) : asNumber(bankAmount);
      const accObj = accounts.find((a) => a.id === bankAccountId);
      legs.push({
        id: 'leg-bank',
        roleTitle: 'حساب البنك',
        transType: firstLegType,
        accountId: bankAccountId,
        accountObj: accObj,
        amount: amt,
      });
    }

    // الطرف الآخر المستهدف
    const otherAccObj = accounts.find((a) => a.id === otherPartyAccountId);
    legs.push({
      id: 'leg-other',
      roleTitle: 'الطرف الآخر (الحساب المستهدف)',
      transType: otherLegType,
      accountId: otherPartyAccountId,
      accountObj: otherAccObj,
      amount: totalVoucherAmount,
    });

    return legs;
  }, [accounts, bankAccountId, bankAmount, cashAccountId, cashAmount, isReceipt, otherPartyAccountId, singleVoucherAmount, totalVoucherAmount, voucherSubKind]);

  // ── الحفظ ──
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!canCreate) return setError(`ليس لديك تصريح إنشاء سندات ${isReceipt ? 'القبض' : 'الصرف'}.`);
    if (!description.trim()) return setError('يرجى إدخال بيان عام وشامل للسند.');
    if (totalVoucherAmount <= 0) return setError('يرجى إدخال مبلغ موجب صحيح للسند.');
    if (!otherPartyAccountId) return setError('يرجى تحديد حساب الطرف الآخر المستهدف.');

    if ((voucherSubKind === 'cash' || voucherSubKind === 'multi') && !cashAccountId) {
      return setError('يرجى اختيار حساب الصندوق الصالح.');
    }
    if ((voucherSubKind === 'bank' || voucherSubKind === 'multi') && !bankAccountId) {
      return setError('يرجى اختيار حساب البنك الصالح.');
    }

    try {
      setSaving(true);

      const payloadLines: FinancialEntryLineInput[] = legsTableData.map((leg) => ({
        accountId: leg.accountId,
        accountCurNo: leg.accountObj?.curNo || selectedCurrency.id,
        transType: leg.transType,
        amount: leg.amount,
        amountOriginal: leg.amount,
        description: description.trim(),
      }));

      const paymentDetails: FinancialPaymentDetailInput[] = [];
      if (voucherSubKind === 'cash' || voucherSubKind === 'multi') {
        paymentDetails.push({
          paymentMethod: 'cash',
          accountId: cashAccountId,
          amountOriginal: voucherSubKind === 'cash' ? asNumber(singleVoucherAmount) : asNumber(cashAmount),
        });
      }
      if (voucherSubKind === 'bank' || voucherSubKind === 'multi') {
        paymentDetails.push({
          paymentMethod: 'bank',
          accountId: bankAccountId,
          amountOriginal: voucherSubKind === 'bank' ? asNumber(singleVoucherAmount) : asNumber(bankAmount),
          bankReference: bankRef.trim() || undefined,
        });
      }

      const entryPayload: FinancialEntryInput = {
        entryNumber: entryNumber.trim(),
        moduleId: moduleId || initialModule?.id || 'PAYMENTS',
        entryTypeId,
        entryCategory: 'General',
        postingStatus: saveAsPosted ? 'posted' : 'draft',
        amountOriginal: totalVoucherAmount,
        amountText: autoAmountText,
        currencyOriginalNo: selectedCurrency.id,
        description: description.trim(),
        notes,
        effectiveAt: effectiveAtIso,
        paymentMethod: voucherSubKind === 'multi' ? 'mixed' : (voucherSubKind as any),
        paymentDetails,
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

      {/* ════════════════════════════════════════════
          أولاً: حقول السند العامة (General Header Fields) - غير قابلة للتعديل
          ════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-md ring-1 ring-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h4 className="text-xs font-black text-slate-100 flex items-center gap-2">
            <span>بيانات السند العامة الرسمية</span>
            <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] text-amber-400 font-mono">
              تعبئة تلقائية محميّة
            </span>
          </h4>
          <span className="text-[11px] font-bold text-slate-400">تأكيد النظام المالي</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* رقم السند (Read-only) */}
          <div>
            <label className="block text-xs font-black text-slate-300">رقم السند (تلقائي)</label>
            <input
              readOnly
              value={entryNumber}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono font-black text-amber-400 outline-none"
            />
          </div>

          {/* التاريخ والوقت (Read-only) */}
          <div>
            <label className="block text-xs font-black text-slate-300 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-cyan-400" />
              <span>التاريخ (تلقائي)</span>
            </label>
            <input
              readOnly
              value={effectiveAtDisplay}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-cyan-200 outline-none"
            />
          </div>

          {/* اسم المستخدم المدخل (Read-only) */}
          <div>
            <label className="block text-xs font-black text-slate-300 flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-emerald-400" />
              <span>المستخدم القائم بالإدخال</span>
            </label>
            <input
              readOnly
              value={entryUserName}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-emerald-300 outline-none"
            />
          </div>

          {/* الفئة (Read-only) */}
          <div>
            <label className="block text-xs font-black text-slate-300">الفئة المالية</label>
            <input
              readOnly
              value={isReceipt ? 'المقبوضات المالية' : 'المصروفات والمدفوعات'}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 outline-none"
            />
          </div>

          {/* نوع السند (Read-only) */}
          <div>
            <label className="block text-xs font-black text-slate-300">نوع السند</label>
            <input
              readOnly
              value={targetTypeName}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-amber-300 outline-none"
            />
          </div>
        </div>

        {/* حقول المبلغ وعملة السند وسعر الصرف والتفقيط */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs font-black text-slate-200">
              عملة السند
            </label>
            <select
              value={currencyId}
              onChange={(e) => setCurrencyId(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-black text-emerald-300 focus:border-cyan-500 focus:outline-none"
            >
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.isDefault ? ' (الافتراضية)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-200">
              سعر الصرف (مقابل عملة النظام)
            </label>
            <input
              type="number"
              step="any"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-200">
              إجمالي مبلغ السند ({selectedCurrency?.code})
            </label>
            {voucherSubKind === 'multi' ? (
              <input
                readOnly
                value={totalVoucherAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                className="mt-1.5 w-full rounded-xl border border-emerald-500/40 bg-emerald-950/20 px-3 py-2 text-base font-mono font-black text-emerald-300 outline-none"
              />
            ) : (
              <input
                required
                type="number"
                step="any"
                min="0"
                value={singleVoucherAmount}
                onChange={(e) => setSingleVoucherAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base font-mono font-black text-emerald-400 focus:border-emerald-500 focus:outline-none"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-black text-cyan-300">المبلغ كتابةً (تلقائي)</label>
            <input
              readOnly
              value={autoAmountText}
              placeholder="يتم التفقيط تلقائياً…"
              className="mt-1.5 w-full rounded-xl border border-cyan-500/40 bg-cyan-950/30 px-3 py-2 text-xs font-bold text-cyan-200 outline-none"
            />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          ثانياً: حقول أطراف السند (Party Legs Section)
          ════════════════════════════════════════════ */}
      <div className="space-y-4 rounded-2xl border border-slate-700/90 bg-slate-950 p-5 shadow-lg ring-1 ring-slate-800">
        <h4 className="text-xs font-black text-slate-100 border-b border-slate-700 pb-2.5 flex items-center justify-between">
          <span>أطراف {targetTypeName} المحاسبية</span>
          <span className="text-[11px] font-bold text-slate-400">
            {isReceipt ? 'الصندوق / البنك مدين والطرف الآخر دائن' : 'الصندوق / البنك دائن والطرف الآخر مدين'}
          </span>
        </h4>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 1. الطرف الأول: الصندوق / البنك / متعدد (مع جلب الحساب الافتراضي تلقائياً) */}
          <div className="space-y-3 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className={`text-xs font-black flex items-center gap-1.5 ${isReceipt ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isReceipt ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                {isReceipt ? 'من حـ (مدين)' : 'إلى حـ (دائن)'} — الطرف الأول ({voucherSubKind === 'cash' ? 'الصندوق' : voucherSubKind === 'bank' ? 'حساب البنك' : 'متعدد'})
              </span>
              <span className="text-[10px] font-bold text-slate-400">الحساب الافتراضي مُعين تلقائياً</span>
            </div>

            {/* السند النقدي: إظهار حسابات الصناديق فقط والتعيين الافتراضي */}
            {voucherSubKind === 'cash' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم الطرف (الصندوق النقدي)</label>
                <AccountPickerModal
                  accounts={cashAccountsList}
                  selectedAccountId={cashAccountId}
                  label="اختر حساب الصندوق"
                  placeholder="اختر حساب الصندوق…"
                  onSelect={setCashAccountId}
                />
              </div>
            )}

            {/* السند البنكي: إظهار حسابات البنوك فقط والتعيين الافتراضي */}
            {voucherSubKind === 'bank' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">اسم الطرف (حساب البنك)</label>
                  <AccountPickerModal
                    accounts={bankAccountsList}
                    selectedAccountId={bankAccountId}
                    label="اختر حساب البنك"
                    placeholder="اختر حساب البنك…"
                    onSelect={setBankAccountId}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400">مرجع الحوالة / العملية البنكية</label>
                  <input
                    type="text"
                    value={bankRef}
                    onChange={(e) => setBankRef(e.target.value)}
                    placeholder="رقم العملية أو الحوالة…"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* السند المتعدد: إظهار صفين لاختيار الحسابين والتوزيع */}
            {voucherSubKind === 'multi' && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">حساب الصندوق الأول</label>
                    <AccountPickerModal
                      accounts={cashAccountsList}
                      selectedAccountId={cashAccountId}
                      label="اختر حساب الصندوق"
                      placeholder="اختر الصندوق…"
                      onSelect={setCashAccountId}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ من الصندوق</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono font-bold text-emerald-300 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">حساب البنك الثاني</label>
                    <AccountPickerModal
                      accounts={bankAccountsList}
                      selectedAccountId={bankAccountId}
                      label="اختر حساب البنك"
                      placeholder="اختر البنك…"
                      onSelect={setBankAccountId}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ من البنك</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={bankAmount}
                      onChange={(e) => setBankAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono font-bold text-cyan-300 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. الطرف الثاني: الحساب المالي المستهدف (عميل/مورد/مصروفات) */}
          <div className="space-y-3 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className={`text-xs font-black flex items-center gap-1.5 ${isReceipt ? 'text-amber-400' : 'text-emerald-400'}`}>
                {!isReceipt ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                {!isReceipt ? 'من حـ (مدين)' : 'إلى حـ (دائن)'} — الطرف الثاني (الحساب المستهدف)
              </span>
              <span className="text-[10px] font-bold text-slate-400">الحساب المستفيد أو الدافع</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اختيار الحساب المالي المستهدف</label>
              <AccountPickerModal
                accounts={accounts.filter((a) => a.isActive && a.isPosting)}
                selectedAccountId={otherPartyAccountId}
                label="اختر الحساب المستهدف"
                placeholder="اختر حساب الطرف المستهدف…"
                onSelect={setOtherPartyAccountId}
              />
            </div>

            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">البيان الشامل للسند</label>
              <input
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`شرح وتوضيح ورقي لـ${targetTypeName}…`}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          ثالثاً: جدول أسطر الأطراف المحاسبية بدقة متناهية
          (دائن/مدين | رقم الحساب | اسم الحساب | عملة الحساب | سعر الصرف | المبلغ | رصيد الحساب)
          ════════════════════════════════════════════ */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-950 shadow-lg ring-1 ring-slate-800">
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-100">جدول أسطر الأطراف المحاسبية للسند</h4>
          <span className="text-[11px] font-bold text-slate-400">استعراض الأسطر المكونة للسند مع رصيد كل حساب</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-700/80">
              <tr>
                <th className="px-3.5 py-3 w-32 text-center border-l border-slate-800">الطرف (من/إلى)</th>
                <th className="px-3.5 py-3 w-48 border-l border-slate-800">رقم الحساب</th>
                <th className="px-3.5 py-3 min-w-[160px] border-l border-slate-800">اسم الحساب</th>
                <th className="px-3.5 py-3 w-28 text-center border-l border-slate-800">عملة الحساب</th>
                <th className="px-3.5 py-3 w-28 text-center border-l border-slate-800">سعر الصرف</th>
                <th className="px-3.5 py-3 w-36 border-l border-slate-800">المبلغ ({selectedCurrency?.code})</th>
                <th className="px-3.5 py-3 w-36 bg-amber-950/20 text-amber-300">رصيد الحساب الحقيقي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {legsTableData.map((leg) => {
                const isDebit = leg.transType === 'Debit';
                const accBalance = leg.accountObj?.balance !== undefined ? leg.accountObj.balance : 0;

                return (
                  <tr key={leg.id} className="hover:bg-slate-900/60 transition-colors">
                    {/* دائن / مدين */}
                    <td className="px-3.5 py-3 text-center border-l border-slate-800/60">
                      <div className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black border ${
                        isDebit
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      }`}>
                        {isDebit ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
                        <span>{isDebit ? 'من حـ (مدين)' : 'إلى حـ (دائن)'}</span>
                      </div>
                    </td>

                    {/* رقم الحساب */}
                    <td className="px-3.5 py-3 font-mono font-bold text-amber-400 border-l border-slate-800/60">
                      {leg.accountId || '—'}
                    </td>

                    {/* اسم الحساب */}
                    <td className="px-3.5 py-3 font-bold text-slate-100 border-l border-slate-800/60">
                      {leg.accountObj ? leg.accountObj.nameAr : <span className="text-slate-500 italic">غير محدد</span>}
                    </td>

                    {/* عملة الحساب */}
                    <td className="px-3.5 py-3 text-center font-mono font-black text-cyan-300 border-l border-slate-800/60">
                      {leg.accountObj?.currencyCode || selectedCurrency?.code || '—'}
                    </td>

                    {/* سعر الصرف */}
                    <td className="px-3.5 py-3 text-center font-mono text-slate-400 border-l border-slate-800/60">
                      {exchangeRate}
                    </td>

                    {/* المبلغ (غير قابل للتعديل) */}
                    <td className="px-3.5 py-3 border-l border-slate-800/60 font-mono font-black text-white">
                      <input
                        readOnly
                        value={leg.amount ? leg.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                        className="w-full bg-transparent font-mono font-bold text-white outline-none"
                      />
                    </td>

                    {/* رصيد الحساب الحقيقي */}
                    <td className="px-3.5 py-3 bg-amber-950/15 font-mono font-bold text-amber-300">
                      {accBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-amber-500/80">{leg.accountObj?.currencyCode || ''}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          رابعاً: أسفل القيد/السند - إظهار اسم المستخدم المدخل رسمياً
          ════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 p-4 border border-slate-700 shadow-md ring-1 ring-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <User className="h-4 w-4 text-emerald-400" />
          <span>المستخدم القائم بالإنشاء والتسجيل:</span>
          <span className="font-black text-emerald-300">{entryUserName}</span>
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
            {saving ? 'جارٍ الحفظ…' : editingEntry ? 'حفظ التعديل' : `حفظ ${targetTypeName}`}
          </button>
        </div>
      </div>
    </form>
  );
}
