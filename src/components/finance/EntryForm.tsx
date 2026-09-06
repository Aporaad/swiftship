/**
 * EntryForm - نموذج إنشاء/تعديل القيود المحاسبية والسندات
 *
 * يدعم وضعين:
 * 1) وضع القيد العادي (General / Compound / Temp): يعرض جدول أسطر المدين/الدائن كاملاً
 * 2) وضع السند (isVoucherMode): يعرض حقلَي حساب فقط (صندوق/بنك + طرف آخر)
 *
 * مميزات إضافية:
 * - قائمة بحث منبثقة لاختيار الحسابات (AccountPickerModal)
 * - حقل المبلغ كتابةً (amountText)
 * - حقل سعر الصرف (exchangeRate) مع حفظ السعر في cur_price
 * - صيغة "من حـ / إلى حـ" مع التمييز اللوني
 * - لا يُعرض خيار "آجل" في وضع السندات
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Save, Trash2, Plus } from 'lucide-react';
import {
  financialEntryService,
  type FinancialEntryCategory,
  type FinancialEntryInput,
  type FinancialEntryLineInput,
  type FinancialPaymentDetailInput,
  type FinancialPaymentMethod,
} from '../../services/financialEntryService';
import { supabase } from '../../lib/supabase-firebase-adapter';
import AccountPickerModal from './AccountPickerModal';

// ─────────────────────────── أنواع مشتركة ───────────────────────────

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
  entityName?: string;
}
export interface FinanceModule { id: string; code: string; nameAr: string; isActive?: boolean; }
export interface FinanceEntryType { id: string; moduleId: string; code: string; nameAr: string; isActive?: boolean; }

type FormLine = {
  id: string;
  accountId: string;
  transType: 'Debit' | 'Credit';
  amountOriginal: string;
};

type PaymentDetailForm = {
  id: string;
  paymentMethod: Exclude<FinancialPaymentMethod, 'mixed'>;
  accountId: string;
  amountOriginal: string;
  bankReference: string;
  dueAt: string;
  note: string;
};

export interface EditableEntryDraft {
  id: string;
  entryNumber: string;
  moduleId: string;
  entryTypeId: string;
  currencyOriginalNo: number;
  description: string;
  notes?: string;
  amountText?: string;
  paymentMethod?: FinancialPaymentMethod;
  paymentDetails?: PaymentDetailForm[];
  lines: Array<FormLine>;
}

// ─────────────────────────── ثوابت ───────────────────────────

/**
 * طرق الدفع المتاحة للقيود العادية
 * Methods available for general entries
 */
const ALL_METHODS: Array<{ id: FinancialPaymentMethod; label: string }> = [
  { id: 'cash',     label: 'نقدًا' },
  { id: 'bank',     label: 'بنك / حوالة' },
  { id: 'deferred', label: 'آجل' },
  { id: 'mixed',    label: 'مختلط' },
];

/**
 * طرق الدفع المتاحة للسندات (بدون "آجل")
 * Methods available for vouchers (no deferred)
 */
const VOUCHER_METHODS: Array<{ id: FinancialPaymentMethod; label: string }> = [
  { id: 'cash', label: 'نقدًا' },
  { id: 'bank', label: 'بنك / حوالة' },
  { id: 'mixed', label: 'مختلط' },
];

// ─────────────────────────── دوال مساعدة ───────────────────────────

const asNumber = (value: string) => Number(value || 0);

const createLine = (transType: 'Debit' | 'Credit'): FormLine => ({
  id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  accountId: '',
  transType,
  amountOriginal: '',
});

