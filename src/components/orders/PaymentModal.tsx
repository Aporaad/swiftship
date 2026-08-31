import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Wallet,
  AlertCircle,
  FileText,
  Calendar,
  Hash,
  CheckCircle2,
  Calculator,
  ArrowRightLeft,
  Coins,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { amountInWords } from '../../lib/numberToWords';
import { financialAccountService } from '../../services/financialAccountService';
import FinancialCalculatorModal from '../finance/FinancialCalculatorModal';

type CollectionMethod = 'Cash' | 'Bank' | 'Deferred' | 'Mixed';
type Allocation = { id: string; method: 'Cash' | 'Bank'; amount: string; receivingAccountId: string; bankReference: string };

interface PaymentModalProps {
  isOpen: boolean;
  selectedOrder: any;
  paymentFormData: {
    amount: string;
    method: CollectionMethod;
    receivingAccountId?: string;
    bankReference?: string;
    allocations?: Allocation[];
    notes: string;
    pin: string;
    voucherDate?: string;
    voucherNumber?: string;
    paymentCurrency?: string;
  };
  setPaymentFormData: (v: any) => void;
  isSubmitting: boolean;
  isAr: boolean;
  financialAccounts?: Array<{ id: string; name: string; currency?: string; curNo?: number; accSubId?: string; accountCode?: string; isPosting?: boolean }>;
  activeCurrencies?: Array<{ id?: number; cur_id?: number; code: string; nameAr?: string; isDefault?: boolean }>;
  dbRates?: Record<string, number>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const makeAllocation = (method: 'Cash' | 'Bank' = 'Cash'): Allocation => ({
  id: `allocation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  method,
  amount: '',
  receivingAccountId: '',
  bankReference: ''
});

export default function PaymentModal({
  isOpen,
  selectedOrder,
  paymentFormData,
  setPaymentFormData,
  isSubmitting,
  isAr,
  financialAccounts = [],
  activeCurrencies = [],
  dbRates = { USD: 535, SAR: 140, YER: 1 },
  onClose,
  onSubmit
}: PaymentModalProps) {
  // 1. ALL React Hooks MUST be defined unconditionally at the very top (Rules of Hooks)
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calculatorTab, setCalculatorTab] = useState<'calc' | 'exchange'>('calc');

  // 2. Early return check MUST come after all Hooks
  if (!isOpen || !selectedOrder) return null;

  // حماية التمرير للقيم المتغيرة والافتراضية
  const safeFormData = paymentFormData || {
    amount: '',
    method: 'Cash' as CollectionMethod,
    receivingAccountId: '',
    bankReference: '',
    allocations: [],
    notes: '',
    pin: '',
    paymentCurrency: 'YER',
    voucherDate: '',
    voucherNumber: ''
  };

  const safeAccounts = Array.isArray(financialAccounts) ? financialAccounts : [];
  const safeActiveCurrencies = (Array.isArray(activeCurrencies) && activeCurrencies.length > 0)
    ? activeCurrencies
    : [
        { cur_id: 1, code: 'YER', nameAr: 'ريال يمني' },
        { cur_id: 2, code: 'SAR', nameAr: 'ريال سعودي' },
        { cur_id: 3, code: 'USD', nameAr: 'دولار أمريكي' }
      ];

  // عملة الطلب الأصلية وعملة الدفع المحددة
  const defaultOrderCurrency = String(selectedOrder?.paidCurrency || selectedOrder?.currency || selectedOrder?.orderCurrency || 'YER').toUpperCase();
  const paymentCurrency = String(safeFormData.paymentCurrency || defaultOrderCurrency).toUpperCase();

  const isMixed = safeFormData.method === 'Mixed';
  const isDeferred = safeFormData.method === 'Deferred';
  const allocationRows = (safeFormData.allocations && safeFormData.allocations.length > 0)
    ? safeFormData.allocations
    : [makeAllocation()];

  const numAmount = parseFloat(safeFormData.amount || '0');
  const dottedAmount = (!isNaN(numAmount) && numAmount > 0)
    ? numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
  const tafqeetText = (!isNaN(numAmount) && numAmount > 0)
    ? amountInWords(numAmount, paymentCurrency, isAr ? 'ar' : 'en')
    : '';

  const voucherNumber = safeFormData.voucherNumber || `RCPT-${selectedOrder?.orderNumber || selectedOrder?.id || Date.now()}-${Date.now().toString().slice(-5)}`;
  const voucherDate = safeFormData.voucherDate || new Date().toLocaleString(isAr ? 'ar-YE' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  // حساب المتبقي للطلب بعملة الطلب وبتحويل ديناميكي لعملة الدفع المختارة
  const orderRemainingRaw = parseFloat(selectedOrder?.amountRemaining || 0);
  const orderRemaining = isNaN(orderRemainingRaw) ? 0 : orderRemainingRaw;
  const orderRemainingInPaymentCurrency = (paymentCurrency === defaultOrderCurrency)
    ? orderRemaining
    : financialAccountService.convertToTargetCurrency(
      orderRemaining,
      defaultOrderCurrency,
      paymentCurrency,
      dbRates
    );

  // تصفية الحسابات المالية (صناديق / بنوك)
  const accountsFor = (method: 'Cash' | 'Bank') => {
    return safeAccounts.filter((account) => {
      if (!account || !account.id) return false;
      const accSubId = account.accSubId || '';
      const accId = String(account.id || '');
      const subIdMatch = method === 'Cash'
        ? (accSubId === '111' || accId.startsWith('111'))
        : (accSubId === '112' || accId.startsWith('112'));
      return subIdMatch && (account.isPosting !== false);
    });
  };

  // الحساب المالي المحدد حالياً (في حال الدفع الفردي)
  const currentReceivingAccount = safeAccounts.find((a) => a && a.id === safeFormData.receivingAccountId);
  const receivingCurrency = currentReceivingAccount?.currency?.toUpperCase() || paymentCurrency;

  // احتساب الفرق في حالة الدفع المختلط مباشرة بدون useMemo لتجنب أي إخلاق بقواعد الهوكس
  const totalAllocatedAmount = isMixed
    ? allocationRows.reduce((sum, row) => sum + Number(row?.amount || 0), 0)
    : Number(safeFormData.amount || 0);

  const amountDiff = Number(safeFormData.amount || 0) - totalAllocatedAmount;

  const updateAllocation = (index: number, patch: Partial<Allocation>) => {
    if (typeof setPaymentFormData !== 'function') return;
    setPaymentFormData({
      ...safeFormData,
      allocations: allocationRows.map((allocation, allocationIndex) =>
        allocationIndex === index ? { ...allocation, ...patch } : allocation
      )
    });
  };

  const changeMethod = (method: CollectionMethod) => {
    if (typeof setPaymentFormData !== 'function') return;
    setPaymentFormData({
      ...safeFormData,
      method,
      receivingAccountId: '',
      bankReference: '',
      allocations: method === 'Mixed'
        ? (safeFormData.allocations?.length && safeFormData.allocations.length >= 2
            ? safeFormData.allocations
            : [makeAllocation('Cash'), makeAllocation('Bank')])
        : []
    });
  };

  const openCalculator = (tab: 'calc' | 'exchange') => {
    setCalculatorTab(tab);
    setIsCalculatorOpen(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4 backdrop-blur-md" role="dialog" aria-modal="true">
        <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 text-start shadow-2xl transition-all">
          {/* Header Bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5 py-4 text-xs font-black text-white backdrop-blur">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37]">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white">
                  {isAr ? 'تحصيل دفعة مالية وسند قبض الطلب' : 'Collect Payment & Receipt Voucher'}
                </h2>
                <p className="text-[11px] font-medium text-slate-400">
                  {isAr ? 'نموذج سند القبض الموحد ومعالجة متعدد العملات' : 'Unified Receipt Voucher & Multi-Currency Engine'}
                </p>
              </div>
            </div>

            {/* Quick Action Tools: Calculator & Exchange buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openCalculator('calc')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:border-[#d4af37]/50 hover:bg-slate-700 hover:text-white transition"
                title={isAr ? 'الآلة الحاسبة' : 'Calculator'}
              >
                <Calculator className="h-4 w-4 text-[#d4af37]" />
                <span className="hidden sm:inline">{isAr ? 'حاسبة' : 'Calc'}</span>
              </button>

              <button
                type="button"
                onClick={() => openCalculator('exchange')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:border-cyan-500/50 hover:bg-slate-700 hover:text-white transition"
                title={isAr ? 'تحويل عملات ومصارفة' : 'Currency Exchange'}
              >
                <ArrowRightLeft className="h-4 w-4 text-cyan-400" />
                <span className="hidden sm:inline">{isAr ? 'مصارفة' : 'Exchange'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-800 bg-slate-800/80 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition"
              >
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 p-5 sm:p-6 text-xs font-bold text-slate-300 font-sans">
            {/* Voucher Header Info Card */}
            <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Hash className="h-3.5 w-3.5 text-[#d4af37]" />
                  {isAr ? 'رقم سند القبض' : 'Voucher No.'}
                </span>
                <span className="mt-1 block font-mono text-xs font-black text-[#d4af37]">{voucherNumber}</span>
              </div>

              <div>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                  {isAr ? 'تاريخ ووقت السند' : 'Voucher Date'}
                </span>
                <span className="mt-1 block font-mono text-xs font-black text-cyan-300">{voucherDate}</span>
              </div>

              <div>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                  {isAr ? 'رقم الطلب والعميل' : 'Order Ref'}
                </span>
                <span className="mt-1 block font-mono text-xs font-black text-emerald-400 truncate">
                  {selectedOrder?.orderNumber || selectedOrder?.id || ''}
                </span>
              </div>

              <div>
                <span className="block text-[11px] text-slate-500">{isAr ? 'المتبقي للتحصيل' : 'Remaining Dues'}</span>
                <span className="mt-1 block font-mono text-sm font-black text-rose-400">
                  {orderRemainingInPaymentCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })} {paymentCurrency}
                  {paymentCurrency !== defaultOrderCurrency && (
                    <span className="mr-1 text-[10px] font-normal text-slate-400">
                      ({orderRemaining.toLocaleString()} {defaultOrderCurrency})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Amount input & Currency selector & Tafqeet Display */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                {/* 1. Amount Field */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-300 font-black">
                      {isAr ? 'المقدار المحصّل الآن' : 'Collection Amount'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof setPaymentFormData === 'function') {
                          setPaymentFormData({ ...safeFormData, amount: String(Number(orderRemainingInPaymentCurrency.toFixed(2))) });
                        }
                      }}
                      className="text-[10px] font-bold text-emerald-400 hover:underline"
                    >
                      {isAr ? 'تحصيل المتبقي كاملاً' : 'Full Remaining'}
                    </button>
                  </div>
                  <div className="relative mt-1.5 flex items-center">
                    <input
                      required
                      type="number"
                      min="0.0001"
                      step="any"
                      value={safeFormData.amount || ''}
                      onChange={(e) => {
                        if (typeof setPaymentFormData === 'function') {
                          setPaymentFormData({ ...safeFormData, amount: e.target.value });
                        }
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 pr-10 text-center font-mono text-lg font-black text-emerald-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                      placeholder={`0.00`}
                    />
                    <button
                      type="button"
                      onClick={() => openCalculator('calc')}
                      className="absolute left-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                      title={isAr ? 'فتح الآلة الحاسبة' : 'Open Calculator'}
                    >
                      <Calculator className="h-4 w-4 text-[#d4af37]" />
                    </button>
                  </div>
                </div>

                {/* 2. Payment Currency Selector */}
                <div>
                  <label className="block text-slate-300 font-black">
                    {isAr ? 'عملة التحصيل' : 'Payment Currency'}
                  </label>
                  <select
                    value={paymentCurrency}
                    onChange={(e) => {
                      if (typeof setPaymentFormData === 'function') {
                        setPaymentFormData({ ...safeFormData, paymentCurrency: e.target.value });
                      }
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-sm font-black text-amber-400 outline-none focus:border-amber-500"
                  >
                    {safeActiveCurrencies.map((c) => (
                      <option key={c?.code || Math.random()} value={c?.code || 'YER'}>
                        {c?.code} {c?.nameAr ? `(${c.nameAr})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Formatted amount & Tafqeet */}
              <div className="grid gap-3 sm:grid-cols-2 items-center pt-1 border-t border-emerald-500/20">
                <div>
                  <span className="block text-slate-400 text-[11px] font-bold">{isAr ? 'المبلغ المنقّط والمُنسّق' : 'Formatted Amount'}</span>
                  <div className="mt-1 flex items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-2.5 font-mono text-base font-black text-cyan-300">
                    {dottedAmount} <span className="mr-1.5 text-xs text-amber-400">{paymentCurrency}</span>
                  </div>
                </div>

                {/* Tafqeet box */}
                <div>
                  <span className="block text-slate-400 text-[11px] font-bold">{isAr ? 'التفقيط بالكلمات' : 'Amount in Words'}</span>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3 py-2 text-xs font-black text-cyan-200 min-h-[42px]">
                    <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span className="truncate">{tafqeetText || (isAr ? 'أدخل المبلغ للتفقيط' : 'Enter amount')}</span>
                  </div>
                </div>
              </div>

              {/* Cross-currency notice if receiving account currency differs */}
              {!isMixed && currentReceivingAccount && receivingCurrency !== paymentCurrency && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 p-2.5 text-xs font-bold text-amber-200">
                  <Coins className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>
                    {isAr
                      ? `مصارفة تلقائية: التحصيل بعملة (${paymentCurrency}) وسيتم قيد الحركة في حساب ${currentReceivingAccount.name} بعملة (${receivingCurrency}).`
                      : `Auto-conversion: Collecting in ${paymentCurrency} into account currency ${receivingCurrency}.`}
                  </span>
                </div>
              )}
            </div>

