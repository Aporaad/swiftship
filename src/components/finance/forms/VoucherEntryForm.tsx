/**
 * VoucherEntryForm.tsx
 * نموذج سندات القبض والصرف الستة المستقل (Receipt & Payment Vouchers)
 *
 * التحديثات الجديدة:
 * - حل وتفادي خطأ "الساق متعددة العملات تحتاج مرجع سعر صرف مثبتًا قبل الحفظ" من خلال جلب وتمرير المرجع الرسمي لسعر الصرف (id & seq) من cur_price تلقائياً لكل ساق متعددة العملات.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save, ArrowRight, ArrowLeft, Wallet, Building, User, Calendar, Calculator } from 'lucide-react';
import {
  financialEntryService,
  type FinancialEntryInput,
  type FinancialEntryLineInput,
  type FinancialPaymentDetailInput,
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
  createdAt?: string;
  updatedAt?: string;
  createdByUid?: string;
  updatedByUid?: string;
  amountOriginal?: number;
  counterpartAccountId?: string;
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
  voucherType: 'receipt' | 'payment';
  voucherSubKind?: 'cash' | 'bank' | 'multi';
  accounts: FinanceAccount[];
  currencies: FinanceCurrency[];
  modules: FinanceModule[];
  entryTypes: FinanceEntryType[];
  canCreate: boolean;
  canPost: boolean;
  createdByUid?: string;
  usersMap?: Map<string, string>;
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
  usersMap,
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

  const createdByName = useMemo(() => {
    if (editingEntry?.createdByUid) {
      return usersMap?.get(editingEntry.createdByUid) || editingEntry.createdByUid;
    }
    return createdByUid ? (usersMap?.get(createdByUid) || createdByUid) : 'مدير النظام (مستخدم الجلسة)';
  }, [createdByUid, editingEntry?.createdByUid, usersMap]);

  const updatedByName = useMemo(() => {
    if (editingEntry?.updatedByUid) {
      return usersMap?.get(editingEntry.updatedByUid) || editingEntry.updatedByUid;
    }
    return createdByUid ? (usersMap?.get(createdByUid) || createdByUid) : '—';
  }, [createdByUid, editingEntry?.updatedByUid, usersMap]);


  const isReceipt = voucherType === 'receipt';

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

  const defaultCashAccount = useMemo(() => {
    return accounts.find((a) => a.id === '1110-0003') || accounts.find((a) => a.accSubId === '111' && a.isActive && a.isPosting) || accounts[0];
  }, [accounts]);

  const defaultBankAccount = useMemo(() => {
    return accounts.find((a) => a.accSubId === '112' && a.isActive && a.isPosting) || accounts.find((a) => a.id.startsWith('112')) || accounts[0];
  }, [accounts]);

  const [entryNumber] = useState(
    () => editingEntry?.entryNumber || `${isReceipt ? 'RV' : 'PV'}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-5)}`
  );

  const [effectiveAtDisplay] = useState(
    () => editingEntry?.effectiveAt
      ? new Date(editingEntry.effectiveAt).toLocaleString('ar-YE', { dateStyle: 'medium', timeStyle: 'short' })
      : new Date().toLocaleString('ar-YE', { dateStyle: 'medium', timeStyle: 'short' })
  );
  const [effectiveAtIso] = useState(
    () => editingEntry?.effectiveAt ? new Date(editingEntry.effectiveAt).toISOString() : new Date().toISOString()
  );

  const entryUserName = useMemo(() => createdByUid || 'مدير النظام (مستخدم الجلسة)', [createdByUid]);

  const [moduleId, setModuleId] = useState(() => editingEntry?.moduleId || initialModule?.id || '');
  const [entryTypeId, setEntryTypeId] = useState(() => {
    if (editingEntry?.entryTypeId) return editingEntry.entryTypeId;
    const found = entryTypes.find((t) => t.code === targetTypeCode);
    return found?.id || entryTypes[0]?.id || '';
  });

  const [currencyId, setCurrencyId] = useState<number | ''>(() => editingEntry?.currencyOriginalNo || defaultCurrency?.id || '');
  const [voucherExchangeRate, setVoucherExchangeRate] = useState<string>('1');
  const [voucherPriceRef, setVoucherPriceRef] = useState<{ id: number; seq: number } | null>(null);

  const [cashAccountId, setCashAccountId] = useState(() => {
    if (editingEntry?.paymentDetails?.[0]?.accountId) return editingEntry.paymentDetails[0].accountId;
    return defaultCashAccount?.id || '';
  });

  const [bankAccountId, setBankAccountId] = useState(() => {
    if (editingEntry?.paymentDetails?.[1]?.accountId) return editingEntry.paymentDetails[1].accountId;
    return defaultBankAccount?.id || '';
  });

  const [otherPartyAccountId, setOtherPartyAccountId] = useState(() => {
    if (!editingEntry?.lines) return '';
    const otherLine = editingEntry.lines.find((l) => l.accountId !== cashAccountId && l.accountId !== bankAccountId);
    return otherLine?.accountId || '';
  });

  const [cashAmount, setCashAmount] = useState(() => editingEntry?.paymentDetails?.[0]?.amountOriginal || '');
  const [bankAmount, setBankAmount] = useState(() => editingEntry?.paymentDetails?.[1]?.amountOriginal || '');
  const [singleVoucherAmount, setSingleVoucherAmount] = useState(() => editingEntry?.paymentDetails?.[0]?.amountOriginal || '');

  const [bankRef, setBankRef] = useState(() => editingEntry?.paymentDetails?.[0]?.bankReference || '');
  const [description, setDescription] = useState(() => editingEntry?.description || '');
  const [notes, setNotes] = useState(() => editingEntry?.notes || '');

  const [customLineNotes, setCustomLineNotes] = useState<Record<string, string>>({});
  const [accountRatesMap, setAccountRatesMap] = useState<Record<number, { price: string; id?: number; seq?: number }>>({});

  const [saveAsPosted, setSaveAsPosted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!moduleId && initialModule?.id) setModuleId(initialModule.id);
    if (currencyId === '' && defaultCurrency?.id) setCurrencyId(defaultCurrency.id);
    const foundType = entryTypes.find((t) => t.code === targetTypeCode);
    if (foundType) setEntryTypeId(foundType.id);
  }, [currencyId, defaultCurrency?.id, entryTypes, initialModule?.id, moduleId, targetTypeCode]);

  useEffect(() => {
    if (!cashAccountId && defaultCashAccount?.id) setCashAccountId(defaultCashAccount.id);
    if (!bankAccountId && defaultBankAccount?.id) setBankAccountId(defaultBankAccount.id);
  }, [bankAccountId, cashAccountId, defaultBankAccount?.id, defaultCashAccount?.id]);

  const selectedVoucherCurrency = currencies.find((c) => c.id === currencyId) || defaultCurrency;

  useEffect(() => {
    if (!selectedVoucherCurrency || selectedVoucherCurrency.isDefault) {
      setVoucherExchangeRate('1');
      setVoucherPriceRef(null);
      return;
    }
    const fetchVoucherRate = async () => {
      const { data } = await (supabase as any)
        .from('cur_price')
        .select('id, seq, price')
        .eq('cur_no', selectedVoucherCurrency.id)
        .order('day_date', { ascending: false })
        .order('seq', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.price) {
        setVoucherExchangeRate(String(data.price));
        setVoucherPriceRef({ id: Number(data.id), seq: Number(data.seq) });
      } else {
        setVoucherExchangeRate('1');
        setVoucherPriceRef(null);
      }
    };
    void fetchVoucherRate();
  }, [selectedVoucherCurrency?.id]);

  useEffect(() => {
    const activeAccounts = [
      accounts.find((a) => a.id === cashAccountId),
      accounts.find((a) => a.id === bankAccountId),
      accounts.find((a) => a.id === otherPartyAccountId),
    ].filter(Boolean) as FinanceAccount[];

    activeAccounts.forEach((acc) => {
      if (acc.curNo === defaultCurrency?.id) {
        setAccountRatesMap((prev) => ({ ...prev, [acc.curNo]: { price: '1' } }));
      } else if (!accountRatesMap[acc.curNo]) {
        void (async () => {
          const { data } = await (supabase as any)
            .from('cur_price')
            .select('id, seq, price')
            .eq('cur_no', acc.curNo)
            .order('day_date', { ascending: false })
            .order('seq', { ascending: false })
            .limit(1)
            .maybeSingle();

          const fetchedPrice = data?.price ? String(data.price) : '1';
          const priceObj = data ? { price: fetchedPrice, id: Number(data.id), seq: Number(data.seq) } : { price: '1' };
          setAccountRatesMap((prev) => ({ ...prev, [acc.curNo]: priceObj }));
        })();
      }
    });
  }, [accounts, bankAccountId, cashAccountId, defaultCurrency?.id, otherPartyAccountId]);

  const cashAccountsList = useMemo(() => {
    return accounts.filter((a) => a.isActive && a.isPosting && (a.accSubId === '111' || a.id.startsWith('111')));
  }, [accounts]);

  const bankAccountsList = useMemo(() => {
    return accounts.filter((a) => a.isActive && a.isPosting && (a.accSubId === '112' || a.id.startsWith('112')));
  }, [accounts]);

  const totalVoucherAmount = useMemo(() => {
    if (voucherSubKind === 'multi') {
      return asNumber(cashAmount) + asNumber(bankAmount);
    }
    return asNumber(singleVoucherAmount);
  }, [bankAmount, cashAmount, singleVoucherAmount, voucherSubKind]);

  const autoAmountText = useMemo(() => {
    if (!totalVoucherAmount || totalVoucherAmount <= 0) return '';
    return amountInWords(totalVoucherAmount, selectedVoucherCurrency?.code || 'YER', 'ar');
  }, [selectedVoucherCurrency?.code, totalVoucherAmount]);

  const unifiedLegsTable = useMemo(() => {
    const firstLegLabel = !isReceipt ? 'من حـ / (صرف)' : 'إلى حـ / (قبض)';
    const firstLegTransType: 'Debit' | 'Credit' = !isReceipt ? 'Credit' : 'Debit';

    const secondLegLabel = !isReceipt ? 'إلى حـ / (المستهدف)' : 'من حـ / (المستهدف)';
    const secondLegTransType: 'Credit' | 'Debit' = !isReceipt ? 'Debit' : 'Credit';

    const numVoucherRate = asNumber(voucherExchangeRate) || 1;

    const legs: Array<{
      id: string;
      roleKind: 'cash' | 'bank' | 'other';
      label: string;
      transType: 'Debit' | 'Credit';
      accountId: string;
      accountObj?: FinanceAccount;
      rawVoucherAmount: number;
      accountConvertedAmount: number;
      autoPrefix: string;
      accountExchangeRate: string;
      priceRef?: { id: number; seq: number };
    }> = [];

    const computeConvertedAmount = (vAmount: number, accRateStr: string) => {
      const accRate = asNumber(accRateStr) || 1;
      if (accRate <= 0) return vAmount;
      return (vAmount * numVoucherRate) / accRate;
    };

    if (voucherSubKind === 'cash' || voucherSubKind === 'multi') {
      const amt = voucherSubKind === 'cash' ? asNumber(singleVoucherAmount) : asNumber(cashAmount);
      const accObj = accounts.find((a) => a.id === cashAccountId);
      const rateInfo = accObj ? (accountRatesMap[accObj.curNo] || { price: '1' }) : { price: '1' };
      const convertedAmt = computeConvertedAmount(amt, rateInfo.price);

      legs.push({
        id: 'leg-cash',
        roleKind: 'cash',
        label: firstLegLabel,
        transType: firstLegTransType,
        accountId: cashAccountId,
        accountObj: accObj,
        rawVoucherAmount: amt,
        accountConvertedAmount: convertedAmt,
        autoPrefix: firstLegTransType === 'Debit' ? 'له مقابل:' : 'عليه مقابل:',
        accountExchangeRate: rateInfo.price,
        priceRef: rateInfo.id && rateInfo.seq ? { id: rateInfo.id, seq: rateInfo.seq } : undefined,
      });
    }

    if (voucherSubKind === 'bank' || voucherSubKind === 'multi') {
      const amt = voucherSubKind === 'bank' ? asNumber(singleVoucherAmount) : asNumber(bankAmount);
      const accObj = accounts.find((a) => a.id === bankAccountId);
      const rateInfo = accObj ? (accountRatesMap[accObj.curNo] || { price: '1' }) : { price: '1' };
      const convertedAmt = computeConvertedAmount(amt, rateInfo.price);

      legs.push({
        id: 'leg-bank',
        roleKind: 'bank',
        label: firstLegLabel,
        transType: firstLegTransType,
        accountId: bankAccountId,
        accountObj: accObj,
        rawVoucherAmount: amt,
        accountConvertedAmount: convertedAmt,
        autoPrefix: firstLegTransType === 'Debit' ? 'له مقابل:' : 'عليه مقابل:',
        accountExchangeRate: rateInfo.price,
        priceRef: rateInfo.id && rateInfo.seq ? { id: rateInfo.id, seq: rateInfo.seq } : undefined,
      });
    }

    const otherAccObj = accounts.find((a) => a.id === otherPartyAccountId);
    const otherRateInfo = otherAccObj ? (accountRatesMap[otherAccObj.curNo] || { price: '1' }) : { price: '1' };
    const otherConvertedAmt = computeConvertedAmount(totalVoucherAmount, otherRateInfo.price);

    legs.push({
      id: 'leg-other',
      roleKind: 'other',
      label: secondLegLabel,
      transType: secondLegTransType,
      accountId: otherPartyAccountId,
      accountObj: otherAccObj,
      rawVoucherAmount: totalVoucherAmount,
      accountConvertedAmount: otherConvertedAmt,
      autoPrefix: secondLegTransType === 'Debit' ? 'له مقابل:' : 'عليه مقابل:',
      accountExchangeRate: otherRateInfo.price,
      priceRef: otherRateInfo.id && otherRateInfo.seq ? { id: otherRateInfo.id, seq: otherRateInfo.seq } : undefined,
    });

    return legs;
  }, [accounts, accountRatesMap, bankAccountId, bankAmount, cashAccountId, cashAmount, isReceipt, otherPartyAccountId, singleVoucherAmount, totalVoucherAmount, voucherExchangeRate, voucherSubKind]);

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

      const payloadLines: FinancialEntryLineInput[] = unifiedLegsTable.map((leg) => {
        const otherName = unifiedLegsTable.find((l) => l.id !== leg.id)?.accountObj?.nameAr || description.trim();
        const customNote = customLineNotes[leg.id] !== undefined ? customLineNotes[leg.id] : `${otherName} ${description.trim()}`;
        const fullLineDesc = `${leg.autoPrefix} ${customNote}`.trim();

        const lineAmountInAccountCurrency = Number(leg.accountConvertedAmount.toFixed(5));
        const lineAmountOriginal = leg.rawVoucherAmount;

        const accCurCode = currencies.find((c) => c.id === leg.accountObj?.curNo)?.code || 'YER';
        const lineAmountText = amountInWords(lineAmountInAccountCurrency, accCurCode, 'ar');
        const lineAmountOriginalText = autoAmountText;

        return {
          accountId: leg.accountId,
          accountCurNo: leg.accountObj?.curNo || selectedVoucherCurrency.id,
          accountCurrencyPrice: leg.priceRef || undefined,
          transType: leg.transType,
          amount: lineAmountInAccountCurrency,
          amountText: lineAmountText,
          amountOriginal: lineAmountOriginal,
          amountOriginalText: lineAmountOriginalText,
          currencyOriginalNo: selectedVoucherCurrency.id,
          currencyPrice: voucherPriceRef || undefined,
          description: fullLineDesc,
        };
      });

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

  const [isCalcOpen, setIsCalcOpen] = useState(false);

  return (
    <form onSubmit={submit} className="space-y-6" dir="rtl">
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-500/50 bg-rose-500/15 p-4 text-xs font-bold text-rose-200 shadow-md">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* ── أولاً: حقول السند العامة ── */}
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-md ring-1 ring-slate-800 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-300">رقم السند (محمي تلقائياً)</label>
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
            <label className="block text-xs font-black text-slate-300 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-cyan-400" />
              <span>تاريخ ووقت السند</span>
            </label>
            <input
              readOnly
              value={effectiveAtDisplay}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-cyan-200 outline-none cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300">الفئة المالية</label>
            <input
              readOnly
              value={isReceipt ? 'المقبوضات المالية' : 'المصروفات والمدفوعات'}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300">نوع السند</label>
            <input
              readOnly
              value={targetTypeName}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-amber-300 outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs font-black text-slate-200">
              عملة السند وسعر صرفها
            </label>
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
                value={voucherExchangeRate}
                onChange={(e) => setVoucherExchangeRate(e.target.value)}
                title="سعر صرف عملة السند مقابل عملة النظام"
                className="w-20 rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-center font-mono text-xs font-bold text-cyan-200 transition-all duration-200 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-200">
              إجمالي مبلغ السند ({selectedVoucherCurrency?.code})
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
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base font-mono font-black text-emerald-400 transition-all duration-200 focus:scale-[1.01] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
              />
            )}
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
            <label className="block text-xs font-black text-slate-200">البيان العام الشامل للسند</label>
            <input
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`شرح ورقي شافي لـ${targetTypeName}…`}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 transition-all duration-200 focus:scale-[1.008] focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ── ثانياً: جدول أطراف السند المدمج مع تثبيت مرجع سعر الصرف ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-950 shadow-lg ring-1 ring-slate-800 space-y-0">
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-100 flex items-center gap-2">
            <span>جدول أطراف السند المدمج ومصارفة الحسابات</span>
            <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] text-cyan-300 font-mono">
              {!isReceipt ? 'الصرف: من حـ (الصندوق/البنك) ← إلى حـ (المستهدف)' : 'القبض: من حـ (المستهدف) ← إلى حـ (الصندوق/البنك)'}
            </span>
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-700/80">
              <tr>
                <th className="px-3.5 py-3 w-36 text-center border-l border-slate-800">صيغة الطرف (من/إلى)</th>
                <th className="px-3.5 py-3 w-56 border-l border-slate-800">اختيار الحساب المالي</th>
                <th className="px-3.5 py-3 min-w-[160px] border-l border-slate-800">اسم الحساب</th>
                <th className="px-3.5 py-3 w-28 text-center border-l border-slate-800">عملة الحساب الأصلية</th>
                <th className="px-3.5 py-3 w-32 text-center border-l border-slate-800">سعر صرف عملة الحساب</th>
                <th className="px-3.5 py-3 w-40 bg-emerald-950/30 text-emerald-300 border-l border-slate-800">المبلغ بعملة الحساب (مصارفةً)</th>
                <th className="px-3.5 py-3 w-36 bg-amber-950/20 text-amber-300 border-l border-slate-800">رصيد الحساب الحقيقي</th>
                <th className="px-3.5 py-3">البيان الفرعي (قابل للتعديل)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {unifiedLegsTable.map((leg) => {
                const isDebit = leg.transType === 'Debit';
                const accBalance = leg.accountObj?.balance !== undefined ? leg.accountObj.balance : 0;
                const otherLegAcc = unifiedLegsTable.find((l) => l.id !== leg.id)?.accountObj;
                const currentCustomNote = customLineNotes[leg.id] !== undefined ? customLineNotes[leg.id] : `${otherLegAcc?.nameAr || description.trim() || ''}`;

                return (
                  <tr key={leg.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="px-3.5 py-3 text-center border-l border-slate-800/60">
                      <div className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black border ${isDebit ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        }`}>
                        {isDebit ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
                        <span>{leg.label}</span>
                      </div>
                    </td>

                    <td className="px-3.5 py-3 border-l border-slate-800/60">
                      {leg.roleKind === 'cash' ? (
                        <AccountPickerModal
                          accounts={cashAccountsList}
                          selectedAccountId={cashAccountId}
                          label="اختيار حساب الصندوق"
                          placeholder="اختر الصندوق…"
                          onSelect={setCashAccountId}
                        />
                      ) : leg.roleKind === 'bank' ? (
                        <div className="space-y-1.5">
                          <AccountPickerModal
                            accounts={bankAccountsList}
                            selectedAccountId={bankAccountId}
                            label="اختيار حساب البنك"
                            placeholder="اختر البنك…"
                            onSelect={setBankAccountId}
                          />
                          <input
                            type="text"
                            value={bankRef}
                            onChange={(e) => setBankRef(e.target.value)}
                            placeholder="مرجع الحوالة البنكية…"
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      ) : (
                        <AccountPickerModal
                          accounts={accounts.filter((a) => a.isActive && a.isPosting)}
                          selectedAccountId={otherPartyAccountId}
                          label="اختيار الحساب المستهدف"
                          placeholder="اختر الحساب المستهدف…"
                          onSelect={setOtherPartyAccountId}
                        />
                      )}
                    </td>

                    <td className="px-3.5 py-3 font-bold text-slate-100 border-l border-slate-800/60">
                      {leg.accountObj ? leg.accountObj.nameAr : <span className="text-slate-500 italic">اختر الحساب</span>}
                    </td>

                    <td className="px-3.5 py-3 text-center font-mono font-black text-cyan-300 border-l border-slate-800/60">
                      {leg.accountObj?.currencyCode || '—'}
                    </td>

                    <td className="px-3.5 py-3 text-center font-mono font-bold text-cyan-200 border-l border-slate-800/60">
                      {leg.accountExchangeRate}
                    </td>

                    <td className="px-3.5 py-3 border-l border-slate-800/60 font-mono font-black text-emerald-300 bg-emerald-950/15">
                      {voucherSubKind === 'multi' && leg.roleKind === 'cash' ? (
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={cashAmount}
                          onChange={(e) => setCashAmount(e.target.value)}
                          placeholder="مبلغ الصندوق"
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-mono font-bold text-emerald-300 focus:border-emerald-500 focus:outline-none"
                        />
                      ) : voucherSubKind === 'multi' && leg.roleKind === 'bank' ? (
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={bankAmount}
                          onChange={(e) => setBankAmount(e.target.value)}
                          placeholder="مبلغ البنك"
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-mono font-bold text-cyan-300 focus:border-cyan-500 focus:outline-none"
                        />
                      ) : (
                        <input
                          readOnly
                          value={leg.accountConvertedAmount ? leg.accountConvertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          className="w-full bg-transparent font-mono font-black text-emerald-300 outline-none cursor-not-allowed"
                        />
                      )}
                    </td>

                    <td className="px-3.5 py-3 bg-amber-950/15 border-l border-slate-800/60 font-mono font-bold text-amber-300">
                      {accBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-amber-500/80">{leg.accountObj?.currencyCode || ''}</span>
                    </td>

                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-[11px] font-black text-amber-400">
                          {leg.autoPrefix}
                        </span>
                        <input
                          type="text"
                          value={currentCustomNote}
                          onChange={(e) => setCustomLineNotes((prev) => ({ ...prev, [leg.id]: e.target.value }))}
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
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <User className="h-4 w-4 text-emerald-400" />
          <span>المستخدم القائم بالإدخال:</span>
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

      {/* ── التفاصيل الزمنية أسفل المستند / السند ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5 shadow-inner">

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-slate-500">تم الإنشاء في</span>
            <span className="font-mono font-bold text-slate-200">
              {editingEntry?.createdAt ? new Date(editingEntry.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-slate-500">تم الإنشاء بواسطة</span>
            <span className="font-black text-[#f4d870]">{createdByName}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-slate-500">تم التحديث في</span>
            <span className="font-mono font-bold text-slate-200">
              {editingEntry?.updatedAt ? new Date(editingEntry.updatedAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-slate-500">تم التحديث بواسطة</span>
            <span className="font-black text-cyan-300">{updatedByName}</span>
          </div>
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
