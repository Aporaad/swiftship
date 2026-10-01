import React, { useState, useEffect } from 'react';
import {
  X, Search, UserPlus, CreditCard, DollarSign, AlertCircle,
  Package, Trash2, Calendar, Calculator, ChevronRight, ChevronLeft,
  User, ShoppingCart, Truck, CheckCircle2, ShieldCheck, FileText, Wallet, Building, ArrowRightLeft, Boxes
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
import type { ItemCategory } from '../../services/itemCategoryService';
import type { Currency } from '../../services/currencyService';
import type { Settings } from '../../context/SettingsContext';
import OrderPartyPicker from './OrderPartyPicker';
import FinancialCalculatorModal from '../finance/FinancialCalculatorModal';
import ProductPickerModal, { SystemProductRecord } from './ProductPickerModal';
import CreateOrderStep1 from '../../features/orders/components/create-order-modal/CreateOrderStep1';
import CreateOrderStep2 from '../../features/orders/components/create-order-modal/CreateOrderStep2';
import CreateOrderStep3 from '../../features/orders/components/create-order-modal/CreateOrderStep3';
import CreateOrderStep4 from '../../features/orders/components/create-order-modal/CreateOrderStep4';
import CreateOrderStep5 from '../../features/orders/components/create-order-modal/CreateOrderStep5';
import type { OrderStatusItem } from '../../hooks/useOrderStatuses';

type Step1Props = React.ComponentProps<typeof CreateOrderStep1>;
type Step2Props = React.ComponentProps<typeof CreateOrderStep2>;
type Step3Props = React.ComponentProps<typeof CreateOrderStep3>;
type Step4Props = React.ComponentProps<typeof CreateOrderStep4>;
type Step5Props = React.ComponentProps<typeof CreateOrderStep5>;
type CurrencyOption = Currency & { price?: number };
type FinancialAccountOption = Step4Props['cashAccountsList'][number] & { accSubId?: string | null };
type OrderCreateSettings = Settings & Step2Props['settings'] & Step3Props['settings'];

export interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  role: string;
  hasPermission: (perm: string) => boolean;
  canEditOrderDefaultsCreation: boolean;
  isSubmitting: boolean;

  // Form State
  formData: Step1Props['formData'];
  setFormData: Step1Props['setFormData'];
  previewOrderNumber: string;

  customerProfileStats: Step1Props['customerProfileStats'];
  orderParties: Step1Props['orderParties'];
  selectedOrderParty: Step1Props['selectedOrderParty'];
  isStaffOrder: boolean;
  setIsStaffOrder: (value: boolean) => void;
  selectOrderParty: Step1Props['selectOrderParty'];
  customerSearchQuery: string;
  setCustomerSearchQuery: (query: string) => void;
  filteredCustomers: Step1Props['filteredCustomers'];
  selectCustomer: Step1Props['selectCustomer'];
  clearSelectedCustomer: () => void;
  setIsAddCustomerOpen: (open: boolean) => void;
  setCustomerFormData: Step1Props['setCustomerFormData'];

  setIsAddSourceOpen: (open: boolean) => void;
  sources: Step1Props['sources'] & Step5Props['sources'];

  cartShareCode: string;
  setCartShareCode: (code: string) => void;

  // Items State
  items: Step2Props['items'];
  addItemRow: () => void;
  updateItemRow: Step2Props['updateItemRow'];
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
  shippings: Step3Props['shippings'] & Step4Props['shippings'] & Step5Props['shippings'];
  addShippingRow: () => void;
  updateShippingRow: (idx: number, fieldOrObj: string | Partial<Step3Props['shippings'][number]>, val?: unknown) => void;
  removeShippingRow: (idx: number) => void;
  shippingCompanies: Step3Props['shippingCompanies'];
  setIsAddShippingCompanyOpen: (open: boolean) => void;
  setActiveAddShippingIndex: Step3Props['setActiveAddShippingIndex'];

  packagingFeeEnabled: boolean;
  setPackagingFeeEnabled: (v: boolean) => void;
  packagingFeeRate: number;
  setPackagingFeeRate: (v: number) => void;

  // Couriers State
  couriers: Step3Props['couriers'] & Step4Props['couriers'] & Step5Props['couriers'];
  profitPerKgRate: number;
  setProfitPerKgRate: (v: number) => void;
  cbmShippingRateValue: number;
  setCbmShippingRateValue: (v: number) => void;
  settings: OrderCreateSettings;

  // Calculations
  calcs: Step3Props['calcs'] & Step4Props['calcs'] & Step5Props['calcs'];
  activeCurrencies: CurrencyOption[];
  financialAccounts?: FinancialAccountOption[];

  // Order Options (order_option)
  packagingOptions?: Step2Props['packagingOptions'];
  shippingCategoryOptions?: Step3Props['shippingCategoryOptions'];
  itemCategories?: ItemCategory[];

  // ====== خيارات جديدة: توصيل للمنزل، عبر مندوب شحن، الدفع لاحقاً، الحفظ والاعتماد ======
  // New feature checkboxes: home delivery, via shipping agent, pay later, direct approve
  homeDeliveryEnabled: boolean;
  setHomeDeliveryEnabled: (v: boolean) => void;
  viaShippingAgent: boolean;
  setViaShippingAgent: (v: boolean) => void;
  payLater: boolean;
  setPayLater: (v: boolean) => void;
  directApprove: boolean;
  setDirectApprove: (v: boolean) => void;
  // ترتيب حالات الطلب المحملة من DB للاستخدام في تحديد ID الحالة
  // Order statuses loaded from DB for dynamic status ID assignment
  orderStatuses?: OrderStatusItem[];

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
    // ====== الخصائص الجديدة ======
    homeDeliveryEnabled,
    setHomeDeliveryEnabled,
    viaShippingAgent,
    setViaShippingAgent,
    payLater,
    setPayLater,
    directApprove,
    setDirectApprove,
    orderStatuses = [],
    handleCreateOrder,
  }
    : CreateOrderModalProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepErrors, setStepErrors] = useState<string | null>(null);
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const orderCurrency = settings.defaultOrderCurrency || settings.currency || 'SAR'; // العملة الافتراضية المعينة لأسعار الطلبات

  // اختيار وتعيين منتج سابق بكامل تفاصيله من قائمة الكتالوج الرئيسية (بدون إعادة إنشائه)
  // Handle selecting an existing product from master catalog picker modal
  // IMPORTANT: يجب الاحتفاظ بـ product_id لإخبار Orders.tsx بأن المنتج موجود مسبقاً
  // IMPORTANT: Must carry product_id so Orders.tsx skips re-creating it in products table
  const handleSelectProductFromPicker = (selectedProduct: SystemProductRecord) => {
    const qty = 1;
    // استخدام unit_price كأولوية أولى ثم المرادفات للتوافق العكسي
    // Prefer unit_price from master catalog, then aliases for backwards compatibility
    const price = Number(
      selectedProduct.unit_price ?? selectedProduct.productPrice ?? selectedProduct.unitPrice ?? 0
    );
    const isInsured = selectedProduct.isInsured ?? false;
    const feeRate = settings.defaultProductInsuranceFee || 0;
    const isPercent = settings.defaultProductInsuranceType === 'percentage';
    const computedFee = isInsured
      ? (isPercent ? (price * qty * (feeRate / 100)) : (feeRate * qty))
      : 0;

    const newItem = {
      // ────── الحقل الحاسم: معرف المنتج الرئيسي لمنع إعادة إنشائه في products ──────
      // Critical field: master product_id to prevent re-creation in products table
      product_id: selectedProduct.product_id || selectedProduct.id || '',
      productId: selectedProduct.product_id || selectedProduct.id || '',
      productName: selectedProduct.product_name_ar || selectedProduct.productName || selectedProduct.name || '',
      productNameEn: selectedProduct.product_name_en || '',
      sku: selectedProduct.sku || '',
      description: selectedProduct.description || selectedProduct.notes || '',
      quantity: qty,
      productPrice: price,
      weight: Number(selectedProduct.weight || 0),
      cbm: Number(selectedProduct.cbm || 0),
      length: Number(selectedProduct.length || 0),
      width: Number(selectedProduct.width || 0),
      height: Number(selectedProduct.height || 0),
      productUrl: selectedProduct.product_url || selectedProduct.productUrl || '',
      trackingNumber: selectedProduct.trackingNumber || '',
      packagingOptionId: selectedProduct.packagingOptionId || '',
      packagingOptionName: selectedProduct.packagingOptionName || '',
      packagingOptionPrice: Number(selectedProduct.packagingOptionPrice || 0),
      itemCategoryId: selectedProduct.item_category_id || selectedProduct.itemCategoryId || '',
      itemCategoryName: selectedProduct.itemCategoryName || '',
      isInsured: isInsured,
      insuranceFee: computedFee,
    };

    let targetIndex = 0;
    if (items.length === 1 && !items[0].productName) {
      targetIndex = 0;
    } else {
      targetIndex = items.length;
      addItemRow();
    }
    (Object.keys(newItem) as Array<keyof typeof newItem>).forEach((key) => {
      updateItemRow(targetIndex, key, newItem[key]);
    });
  };

  // Filter available cash box and bank accounts from financialAccounts
  const cashAccountsList = (financialAccounts || []).filter(
    (account) => account.accSubId === '111' || String(account.id).startsWith('111')
  );
  const bankAccountsList = (financialAccounts || []).filter(
    (account) => account.accSubId === '112' || String(account.id).startsWith('112')
  );

  const getCurrencyRate = (code: string) => {
    //مهم : هذا خطاء كبير هل يتم مصارفه العملات على قيم ثابته ولايتم اخذها من جدول اسعار الصرف
    if (code === 'YER') return 1;
    const found = activeCurrencies?.find((c) => c.code === code);
    if (found && found.currentPrice && found.currentPrice > 0) return found.currentPrice;
    if (found?.price && found.price > 0) return found.price;
    if (code === 'SAR') return 140;
    if (code === 'USD') return 535;
    return 1;
  };

  const updateShipmentContentCategory = (idx: number, categoryId: string, cartonValue?: number) => {
    const category = itemCategories.find((entry) => entry.id === categoryId);
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

  const stepProps = {
    isAr, role, hasPermission, canEditOrderDefaultsCreation, isSubmitting,
    formData, setFormData, previewOrderNumber, customerProfileStats, orderParties,
    selectedOrderParty, isStaffOrder, setIsStaffOrder, selectOrderParty,
    customerSearchQuery, setCustomerSearchQuery, filteredCustomers, selectCustomer,
    clearSelectedCustomer, setIsAddCustomerOpen, setCustomerFormData, setIsAddSourceOpen,
    sources, cartShareCode, setCartShareCode, items, addItemRow, updateItemRow, removeItemRow,
    bankCommissionEnabled, setBankCommissionEnabled, bankCommissionType,
    setBankCommissionType, bankCommissionRate, setBankCommissionRate, couponEnabled,
    setCouponEnabled, couponRate, setCouponRate, addShippingEnabled, setAddShippingEnabled,
    shippings, addShippingRow, updateShippingRow, removeShippingRow, shippingCompanies,
    setIsAddShippingCompanyOpen, setActiveAddShippingIndex, packagingFeeEnabled,
    setPackagingFeeEnabled, packagingFeeRate, setPackagingFeeRate, couriers,
    profitPerKgRate, setProfitPerKgRate, cbmShippingRateValue, setCbmShippingRateValue,
    settings, calcs, activeCurrencies, financialAccounts, packagingOptions,
    shippingCategoryOptions, itemCategories, homeDeliveryEnabled, setHomeDeliveryEnabled,
    viaShippingAgent, setViaShippingAgent, payLater, setPayLater, directApprove,
    setDirectApprove, orderStatuses, currentStep, orderCurrency, cashAccountsList,
    bankAccountsList, getCurrencyRate, setIsProductPickerOpen, amountInWords,
  };

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
    // التحقق من تفاصيل الدفع — يُتخطى إذا كان خيار "الدفع لاحقاً" مفعلاً
    // Skip payment validation when payLater is enabled
    if (step === 4 && !payLater) {
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
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 bg-slate-900/90 border border-slate-800/80 p-3 rounded-2xl text-xs font-bold">
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
            {/* Calculator Button */}
            <div className="bg-slate-955/70 p-2.5 rounded-xl border border-slate-800/60 text-start col-span-2 sm:col-span-1">
              <button
                type="button"
                onClick={() => setIsCalcOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#d4af37]/10 bg-[#d4af37]/5 hover:bg-[#d4af37]/25 px-2.5 py-1.5 text-xs font-bold text-[#f4d870] transition active:scale-95 cursor-pointer"
                title={isAr ? 'فتح الآلة الحاسبة والمصارفة' : 'Calculator & Currency Exchange'}
              >
                <Calculator className="h-6 w-6 text-[#f4d870]" />
              </button>
              {/* Financial Calculator Modal */}
              <FinancialCalculatorModal
                isOpen={isCalcOpen}
                onClose={() => setIsCalcOpen(false)}
                currencies={activeCurrencies.map((currency) => ({
                  id: currency.cur_id,
                  code: currency.code,
                  isDefault: currency.is_default,
                }))}
              />
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
                  onClick={() => { /* handleStepClick(step.id)*/ }}
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
	          {currentStep === 1 && <CreateOrderStep1 {...stepProps} />}

	          {/* ---------------------------------------------------- */}
	          {/* STEP 2: Cart Code, Products & Items Table            */}
	          {/* ---------------------------------------------------- */}
	          {currentStep === 2 && <CreateOrderStep2 {...stepProps} />}

	          {/* ---------------------------------------------------- */}
	          {/* STEP 3: Shipping, Logistics & Field Couriers         */}
	          {/* ---------------------------------------------------- */}
	          {currentStep === 3 && <CreateOrderStep3 {...stepProps} />}

	          {/* ---------------------------------------------------- */}
	          {/* STEP 4: Financials, Currency & Payment               */}
	          {/* ---------------------------------------------------- */}
	          {currentStep === 4 && <CreateOrderStep4 {...stepProps} />}

          {/* ---------------------------------------------------- */}
	          {/* STEP 5: Summary & Final Submission (الخلاصة والحفظ)    */}
	          {/* ---------------------------------------------------- */}

	          {currentStep === 5 && <CreateOrderStep5 {...stepProps} />}

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

      {/* نافذة اختيار منتج من القائمة المسجلة */}
      <ProductPickerModal
        isOpen={isProductPickerOpen}
        onClose={() => setIsProductPickerOpen(false)}
        onSelectProduct={handleSelectProductFromPicker}
        isAr={isAr}
      />
    </div >
  );
}
