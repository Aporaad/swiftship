import React, { useState, useEffect } from 'react';
import {
  X, Search, UserPlus, CreditCard, DollarSign, AlertCircle,
  Package, Trash2, Calendar, Calculator, ChevronRight, ChevronLeft,
  User, ShoppingCart, Truck, CheckCircle2, ShieldCheck, FileText, Wallet, Building, ArrowRightLeft
} from 'lucide-react';
import {
  numberToWordsAr,
  numberToWordsEn,
  currencyNameAr,
  currencyNameEn,
  amountInWords,
  paidAmountInWords
} from '../../lib/numberToWords';
import { calculateShipmentCategoryFees } from '../../services/itemCategoryService';
import OrderPartyPicker from './OrderPartyPicker';
import FinancialCalculatorModal from '../finance/FinancialCalculatorModal';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  role: string;
  hasPermission: (perm: string) => boolean;
  canEditOrderDefaultsCreation: boolean;
  isSubmitting: boolean;

  // Form State
  formData: any;
  setFormData: (data: any) => void;
  previewOrderNumber: string;

  customerProfileStats: any;
  orderParties: any[];
  selectedOrderParty: any;
  isStaffOrder: boolean;
  setIsStaffOrder: (value: boolean) => void;
  selectOrderParty: (party: any) => void;
  customerSearchQuery: string;
  setCustomerSearchQuery: (query: string) => void;
  filteredCustomers: any[];
  selectCustomer: (c: any) => void;
  clearSelectedCustomer: () => void;
  setIsAddCustomerOpen: (open: boolean) => void;
  setCustomerFormData: (data: any) => void;

  setIsAddSourceOpen: (open: boolean) => void;
  sources: any[];

  cartShareCode: string;
  setCartShareCode: (code: string) => void;

  // Items State
  items: any[];
  addItemRow: () => void;
  updateItemRow: (idx: number, field: string, val: any) => void;
  removeItemRow: (idx: number) => void;

  // Adjustments State
  bankCommissionEnabled: boolean;
  setBankCommissionEnabled: (v: boolean) => void;
  bankCommissionType: 'percentage' | 'fixed';
  setBankCommissionType: (v: 'percentage' | 'fixed') => void;
  bankCommissionRate: number;
  setBankCommissionRate: (v: number) => void;
  couponEnabled: boolean;
  setCouponEnabled: (v: boolean) => void;
  couponRate: number;
  setCouponRate: (v: number) => void;
  addShippingEnabled: boolean;
  setAddShippingEnabled: (v: boolean) => void;

  // Shippings State
  shippings: any[];
  addShippingRow: () => void;
  updateShippingRow: (idx: number, fieldOrObj: string | Record<string, any>, val?: any) => void;
  removeShippingRow: (idx: number) => void;
  shippingCompanies: any[];
  setIsAddShippingCompanyOpen: (open: boolean) => void;
  setActiveAddShippingIndex: (idx: any) => void;

  packagingFeeEnabled: boolean;
  setPackagingFeeEnabled: (v: boolean) => void;
  packagingFeeRate: number;
  setPackagingFeeRate: (v: number) => void;

  // Couriers State
  couriers: any[];
  profitPerKgRate: number;
  setProfitPerKgRate: (v: number) => void;
  cbmShippingRateValue: number;
  setCbmShippingRateValue: (v: number) => void;
  settings: any;

  // Calculations
  calcs: any;
  activeCurrencies: any[];
  financialAccounts?: any[];

  // Order Options (order_option)
  packagingOptions?: any[];
  shippingCategoryOptions?: any[];
  itemCategories?: any[];

  // Action
  handleCreateOrder: (e: React.FormEvent) => void;
}

const STEPS = [
  { id: 1, titleAr: 'العميل والمصدر', titleEn: 'Customer & Source', icon: User },
  { id: 2, titleAr: 'السلة والمنتجات', titleEn: 'Cart & Products', icon: ShoppingCart },
  { id: 3, titleAr: 'الشحن والمناديب', titleEn: 'Shipping & Logistics', icon: Truck },
  { id: 4, titleAr: 'المالية والدفع', titleEn: 'Financials & Payment', icon: DollarSign },
  { id: 5, titleAr: 'الخلاصة والحفظ', titleEn: 'Summary & Save', icon: CheckCircle2 },
];