            {/* Collection Method Selector */}
            <label className="block text-slate-400 font-bold">
              {isAr ? 'طريقة التحصيل وسند القبض' : 'Collection Method'}
              <select
                value={safeFormData.method || 'Cash'}
                onChange={(e) => changeMethod(e.target.value as CollectionMethod)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm font-black text-white outline-none focus:border-cyan-500"
              >
                <option value="Cash">{isAr ? 'نقدًا (صندوق نقدي)' : 'Cash'}</option>
                <option value="Bank">{isAr ? 'بنك / حوالة بنكية' : 'Bank Transfer'}</option>
                <option value="Mixed">{isAr ? 'مختلط (نقد وبنك متعدد)' : 'Mixed Cash & Bank'}</option>
                <option value="Deferred">{isAr ? 'آجل — (ليس قبضًا فعليًا)' : 'Deferred'}</option>
              </select>
            </label>

            {isDeferred ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-amber-100 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  {isAr
                    ? 'لا يمكن استخدام طريقة «آجل» في تحصيل الدفعة المباشرة، حيث إنها لا تمثل قبضًا فعليًا. يرجى اختيار حساب نقد أو بنك لتحصيل المبلغ.'
                    : 'Deferred payment does not represent an immediate cash receipt. Please select a Cash or Bank account.'}
                </span>
              </div>
            ) : isMixed ? (
              <fieldset className="space-y-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <legend className="font-black text-cyan-100">{isAr ? 'توزيع وسائط القبض المختلط' : 'Mixed Allocations'}</legend>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {isAr
                        ? `اختر حسابات التحصيل بحيث يساوي إجمالي التوزيع مبلغ الدفعة بالضبط.`
                        : `Select collection accounts. Total allocation must equal the payment amount.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof setPaymentFormData === 'function') {
                        setPaymentFormData({ ...safeFormData, allocations: [...allocationRows, makeAllocation('Cash')] });
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 text-xs text-cyan-200 hover:bg-cyan-400/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isAr ? 'إضافة توزيع' : 'Add Allocation'}
                  </button>
                </div>

                {allocationRows.map((allocation, index) => (
                  <div key={allocation?.id || index} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 md:grid-cols-5 items-center">
                    <select
                      value={allocation?.method || 'Cash'}
                      onChange={(e) => updateAllocation(index, { method: e.target.value as Allocation['method'], receivingAccountId: '', bankReference: '' })}
                      className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"
                    >
                      <option value="Cash">{isAr ? 'نقد' : 'Cash'}</option>
                      <option value="Bank">{isAr ? 'بنك' : 'Bank'}</option>
                    </select>

                    <select
                      value={allocation?.receivingAccountId || ''}
                      onChange={(e) => updateAllocation(index, { receivingAccountId: e.target.value })}
                      className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-white md:col-span-2 text-xs"
                    >
                      <option value="">{isAr ? `اختر حساب ${allocation?.method === 'Cash' ? 'صندوق' : 'بنك'}` : 'Select Account'}</option>
                      {accountsFor(allocation?.method as 'Cash' | 'Bank').map((account) => (
                        <option key={account?.id || Math.random()} value={account?.id}>
                          {account?.name} {account?.currency ? `(${account.currency})` : ''}
                        </option>
                      ))}
                    </select>

                    <input
                      required
                      type="number"
                      min="0.0001"
                      step="any"
                      value={allocation?.amount || ''}
                      onChange={(e) => updateAllocation(index, { amount: e.target.value })}
                      placeholder={isAr ? 'المبلغ' : 'Amount'}
                      className="rounded-lg border border-slate-700 bg-slate-900 p-2 font-mono text-emerald-300"
                    />

                    {allocation?.method === 'Bank' ? (
                      <input
                        required
                        value={allocation?.bankReference || ''}
                        onChange={(e) => updateAllocation(index, { bankReference: e.target.value })}
                        placeholder={isAr ? 'رقم / مرجع الحوالة' : 'Bank Reference'}
                        className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-white md:col-span-4 text-xs"
                      />
                    ) : (
                      <div className="md:col-span-4" />
                    )}

                    {allocationRows.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof setPaymentFormData === 'function') {
                            setPaymentFormData({ ...safeFormData, allocations: allocationRows.filter((_, itemIndex) => itemIndex !== index) });
                          }
                        }}
                        className="justify-self-end rounded p-2 text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}

                {Math.abs(amountDiff) > 0.0001 && (
                  <div className="text-[11px] font-bold text-rose-400 px-1">
                    {isAr
                      ? `تنبيه التوزيع: المبلغ الإجمالي = ${safeFormData.amount}، مجموع الأسطر = ${totalAllocatedAmount} (الفرق = ${amountDiff.toFixed(2)})`
                      : `Allocation discrepancy: Total = ${safeFormData.amount}, Sum = ${totalAllocatedAmount}`}
                  </div>
                )}
              </fieldset>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-slate-400 font-bold">
                  {isAr ? `حساب القبض المستلم (الصندوق/البنك)` : 'Receiving Account'}
                  <select
                    required
                    value={safeFormData.receivingAccountId || ''}
                    onChange={(e) => {
                      if (typeof setPaymentFormData === 'function') {
                        setPaymentFormData({ ...safeFormData, receivingAccountId: e.target.value });
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm font-black text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">
                      {safeFormData.method === 'Bank'
                        ? (isAr ? `اختر حسابًا بنكيًا` : 'Select Bank Account')
                        : (isAr ? `اختر صندوقًا نقديًا` : 'Select Cash Box')}
                    </option>
                    {accountsFor((safeFormData.method as 'Cash' | 'Bank') || 'Cash').map((account) => (
                      <option key={account?.id || Math.random()} value={account?.id}>
                        {account?.name} {account?.currency ? `(${account.currency})` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {safeFormData.method === 'Bank' && (
                  <label className="block text-slate-400 font-bold">
                    {isAr ? 'مرجع الحوالة / العملية البنكية' : 'Bank Reference'}
                    <input
                      required
                      value={safeFormData.bankReference || ''}
                      onChange={(e) => {
                        if (typeof setPaymentFormData === 'function') {
                          setPaymentFormData({ ...safeFormData, bankReference: e.target.value });
                        }
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-white outline-none focus:border-cyan-500"
                      placeholder="Ref #..."
                    />
                  </label>
                )}
              </div>
            )}

            {/* Notes / Statement */}
            <label className="block text-slate-400 font-bold">
              {isAr ? 'البيان العام / ملاحظات سند القبض' : 'Voucher Statement / Notes'}
              <textarea
                value={safeFormData.notes || ''}
                onChange={(e) => {
                  if (typeof setPaymentFormData === 'function') {
                    setPaymentFormData({ ...safeFormData, notes: e.target.value });
                  }
                }}
                className="mt-1 min-h-16 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-white outline-none focus:border-cyan-500"
                placeholder={isAr ? 'تحصيل دفعة مالية من حساب العميل للطلب...' : 'Payment collection statement...'}
              />
            </label>

            {/* PIN Security Authorization */}
            <label className="block text-slate-400 font-bold">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-yellow-500" />
                {isAr ? 'رمز الـ PIN المالي للتحقق والإعتماد' : 'Security PIN Authorization'}
              </span>
              <input
                required
                type="password"
                maxLength={6}
                pattern="^[0-9]{4,6}$"
                value={safeFormData.pin || ''}
                onChange={(e) => {
                  if (typeof setPaymentFormData === 'function') {
                    setPaymentFormData({ ...safeFormData, pin: e.target.value });
                  }
                }}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-center font-mono text-base font-black tracking-widest text-yellow-400 outline-none focus:border-yellow-500"
                placeholder="••••"
              />
            </label>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-slate-400 hover:bg-slate-800 disabled:opacity-50 font-bold"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="submit"
                disabled={isSubmitting || isDeferred || (isMixed && Math.abs(amountDiff) > 0.0001)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-yellow-600 px-6 py-2.5 font-black text-[#000000] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-yellow-600/20"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isSubmitting
                  ? (isAr ? 'جارٍ ترحيل القبض…' : 'Processing…')
                  : (isAr ? 'تأكيد وترحيل سند القبض' : 'Confirm & Post Voucher')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Financial Calculator / Currency Exchange Modal */}
      <FinancialCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        initialTab={calculatorTab}
        currencies={safeActiveCurrencies.map((c) => ({
          id: c?.cur_id || c?.id || 1,
          code: c?.code || 'YER',
          isDefault: c?.isDefault
        }))}
      />
    </>
  );
}