const createPaymentDetail = (
  paymentMethod: Exclude<FinancialPaymentMethod, 'mixed'> = 'cash',
): PaymentDetailForm => ({
  id: `payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  paymentMethod,
  accountId: '',
  amountOriginal: '',
  bankReference: '',
  dueAt: '',
  note: '',
});

/**
 * تحديد لون وتسمية الطرف (مدين/دائن) مع صيغة من-إلى
 * Determine color and label for debit/credit with from-to notation
 */
function getTransLabel(
  transType: 'Debit' | 'Credit',
  isVoucher: boolean,
  voucherType?: 'receipt' | 'payment',
): { label: string; fromTo: string; colorClass: string } {
  if (transType === 'Debit') {
    return {
      label: 'مدين',
      fromTo: 'من حـ',
      colorClass: 'text-emerald-300',
    };
  }
  return {
    label: 'دائن',
    fromTo: 'إلى حـ',
    colorClass: 'text-amber-300',
  };
}

// ─────────────────────────── الواجهة الرئيسية ───────────────────────────

interface EntryFormProps {
  /** فئة القيد: عام / مركب / مؤقت */
  category: FinancialEntryCategory;
  /** قائمة الحسابات المالية المتاحة */
  accounts: FinanceAccount[];
  /** قائمة العملات */
  currencies: FinanceCurrency[];
  /** قائمة الفئات (modules) */
  modules: FinanceModule[];
  /** قائمة أنواع القيود */
  entryTypes: FinanceEntryType[];
  /** هل يملك المستخدم صلاحية الإنشاء؟ */
  canCreate: boolean;
  /** هل يملك المستخدم صلاحية الترحيل؟ */
  canPost: boolean;
  /** معرف المستخدم المنشئ */
  createdByUid?: string;
  /** كود الفئة الافتراضية */
  initialModuleCode?: string;
  /** كود النوع الافتراضي */
  initialTypeCode?: string;
  /** بيانات القيد عند التعديل */
  editingEntry?: EditableEntryDraft;
  /** وضع السند: يُخفي جدول الأسطر ويعرض حقلَي حساب فقط */
  isVoucherMode?: boolean;
  /** نوع السند: قبض أو صرف (يحدد من هو المدين تلقائياً) */
  voucherType?: 'receipt' | 'payment';
  /** دالة تُستدعى عند الحفظ بنجاح */
  onSaved: () => void;
  /** دالة تُستدعى عند الإلغاء */
  onCancel: () => void;
}

export default function EntryForm({
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
  isVoucherMode = false,
  voucherType,
  onSaved,
  onCancel,
}: EntryFormProps) {
  // ── حالة رأس القيد ──
  const defaultCurrency = useMemo(
    () => currencies.find((c) => c.isDefault) || currencies[0],
    [currencies],
  );
  const initialModule = useMemo(
    () => modules.find((m) => m.code === initialModuleCode) || modules[0],
    [modules, initialModuleCode],
  );

  const [entryNumber, setEntryNumber] = useState(
    () => editingEntry?.entryNumber || `JV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-6)}`,
  );
  const [moduleId, setModuleId]       = useState(() => editingEntry?.moduleId || '');
  const [entryTypeId, setEntryTypeId] = useState(() => editingEntry?.entryTypeId || '');
  const [currencyId, setCurrencyId]   = useState<number | ''>(() => editingEntry?.currencyOriginalNo || '');
  const [description, setDescription] = useState(() => editingEntry?.description || '');
  const [notes, setNotes]             = useState(() => editingEntry?.notes || '');
  /** المبلغ كتابةً بالحروف مع ذكر العملة */
  const [amountText, setAmountText]   = useState(() => editingEntry?.amountText || '');
  /** سعر صرف العملة المختارة مقابل العملة الافتراضية */
  const [exchangeRate, setExchangeRate] = useState('');
  /** مرجع سعر الصرف المجلوب من قاعدة البيانات */
  const [exchangeRatePriceRef, setExchangeRatePriceRef] = useState<{ id: number; seq: number } | null>(null);

  const availableMethods = isVoucherMode ? VOUCHER_METHODS : ALL_METHODS;
  const defaultMethod: FinancialPaymentMethod = editingEntry?.paymentMethod || 'cash';

  const [paymentMethod, setPaymentMethod] = useState<FinancialPaymentMethod>(
    () => {
      // في وضع السند: لا نسمح بـ"آجل"
      if (isVoucherMode && defaultMethod === 'deferred') return 'cash';
      return defaultMethod;
    },
  );
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailForm[]>(
    () => editingEntry?.paymentDetails?.length
      ? editingEntry.paymentDetails
      : [createPaymentDetail(
          editingEntry?.paymentMethod === 'bank'
            ? 'bank'
            : 'cash',
        )],
  );

  const [saveAsPosted, setSaveAsPosted] = useState(false);

  // ── أسطر القيد ──
  const [lines, setLines] = useState<FormLine[]>(
    () => editingEntry?.lines || (
      category === 'Compound'
        ? [createLine('Debit'), createLine('Credit'), createLine('Credit')]
        : [createLine('Debit'), createLine('Credit')]
    ),
  );

  // ── حساب الطرف الآخر في وضع السند ──
  // في وضع القبض: الصندوق/البنك = مدين، الطرف الآخر = دائن
  // في وضع الصرف: الصندوق/البنك = دائن، الطرف الآخر = مدين
  const otherPartyTransType: 'Debit' | 'Credit' = voucherType === 'payment' ? 'Debit' : 'Credit';
  const cashBankTransType: 'Debit' | 'Credit'   = voucherType === 'payment' ? 'Credit' : 'Debit';

  const [otherPartyAccountId, setOtherPartyAccountId] = useState(() => {
    if (!isVoucherMode || !editingEntry?.lines) return '';
    // الطرف الآخر هو السطر الذي ليس حساب الصندوق/البنك
    const paymentAccId = editingEntry.paymentDetails?.[0]?.accountId || '';
    const otherLine = editingEntry.lines.find((l) => l.accountId !== paymentAccId);
    return otherLine?.accountId || '';
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  // ─────────────────────────── التهيئة التلقائية ───────────────────────────

  useEffect(() => {
    if (!moduleId && initialModule?.id) setModuleId(initialModule.id);
    if (currencyId === '' && defaultCurrency?.id) setCurrencyId(defaultCurrency.id);
  }, [currencyId, defaultCurrency?.id, initialModule?.id, moduleId]);

  const availableTypes = useMemo(
    () => entryTypes.filter((t) => t.moduleId === moduleId),
    [entryTypes, moduleId],
  );
  useEffect(() => {
    const preferred = availableTypes.find((t) => t.code === initialTypeCode) || availableTypes[0];
    if (preferred && !availableTypes.some((t) => t.id === entryTypeId)) {
      setEntryTypeId(preferred.id);
    }
  }, [availableTypes, entryTypeId, initialTypeCode]);

  const selectedCurrency = currencies.find((c) => c.id === currencyId);

  /**
   * جلب سعر الصرف تلقائياً عند تغيير العملة
   * Auto-fetch exchange rate when currency changes
   */
  useEffect(() => {
    if (!selectedCurrency || selectedCurrency.isDefault) {
      setExchangeRate('');
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
        setExchangeRate('');
        setExchangeRatePriceRef(null);
      }
    };
    void fetchRate();
  }, [selectedCurrency?.id]);

  // ─────────────────────────── إجماليات ───────────────────────────

  const debitTotal  = lines.filter((l) => l.transType === 'Debit').reduce((s, l) => s + asNumber(l.amountOriginal), 0);
  const creditTotal = lines.filter((l) => l.transType === 'Credit').reduce((s, l) => s + asNumber(l.amountOriginal), 0);
  const balanceDiff = debitTotal - creditTotal;
  const isBalanced = debitTotal > 0 && balanceDiff === 0;
  const balanced = isBalanced;

  // ─────────────────────────── دوال التحديث ───────────────────────────

  const updateLine = (index: number, patch: Partial<FormLine>) =>
    setLines((cur) => cur.map((l, i) => i === index ? { ...l, ...patch } : l));

  const removeLine = (index: number) => {
    if (lines.length <= (category === 'Compound' ? 3 : 2)) return;
    setLines((cur) => cur.filter((_, i) => i !== index));
  };

  const updatePaymentDetail = (index: number, patch: Partial<PaymentDetailForm>) =>
    setPaymentDetails((cur) => cur.map((d, i) => i === index ? { ...d, ...patch } : d));

  /** فلترة حسابات طريقة الدفع حسب نوعها */
  const accountsForPaymentMethod = (method: Exclude<FinancialPaymentMethod, 'mixed'>) =>
    accounts.filter(
      (acc) =>
        acc.isActive &&
        acc.isPosting &&
        (method === 'cash' ? acc.accSubId === '111' : method === 'bank' ? acc.accSubId === '112' : true),
    );

  const choosePaymentMethod = (method: FinancialPaymentMethod) => {
    setPaymentMethod(method);
    setPaymentDetails((cur) =>
      method === 'mixed'
        ? cur.length >= 2 ? cur : [createPaymentDetail('cash'), createPaymentDetail('bank')]
        : [{ ...(cur[0] || createPaymentDetail(method as any)), paymentMethod: method as any, amountOriginal: String(debitTotal) }],
    );
  };

  const resolveCrossCurrencyLine = async (
    line: FormLine,
    account: FinanceAccount,
    originalAmount: number,
  ): Promise<FinancialEntryLineInput> => resolveLinePayload(line, account, originalAmount);

  const resolveLinePayload = async (
    line: { id: string; accountId: string; transType: 'Debit' | 'Credit'; amount?: number },
    account: FinanceAccount,
    originalAmount: number,
  ): Promise<FinancialEntryLineInput> => {
    if (!selectedCurrency) throw new Error('اختر عملة رأس القيد أولًا.');
    if (account.curNo === selectedCurrency.id) {
      return {
        id: line.id,
        accountId: account.id,
        accountCurNo: account.curNo,
        currencyOriginalNo: selectedCurrency.id,
        transType: line.transType,
        amount: originalAmount,
        amountOriginal: originalAmount,
      };
    }
    const accountCurrency = currencies.find((c) => c.id === account.curNo);
    if (!accountCurrency) {
      throw new Error('عملة الحساب المالي غير معرّفة في النظام.');
    }

    const fetchPrice = async (curNo: number, curCode: string) => {
      const { data, error: priceError } = await (supabase as any)
        .from('cur_price')
        .select('id, seq, price, day_date')
        .eq('cur_no', curNo)
        .order('day_date', { ascending: false })
        .order('seq', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (priceError || !data || Number(data.price) <= 0) {
        throw new Error(`لا يوجد سعر صرف موثق لعملة ${curCode}؛ لن يُحفظ القيد.`);
      }
      return {
        price: Number(data.price),
        reference: { id: Number(data.id), seq: Number(data.seq) },
      };
    };

    if (!selectedCurrency.isDefault && !accountCurrency.isDefault) {
      const [priceOriginal, priceAccount] = await Promise.all([
        fetchPrice(selectedCurrency.id, selectedCurrency.code),
        fetchPrice(accountCurrency.id, accountCurrency.code),
      ]);
      const amountInDefaultCurrency = originalAmount * priceOriginal.price;
      const accountAmount = priceAccount.price > 0 ? amountInDefaultCurrency / priceAccount.price : originalAmount;
      return {
        id: line.id,
        accountId: account.id,
        accountCurNo: account.curNo,
        currencyOriginalNo: selectedCurrency.id,
        transType: line.transType,
        amount: Number(accountAmount.toFixed(4)),
        amountOriginal: originalAmount,
        currencyPrice: priceOriginal.reference,
        accountCurrencyPrice: priceAccount.reference,
      };
    }

    // استخدام السعر المُعدَّل يدوياً إن وُجد، وإلا جلبه من قاعدة البيانات
    const pricedCurrency = selectedCurrency.isDefault ? accountCurrency : selectedCurrency;
    let priceValue: number;
    let priceRef: { id: number; seq: number };

    if (exchangeRate && exchangeRatePriceRef && Number(exchangeRate) > 0) {
      priceValue = Number(exchangeRate);
      priceRef = exchangeRatePriceRef;
    } else {
      const fetched = await fetchPrice(pricedCurrency.id, pricedCurrency.code);
      priceValue = fetched.price;
      priceRef = fetched.reference;
    }

    const accountAmount = selectedCurrency.isDefault
      ? originalAmount / priceValue
      : originalAmount * priceValue;

    return {
      id: line.id,
      accountId: account.id,
      accountCurNo: account.curNo,
      currencyOriginalNo: selectedCurrency.id,
      transType: line.transType,
      amount: Number(accountAmount.toFixed(4)),
      amountOriginal: originalAmount,
      currencyPrice: priceRef,
    };
  };

  // ─────────────────────────── بناء أسطر السند (وضع السند المبسط) ───────────────────────────

  /**
   * في وضع السند: يُبنى سطرا القيد تلقائياً من:
   * - حساب الصندوق/البنك (من تفاصيل الدفع)
   * - حساب الطرف الآخر (يختاره المستخدم)
   */
  const buildVoucherLines = (): FormLine[] => {
    const cashBankAccountId = paymentDetails[0]?.accountId || '';
    const amount = String(asNumber(paymentDetails[0]?.amountOriginal || '0') || debitTotal || 0);
    return [
      {
        id: lines[0]?.id || `line-${Date.now()}-a`,
        accountId: cashBankAccountId,
        transType: cashBankTransType,
        amountOriginal: amount,
      },
      {
        id: lines[1]?.id || `line-${Date.now()}-b`,
        accountId: otherPartyAccountId,
        transType: otherPartyTransType,
        amountOriginal: amount,
      },
    ];
  };

  // ─────────────────────────── حفظ سعر الصرف في cur_price ───────────────────────────

  /**
   * إذا عدّل المستخدم سعر الصرف وحفظ القيد، نسجّل السعر الجديد في cur_price
   * If user modified exchange rate, save it to cur_price table
   */
  const saveExchangeRateIfModified = async () => {
    if (!selectedCurrency || selectedCurrency.isDefault) return;
    if (!exchangeRate || Number(exchangeRate) <= 0) return;
    // نتحقق إن كان السعر مختلفاً عن آخر سعر مجلوب
    const { data: existing } = await (supabase as any)
      .from('cur_price')
      .select('id, seq, price')
      .eq('cur_no', selectedCurrency.id)
      .order('day_date', { ascending: false })
      .order('seq', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && Number(existing.price) === Number(exchangeRate)) return; // لا تغيير
    // إدراج سعر جديد
    await (supabase as any).from('cur_price').insert({
      cur_no:   selectedCurrency.id,
      price:    Number(exchangeRate),
      day_date: new Date().toISOString().slice(0, 10),
    });
  };

  // ─────────────────────────── الإرسال ───────────────────────────

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!canCreate) return setError('ليس لديك تصريح إنشاء هذا النوع من القيود.');
    if (!selectedCurrency || !entryTypeId || !moduleId || !description.trim()) {
      return setError('أكمل رقم القيد والفئة والنوع والعملة والبيان.');
    }
    if (saveAsPosted && !canPost) return setError('ليس لديك تصريح اعتماد وترحيل القيد.');
    if (paymentMethod === 'mixed' && category !== 'Compound') {
      return setError('الدفع المختلط يحتاج قيدًا مركبًا لتمثيل كل حساب قبض أو صرف بساق مستقل.');
    }

    try {
      setSaving(true);

      // في وضع السند: بناء الأسطر تلقائياً
      const effectiveLines = isVoucherMode ? buildVoucherLines() : lines;

      // التحقق من صحة أسطر السند
      if (isVoucherMode) {
        const cashBankAccId = paymentDetails[0]?.accountId;
        if (!cashBankAccId) return setError('اختر حساب الصندوق أو البنك في تفاصيل الدفع.');
        if (!otherPartyAccountId) return setError('اختر حساب الطرف الآخر.');
        const amount = asNumber(paymentDetails[0]?.amountOriginal || '0');
        if (amount <= 0) return setError('أدخل مبلغاً موجباً صحيحاً.');
      } else {
        // التحقق من توازن القيد العادي
        const debit  = effectiveLines.filter((l) => l.transType === 'Debit').reduce((s, l) => s + asNumber(l.amountOriginal), 0);
        const credit = effectiveLines.filter((l) => l.transType === 'Credit').reduce((s, l) => s + asNumber(l.amountOriginal), 0);
        if (debit === 0 || debit !== credit) {
          return setError('لا يمكن الحفظ: مجموع المدين والدائن غير متساوٍ بعملة رأس القيد.');
        }
      }

      const payloadLines = await Promise.all(
        effectiveLines.map(async (line) => {
          const account = accounts.find((a) => a.id === line.accountId);
          const amountOriginal = asNumber(line.amountOriginal);
          if (!account || !amountOriginal) throw new Error('حدد حسابًا ماليًا ومبلغًا صالحًا لكل ساق.');
          return resolveCrossCurrencyLine(line, account, amountOriginal);
        }),
      );

      const totalAmount = payloadLines.filter((l) => l.transType === 'Debit').reduce((s, l) => s + l.amountOriginal, 0);

      const normalizedPaymentDetails: FinancialPaymentDetailInput[] = paymentDetails.map((d) => ({
        ...d,
        amountOriginal: paymentMethod === 'mixed' ? asNumber(d.amountOriginal) : totalAmount,
      }));

      const paymentTotal = normalizedPaymentDetails.reduce((s, d) => s + d.amountOriginal, 0);
      if (!normalizedPaymentDetails.length || normalizedPaymentDetails.some((d) => !d.accountId || !d.amountOriginal)) {
        throw new Error('حدد حسابًا ومبلغًا صحيحًا لكل تفصيل دفع.');
      }
      if (paymentTotal !== totalAmount) {
        throw new Error('يجب أن يساوي مجموع تفاصيل الدفع مبلغ القيد بعملة الرأس.');
      }

      for (const detail of normalizedPaymentDetails) {
        const account = accounts.find((a) => a.id === detail.accountId);
        if (!account || !payloadLines.some((l) => l.accountId === detail.accountId)) {
          throw new Error('حساب تفصيل الدفع يجب أن يكون حسابًا ماليًا ظاهرًا في أسطر القيد.');
        }
        if (detail.paymentMethod === 'cash' && account.accSubId !== '111') {
          throw new Error('طريقة النقد تحتاج حسابًا من قسم الصناديق النقدية.');
        }
        if (detail.paymentMethod === 'bank' && account.accSubId !== '112') {
          throw new Error('طريقة البنك تحتاج حسابًا من قسم الحسابات البنكية.');
        }
        if (detail.paymentMethod === 'bank' && !detail.bankReference?.trim()) {
          throw new Error('أدخل مرجع الحوالة أو العملية البنكية.');
        }
        if (detail.paymentMethod === 'deferred' && !detail.dueAt) {
          throw new Error('أدخل تاريخ استحقاق الدفع الآجل.');
        }
      }

      // حفظ سعر الصرف المعدّل إن وجد
      await saveExchangeRateIfModified();

      const entryPayload: FinancialEntryInput = {
        entryNumber: entryNumber.trim(),
        moduleId,
        entryTypeId,
        entryCategory: category,
        postingStatus: saveAsPosted ? 'posted' : 'draft',
        description: description.trim(),
        notes,
        paymentMethod,
        paymentDetails: normalizedPaymentDetails,
        createdByUid,
        lines: payloadLines,
      };

      if (editingEntry) {
        await financialEntryService.replaceDraft(editingEntry.id, entryPayload);
      } else {
        await financialEntryService.create(entryPayload);
      }

      onSaved();
    } catch (cause: any) {
      setError(cause?.message || 'تعذر حفظ القيد.');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────── العرض ───────────────────────────

  const voucherCashBankAccountId = paymentDetails[0]?.accountId || '';
  const voucherAmount = paymentDetails[0]?.amountOriginal || '';

  return (
    <form onSubmit={submit} className="space-y-5" dir="rtl">

      {/* رسالة الخطأ */}
      {error && (
        <div className="flex gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── بيانات رأس القيد ── */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-bold text-slate-300">
          رقم القيد
          <input
            required
            value={entryNumber}
            onChange={(e) => setEntryNumber(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs font-bold text-slate-300">
          الفئة
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {modules.map((m) => <option key={m.id} value={m.id}>{m.nameAr}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-300">
          النوع
          <select
            value={entryTypeId}
            onChange={(e) => setEntryTypeId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {availableTypes.map((t) => <option key={t.id} value={t.id}>{t.nameAr}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-300">
          عملة الرأس
          <select
            value={currencyId}
            onChange={(e) => setCurrencyId(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {currencies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}{c.isDefault ? ' — افتراضية' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── سعر الصرف (للعملات غير الافتراضية فقط) ── */}
      {selectedCurrency && !selectedCurrency.isDefault && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
          <label className="text-xs font-bold text-amber-300">
            سعر صرف {selectedCurrency.code} مقابل العملة الافتراضية
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="0"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                placeholder="أدخل سعر الصرف…"
                className="w-48 rounded-lg border border-amber-500/30 bg-slate-900 px-3 py-2 text-sm text-white"
              />
              <span className="text-xs text-slate-400">
                {exchangeRate
                  ? `1 ${selectedCurrency.code} = ${exchangeRate} ${currencies.find((c) => c.isDefault)?.code || ''}`
                  : 'لا يوجد سعر محدد'}
              </span>
            </div>
          </label>
          <p className="mt-1 text-[10px] text-amber-400/70">
            ⚡ سيُحفظ السعر المعدَّل تلقائياً في جدول أسعار العملات عند حفظ القيد.
          </p>
        </div>
      )}

      {/* ── البيان وطريقة الدفع ── */}
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <label className="text-xs font-bold text-slate-300">
          البيان
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="وصف واضح للحركة المالية"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs font-bold text-slate-300">
          طريقة الدفع
          <select
            value={paymentMethod}
            onChange={(e) => choosePaymentMethod(e.target.value as FinancialPaymentMethod)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {availableMethods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      </div>

      {/* ── المبلغ كتابةً بالحروف ── */}
      <label className="block text-xs font-bold text-slate-300">
        المبلغ كتابةً
        <input
          type="text"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          placeholder={`مثال: خمسون ألف ${selectedCurrency?.code || 'ريال'}`}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600"
        />
      </label>

      {/* ── تفاصيل طريقة الدفع ── */}
      <fieldset className="space-y-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <legend className="text-sm font-black text-cyan-100">تفاصيل طريقة الدفع</legend>
          {paymentMethod === 'mixed' && (
            <button
              type="button"
              onClick={() => setPaymentDetails((cur) => [...cur, createPaymentDetail('cash')])}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 px-2.5 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/10"
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة توزيع
            </button>
          )}
        </div>

        {paymentDetails.map((detail, index) => (
          <div key={detail.id} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 md:grid-cols-6">
            {/* الطريقة */}
            <label className="text-[11px] font-bold text-slate-400">
              الطريقة
              <select
                disabled={paymentMethod !== 'mixed'}
                value={detail.paymentMethod}
                onChange={(e) => updatePaymentDetail(index, { paymentMethod: e.target.value as PaymentDetailForm['paymentMethod'], accountId: '' })}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white disabled:opacity-60"
              >
                {availableMethods.filter((m) => m.id !== 'mixed').map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>

            {/* الحساب المالي (صندوق/بنك) */}
            <div className="text-[11px] font-bold text-slate-400 md:col-span-2">
              الحساب المالي (صندوق / بنك)
              <AccountPickerModal
                accounts={accountsForPaymentMethod(detail.paymentMethod)}
                selectedAccountId={detail.accountId}
                label="اختيار حساب الصندوق أو البنك"
                placeholder="اختر حساب الوسيط"
                onSelect={(id) => updatePaymentDetail(index, { accountId: id })}
              />
            </div>

            {/* المبلغ */}
            <label className="text-[11px] font-bold text-slate-400">
              المبلغ
              <input
                readOnly={paymentMethod !== 'mixed'}
                inputMode="decimal"
                value={paymentMethod === 'mixed' ? detail.amountOriginal : (isVoucherMode ? voucherAmount : (debitTotal || ''))}
                onChange={(e) => updatePaymentDetail(index, { amountOriginal: e.target.value })}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white read-only:opacity-70"
              />
            </label>

            {/* مرجع الحوالة أو تاريخ الاستحقاق */}
            {detail.paymentMethod === 'bank' ? (
              <label className="text-[11px] font-bold text-slate-400 md:col-span-2">
                مرجع الحوالة / العملية
                <input
                  value={detail.bankReference}
                  onChange={(e) => updatePaymentDetail(index, { bankReference: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white"
                />
              </label>
            ) : detail.paymentMethod === 'deferred' ? (
              <label className="text-[11px] font-bold text-slate-400 md:col-span-2">
                تاريخ الاستحقاق
                <input
                  type="datetime-local"
                  value={detail.dueAt}
                  onChange={(e) => updatePaymentDetail(index, { dueAt: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white"
                />
              </label>
            ) : <div className="md:col-span-2" />}

            {/* حذف توزيع في وضع المختلط */}
            {paymentMethod === 'mixed' && (
              <button
                type="button"
                disabled={paymentDetails.length <= 2}
                onClick={() => setPaymentDetails((cur) => cur.filter((_, i) => i !== index))}
                className="self-end rounded p-2 text-rose-300 hover:bg-rose-500/10 disabled:opacity-30"
                aria-label="حذف توزيع الدفع"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </fieldset>

      {/* ══════════════════════════════════════════════
          وضع السند المبسط: حقلا الحساب فقط
          Voucher mode: show only two account fields
          ══════════════════════════════════════════════ */}
      {isVoucherMode ? (
        <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <h4 className="text-sm font-black text-white">أطراف السند</h4>

          {/* حساب الصندوق/البنك (مأخوذ تلقائياً من تفاصيل الدفع) */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="mb-1 flex items-center gap-2">
              {cashBankTransType === 'Debit' ? (
                <ArrowRight className="h-4 w-4 text-emerald-400" />
              ) : (
                <ArrowLeft className="h-4 w-4 text-amber-400" />
              )}
              <span className={`text-xs font-black ${cashBankTransType === 'Debit' ? 'text-emerald-300' : 'text-amber-300'}`}>
                {cashBankTransType === 'Debit' ? 'من حـ' : 'إلى حـ'}
                {' '}
                <span className="font-normal text-slate-400">
                  ({cashBankTransType === 'Debit' ? 'مدين' : 'دائن'}) — حساب الصندوق / البنك (محدد تلقائياً من تفاصيل الدفع)
                </span>
              </span>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
              {voucherCashBankAccountId
                ? (() => {
                    const acc = accounts.find((a) => a.id === voucherCashBankAccountId);
                    return acc ? `${acc.id} — ${acc.nameAr}` : voucherCashBankAccountId;
                  })()
                : <span className="text-slate-500 italic">اختر الحساب المالي في تفاصيل الدفع أعلاه</span>}
            </div>
          </div>

          {/* حساب الطرف الآخر */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="mb-1 flex items-center gap-2">
              {otherPartyTransType === 'Debit' ? (
                <ArrowRight className="h-4 w-4 text-emerald-400" />
              ) : (
                <ArrowLeft className="h-4 w-4 text-amber-400" />
              )}
              <span className={`text-xs font-black ${otherPartyTransType === 'Debit' ? 'text-emerald-300' : 'text-amber-300'}`}>
                {otherPartyTransType === 'Debit' ? 'من حـ' : 'إلى حـ'}
                {' '}
                <span className="font-normal text-slate-400">
                  ({otherPartyTransType === 'Debit' ? 'مدين' : 'دائن'}) — حساب الطرف الآخر
                </span>
              </span>
            </div>
            <AccountPickerModal
              accounts={accounts.filter((a) => a.isActive && a.isPosting)}
              selectedAccountId={otherPartyAccountId}
              label="اختيار حساب الطرف الآخر"
              placeholder="انقر لاختيار الحساب…"
              onSelect={setOtherPartyAccountId}
            />
          </div>

          {/* إجمالي السند */}
          {voucherAmount && Number(voucherAmount) > 0 && (
            <div className="rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-black text-white">
              المبلغ: {Number(voucherAmount).toLocaleString()} {selectedCurrency?.code}
              {amountText && <span className="block text-xs font-normal text-slate-400 mt-0.5">{amountText}</span>}
            </div>
          )}
        </div>
      ) : (
        /* ══════════════════════════════════════════════
           وضع القيد العادي: جدول أسطر المدين/الدائن
           Normal entry mode: full debit/credit table
           ══════════════════════════════════════════════ */
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-[780px] w-full text-right text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-3 py-3">الساق</th>
                  <th className="px-3 py-3">الحساب المالي</th>
                  <th className="px-3 py-3">العملة</th>
                  <th className="px-3 py-3">المبلغ بعملة الرأس</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const account = accounts.find((a) => a.id === line.accountId);
                  const { label, fromTo, colorClass } = getTransLabel(line.transType, false, voucherType);
                  return (
                    <tr key={line.id} className="border-t border-slate-800">
                      {/* نوع الساق مع صيغة من-إلى */}
                      <td className={`px-3 py-2 font-black ${colorClass}`}>
                        <div className="flex flex-col">
                          <select
                            value={line.transType}
                            onChange={(e) => updateLine(index, { transType: e.target.value as FormLine['transType'] })}
                            className="rounded bg-transparent py-1 text-inherit text-xs"
                          >
                            <option value="Debit">مدين</option>
                            <option value="Credit">دائن</option>
                          </select>
                          <span className="text-[10px] opacity-70">{fromTo}</span>
                        </div>
                      </td>

                      {/* اختيار الحساب عبر AccountPickerModal */}
                      <td className="px-3 py-2">
                        <AccountPickerModal
                          accounts={accounts.filter((a) => a.isActive && a.isPosting)}
                          selectedAccountId={line.accountId}
                          label="اختيار الحساب المالي للساق"
                          onSelect={(id) => updateLine(index, { accountId: id })}
                        />
                      </td>

                      {/* عملة الحساب */}
                      <td className="px-3 py-2 text-slate-300">{account?.currencyCode || '—'}</td>

                      {/* المبلغ */}
                      <td className="px-3 py-2">
                        <input
                          inputMode="decimal"
                          value={line.amountOriginal}
                          onChange={(e) => updateLine(index, { amountOriginal: e.target.value })}
                          className="w-32 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-white"
                        />
                      </td>

                      {/* حذف الساق (للقيود المركبة فقط) */}
                      <td className="px-3 py-2">
                        {category === 'Compound' && (
                          <button
                            type="button"
                            aria-label="حذف الساق"
                            onClick={() => removeLine(index)}
                            className="rounded p-1 text-rose-300 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* زر إضافة ساق (القيود المركبة فقط) */}
          {category === 'Compound' && (
            <button
              type="button"
              onClick={() => setLines((cur) => [...cur, createLine('Debit')])}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/10"
            >
              <Plus className="h-4 w-4" />
              إضافة ساق
            </button>
          )}

          {/* إجماليات التوازن */}
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-900 p-3 text-center text-xs font-black">
            <div className="text-emerald-300">
              من حـ / المدين: {debitTotal.toLocaleString()} {selectedCurrency?.code}
            </div>
            <div className="text-amber-300">
              إلى حـ / الدائن: {creditTotal.toLocaleString()} {selectedCurrency?.code}
            </div>
            <div className={balanced ? 'text-emerald-300' : 'text-rose-300'}>
              الفرق: {Math.abs(balanceDiff).toLocaleString()}
            </div>
          </div>
        </>
      )}

      {/* ملاحظات */}
      <label className="block text-xs font-bold text-slate-300">
        ملاحظات
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 min-h-16 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />
      </label>

      {/* أزرار الإجراءات */}
      <div className="flex flex-wrap justify-end gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={saveAsPosted}
            onChange={(e) => setSaveAsPosted(e.target.checked)}
            disabled={Boolean(editingEntry) || !canPost || category === 'Temp'}
          />
          اعتماد وترحيل مباشرة
        </label>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800"
        >
          إلغاء
        </button>
        <button
          disabled={saving || !canCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'جارٍ الحفظ…' : editingEntry ? 'حفظ التعديل' : 'حفظ القيد'}
        </button>
      </div>
    </form>
  );
}