function ShipmentFeeCell({
  label,
  value,
  currency,
  emphasized = false,
}: {
  label: string;
  value: number | string | undefined;
  currency?: string;
  emphasized?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-2 ${emphasized ? 'border-cyan-400/35 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/70'}`}>
      <span className="block text-[8px] uppercase font-black text-slate-500 truncate">{label}</span>
      <span className={`block mt-0.5 text-[11px] font-mono font-black ${emphasized ? 'text-cyan-300' : 'text-slate-200'}`}>
        {(Number(value) || 0).toLocaleString()} {currency || 'SAR'}
      </span>
    </div>
  );
}

export default function CreateOrderModal(
  {
    isOpen,
    onClose,
    isAr,
    role,
    hasPermission,
    canEditOrderDefaultsCreation,
    isSubmitting,
    formData,
    setFormData,
    previewOrderNumber,
    customerProfileStats,
    orderParties,
    selectedOrderParty,
    isStaffOrder,
    setIsStaffOrder,
    selectOrderParty,
    customerSearchQuery,
    setCustomerSearchQuery,
    filteredCustomers,
    selectCustomer,
    clearSelectedCustomer,
    setIsAddCustomerOpen,
    setCustomerFormData,
    setIsAddSourceOpen,
    sources,
    cartShareCode,
    setCartShareCode,
    items,
    addItemRow,
    updateItemRow,
    removeItemRow,
    bankCommissionEnabled,
    setBankCommissionEnabled,
    bankCommissionType,
    setBankCommissionType,
    bankCommissionRate,
    setBankCommissionRate,
    couponEnabled,
    setCouponEnabled,
    couponRate,
    setCouponRate,
    addShippingEnabled,
    setAddShippingEnabled,
    shippings,
    addShippingRow,
    updateShippingRow,
    removeShippingRow,
    shippingCompanies,
    setIsAddShippingCompanyOpen,
    setActiveAddShippingIndex,
    packagingFeeEnabled,
    setPackagingFeeEnabled,
    packagingFeeRate,
    setPackagingFeeRate,
    couriers,
    profitPerKgRate,
    setProfitPerKgRate,
    cbmShippingRateValue,
    setCbmShippingRateValue,
    settings,
    calcs,
    activeCurrencies,
    financialAccounts = [],
    packagingOptions = [],
    shippingCategoryOptions = [],
    itemCategories = [],
    handleCreateOrder,
  }
    : CreateOrderModalProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepErrors, setStepErrors] = useState<string | null>(null);
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const orderCurrency = settings.defaultOrderCurrency || settings.currency || 'SAR'; // العملة الافتراضية المعينة لأسعار الطلبات

  // Filter available cash box and bank accounts from financialAccounts
  const cashAccountsList = (financialAccounts || []).filter(
    (a: any) => a.accSubId === '111' || (a.id && String(a.id).startsWith('111'))
  );
  const bankAccountsList = (financialAccounts || []).filter(
    (a: any) => a.accSubId === '112' || (a.id && String(a.id).startsWith('112'))
  );

  const getCurrencyRate = (code: string) => {
    if (code === 'YER') return 1;
    const found = activeCurrencies?.find((c) => c.code === code);
    if (found && found.currentPrice && found.currentPrice > 0) return found.currentPrice;
    if (found && (found as any).price && (found as any).price > 0) return (found as any).price;
    if (code === 'SAR') return 140;
    if (code === 'USD') return 535;
    return 1;
  };

  const updateShipmentContentCategory = (idx: number, categoryId: string, cartonValue?: number) => {
    const category = itemCategories.find((entry: any) => entry.id === categoryId);
    const fees = calculateShipmentCategoryFees(category, cartonValue ?? shippings[idx]?.cartonCount);
    updateShippingRow(idx, {
      contentCategoryId: category?.id || '',
      contentCategoryName: category ? (isAr ? category.nameAr : category.nameEn) : '',
      cartonCount: fees.cartonCount,
      customsFee: fees.customsFee,
      taxFee: fees.taxFee,
      otherCategoryFee: fees.otherCategoryFee,
      categoryFeesTotal: fees.total,
      categoryFeeCurrency: fees.currency,
    });
  };


  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setStepErrors(null);
      setFormData({ ...formData, orderCurrency, currency: orderCurrency, exchangeRate: 1 });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Validation function per step
  const validateStep = (step: number): boolean => {
    setStepErrors(null);

    // Step 1 Validation: Customer & Source
    if (step === 1) {
    // التحقق من وجود طرف الطلب (عميل أو موظف أو مندوب)
    // Validate order party: customer, employee, or courier must be selected
    if (!formData.customerId && !formData.orderPartyId && !formData.customerName) {
        setStepErrors(
          isAr
            ? '⚠️ يرجى اختيار وتحديد العميل أولاً للمتابعة إلى الخطوة التالية'
            : '⚠️ Please select a customer before proceeding to the next step'
        );
        return false;
      }
      if (!formData.orderSourceId) {
        setStepErrors(
          isAr
            ? '⚠️ يرجى اختيار مصدر الشراء والطلب (سلة، شي إن، مصنع...)'
            : '⚠️ Please select an order source'
        );
        return false;
      }
    }

    // Step 2 Validation: Products & Items
    if (step === 2) {
      if (!items || items.length === 0) {
        setStepErrors(
          isAr
            ? '⚠️ يجب إدراج منتج واحد على الأقل في السلة'
            : '⚠️ You must add at least one product item'
        );
        return false;
      }
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.productName || item.productName.trim() === '') {
          setStepErrors(
            isAr
              ? `⚠️ يرجى كتابة اسم المنتج للبند رقم (${i + 1})`
              : `⚠️ Please enter product name for item #${i + 1}`
          );
          return false;
        }
        if (item.quantity === undefined || item.quantity <= 0) {
          setStepErrors(
            isAr
              ? `⚠️ يرجى تحديد كمية صحيحة (أكبر من 0) للبند رقم (${i + 1})`
              : `⚠️ Please specify a valid quantity (>0) for item #${i + 1}`
          );
          return false;
        }
        if (item.productPrice === undefined || item.productPrice < 0) {
          setStepErrors(
            isAr
              ? `⚠️ يرجى تحديد سعر صحيح للمنتج للبند رقم (${i + 1})`
              : `⚠️ Please specify a valid price for item #${i + 1}`
          );
          return false;
        }
      }
    }

    // Step 3 Validation: Shippings & Couriers
    if (step === 3) {
      if (shippings && shippings.length > 0) {
        for (let i = 0; i < shippings.length; i++) {
          const sh = shippings[i];
          if (!sh.shippingCompany) {
            setStepErrors(
              isAr
                ? `⚠️ يرجى اختيار شركة الشحن لمسار الشحن رقم (${i + 1})`
                : `⚠️ Please select a carrier company for shipping track #${i + 1}`
            );
            return false;
          }
        }
      }
    }

    // Step 4 Validation: Financials
    if (step === 4) {
      const exchange = formData.exchangeRate ?? (getCurrencyRate(orderCurrency) / getCurrencyRate(formData.currency || 'YER'));
      if (!exchange || exchange <= 0) {
        setStepErrors(
          isAr
            ? '⚠️ يرجى إدخال سعر صرف صحيح للعملة'
            : '⚠️ Please specify a valid currency exchange rate'
        );
        return false;
      }
      if (formData.amountPaid === undefined || formData.amountPaid < 0) {
        setStepErrors(
          isAr
            ? '⚠️ يرجى إدخال قيمة الدفعة الكاش بشكل صحيح'
            : '⚠️ Please specify a valid amount paid'
        );
        return false;
      }
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setStepErrors(null);
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrevStep = () => {
    setStepErrors(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleStepClick = (stepId: number) => {
    if (stepId < currentStep) {
      setStepErrors(null);
      setCurrentStep(stepId);
    } else if (stepId > currentStep) {
      if (validateStep(currentStep)) {
        setStepErrors(null);
        setCurrentStep(stepId);
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep <= 4) {
      handleNextStep();
    } else {
      if (validateStep(1) && validateStep(2) && validateStep(3) && validateStep(4)) {
        handleCreateOrder(e);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-955/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl my-4 overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.18)] flex flex-col max-h-[92vh]">

        {/* ======================================================== */}
        {/* 1. FIXED TOP HEADER Across ALL Steps                     */}
        {/* ======================================================== */}
        <div className="bg-slate-955 border-b border-slate-800/80 p-4 space-y-3 shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-start">
              <div className="w-3 h-3 rounded-full bg-[#d4af37] animate-pulse"></div>
              <h3 className="font-black text-white text-base">
                {isAr ? 'إنشاء فاتورة طلب جديد' : 'Create Order Invoice'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="bg-slate-800 text-slate-400 hover:text-white p-1.5 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Fixed Metrics Bar (5 Persistent Fields across steps) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-slate-900/90 border border-slate-800/80 p-3 rounded-2xl text-xs font-bold">
            {/* 1. Order Number */}
            <div className="bg-slate-955/70 p-2.5 rounded-xl border border-slate-800/60 text-start">
              <span className="block text-[9px] text-slate-500 font-black uppercase tracking-wider">
                {isAr ? 'رقم الطلب الموحد' : 'Unified Order Code'}
              </span>
              <span className="font-mono text-xs font-black text-[#d4af37] truncate block">
                {previewOrderNumber || '—'}
              </span>
            </div>

            {/* 2. Order Date */}
            <div className="bg-slate-955/70 p-2.5 rounded-xl border border-slate-800/60 text-start">
              <span className="block text-[9px] text-slate-500 font-black uppercase tracking-wider">
                {isAr ? 'تاريخ الفاتورة' : 'Invoice Date'}
              </span>
              <span className="font-sans text-xs font-bold text-slate-200 truncate block">
                {new Date().toLocaleDateString(isAr ? 'ar-YE' : 'en-US')}
              </span>
            </div>

            {/* 3. Default Order Currency */}
            <div className="bg-slate-955/70 p-2.5 rounded-xl border border-slate-800/60 text-start">
              <span className="block text-[9px] text-slate-500 font-black uppercase tracking-wider">
                {isAr ? 'عملة الطلب' : 'Order Currency'}
              </span>
              <span className="font-mono text-xs font-black text-amber-400 truncate block">
                {orderCurrency || 'SAR'}
              </span>
            </div>

            {/* 4. Selected Customer Name */}
            <div className="bg-slate-955/70 p-2.5 rounded-xl border border-slate-800/60 text-start">
              <span className="block text-[9px] text-slate-500 font-black uppercase tracking-wider">
                {isAr ? 'اسم العميل' : 'Customer Name'}
              </span>
              <span className="text-xs font-bold truncate block text-white">
                {formData.customerName || (isAr ? '⚠️ لم يتم الاختيار' : '⚠️ Unassigned')}
              </span>
            </div>

            {/* 5. Other Fees (رسوم أخرى) */}
            <div className="bg-slate-955/70 p-2.5 rounded-xl border border-slate-800/60 text-start col-span-2 sm:col-span-1">
              <span className="block text-[9px] text-slate-500 font-black uppercase tracking-wider">
                {isAr ? 'رسوم اخرى' : 'Other Fees'}
              </span>
              <span className="font-mono text-xs font-black text-blue-400 truncate block">
                {(calcs?.profitCompanySAR || 0).toLocaleString()} SAR
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. VISUAL PROGRESS BAR FOR STEPS                         */}
        {/* ======================================================== */}
        <div className="bg-slate-950/80 border-b border-slate-800/60 px-4 sm:px-8 py-3.5 shrink-0">
          <div className="flex items-center justify-between relative max-w-4xl mx-auto">
            {/* Connecting line */}
            <div className="absolute top-5 left-6 right-6 h-1 bg-slate-800 -translate-y-1/2 z-0 rounded-full"></div>
            {/* Active progress bar line fill */}
            <div
              className="absolute top-5 h-1 bg-gradient-to-r from-[#d4af37] via-amber-400 to-yellow-500 -translate-y-1/2 z-0 rounded-full transition-all duration-500 ease-out"
              style={{
                left: isAr ? 'auto' : '1.5rem',
                right: isAr ? '1.5rem' : 'auto',
                width: `${((currentStep - 1) / (STEPS.length - 1)) * 92}%`
              }}
            ></div>

            {STEPS.map((step) => {
              const isCompleted = step.id < currentStep;
              const isActive = step.id === currentStep;
              const Icon = step.icon;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleStepClick(step.id)}
                  className={`relative z-10 flex flex-col items-center group cursor-pointer transition-all ${isActive ? 'scale-105' : 'hover:scale-102'
                    }`}
                >
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-black text-xs transition-all duration-300 shadow-lg ${isCompleted
                      ? 'bg-emerald-500 text-black border-2 border-emerald-400 shadow-emerald-500/20'
                      : isActive
                        ? 'bg-gradient-to-br from-[#d4af37] to-yellow-600 text-black border-2 border-yellow-300 shadow-[#d4af37]/30 ring-4 ring-[#d4af37]/20'
                        : 'bg-slate-900 text-slate-500 border border-slate-800 group-hover:border-slate-700'
                      }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-5 h-5 stroke-[2.5]" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="mt-1.5 text-center">
                    <span
                      className={`block text-[10px] sm:text-[11px] font-black tracking-tight transition-colors ${isActive
                        ? 'text-[#d4af37]'
                        : isCompleted
                          ? 'text-emerald-400'
                          : 'text-slate-500 group-hover:text-slate-400'
                        }`}
                    >
                      {isAr ? step.titleAr : step.titleEn}
                    </span>
                    <span className="block text-[8px] font-bold text-slate-600">
                      {isAr ? `خطوة ${step.id}` : `Step ${step.id}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Validation Error Alert Banner */}
        {stepErrors && (
          <div className="bg-rose-950/70 border-b border-rose-900/80 px-6 py-2.5 text-rose-300 text-xs font-black flex items-center justify-between gap-3 animate-shake shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{stepErrors}</span>
            </div>
            <button onClick={() => setStepErrors(null)} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. STEP FORM BODY CONTENT (Scrollable)                   */}
        {/* ======================================================== */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 custom-scrollbar text-start">

          {/* ---------------------------------------------------- */}
          {/* STEP 1: Customer & Order Source Details              */}
          {/* ---------------------------------------------------- */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              {/* Debt Alert Warning Banner if Customer has Outstanding Debt */}
              {customerProfileStats && customerProfileStats.totalOutstandingDebt > 0 && (
                <div className="p-4 bg-red-950/30 border border-red-900 text-red-400 rounded-2xl flex items-center gap-3 animate-pulse">
                  <AlertCircle className="w-6 h-6 shrink-0 text-red-500" />
                  <span className="font-black text-xs leading-relaxed">
                    {isAr
                      ? `⚠️ تنبيه ديون معلقة: يوجد للعميل الحالي ديون غير محصلة ومستحقة بذمته بقيمة: [ ${customerProfileStats.totalOutstandingDebt.toLocaleString()} ريال يمني ].`
                      : `⚠️ Outstanding Balances Warning: This client has outstanding pending balances of [ YER ${customerProfileStats.totalOutstandingDebt.toLocaleString()} ].`}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Customer Selection */}
                <div className="space-y-4 bg-slate-950/40 border border-slate-800 p-5 rounded-3xl relative">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-[#d4af37] flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      {isAr ? (isStaffOrder ? 'اختيار طرف الطلب' : 'اختيار وتحديد العميل المستلم') : (isStaffOrder ? 'Choose order party' : 'Receiver Customer')} *
                    </label>
                    {(role === 'Admin' || hasPermission('add_customers')) && (
                      <button
                        type="button"
                        onClick={() => setIsAddCustomerOpen(true)}
                        className="text-xs font-black text-[#d4af37] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {isAr ? 'إضافة عميل جديد ➕' : 'Quick add customer'}
                      </button>
                    )}
                  </div>

                  <OrderPartyPicker
                    isAr={isAr}
                    parties={orderParties}
                    selectedParty={selectedOrderParty}
                    staffOnly={isStaffOrder}
                    onStaffOnlyChange={setIsStaffOrder}
                    onSelect={selectOrderParty}
                    onClear={clearSelectedCustomer}
                  />

                  {!formData.customerId && !isStaffOrder ? (
                    <div className="relative">
                      <Search className="absolute right-3 top-3 text-slate-500 w-4 h-4" />
                      <input
                        type="text"
                        placeholder={isAr ? "ابحث عن عميل بالاسم أو رقم الجوال..." : "Search customer by name or phone..."}
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl py-3 pr-9 pl-4 outline-none font-bold text-xs focus:border-[#d4af37]/60"
                      />

                      {customerSearchQuery.trim() !== '' && (
                        <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-800">
                          {filteredCustomers.length > 0 ? (
                            filteredCustomers.map((c) => (
                              <button
                                type="button"
                                key={c.id}
                                onClick={() => selectCustomer(c)}
                                className="w-full text-start p-3 text-xs hover:bg-slate-800 text-white font-bold flex justify-between items-center cursor-pointer"
                              >
                                <span>{c.fullName}</span>
                                <span className="font-mono text-slate-500">{c.phone}</span>
                              </button>
                            ))
                          ) : (
                            <div className="p-3 text-xs text-slate-500 font-bold flex justify-between items-center">
                              <span>{isAr ? '🟢 عميل جديد' : '🟢 New Customer'}</span>
                              {(role === 'Admin' || hasPermission('add_customers')) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomerFormData((prev: any) => ({
                                      ...prev,
                                      fullName: customerSearchQuery,
                                    }));
                                    setIsAddCustomerOpen(true);
                                  }}
                                  className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 px-3 py-1 rounded-lg text-[10px]"
                                >
                                  {isAr ? 'إضافة الآن' : 'Create Now'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : !isStaffOrder ? (
                    <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl space-y-3 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-[#d4af37]/5 rounded-full -mr-8 -mt-8"></div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-black text-white">{formData.customerName}</h4>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formData.customerPhone}</p>
                        </div>
                        <div className="flex gap-1.5 items-center">
                          {customerProfileStats?.tier === 'VIP' && (
                            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/25 px-2 py-0.5 rounded text-[8px] font-black uppercase">VIP Client</span>
                          )}
                          {customerProfileStats?.tier === 'Debt' && (
                            <span className="bg-red-500/10 text-red-500 border border-red-500/25 px-2 py-0.5 rounded text-[8px] font-black uppercase">Has Debt</span>
                          )}
                          {customerProfileStats?.tier === 'Regular' && (
                            <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Regular</span>
                          )}
                          <button
                            type="button"
                            onClick={clearSelectedCustomer}
                            className="bg-slate-800 text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-850/50">
                        <div>{isAr ? 'إجمالي الطلبات:' : 'Total orders:'} <span className="text-slate-300 font-mono">{customerProfileStats?.totalOrdersCount || 0}</span></div>
                        <div>{isAr ? 'آخر طلب:' : 'Last order:'} <span className="text-slate-300 font-mono">{customerProfileStats?.lastOrderDate ? new Date(customerProfileStats.lastOrderDate).toLocaleDateString() : '—'}</span></div>
                        <div className="col-span-2">{isAr ? 'العنوان الأساسي:' : 'Address:'} <span className="text-slate-300">{formData.customerAddress || '—'}</span></div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* 2. Order Source & References */}
                <div className="space-y-4 bg-slate-950/40 border border-slate-800 p-5 rounded-3xl">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider text-start">
                        {isAr ? 'مصدر الشراء والطلب' : 'Order Source'} *
                      </label>
                      {(role === 'Admin' || hasPermission('add_sources')) && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddSourceOpen(true);
                          }}
                          className="text-[10px] font-black text-[#d4af37] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          ➕ {isAr ? 'مصدر جديد' : 'New Source'}
                        </button>
                      )}
                    </div>
                    <select
                      required
                      value={formData.orderSourceId}
                      onChange={(e) => setFormData({ ...formData, orderSourceId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs cursor-pointer focus:border-[#d4af37]"
                    >
                      <option value="">{isAr ? '-- اختر مصدر الشراء --' : '-- Choose Source --'}</option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>{s.name || s.source_name} {s.type ? `(${s.type})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-start">
                      {isAr ? 'رقم الفاتورة الأصلي (سلة / المتجر)' : 'Orig. Store Reference'}
                    </label>
                    <input
                      type="text"
                      value={formData.externalOrderNumber}
                      onChange={(e) => setFormData({ ...formData, externalOrderNumber: e.target.value })}
                      placeholder={isAr ? "رقم الفاتورة في سلة أو المتجر الأصلي" : "Original Invoice ID"}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider text-start">
                      {isAr ? 'رقم التتبع الدولي (Global Tracking)' : 'Global Tracking Code'}
                    </label>
                    <input
                      type="text"
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                      placeholder={isAr ? "رقم التتبع الدولي (DHL...)" : "Global Tracking ID"}
                      className="w-full bg-slate-950 border border-slate-805 text-white rounded-xl p-3 outline-none font-bold text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 2: Cart Code, Products & Items Table            */}
          {/* ---------------------------------------------------- */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-fade-in">
              {/* Cart Share Code Bar */}
              <div className="bg-slate-955/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="text-start">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    {isAr ? 'كود السلة الموحد (Cart Share Code)' : 'Cart Share Code'}
                  </label>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {isAr ? 'إدخال كود السلة للتفعيل والمشاركة السريعة' : 'Enter cart share token for quick web view'}
                  </span>
                </div>
                <div className="flex gap-2 max-w-xs w-full">
                  <input
                    type="text"
                    value={cartShareCode}
                    onChange={(e) => setCartShareCode(e.target.value)}
                    placeholder={isAr ? "كود السلة" : "Cart Code"}
                    className="flex-1 bg-slate-950 border border-slate-805 text-white rounded-xl p-2.5 outline-none font-bold text-xs font-mono"
                  />
                  {cartShareCode && (
                    <button
                      type="button"
                      onClick={() => window.open(`https://cart.shop/share/${cartShareCode}`, '_blank')}
                      className="bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/25 text-[#d4af37] px-3 rounded-xl text-xs flex items-center justify-center transition cursor-pointer"
                      title={isAr ? 'فتح رابط السلة' : 'Open cart URL'}
                    >
                      <Package className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Detailed Products Table */}
              <div className="space-y-3 bg-slate-955/20 border border-slate-850 p-5 rounded-3xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 flex-wrap gap-2">
                  <div className="text-start">
                    <span className="text-xs font-black text-white block flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4 text-[#d4af37]" />
                      {isAr ? 'محتويات الشحنة والمنتجات التفصيلية' : 'Freight Cargo Products'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {isAr ? 'أدخل أصناف المنتج وأسعارها والكميات بالتفصيل' : 'Define detailed products lists for pricing & weight'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="bg-cyan-600/10 hover:bg-cyan-650/20 text-cyan-400 border border-cyan-500/20 px-3.5 py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1"
                  >
                    ➕ {isAr ? 'إدراج بند منتج جديد' : 'Add Product Item'}
                  </button>
                </div>

                <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-black text-slate-500 uppercase tracking-wider pb-1 px-2.5">
                  <div className="col-span-3 text-start">{isAr ? 'اسم المنتج' : 'Item Name'}</div>
                  <div className="col-span-2 text-center">{isAr ? 'السعر (SAR)' : 'Price (SAR)'}</div>
                  <div className="col-span-1 text-center">{isAr ? 'الكمية' : 'Qty'}</div>
                  {formData.orderSourceType === 'Factory' ? (
                    <>
                      <div className="col-span-1 text-center">{isAr ? 'وزن (KG)' : 'Weight'}</div>
                      <div className="col-span-1 text-center">CBM</div>
                      <div className="col-span-1 text-center">{isAr ? 'طول' : 'L'}</div>
                      <div className="col-span-1 text-center">{isAr ? 'عرض' : 'W'}</div>
                      <div className="col-span-1 text-center">{isAr ? 'ارتفاع' : 'H'}</div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-2 text-center">{isAr ? 'رابط المنتج' : 'URL Link'}</div>
                      <div className="col-span-3 text-center">{isAr ? 'رقم التتبع للمنتج' : 'Product Tracking'}</div>
                    </>
                  )}
                  <div className="col-span-1 text-center">{isAr ? 'حذف' : 'Del'}</div>
                </div>

                <div className="space-y-2.5">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-3 bg-slate-900/50 border border-slate-850/60 rounded-2xl hover:border-slate-800 transition">
                      <div className="col-span-3">
                        <input
                          required
                          type="text"
                          value={item.productName || ''}
                          onChange={(e) => updateItemRow(idx, 'productName', e.target.value)}
                          placeholder={isAr ? "اسم المنتج..." : "Product Name"}
                          className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] text-start focus:border-[#d4af37]"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          required
                          type="number"
                          value={item.productPrice || 0}
                          onChange={(e) => updateItemRow(idx, 'productPrice', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center focus:border-[#d4af37]"
                        />
                      </div>

                      <div className="col-span-1">
                        <input
                          required
                          type="number"
                          value={item.quantity || 1}
                          onChange={(e) => updateItemRow(idx, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center focus:border-[#d4af37]"
                        />
                      </div>

                      {formData.orderSourceType === 'Factory' ? (
                        <>
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.weight ?? ''}
                              onChange={(e) => updateItemRow(idx, 'weight', e.target.value)}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.cbm ?? ''}
                              onChange={(e) => updateItemRow(idx, 'cbm', e.target.value)}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.length ?? ''}
                              onChange={(e) => {
                                const newL = e.target.value;
                                const w = parseFloat(item.width || 0);
                                const h = parseFloat(item.height || 0);
                                updateItemRow(idx, 'length', newL);
                                updateItemRow(idx, 'cbm', parseFloat(((parseFloat(newL || '0') * w * h) / 1000000).toFixed(6)));
                              }}
                              placeholder="L"
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.width ?? ''}
                              onChange={(e) => {
                                const newW = e.target.value;
                                const l = parseFloat(item.length || 0);
                                const h = parseFloat(item.height || 0);
                                updateItemRow(idx, 'width', newW);
                                updateItemRow(idx, 'cbm', parseFloat(((l * parseFloat(newW || '0') * h) / 1000000).toFixed(6)));
                              }}
                              placeholder="W"
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                          <div className="col-span-1">
                            <input
                              type="number"
                              step="any"
                              value={item.height ?? ''}
                              onChange={(e) => {
                                const newH = e.target.value;
                                const l = parseFloat(item.length || 0);
                                const w = parseFloat(item.width || 0);
                                updateItemRow(idx, 'height', newH);
                                updateItemRow(idx, 'cbm', parseFloat(((l * w * parseFloat(newH || '0')) / 1000000).toFixed(6)));
                              }}
                              placeholder="H"
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] font-mono text-center"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={item.productUrl || ''}
                              onChange={(e) => updateItemRow(idx, 'productUrl', e.target.value)}
                              placeholder={isAr ? "رابط المنتج..." : "Product Link"}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] text-start"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="text"
                              value={item.trackingNumber || ''}
                              onChange={(e) => updateItemRow(idx, 'trackingNumber', e.target.value)}
                              placeholder={isAr ? "كود تتبع الطرد للمنتج" : "Item Tracking Number"}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold text-[11px] text-start font-mono"
                            />
                          </div>
                        </>
                      )}

                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length === 1}
                          className="text-rose-500 hover:text-white hover:bg-rose-600/20 p-2 rounded-xl transition disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Packaging Type Selection Sub-row */}
                      <div className="col-span-12 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/40 text-[10px] text-start">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-cyan-400">{isAr ? 'فئة الصنف:' : 'Item category:'}</span>
                          <select
                            value={item.itemCategoryId || ''}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const category = itemCategories.find((entry: any) => entry.id === selectedId);
                              updateItemRow(idx, 'itemCategoryId', selectedId);
                              updateItemRow(idx, 'itemCategoryName', category ? (isAr ? category.nameAr : category.nameEn) : '');
                            }}
                            className="bg-slate-950 border border-slate-800 text-white font-bold rounded-xl px-3 py-1.5 text-[11px] outline-none cursor-pointer focus:border-cyan-400"
                          >
                            <option value="">{isAr ? '-- بدون فئة --' : '-- No category --'}</option>
                            {itemCategories.map((category: any) => <option key={category.id} value={category.id}>{isAr ? category.nameAr : category.nameEn}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-amber-400 flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            {isAr ? 'نوع التغليف الخاص بالمنتج:' : 'Product Packaging Type:'}
                          </span>
                          <select
                            value={item.packagingOptionId || ''}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const foundOpt = packagingOptions?.find((o: any) => o.id === selectedId);
                              updateItemRow(idx, 'packagingOptionId', selectedId);
                              updateItemRow(idx, 'packagingOptionName', foundOpt ? (isAr ? foundOpt.nameAr : foundOpt.nameEn) : '');
                              updateItemRow(idx, 'packagingOptionPrice', foundOpt ? (parseFloat(foundOpt.price) || 0) : 0);
                            }}
                            className="bg-slate-950 border border-slate-800 text-white font-bold rounded-xl px-3 py-1.5 text-[11px] outline-none cursor-pointer focus:border-[#d4af37]"
                          >
                            <option value="">{isAr ? '-- بدون تغليف خاص (0) --' : '-- Standard (0) --'}</option>
                            {(packagingOptions || []).map((pkg: any) => (
                              <option key={pkg.id} value={pkg.id}>
                                {isAr ? pkg.nameAr : pkg.nameEn} {pkg.price > 0 ? `(+${pkg.price} ${orderCurrency})` : '(مجاني)'}
                              </option>
                            ))}
                          </select>
                        </div>
                        {item.packagingOptionPrice > 0 && (
                          <span className="text-emerald-400 font-mono font-bold bg-emerald-950/20 border border-emerald-900/40 px-2 py-0.5 rounded-lg">
                            +{((parseFloat(item.packagingOptionPrice) || 0) * (parseFloat(item.quantity) || 1)).toLocaleString()} {orderCurrency}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bank Commission & Coupon Adjustments */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-850/65">
                  <div className="flex flex-col gap-2 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="bank-comm-check"
                        checked={bankCommissionEnabled}
                        onChange={(e) => setBankCommissionEnabled(e.target.checked)}
                        className="rounded bg-slate-955 border-slate-800 text-yellow-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="bank-comm-check" className="text-[11px] font-bold text-slate-350 cursor-pointer">
                        {isAr ? 'عمولة البنك' : 'Bank Commission'}
                      </label>
                    </div>
                    {bankCommissionEnabled && (
                      <div className="flex items-center gap-2 bg-[#d4af37]/5">
                        <select
                          value={bankCommissionType}
                          onChange={(e) => setBankCommissionType(e.target.value as 'percentage' | 'fixed')}
                          className="bg-slate-955  border border-slate-800 text-slate-300 rounded-xl p-1.5 text-[10px]"
                        >
                          <option className='bg-slate-900 text-white' value="percentage">{isAr ? 'نسبة (%)' : 'Percentage (%)'}</option>
                          <option className='bg-slate-900 text-white' value="fixed">{isAr ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
                        </select>
                        <input
                          type="number"
                          value={bankCommissionRate}
                          onChange={(e) => setBankCommissionRate(parseFloat(e.target.value) || 0)}
                          className="w-20 bg-slate-955 border border-slate-800 text-white rounded-xl p-1.5 text-center font-mono font-bold text-[10px]"
                          placeholder={bankCommissionType === 'percentage' ? '%' : 'SAR'}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850">
                    <input
                      type="checkbox"
                      id="coupon-check"
                      checked={couponEnabled}
                      onChange={(e) => setCouponEnabled(e.target.checked)}
                      className="rounded bg-slate-955 border-slate-800 text-yellow-600 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="coupon-check" className="text-[11px] font-bold text-slate-350 cursor-pointer">
                      {isAr ? 'كوبون خصم (مبلغ)' : 'Coupon Discount (Amount)'}
                    </label>
                    {couponEnabled && (
                      <input
                        type="number"
                        value={couponRate}
                        onChange={(e) => setCouponRate(parseFloat(e.target.value) || 0)}
                        className="w-20 bg-slate-955 border border-slate-800 text-white rounded-xl p-1.5 text-center font-mono font-bold text-[10px]"
                        placeholder="0.00"
                      />
                    )}
                  </div>

                  {formData.orderSourceType === 'App' && (
                    <div className="flex items-center gap-3 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850">
                      <input
                        type="checkbox"
                        id="add-shipping-check"
                        checked={addShippingEnabled}
                        onChange={(e) => setAddShippingEnabled(e.target.checked)}
                        className="rounded bg-slate-955 border-slate-800 text-yellow-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="add-shipping-check" className="text-[11px] font-bold text-slate-350 cursor-pointer">
                        {isAr ? 'إضافة تفاصيل الشحن للطلب' : 'Add Shipping Tracks'}
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 3: Shipping, Logistics & Field Couriers         */}
          {/* ---------------------------------------------------- */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              {/* Shipping Tracks List */}
              {formData.orderSourceType !== 'SHEIN' && (formData.orderSourceType !== 'App' || addShippingEnabled) && (
                <div className="space-y-4 bg-slate-950/30 border border-slate-850 p-5 rounded-3xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3 flex-wrap gap-2">
                    <div className="text-start">
                      <span className="text-xs font-black text-white block flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-[#d4af37]" />
                        {isAr ? 'تفاصيل شحنات المسار اللوجيستي' : 'Shipping Manifest Tracks'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold mt-0.5">
                        {isAr ? 'أدخل مسارات الشحن المعتمدة والتكاليف والشركات الناقلة' : 'Define transport companies and costs for delivery tracks'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addShippingRow}
                      className="bg-emerald-600/10 hover:bg-emerald-650/20 text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1"
                    >
                      ➕ {isAr ? 'إضافة مسار شحن جديد' : 'Add Shipping Track'}
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {shippings && shippings.map((sh, idx) => (
                      <div key={sh.id || idx} className="bg-slate-900/50 p-4 rounded-2xl border border-slate-850 space-y-3 relative">
                        <div className="flex justify-between items-center border-b border-slate-850/60 pb-2">
                          <span className="text-[10px] font-black text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2.5 py-0.5 rounded-lg">
                            {isAr ? `مسار الشحن #${idx + 1}` : `Shipping Track #${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeShippingRow(idx)}
                            className="text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/20 transition-all font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isAr ? 'إلغاء المسار' : 'Delete Segment'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] text-start font-bold">
                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'نوع الشحن' : 'Mode'}</label>
                            <select
                              value={sh.shippingType || 'بري'}
                              onChange={(e) => updateShippingRow(idx, 'shippingType', e.target.value)}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold cursor-pointer"
                            >
                              <option className="bg-slate-900 text-white" value="بري">{isAr ? 'Overland بري' : 'Land - Overland'}</option>
                              <option className="bg-slate-900 text-white" value="جوي">{isAr ? 'Air Freight جوي' : 'Air - Air Freight'}</option>
                              <option className="bg-slate-900 text-white" value="بحري">{isAr ? 'Ocean Cargo بحري' : 'Sea - Ocean Cargo'}</option>
                            </select>
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="block text-slate-400">{isAr ? 'شركة الشحن' : 'Carrier'}</label>
                              {(role === 'Admin' || hasPermission('add_sources')) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveAddShippingIndex(idx);
                                    setIsAddShippingCompanyOpen(true);
                                  }}
                                  className="text-[10px] font-black text-cyan-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                  ➕ {isAr ? 'شركة جديدة' : 'New Carrier'}
                                </button>
                              )}
                            </div>
                            <select
                              value={sh.shippingCompany || ''}
                              onChange={(e) => updateShippingRow(idx, 'shippingCompany', e.target.value)}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-bold cursor-pointer"
                            >
                              <option className="bg-slate-900 text-white" value="">{isAr ? '-- اختر شركة شحن --' : '-- Choose carrier --'}</option>
                              {shippingCompanies.map((c) => (
                                <option className="bg-slate-900 text-white" key={c.id} value={c.name}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'فئة سرعة الشحن (order_option)' : 'Shipping Category'}</label>
                            <select
                              value={sh.shippingCategoryId || ''}
                              onChange={(e) => {
                                const selectedId = e.target.value;
                                const foundOpt = shippingCategoryOptions?.find((o: any) => o.id === selectedId);
                                updateShippingRow(idx, {
                                  shippingCategoryId: selectedId,
                                  shippingCategoryName: foundOpt ? (isAr ? foundOpt.nameAr : foundOpt.nameEn) : '',
                                  shippingCategoryPrice: foundOpt ? (parseFloat(foundOpt.price) || 0) : 0,
                                  shippingDuration: foundOpt?.duration !== undefined ? String(foundOpt.duration) : sh.shippingDuration
                                });
                              }}
                              className="w-full bg-slate-955 border border-slate-800 text-cyan-300 font-bold rounded-xl p-2.5 outline-none cursor-pointer focus:border-[#d4af37]"
                            >
                              <option className="bg-slate-900 text-white" value="">{isAr ? '-- عادي (اعتيادي) --' : '-- Standard --'}</option>
                              {(shippingCategoryOptions || []).map((cat: any) => (
                                <option className="bg-slate-900 text-white" key={cat.id} value={cat.id}>
                                  {isAr ? cat.nameAr : cat.nameEn} {cat.duration ? `(${cat.duration} ${isAr ? 'أيام' : 'd'})` : ''} {cat.price > 0 ? `(+${cat.price} ${orderCurrency})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'رقم التتبع للشحنة' : 'Tracking Number'}</label>
                            <input
                              type="text"
                              value={sh.trackingNumber || ''}
                              onChange={(e) => updateShippingRow(idx, 'trackingNumber', e.target.value)}
                              placeholder={isAr ? "رقم التتبع المخصص للشحنة" : "Cargo tracking ID"}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'أجرة وتكاليف النقل (SAR)' : 'Shipping Cost (SAR)'}</label>
                            <input
                              type="number"
                              required
                              value={sh.shippingCost || 0}
                              onChange={(e) => updateShippingRow(idx, 'shippingCost', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-955 border border-slate-800 text-[#d4af37] rounded-xl p-2.5 outline-none font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'مكان التصدير' : 'Source'}</label>
                            <input
                              type="text"
                              required
                              value={sh.shippingSource || ''}
                              onChange={(e) => updateShippingRow(idx, 'shippingSource', e.target.value)}
                              placeholder={isAr ? "مثال: الصين، دبي" : "Source country"}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'مكان الاستلام' : 'Destination'}</label>
                            <input
                              type="text"
                              required
                              value={sh.shippingDestination || ''}
                              onChange={(e) => updateShippingRow(idx, 'shippingDestination', e.target.value)}
                              placeholder={isAr ? "مثال: مستودع صنعاء" : "Destination depot"}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'تاريخ الانطلاق' : 'Dispatch Date'}</label>
                            <input
                              type="date"
                              value={sh.shippingDate || ''}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                let expected = sh.expectedArrival || '';
                                if (newDate && sh.shippingDuration) {
                                  const days = parseInt(sh.shippingDuration);
                                  if (!isNaN(days)) {
                                    const dateObj = new Date(newDate);
                                    dateObj.setDate(dateObj.getDate() + days);
                                    expected = dateObj.toISOString().split('T')[0];
                                  }
                                }
                                updateShippingRow(idx, { shippingDate: newDate, expectedArrival: expected });
                              }}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1">{isAr ? 'موعد الوصول المتوقع' : 'Expected Arrival'}</label>
                            <input
                              type="date"
                              value={sh.expectedArrival || ''}
                              onChange={(e) => updateShippingRow(idx, 'expectedArrival', e.target.value)}
                              className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-sans"
                            />
                          </div>

                          <div className="md:col-span-4 border-t border-cyan-500/15 pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                            <div className="lg:col-span-2">
                              <label className="block text-cyan-300 mb-1 font-black">{isAr ? 'فئة محتوى الشحنة' : 'Shipment content category'}</label>
                              <select
                                value={sh.contentCategoryId || ''}
                                onChange={(e) => updateShipmentContentCategory(idx, e.target.value)}
                                className="w-full bg-slate-950 border border-cyan-500/25 text-white rounded-xl p-2.5 outline-none font-bold cursor-pointer focus:border-cyan-400"
                              >
                                <option className="bg-slate-900 text-white" value="">{isAr ? '-- بدون فئة --' : '-- No category --'}</option>
                                {itemCategories.map((category: any) => <option className="bg-slate-900 text-white" key={category.id} value={category.id}>{isAr ? category.nameAr : category.nameEn}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-slate-500 mb-1">{isAr ? 'عدد الكراتين' : 'Cartons'}</label>
                              <input
                                type="number"
                                min="0"
                                value={sh.cartonCount ?? 0}
                                onChange={(e) => updateShipmentContentCategory(idx, sh.contentCategoryId || '', Math.max(0, parseInt(e.target.value, 10) || 0))}
                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 outline-none font-mono text-center"
                              />
                            </div>
                            <ShipmentFeeCell label={isAr ? 'جمارك' : 'Customs'} value={sh.customsFee} currency={sh.categoryFeeCurrency} />
                            <ShipmentFeeCell label={isAr ? 'ضريبة' : 'Tax'} value={sh.taxFee} currency={sh.categoryFeeCurrency} />
                            <ShipmentFeeCell label={isAr ? 'رسوم أخرى' : 'Other fees'} value={sh.otherCategoryFee} currency={sh.categoryFeeCurrency} />
                            <ShipmentFeeCell label={isAr ? 'إجمالي رسوم الفئة' : 'Category fees total'} value={sh.categoryFeesTotal} currency={sh.categoryFeeCurrency} emphasized />
                            <p className="lg:col-span-7 text-[9px] text-slate-500">{isAr ? 'تسجل هذه الرسوم مع الشحنة فقط، ولا تُضاف إلى إجمالي الطلب أو الدفعة المطلوبة.' : 'These fees are stored with the shipment only and are not added to the order total or payment due.'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850 text-start">
                    <input
                      type="checkbox"
                      id="packaging-fee-check"
                      checked={packagingFeeEnabled}
                      onChange={(e) => setPackagingFeeEnabled(e.target.checked)}
                      className="rounded bg-slate-955 border-slate-800 text-yellow-600 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="packaging-fee-check" className="text-[11px] font-bold text-slate-350 cursor-pointer">
                      {isAr ? 'إضافة رسوم تغليف شركة الشحن (ريال ثابت)' : 'Add carrier packaging fee (fixed SAR)'}
                    </label>
                    {packagingFeeEnabled && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={packagingFeeRate}
                          onChange={(e) => canEditOrderDefaultsCreation && setPackagingFeeRate(parseFloat(e.target.value) || 0)}
                          disabled={!canEditOrderDefaultsCreation}
                          className="w-24 bg-slate-955 border border-slate-800 text-white rounded-xl p-1.5 text-center font-mono font-bold text-[11px] disabled:opacity-50"
                          placeholder="0"
                        />
                        <span className="text-[10px] text-slate-500 font-bold">SAR</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Field Logistics & Couriers Section */}
              <div className="space-y-4 bg-slate-955/20 border border-slate-800 p-5 rounded-3xl">
                <span className="block text-xs font-black text-white text-start mb-1 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-[#d4af37]" />
                  {isAr ? 'المناديب واللوجستيات الميدانية' : 'Field Logistics & Delivery Drivers'}
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-start font-bold">
                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'موظف التعبئة والتجميع (سعودي)' : 'Saudi Partner Aggregator'}</label>
                    <select
                      value={formData.shippingCourierId}
                      onChange={(e) => setFormData({ ...formData, shippingCourierId: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-855 text-white rounded-xl p-3 outline-none text-[11px] font-bold cursor-pointer"
                    >
                      <option className="bg-slate-900 text-white" value="">{isAr ? '-- اختر موظف التجميع --' : '-- Choose Aggregator --'}</option>
                      {couriers.filter(c => c.courierType === 'sourcing').map(c => (
                        <option className="bg-slate-900 text-white" key={c.id} value={c.id}>
                          {c.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'مندوب التوزيع النهائي (اليمن)' : 'Yemen Delivery Driver'}</label>
                    <select
                      value={formData.deliveryCourierId}
                      onChange={(e) => setFormData({ ...formData, deliveryCourierId: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-855 text-white rounded-xl p-3 outline-none text-[11px] font-bold cursor-pointer"
                    >
                      <option className="bg-slate-900 text-white" value="">{isAr ? '-- اختر مندوب التوصيل --' : '-- Choose Yemen Driver --'}</option>
                      {couriers.filter(c => c.courierType === 'local' || !c.courierType).map(c => (
                        <option className="bg-slate-900 text-white" key={c.id} value={c.id}>
                          {c.fullName} {c.governorate || c.provinceId ? `(${c.governorate || c.provinceId})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? `رسوم التوصيل لليمن (${formData.deliveryCourierFeeCurrency || settings.currency || 'YER'})` : `Delivery Courier Fee (${formData.deliveryCourierFeeCurrency || settings.currency || 'YER'})`}</label>
                    <input
                      type="number"
                      value={formData.deliveryCourierFee}
                      onChange={(e) => setFormData({ ...formData, deliveryCourierFee: parseFloat(e.target.value) || 0 })}
                      disabled={!canEditOrderDefaultsCreation}
                      className="w-full bg-slate-955 border border-slate-855 text-white rounded-xl p-3 outline-none font-mono text-xs text-center disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 4: Financials, Currency & Payment               */}
          {/* ---------------------------------------------------- */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-fade-in">
              {/* Top inputs row: order-specific rates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 border border-slate-800 p-5 rounded-3xl text-[11px] font-bold text-slate-400 text-start">
                {formData.orderSourceType === 'SHEIN' && (
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1.5">
                      {isAr ? 'سعر شي إن الأحمر (' + orderCurrency + ')' : 'SHEIN Red Price (' + orderCurrency + ')'}
                    </label>
                    <input
                      type="number"
                      value={formData.sheinRedPrice || ''}
                      onChange={(e) => setFormData({ ...formData, sheinRedPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-955 border border-slate-805 text-white rounded-xl p-3 outline-none font-mono text-xs"
                      placeholder="0.00"
                    />
                  </div>
                )}
                {formData.orderSourceType === 'Factory' && (
                  <>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1.5">
                        {isAr ? 'نسبة الربح للكيلو (' + orderCurrency + '/كجم)' : 'Profit Rate per KG (' + orderCurrency + '/kg)'}
                      </label>
                      <input type="number" step="any" value={profitPerKgRate}
                        onChange={(e) => setProfitPerKgRate(parseFloat(e.target.value) || 0)}
                        disabled={!canEditOrderDefaultsCreation}
                        className="w-full bg-slate-955 border border-slate-805 text-white rounded-xl p-3 outline-none font-mono text-xs disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1.5 font-bold">
                        {isAr ? 'سعر شحن الـ CBM (دولار USD/m³)' : 'CBM Shipping Rate (USD/m³)'}
                      </label>
                      <input type="number" step="any" value={cbmShippingRateValue}
                        onChange={(e) => setCbmShippingRateValue(parseFloat(e.target.value) || 0)}
                        disabled={!canEditOrderDefaultsCreation}
                        className="w-full bg-slate-955 border border-slate-805 text-white rounded-xl p-3 outline-none font-mono text-xs disabled:opacity-50" />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1.5">
                    {isAr ? 'رسوم تغليف وشحن محلي (' + orderCurrency + ')' : 'KSA Wrapping Fee & Local Freight (' + orderCurrency + ')'}
                  </label>
                  <input type="number" value={formData.packagingFee || ''}
                    onChange={(e) => setFormData({ ...formData, packagingFee: parseFloat(e.target.value) || 0 })}
                    disabled={!canEditOrderDefaultsCreation}
                    className="w-full bg-slate-955 border border-slate-805 text-white rounded-xl p-3 outline-none font-mono text-xs disabled:opacity-50"
                    placeholder="0.00" />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2.5 cursor-pointer bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 hover:bg-slate-900 transition">
                    <input type="checkbox" checked={formData.deductSourcingCostFromCourier || false}
                      onChange={(e) => setFormData({ ...formData, deductSourcingCostFromCourier: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-955 text-[#d4af37] focus:ring-0 cursor-pointer accent-[#d4af37]" />
                    <span className="text-[11px] font-bold text-slate-300">
                      {isAr ? 'خصم تكاليف شراء المنتجات من حساب مندوب التجميع حالاً' : 'Deduct Original Products Cost from Courier Account'}
                    </span>
                  </label>
                </div>
              </div>

              {/* ── Two-Column: Financial Breakdown (left) vs Payment (right) ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* ═══ LEFT: Full Financial Breakdown ═══ */}
                <div className="p-5 bg-slate-955 rounded-2xl border border-slate-800 shadow-xl space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
                    <Calculator className="w-4 h-4 text-[#d4af37]" />
                    <span className="text-[11px] text-slate-300 font-extrabold uppercase tracking-widest">
                      {isAr ? 'الكشف المالي التفصيلي' : 'Financial Breakdown'}
                    </span>
                  </div>

                  {/* Products */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">{isAr ? '🛍 قيمة المنتجات:' : '🛍 Products Value:'}</span>
                    <span className="font-mono text-white font-bold">{(calcs.productsSum || 0).toLocaleString()} {orderCurrency}</span>
                  </div>

                  {/* Shipping cost — only if shippings exist AND cost > 0 */}
                  {shippings && shippings.length > 0 && shippings.reduce((s: number, sh: any) => s + (parseFloat(sh.shippingCost) || 0), 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '🚚 تكاليف الشحن:' : '🚚 Shipping Cost:'}</span>
                      <span className="font-mono text-blue-300 font-bold">
                        {shippings.reduce((s: number, sh: any) => s + (parseFloat(sh.shippingCost) || 0), 0).toLocaleString()} {orderCurrency}
                      </span>
                    </div>
                  )}

                  {/* Packaging fee — carrier packaging (packagingFeeEnabled) */}
                  {packagingFeeEnabled && packagingFeeRate > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '📦 رسوم تغليف شركة الشحن:' : '📦 Carrier Packaging Fee:'}</span>
                      <span className="font-mono text-purple-300 font-bold">{packagingFeeRate.toLocaleString()} {orderCurrency}</span>
                    </div>
                  )}

                  {/* Packaging options fees from order_option */}
                  {items && items.reduce((sum: number, it: any) => sum + ((parseFloat(it.packagingOptionPrice) || 0) * (parseFloat(it.quantity) || 1)), 0) > 0 && (
                    <div className="flex justify-between items-center text-amber-300">
                      <span className="font-bold">{isAr ? '📦 رسوم تغليف المنتجات المخصصة:' : '📦 Products Packaging Options Fee:'}</span>
                      <span className="font-mono font-bold">
                        +{items.reduce((sum: number, it: any) => sum + ((parseFloat(it.packagingOptionPrice) || 0) * (parseFloat(it.quantity) || 1)), 0).toLocaleString()} {orderCurrency}
                      </span>
                    </div>
                  )}

                  {/* Shipping category speed fees from order_option */}
                  {shippings && shippings.reduce((sum: number, sh: any) => sum + (parseFloat(sh.shippingCategoryPrice) || 0), 0) > 0 && (
                    <div className="flex justify-between items-center text-cyan-300">
                      <span className="font-bold">{isAr ? '⚡️ رسوم فئات الشحن السريع:' : '⚡️ Shipping Category Speed Fees:'}</span>
                      <span className="font-mono font-bold">
                        +{shippings.reduce((sum: number, sh: any) => sum + (parseFloat(sh.shippingCategoryPrice) || 0), 0).toLocaleString()} {orderCurrency}
                      </span>
                    </div>
                  )}

                  {/* Packaging fee — general local wrapping (formData.packagingFee) */}
                  {(formData.packagingFee || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '📦 رسوم تغليف وشحن محلي:' : '📦 KSA Wrapping & Local Freight:'}</span>
                      <span className="font-mono text-purple-200 font-bold">{(formData.packagingFee || 0).toLocaleString()} {orderCurrency}</span>
                    </div>
                  )}

                  {/* Bank commission */}
                  {bankCommissionEnabled && bankCommissionRate > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '🏦 عمولة البنك:' : '🏦 Bank Commission:'}</span>
                      <span className="font-mono text-orange-300 font-bold">
                        {bankCommissionType === 'percentage'
                          ? `${bankCommissionRate}% ≈ ${Math.ceil((calcs.productsSum || 0) * bankCommissionRate / 100).toLocaleString()} ${orderCurrency}`
                          : `${bankCommissionRate.toLocaleString()} ${orderCurrency}`
                        }
                      </span>
                    </div>
                  )}

                  {/* Coupon discount */}
                  {couponEnabled && couponRate > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '🎟 خصم الكوبون:' : '🎟 Coupon Discount:'}</span>
                      <span className="font-mono text-emerald-300 font-bold">-{couponRate.toLocaleString()} {orderCurrency}</span>
                    </div>
                  )}

                  {/* Other fees (previously "Company Margin") */}
                  {(calcs?.profitCompanySAR || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '📌 رسوم أخرى:' : '📌 Other Fees:'}</span>
                      <span className="font-mono text-cyan-300 font-bold">{Math.ceil(calcs.profitCompanySAR || 0).toLocaleString()} {orderCurrency}</span>
                    </div>
                  )}

                  {/* Courier commission — rate + value */}
                  {(() => {
                    const courier = couriers.find(c => c.id === formData.shippingCourierId);
                    const commRate = courier?.commissionRate || 0;
                    const commValue = commRate > 0 ? Math.ceil(calcs.profitSaudiSAR) : 0;
                    return commRate > 0 ? (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">{isAr ? '👤 عمولة مندوب الشحن:' : '👤 Shipping Agent Commission:'}</span>
                        <span className="font-mono text-yellow-300 font-bold">
                          {commRate}% ≈ {commValue.toLocaleString()} {orderCurrency}
                        </span>
                      </div>
                    ) : null;
                  })()}

                  {/* Delivery fee */}
                  {(formData.deliveryCourierFee || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">{isAr ? '🛵 أجرة توصيل المندوب:' : '🛵 Delivery Agent Fee:'}</span>
                      <span className="font-mono text-amber-200 font-bold text-end">
                        <span className="block">{(formData.deliveryCourierFee || 0).toLocaleString()} {calcs.deliveryCourierFeeCurrency}</span>
                        <span className="block text-[10px] text-amber-300/75">≈ {calcs.deliveryCourierFeeOrderCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })} {orderCurrency}</span>
                      </span>
                    </div>
                  )}

                  {/* Divider — Net total in order currency */}
                  <div className="border-t border-slate-700 pt-2.5 mt-1 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-slate-300 text-xs">{isAr ? '📊 الإجمالي بعملة الطلب:' : '📊 Total in Order Currency:'}</span>
                      <span className="font-black font-mono text-slate-200 text-sm bg-slate-800/80 px-3 py-1 rounded-xl border border-slate-700">
                        {Math.ceil(calcs.totalOrderSAR).toLocaleString()} {orderCurrency}
                      </span>
                    </div>

                    {/* Total in payment currency — with word form */}
                    <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-4 py-3">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-emerald-300 text-xs">{isAr ? `💰 الإجمالي بعملة الدفع (${formData.currency}):` : `💰 Total in ${formData.currency}:`}</span>
                        <span className="font-black font-mono text-emerald-300 text-base">
                          {Math.ceil(calcs.totalOrderYER).toLocaleString()} {formData.currency}
                        </span>
                      </div>
                      {calcs.totalOrderYER > 0 && (
                        <p className="text-[10px] text-emerald-400/80 font-bold mt-1.5 italic">
                          {amountInWords(calcs.totalOrderYER, formData.currency, isAr ? 'ar' : 'en')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ═══ RIGHT: Payment Section (مطابق لسند القبض) ═══ */}
                <div className="p-5 bg-slate-955 rounded-2xl border border-[#d4af37]/20 shadow-xl space-y-4 text-xs">
                  {/* Header with Calculator & Exchange Button */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#d4af37]" />
                      <span className="text-[11px] text-slate-300 font-extrabold uppercase tracking-widest">
                        {isAr ? 'تفاصيل وسائل وحسابات التحصيل' : 'Payment Methods & Receipt Accounts'}
                      </span>
                    </div>

                    {/* Calculator Button */}
                    <button
                      type="button"
                      onClick={() => setIsCalcOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 hover:bg-[#d4af37]/25 px-2.5 py-1 text-xs font-bold text-[#f4d870] transition active:scale-95 cursor-pointer"
                      title={isAr ? 'فتح الآلة الحاسبة والمصارفة' : 'Calculator & Currency Exchange'}
                    >
                      <Calculator className="h-4 w-4 text-[#f4d870]" />
                      <span>{isAr ? 'حاسبة ومصارفة' : 'Calc & Rates'}</span>
                    </button>
                  </div>

                  {/* Payment Type Selection (نقد / بنك / آجل / متعدد) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">
                      {isAr ? 'نوع وسيلة الدفع' : 'Payment Type'}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'Cash', labelAr: 'نقد (صندوق)', labelEn: 'Cash Box', icon: Wallet },
                        { id: 'Bank', labelAr: 'بنك (تحويل)', labelEn: 'Bank Transfer', icon: Building },
                        { id: 'Deferred', labelAr: 'آجل (دين)', labelEn: 'On Credit', icon: FileText },
                        { id: 'Mixed', labelAr: 'متعدد (مختلط)', labelEn: 'Multi / Split', icon: ArrowRightLeft },
                      ].map((type) => {
                        const Icon = type.icon;
                        const isSelected = (formData.paymentMethod || 'Cash') === type.id;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, paymentMethod: type.id });
                            }}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border font-bold text-[10px] transition-all cursor-pointer ${isSelected
                              ? 'bg-[#d4af37]/15 border-[#d4af37] text-[#d4af37] shadow-md ring-1 ring-[#d4af37]/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                              }`}
                          >
                            <Icon className="w-4 h-4 mb-1" />
                            <span>{isAr ? type.labelAr : type.labelEn}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Currency & Exchange Rate */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                      <span className="text-[9px] font-black uppercase text-[#d4af37] block mb-1">{isAr ? 'عملة الدفع' : 'Payment Currency'}</span>
                      <select
                        value={formData.currency}
                        onChange={(e) => {
                          const newCurrency = e.target.value;
                          const rateOrder = getCurrencyRate(orderCurrency);
                          const ratePayment = getCurrencyRate(newCurrency);
                          setFormData({ ...formData, currency: newCurrency, exchangeRate: rateOrder / ratePayment });
                        }}
                        className="w-full bg-slate-955 text-white font-bold text-xs p-2 rounded-lg border border-slate-800 outline-none cursor-pointer"
                      >
                        {activeCurrencies.map((c) => (
                          <option className="bg-slate-900 text-white" key={c.code} value={c.code}>
                            {isAr ? (c.main_nameAR || c.sup_nameAR || c.code) : (c.main_nameEn || c.sup_nameEn || c.code)} ({c.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-slate-900 border border-slate-600 p-2.5 rounded-xl">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                        {isAr ? `سعر الصرف (${orderCurrency}/${formData.currency})` : `Rate (${orderCurrency}/${formData.currency})`}
                      </span>
                      <input type="number" step="any"
                        value={getCurrencyRate(orderCurrency) / getCurrencyRate(formData.currency || 'YER')}
                        readOnly
                        className="w-full bg-slate-955 border border-slate-800 text-white font-mono font-bold text-xs p-2 rounded-lg text-center outline-none disabled:opacity-50" />
                    </div>
                  </div>

                  {/* Receiving Accounts Dropdowns based on Payment Method */}
                  {((formData.paymentMethod || 'Cash') === 'Cash' || (formData.paymentMethod || 'Cash') === 'Mixed') && (
                    <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-2">
                      <label className="text-[10px] font-black text-amber-400 flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5" />
                        <span>{isAr ? 'حساب الصندوق القابض (الصناديق)' : 'Cash Box Receiving Account'}</span>
                      </label>
                      <select
                        value={formData.cashAccountId || ''}
                        onChange={(e) => setFormData({ ...formData, cashAccountId: e.target.value })}
                        className="w-full bg-slate-955 text-white font-bold text-xs p-2.5 rounded-lg border border-slate-800 outline-none cursor-pointer focus:border-[#d4af37]"
                      >
                        <option value="">{isAr ? '-- اختر حساب الصندوق --' : '-- Select Cash Account --'}</option>
                        {cashAccountsList.map((acc: any) => (
                          <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                            {acc.name || acc.accNameAr || acc.id} ({acc.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {((formData.paymentMethod || 'Cash') === 'Bank' || (formData.paymentMethod || 'Cash') === 'Mixed') && (
                    <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-2.5">
                      <label className="text-[10px] font-black text-cyan-400 flex items-center gap-1">
                        <Building className="w-3.5 h-3.5" />
                        <span>{isAr ? 'حساب البنك القابض (البنوك)' : 'Bank Receiving Account'}</span>
                      </label>
                      <select
                        value={formData.bankAccountId || ''}
                        onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                        className="w-full bg-slate-955 text-white font-bold text-xs p-2.5 rounded-lg border border-slate-800 outline-none cursor-pointer focus:border-cyan-400"
                      >
                        <option value="">{isAr ? '-- اختر حساب البنك --' : '-- Select Bank Account --'}</option>
                        {bankAccountsList.map((acc: any) => (
                          <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                            {acc.name || acc.accNameAr || acc.id} ({acc.id})
                          </option>
                        ))}
                      </select>

                      {/* Bank Reference Input */}
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 block mb-1">
                          {isAr ? 'رقم المرجع / الحوالة البنكية' : 'Bank Transfer Reference #'}
                        </label>
                        <input
                          type="text"
                          value={formData.bankReference || ''}
                          onChange={(e) => setFormData({ ...formData, bankReference: e.target.value })}
                          placeholder={isAr ? "رقم الإشعار أو الحوالة..." : "Transfer Ref / Voucher #"}
                          className="w-full bg-slate-955 border border-slate-800 text-white font-mono font-bold text-xs p-2 rounded-lg outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  )}

                  {(formData.paymentMethod || 'Cash') === 'Deferred' && (
                    <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl text-[10px] text-amber-300 font-bold leading-relaxed">
                      {isAr
                        ? '📌 الدفع الآجل: سيتم ترحيل كامل قيمة الفاتورة كمديونية على حساب العميل دون تحصيل مبالغ نقدية حالاً.'
                        : '📌 On Credit: Full invoice value will be registered as outstanding debt on customer balance.'}
                    </div>
                  )}

                  {/* Multi / Mixed Payment Split Amounts */}
                  {(formData.paymentMethod || 'Cash') === 'Mixed' && (
                    <div className="grid grid-cols-2 gap-2 bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                      <div>
                        <label className="text-[9px] font-bold text-amber-400 block mb-1">
                          {isAr ? 'مبلغ الصندوق' : 'Cash Split Amount'}
                        </label>
                        <input
                          type="number"
                          value={formData.cashAmount || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const bVal = parseFloat(formData.bankAmount || '0') || 0;
                            setFormData({
                              ...formData,
                              cashAmount: val,
                              amountPaid: val + bVal
                            });
                          }}
                          placeholder="0.00"
                          className="w-full bg-slate-955 border border-slate-800 text-amber-300 font-mono font-bold text-xs p-2 rounded-lg outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-cyan-400 block mb-1">
                          {isAr ? 'مبلغ البنك' : 'Bank Split Amount'}
                        </label>
                        <input
                          type="number"
                          value={formData.bankAmount || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const cVal = parseFloat(formData.cashAmount || '0') || 0;
                            setFormData({
                              ...formData,
                              bankAmount: val,
                              amountPaid: cVal + val
                            });
                          }}
                          placeholder="0.00"
                          className="w-full bg-slate-955 border border-slate-800 text-cyan-300 font-mono font-bold text-xs p-2 rounded-lg outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Total in order currency — info only */}
                  <div className="flex justify-between items-center bg-slate-900/60 px-3 py-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-black text-[11px]">{isAr ? `المبلغ المطلوب بعملة الطلب (${orderCurrency}):` : `Amount Due in ${orderCurrency}:`}</span>
                    <span className="font-mono font-black text-amber-400 text-sm">{Math.ceil(calcs.totalOrderSAR).toLocaleString()} {orderCurrency}</span>
                  </div>

                  {/* Cash / Advance Payment */}
                  {(formData.paymentMethod || 'Cash') !== 'Deferred' && (formData.paymentMethod || 'Cash') !== 'Mixed' && (
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 font-bold flex justify-between items-center">
                        <span className="text-[#d4af37]">{isAr ? 'الدفعة المقدمة / المحصلة (' + formData.currency + ')' : 'Cash / Advance Payment (' + formData.currency + ')'}</span>
                        <div className="flex gap-1.5 text-[9px]">
                          <button type="button" onClick={() => setFormData({ ...formData, amountPaid: 0 })}
                            className="px-2.5 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer">0</button>
                          <button type="button" onClick={() => setFormData({ ...formData, amountPaid: Math.ceil(calcs.totalOrderYER) })}
                            className="px-2.5 py-0.5 rounded border border-emerald-800/40 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 transition cursor-pointer">
                            {isAr ? 'سداد الكل' : 'Pay All'}
                          </button>
                        </div>
                      </label>
                      <input
                        type="number"
                        value={formData.amountPaid || ''}
                        onChange={(e) => setFormData({ ...formData, amountPaid: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-955 border border-slate-700 focus:border-emerald-500/50 text-emerald-400 font-black rounded-xl py-3 px-4 outline-none font-mono text-sm"
                        placeholder={'0.00 ' + formData.currency}
                      />
                      {/* Written word-form for paid amount */}
                      {(formData.amountPaid || 0) > 0 && (
                        <p className="text-[10px] text-blue-400/80 font-bold bg-blue-950/20 border border-blue-900/30 rounded-lg px-3 py-1.5 italic">
                          {isAr
                            ? `✍️ المبلغ المدفوع: ${numberToWordsAr(Math.ceil(formData.amountPaid))} ${currencyNameAr(formData.currency)}`
                            : `✍️ Paid: ${numberToWordsEn(Math.ceil(formData.amountPaid))} ${currencyNameEn(formData.currency)}`
                          }
                        </p>
                      )}
                    </div>
                  )}

                  {/* Outstanding Debt */}
                  <div className="flex justify-between items-center p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
                    <span className="font-extrabold text-[#d4af37] text-[11px]">{isAr ? 'المديونية المتبقية للدفع:' : 'Outstanding Debt:'}</span>
                    <span className="font-mono text-sm font-black text-rose-400">{Math.ceil(calcs.remainingYER).toLocaleString()} {formData.currency}</span>
                  </div>
                </div>

                {/* Financial Calculator Modal */}
                <FinancialCalculatorModal
                  isOpen={isCalcOpen}
                  onClose={() => setIsCalcOpen(false)}
                  currencies={activeCurrencies}
                />

              </div>
            </div>
          )}


          {/* ---------------------------------------------------- */}
          {/* STEP 5: Summary & Final Submission (الخلاصة والحفظ)    */}
          {/* ---------------------------------------------------- */}

          {currentStep === 5 && (
            <div className="space-y-5 animate-fade-in text-start">
              <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-2xl flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-emerald-300">
                    {isAr ? 'تم مراجعة واكتمال كافة الخطوات بنجاح' : 'Order details verified & ready for save'}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {isAr ? 'يرجى مراجعة ملخص بيانات الطلب أدناه وتأكيد حفظ وترحيل الفاتورة' : 'Review the order summary below before final submission'}
                  </p>
                </div>
              </div>

              {/* Summary Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* 1. Customer & Order Source */}
                <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                    <User className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="text-xs font-black text-white">{isAr ? 'بيانات العميل والمصدر' : 'Customer & Source Details'}</h4>
                  </div>
                  <div className="space-y-2 text-xs font-bold">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'اسم العميل:' : 'Customer Name:'}</span>
                      <span className="text-white">{formData.customerName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'رقم الهاتف:' : 'Phone:'}</span>
                      <span className="text-slate-300 font-mono">{formData.customerPhone || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'العنوان:' : 'Address:'}</span>
                      <span className="text-slate-300 text-end max-w-[200px]">{formData.customerAddress || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'مصدر الطلب:' : 'Order Source:'}</span>
                      <span className="text-[#d4af37]">
                        {sources.find(s => s.id === formData.orderSourceId)?.name || formData.orderSourceId || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'رقم الفاتورة الأصلي:' : 'Store Invoice ID:'}</span>
                      <span className="text-slate-300 font-mono">{formData.externalOrderNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'رقم التتبع الدولي:' : 'Global Tracking:'}</span>
                      <span className="text-slate-300 font-mono">{formData.trackingNumber || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Products Summary */}
                <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                    <ShoppingCart className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="text-xs font-black text-white">{isAr ? 'ملخص أصناف المنتجات' : 'Products & Items Summary'}</h4>
                  </div>
                  <div className="space-y-2 text-xs font-bold max-h-40 overflow-y-auto custom-scrollbar">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-850 text-[11px] space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-white truncate max-w-[160px] font-black">{idx + 1}. {item.productName || '—'}</span>
                          <span className="font-mono text-emerald-400">{item.quantity} × {(item.productPrice || 0).toLocaleString()} {orderCurrency}</span>
                        </div>
                        {(item.weight || item.cbm) && (
                          <div className="flex gap-3 text-[10px] text-slate-500">
                            {item.weight && <span>⚖️ {item.weight} kg</span>}
                            {item.cbm && <span>📐 {item.cbm} m³</span>}
                          </div>
                        )}
                        {item.trackingNumber && (
                          <div className="text-[10px] text-slate-500 font-mono">🔍 {item.trackingNumber}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 space-y-1">
                    <div className="flex justify-between text-xs font-black">
                      <span className="text-slate-400">{isAr ? 'إجمالي المنتجات:' : 'Products Subtotal:'}</span>
                      <span className="font-mono text-amber-400">{(calcs.productsSum || 0).toLocaleString()} {orderCurrency}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500">{isAr ? 'إجمالي الوحدات:' : 'Total Units:'}</span>
                      <span className="font-mono text-slate-300">{items.reduce((s: number, i: any) => s + (parseInt(i.quantity) || 0), 0)} {isAr ? 'قطعة' : 'pcs'}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Logistics & Couriers Summary */}
                <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                    <Truck className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="text-xs font-black text-white">{isAr ? 'ملخص الشحن والمناديب' : 'Logistics & Couriers Summary'}</h4>
                  </div>
                  <div className="space-y-2.5 text-xs font-bold">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? 'عدد مسارات الشحن:' : 'Shipping Tracks:'}</span>
                      <span className="text-slate-200">{shippings?.length || 0} {isAr ? 'مسارات' : 'tracks'}</span>
                    </div>
                    {shippings && shippings.length > 0 && shippings.map((sh: any, idx: number) => (
                      <div key={idx} className="bg-slate-900/50 rounded-xl p-2.5 border border-slate-850 space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-[#d4af37] font-black">{isAr ? `مسار #${idx + 1}:` : `Track #${idx + 1}:`} {sh.shippingCompany || '—'}</span>
                          <span className="text-blue-300 font-mono">{(parseFloat(sh.shippingCost) || 0).toLocaleString()} {orderCurrency}</span>
                        </div>
                        {sh.shippingType && <div className="text-slate-500">{isAr ? 'النوع:' : 'Mode:'} {sh.shippingType}</div>}
                        {sh.shippingSource && sh.shippingDestination && (
                          <div className="text-slate-500">{sh.shippingSource} → {sh.shippingDestination}</div>
                        )}
                        {sh.trackingNumber && <div className="font-mono text-slate-400">🔍 {sh.trackingNumber}</div>}
                        {/* Shipping packaging fee per route */}
                        {(parseFloat(sh.packagingFee) || 0) > 0 && (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500">{isAr ? '📦 رسوم تغليف المسار:' : '📦 Track Packaging:'}</span>
                            <span className="text-purple-300 font-mono">{(parseFloat(sh.packagingFee) || 0).toLocaleString()} {orderCurrency}</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* General company packaging fee */}
                    {packagingFeeEnabled && packagingFeeRate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '📦 رسوم تغليف شركة الشحن:' : '📦 Carrier Packaging Fee:'}</span>
                        <span className="text-purple-300 font-mono">{packagingFeeRate.toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {/* Local wrapping fee */}
                    {(formData.packagingFee || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '📦 رسوم تغليف وشحن محلي:' : '📦 KSA Wrapping & Local Freight:'}</span>
                        <span className="text-purple-200 font-mono">{(formData.packagingFee || 0).toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {items && items.reduce((sum: number, it: any) => sum + ((parseFloat(it.packagingOptionPrice) || 0) * (parseFloat(it.quantity) || 1)), 0) > 0 && (
                      <div className="flex justify-between text-amber-300">
                        <span>{isAr ? '📦 تغليف المنتجات المخصص:' : '📦 Custom Packaging Option:'}</span>
                        <span className="font-mono">+{items.reduce((sum: number, it: any) => sum + ((parseFloat(it.packagingOptionPrice) || 0) * (parseFloat(it.quantity) || 1)), 0).toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {shippings && shippings.reduce((sum: number, sh: any) => sum + (parseFloat(sh.shippingCategoryPrice) || 0), 0) > 0 && (
                      <div className="flex justify-between text-cyan-300">
                        <span>{isAr ? '⚡️ فئات الشحن المسرّعة:' : '⚡️ Shipping Speed Categories:'}</span>
                        <span className="font-mono">+{shippings.reduce((sum: number, sh: any) => sum + (parseFloat(sh.shippingCategoryPrice) || 0), 0).toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}

                    <div className="border-t border-slate-800/60 pt-2 space-y-1.5">
                      {/* Aggregator + commission */}
                      {(() => {
                        const aggCourier = couriers.find(c => c.id === formData.shippingCourierId);
                        const aggRate = aggCourier?.commissionRate || 0;
                        const commValue = aggRate > 0 ? Math.ceil(calcs.profitSaudiSAR * aggRate / 100) : 0;
                        return (
                          <div className="flex justify-between">
                            <span className="text-slate-500">{isAr ? 'مندوب التجميع (سعودي):' : 'Saudi Aggregator:'}</span>
                            <span className="text-slate-200 text-end">
                              {aggCourier?.fullName || (isAr ? 'غير محدد' : 'N/A')}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Courier commission */}
                      {(() => {
                        const shipCourier = couriers.find(c => c.id === formData.shippingCourierId);
                        const commRate = shipCourier?.commissionRate || 0;
                        const commValue = commRate > 0 ? Math.ceil(calcs.profitSaudiSAR) : 0;
                        return commRate > 0 ? (
                          <div className="flex justify-between">
                            <span className="text-slate-500">{isAr ? '👤 عمولة مندوب الشحن:' : '👤 Shipping Agent Comm.:'}</span>
                            <span className="text-yellow-300 font-mono">{commRate}% ≈ {commValue.toLocaleString()} {orderCurrency}</span>
                          </div>
                        ) : null;
                      })()}

                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? 'مندوب التوصيل (اليمن):' : 'Yemen Courier:'}</span>
                        <span className="text-slate-200">
                          {couriers.find(c => c.id === formData.deliveryCourierId)?.fullName || (isAr ? 'غير محدد' : 'N/A')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? 'أجرة التوصيل:' : 'Delivery Fee:'}</span>
                        <span className="text-amber-200 font-mono">{(formData.deliveryCourierFee || 0).toLocaleString()} YER</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Full Financial Audit Summary */}
                <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                    <FileText className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="text-xs font-black text-white">{isAr ? 'الكشف المالي التفصيلي' : 'Full Financial Breakdown'}</h4>
                  </div>
                  <div className="space-y-2 text-xs font-bold">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{isAr ? '🛍 قيمة المنتجات:' : '🛍 Products Value:'}</span>
                      <span className="font-mono text-white">{(calcs.productsSum || 0).toLocaleString()} {orderCurrency}</span>
                    </div>
                    {shippings && shippings.length > 0 && shippings.reduce((s: number, sh: any) => s + (parseFloat(sh.shippingCost) || 0), 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '🚚 تكاليف الشحن:' : '🚚 Shipping Cost:'}</span>
                        <span className="font-mono text-blue-300">
                          {shippings.reduce((sum: number, sh: any) => sum + (parseFloat(sh.shippingCost) || 0), 0).toLocaleString()} {orderCurrency}
                        </span>
                      </div>
                    )}
                    {/* Carrier packaging */}
                    {packagingFeeEnabled && packagingFeeRate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '📦 رسوم تغليف شركة الشحن:' : '📦 Carrier Packaging Fee:'}</span>
                        <span className="font-mono text-purple-300">{packagingFeeRate.toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {/* Local wrapping */}
                    {(formData.packagingFee || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '📦 رسوم تغليف وشحن محلي:' : '📦 KSA Wrapping & Local Freight:'}</span>
                        <span className="font-mono text-purple-200">{(formData.packagingFee || 0).toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {bankCommissionEnabled && bankCommissionRate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '🏦 عمولة البنك:' : '🏦 Bank Commission:'}</span>
                        <span className="font-mono text-orange-300">
                          {bankCommissionType === 'percentage'
                            ? `${bankCommissionRate}% ≈ ${Math.ceil((calcs.productsSum || 0) * bankCommissionRate / 100).toLocaleString()} ${orderCurrency}`
                            : `${bankCommissionRate.toLocaleString()} ${orderCurrency}`}
                        </span>
                      </div>
                    )}
                    {couponEnabled && couponRate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '🎟 خصم الكوبون:' : '🎟 Coupon Discount:'}</span>
                        <span className="font-mono text-emerald-300">-{couponRate.toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {(calcs?.profitCompanySAR || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '📌 رسوم أخرى:' : '📌 Other Fees:'}</span>
                        <span className="font-mono text-cyan-300">{Math.ceil(calcs.profitCompanySAR || 0).toLocaleString()} {orderCurrency}</span>
                      </div>
                    )}
                    {/* Courier commission in summary */}
                    {(() => {
                      const sc = couriers.find(c => c.id === formData.shippingCourierId);
                      const commRate = sc?.commissionRate || 0;
                      const commValue = commRate > 0 ? Math.ceil(calcs.profitSaudiSAR) : 0;
                      return commRate > 0 ? (
                        <div className="flex justify-between">
                          <span className="text-slate-500">{isAr ? '👤 عمولة مندوب الشحن:' : '👤 Shipping Agent Comm.:'}</span>
                          <span className="font-mono text-yellow-300">{commValue.toLocaleString()} {orderCurrency}</span>
                        </div>
                      ) : null;
                    })()}
                    {(formData.deliveryCourierFee || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? '🛵 أجرة توصيل المندوب:' : '🛵 Delivery Agent Fee:'}</span>
                        <span className="font-mono text-amber-200">{(formData.deliveryCourierFee || 0).toLocaleString()} YER</span>
                      </div>
                    )}

                    {/* Currency info */}
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">{isAr ? `سعر الصرف (${orderCurrency}/${formData.currency}):` : `Rate (${orderCurrency}/${formData.currency}):`}</span>
                      <span className="font-mono text-slate-300">{(getCurrencyRate(orderCurrency) / getCurrencyRate(formData.currency || 'YER')).toFixed(2)}</span>
                    </div>

                    <div className="border-t border-slate-700 pt-2 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-black">{isAr ? '📊 الإجمالي بعملة الطلب:' : '📊 Total in Order Currency:'}</span>
                        <span className="font-mono text-slate-200 font-black">{Math.ceil(calcs.totalOrderSAR).toLocaleString()} {orderCurrency}</span>
                      </div>

                      {/* Total in payment currency — word form */}
                      <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-3 py-2.5">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-emerald-300">{isAr ? `💰 الإجمالي بعملة الدفع (${formData.currency}):` : `💰 Total in ${formData.currency}:`}</span>
                          <span className="font-mono text-emerald-300 font-black text-sm">{Math.ceil(calcs.totalOrderYER).toLocaleString()} {formData.currency}</span>
                        </div>
                        <p className="text-[10px] text-emerald-400/80 font-bold mt-1 italic">
                          {amountInWords(calcs.totalOrderYER, formData.currency, isAr ? 'ar' : 'en')}
                        </p>
                      </div>

                      {/* Paid — word form */}
                      <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl px-3 py-2.5">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-blue-300">{isAr ? '✅ المبلغ المدفوع (كاش):' : '✅ Amount Paid (Cash):'}</span>
                          <span className="font-mono text-blue-300 font-black">{Math.ceil(formData.amountPaid || 0).toLocaleString()} {formData.currency}</span>
                        </div>
                        {(formData.amountPaid || 0) > 0 && (
                          <p className="text-[10px] text-blue-400/80 font-bold mt-1 italic">
                            {isAr
                              ? `✍️ استلمت مبلغ: ${numberToWordsAr(Math.ceil(formData.amountPaid))} ${currencyNameAr(formData.currency)} نقداً`
                              : `✍️ Received: ${numberToWordsEn(Math.ceil(formData.amountPaid))} ${currencyNameEn(formData.currency)} cash`
                            }
                          </p>
                        )}
                      </div>

                      {/* Remaining debt */}
                      <div className="flex justify-between items-center p-2.5 bg-rose-500/5 rounded-xl border border-rose-500/10">
                        <span className="text-rose-400 font-black">{isAr ? '⚠️ المديونية المتبقية:' : '⚠️ Remaining Debt:'}</span>
                        <span className="font-mono text-rose-400 font-black">{Math.ceil(calcs.remainingYER).toLocaleString()} {formData.currency}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Notes/Remarks field */}
              <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                  📝 {isAr ? 'ملاحظات إضافية على الطلب' : 'Additional Order Notes'}
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={isAr ? 'أضف أي ملاحظات أو تعليمات إضافية على هذا الطلب...' : 'Add any additional notes or special instructions...'}
                  rows={3}
                  className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none font-bold text-xs resize-none focus:border-[#d4af37]/60"
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 4. STEP NAVIGATION CONTROLS AND BUTTONS BAR              */}
          {/* ======================================================== */}
          <div className="pt-6 mt-6 border-t border-slate-800 flex justify-between items-center flex-wrap gap-3 shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-5 py-2.5 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all font-bold text-xs cursor-pointer"
            >
              {isAr ? 'إلغاء النافذة' : 'Cancel'}
            </button>

            <div className="flex items-center gap-3">
              {/* Previous Step Button */}
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black rounded-xl transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  {isAr ? 'الخطوة السابقة' : 'Previous Step'}
                </button>
              )}

              {/* Next Step Button */}
              {currentStep <= 4 && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  {isAr ? 'الخطوة التالية' : 'Next Step'}
                  {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              )}
              {/* Final Submit Button */}
              {currentStep === 5 && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-7 py-2.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-teal-600 hover:to-emerald-500 text-black font-black rounded-xl transition-all text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmitting
                    ? (isAr ? 'جاري الترحيل والحفظ...' : 'Saving...')
                    : (isAr ? 'حفظ وترحيل الفاتورة ' : 'Deploy Freight Cargo')}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
