import React, { useState, useEffect } from 'react';
import {
  X, Edit2, Trash2, Calendar, Package, DollarSign, CreditCard, AlertCircle,
  User, ShoppingCart, Truck, CheckCircle2, ChevronRight, ChevronLeft, Calculator, FileText, ShieldCheck
} from 'lucide-react';
import { doc, updateDoc, db } from '../../lib/supabase';
import { notificationService } from '../../services/notificationService';
import { activityLogService } from '../../services/activityLogService';
import { calculateShipmentCategoryFees } from '../../services/itemCategoryService';
import { financialAccountService } from '../../services/financialAccountService';
import { buildOrderParties, findOrderParty, toOrderPartyPayload, type OrderParty } from '../../services/orderPartyService';
import { calculateOrderPaymentTotals } from '../../services/orderCurrencyService';
import OrderPartyPicker from './OrderPartyPicker';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderToEdit: any;
  customers: any[];
  employees: any[];
  sources: any[];
  couriers: any[];
  shippingCompanies: any[];
  activeCurrencies: any[];
  packagingOptions?: any[];
  shippingCategoryOptions?: any[];
  itemCategories?: any[];
  settings: any;
  isAr: boolean;
}

const STEPS = [
  { id: 1, titleAr: 'العميل والمصدر', titleEn: 'Customer & Source', icon: User },
  { id: 2, titleAr: 'المنتجات والأصناف', titleEn: 'Products & Items', icon: ShoppingCart },
  { id: 3, titleAr: 'الشحن والمناديب', titleEn: 'Shipping & Logistics', icon: Truck },
  { id: 4, titleAr: 'المالية والدفع', titleEn: 'Financials & Payment', icon: DollarSign },
  { id: 5, titleAr: 'الخلاصة والتأكيد', titleEn: 'Summary & Confirm', icon: CheckCircle2 },
];

function FeeSummary({
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
    <div className={`rounded-lg border p-2 ${emphasized ? 'border-cyan-400/35 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/70'}`}>
      <span className="block text-[8px] uppercase font-black text-slate-500 truncate">{label}</span>
      <span className={`block mt-0.5 text-[11px] font-mono font-black ${emphasized ? 'text-cyan-300' : 'text-slate-200'}`}>
        {(Number(value) || 0).toLocaleString()} {currency || 'SAR'}
      </span>
    </div>
  );
}

export default function EditOrderModal({
  isOpen,
  onClose,
  orderToEdit,
  customers,
  employees,
  sources,
  couriers,
  shippingCompanies,
  activeCurrencies,
  packagingOptions = [],
  shippingCategoryOptions = [],
  itemCategories = [],
  settings,
  isAr,
}: EditOrderModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepErrors, setStepErrors] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<any>({
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    orderPartyId: '',
    orderPartyType: 'customer',
    isStaffOrder: false,
    employeeId: '',
    courierId: '',
    customerAccountId: '',
    customerAccountCode: '',
    orderSourceId: '',
    orderSourceName: '',
    orderSourceType: 'App',
    externalOrderNumber: '',
    trackingNumber: '',
    shippingCompany: 'Aramex',
    shippingCourierId: '',
    deliveryCourierId: '',
    deliveryCourierFee: 4000,
    deliveryCourierFeeCurrency: settings?.currency || 'YER',
    orderCurrency: settings?.defaultOrderCurrency || settings?.currency || 'SAR',
    currency: settings?.defaultOrderCurrency || settings?.currency || 'SAR',
    exchangeRate: 1,
    exchangeRateYER: 1,
    exchangeRateUSD: 1,
    bankCommissionRate: 3,
    companyProfitRate: 12,
    packagingFee: 0,
    sheinRedPrice: 0,
    amountPaid: 0,
    paymentMethod: 'Cash',
    notes: '',
  });

  const [items, setItems] = useState<any[]>([]);
  const [shippings, setShippings] = useState<any[]>([]);

  // Load existing order data on mount/open
  useEffect(() => {
    if (isOpen && orderToEdit) {
      setCurrentStep(1);
      setStepErrors(null);
      const loadedOrderCurrency = orderToEdit.orderCurrency || orderToEdit.currency || settings?.defaultOrderCurrency || settings?.currency || 'SAR';

      setFormData({
        customerId: orderToEdit.customerId || '',
        customerName: orderToEdit.customerName || '',
        customerPhone: orderToEdit.customerPhone || '',
        customerAddress: orderToEdit.customerAddress || '',
        orderPartyId: orderToEdit.orderPartyId || orderToEdit.customerId || '',
        orderPartyType: orderToEdit.orderPartyType || (orderToEdit.isStaffOrder ? 'employee' : 'customer'),
        isStaffOrder: Boolean(orderToEdit.isStaffOrder || (orderToEdit.orderPartyType && orderToEdit.orderPartyType !== 'customer')),
        employeeId: orderToEdit.employeeId || '',
        courierId: orderToEdit.courierId || '',
        customerAccountId: orderToEdit.customerAccountId || '',
        customerAccountCode: orderToEdit.customerAccountCode || '',
        orderSourceId: orderToEdit.orderSourceId || '',
        orderSourceName: orderToEdit.orderSourceName || '',
        orderSourceType: orderToEdit.orderSourceType || 'App',
        externalOrderNumber: orderToEdit.externalOrderNumber || '',
        trackingNumber: orderToEdit.trackingNumber || '',
        shippingCompany: orderToEdit.shippingCompany || 'Aramex',
        shippingCourierId: orderToEdit.shippingCourierId || '',
        deliveryCourierId: orderToEdit.deliveryCourierId || '',
        deliveryCourierFee: orderToEdit.deliveryCourierFee ?? 4000,
        deliveryCourierFeeCurrency: orderToEdit.deliveryCourierFeeCurrency || settings?.currency || 'YER',
        orderCurrency: loadedOrderCurrency,
        currency: loadedOrderCurrency,
        exchangeRate: 1,
        exchangeRateYER: orderToEdit.exchangeRateYER || 1,
        exchangeRateUSD: orderToEdit.exchangeRateUSD || 1,
        bankCommissionRate: orderToEdit.bankCommissionRate ?? 3,
        companyProfitRate: orderToEdit.companyProfitRate ?? 12,
        packagingFee: orderToEdit.packagingFee || 0,
        sheinRedPrice: orderToEdit.sheinRedPrice || 0,
        amountPaid: orderToEdit.amountPaid || 0,
        paymentMethod: orderToEdit.paymentMethod || 'Cash',
        notes: orderToEdit.notes || '',
      });

      setItems(
        orderToEdit.items && orderToEdit.items.length > 0
          ? JSON.parse(JSON.stringify(orderToEdit.items))
          : [{ productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0 }]
      );

      setShippings(
        orderToEdit.shippingDetails && orderToEdit.shippingDetails.length > 0
          ? JSON.parse(JSON.stringify(orderToEdit.shippingDetails))
          : []
      );
    }
  }, [isOpen, orderToEdit, settings]);

  if (!isOpen || !orderToEdit) return null;

  const orderParties = buildOrderParties(customers, employees, couriers);
  const selectedOrderParty = findOrderParty(formData, customers, employees, couriers);
  const setIsStaffOrder = (value: boolean) => {
    setFormData((prev: any) => ({
      ...prev,
      customerId: '', customerName: '', customerPhone: '', customerAddress: '',
      orderPartyId: '', employeeId: '', courierId: '', customerAccountId: '', customerAccountCode: '',
      isStaffOrder: value, orderPartyType: value ? 'employee' : 'customer',
    }));
  };
  const clearOrderParty = () => {
    setFormData((prev: any) => ({
      ...prev, customerId: '', customerName: '', customerPhone: '', customerAddress: '',
      orderPartyId: '', employeeId: '', courierId: '', customerAccountId: '', customerAccountCode: '',
    }));
  };
  const selectOrderParty = async (party: OrderParty) => {
    const entityType = party.type === 'employee' ? 'employee' : party.type === 'courier' ? 'courier' : 'customer';
    const account = party.financialAccountId
      ? null
      : await financialAccountService.createAccountForEntity(entityType, party.id, party.name, settings?.currency || 'YER');
    const resolved = account ? { ...party, financialAccountId: account.id, financialAccountCode: account.accountCode } : party;
    setFormData((prev: any) => ({ ...prev, ...toOrderPartyPayload(resolved) }));
  };

  // Item handlers
  const addItemRow = () => {
    setItems([...items, { productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0 }]);
  };

  const updateItemRow = (idx: number, field: string, val: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const removeItemRow = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  // Shipping handlers
  const addShippingRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setShippings([
      ...shippings,
      {
        id: Math.random().toString(36).substring(2, 11),
        shippingType: 'بري',
        shippingCompany: shippingCompanies[0]?.name || 'Aramex',
        shippingSource: '',
        shippingDestination: '',
        shippingDate: today,
        shippingDuration: '15',
        expectedArrival: '',
        shippingCost: 0,
        packagingFees: 0,
        contentCategoryId: '',
        contentCategoryName: '',
        cartonCount: 0,
        customsFee: 0,
        taxFee: 0,
        otherCategoryFee: 0,
        categoryFeesTotal: 0,
        categoryFeeCurrency: 'SAR',
      },
    ]);
  };

  const updateShippingRow = (idx: number, field: string, val: any) => {
    setShippings((prev) => {
      const updated = [...prev];
      const nextShipping = { ...updated[idx], [field]: val };

      if (field === 'contentCategoryId' || field === 'cartonCount') {
        const categoryId = field === 'contentCategoryId' ? val : nextShipping.contentCategoryId;
        const category = itemCategories.find((entry: any) => entry.id === categoryId);
        const fees = calculateShipmentCategoryFees(category, nextShipping.cartonCount);
        Object.assign(nextShipping, {
          contentCategoryId: category?.id || '',
          contentCategoryName: category ? (isAr ? category.nameAr : category.nameEn) : '',
          cartonCount: fees.cartonCount,
          customsFee: fees.customsFee,
          taxFee: fees.taxFee,
          otherCategoryFee: fees.otherCategoryFee,
          categoryFeesTotal: fees.total,
          categoryFeeCurrency: fees.currency,
        });
      }

      updated[idx] = nextShipping;
      return updated;
    });
  };

  const removeShippingRow = (idx: number) => {
    setShippings(shippings.filter((_, i) => i !== idx));
  };

  // Calculations
  const productsSum = items.reduce(
    (sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.productPrice || 0)),
    0
  );
  const itemsPackagingSum = items.reduce(
    (sum, i) => sum + ((parseFloat(i.packagingOptionPrice as any) || 0) * (parseFloat(i.quantity as any) || 1)),
    0
  );
  const shippingsCategorySum = shippings.reduce(
    (sum, s) => sum + (parseFloat(s.shippingCategoryPrice as any) || 0),
    0
  );
  const shippingsCostSum = shippings.reduce(
    (sum, s) => sum + parseFloat(s.shippingCost || 0) + parseFloat(s.packagingFees || 0) + (parseFloat(s.shippingCategoryPrice as any) || 0),
    0
  );
  const orderCurrency = formData.orderCurrency || settings?.defaultOrderCurrency || settings?.currency || 'SAR';
  const paymentCurrency = formData.currency || orderCurrency;
  const currencyRates = activeCurrencies.reduce((rates: Record<string, number>, currency: any) => {
    const value = Number(currency.currentPrice ?? currency.price ?? currency.rate);
    if (currency.code && Number.isFinite(value) && value > 0) rates[currency.code] = value;
    return rates;
  }, {});
  const currencyTotals = calculateOrderPaymentTotals({
    orderSubtotal: productsSum + itemsPackagingSum + shippingsCostSum + parseFloat(formData.packagingFee || 0),
    deliveryFeeOriginal: parseFloat(formData.deliveryCourierFee) || 0,
    deliveryFeeCurrency: formData.deliveryCourierFeeCurrency || settings?.currency || 'YER',
    orderCurrency,
    paymentCurrency,
    rates: currencyRates,
  });
  const totalOrderSAR = currencyTotals.totalOrderCurrency;
  const totalOrderYER = currencyTotals.totalPaymentCurrency;
  const valPaid = parseFloat(formData.amountPaid) || 0;
  const remainingYER = totalOrderYER - valPaid;

  // Step Validation Logic
  const validateStep = (step: number): boolean => {
    setStepErrors(null);

    if (step === 1) {
      if (!formData.customerName || formData.customerName.trim() === '') {
        setStepErrors(isAr ? '⚠️ يرجى تحديد العميل أو إدخال اسمه' : '⚠️ Please select or enter customer name');
        return false;
      }
    }

    if (step === 2) {
      if (!items || items.length === 0) {
        setStepErrors(isAr ? '⚠️ يجب إدراج منتج واحد على الأقل' : '⚠️ Must include at least one product');
        return false;
      }
      for (let i = 0; i < items.length; i++) {
        if (!items[i].productName || items[i].productName.trim() === '') {
          setStepErrors(isAr ? `⚠️ يرجى كتابة اسم المنتج للبند رقم (${i + 1})` : `⚠️ Please enter product name for item #${i + 1}`);
          return false;
        }
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

  // Final Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 5) {
      handleNextStep();
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payStatus = remainingYER <= 0 ? 'Paid' : valPaid > 0 ? 'Partial Paid' : 'Unpaid';

      const payload = {
        customerId: formData.customerId,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerAddress: formData.customerAddress,
        orderPartyId: formData.orderPartyId || formData.customerId,
        orderPartyType: formData.orderPartyType || 'customer',
        isStaffOrder: Boolean(formData.isStaffOrder),
        employeeId: formData.employeeId || '',
        courierId: formData.courierId || '',
        customerAccountId: formData.customerAccountId || '',
        customerAccountCode: formData.customerAccountCode || '',
        orderSourceId: formData.orderSourceId,
        orderSourceName: formData.orderSourceName,
        orderSourceType: formData.orderSourceType,
        externalOrderNumber: formData.externalOrderNumber,
        trackingNumber: formData.trackingNumber || orderToEdit.orderNumber,
        shippingCompany: formData.shippingCompany,
        shippingCourierId: formData.shippingCourierId,
        deliveryCourierId: formData.deliveryCourierId,
        deliveryCourierFee: parseFloat(formData.deliveryCourierFee) || 0,
        deliveryCourierFeeCurrency: formData.deliveryCourierFeeCurrency || settings?.currency || 'YER',
        deliveryCourierFeeOrderCurrency: currencyTotals.deliveryFeeOrderCurrency,
        currency: orderCurrency,
        orderCurrency,
        paidCurrency: paymentCurrency,
        exchangeRate: currencyTotals.paymentExchangeRate,
        exchangeRateYER: formData.exchangeRateYER,
        exchangeRateUSD: formData.exchangeRateUSD,
        bankCommissionRate: formData.bankCommissionRate,
        companyProfitRate: formData.companyProfitRate,
        packagingFee: parseFloat(formData.packagingFee) || 0,
        sheinRedPrice: parseFloat(formData.sheinRedPrice) || 0,
        productsSum,
        totalCostSAR: totalOrderSAR,
        totalCostYER: totalOrderYER,
        amountPaid: valPaid,
        amountRemaining: Math.max(0, remainingYER),
        paymentStatus: payStatus,
        items,
        shippingDetails: shippings,
        updatedAt: Date.now(),
      };

      await updateDoc(doc(db, 'orders', orderToEdit.id), payload);

      activityLogService.log('edit_order', orderToEdit.orderNumber || orderToEdit.id, {
        updatedFields: Object.keys(payload),
      });

      notificationService.notify({
        title: isAr ? 'تم تعديل الطلب' : 'Order Updated',
        message: isAr
          ? `تم حفظ التعديلات على الطلب رقم ${orderToEdit.orderNumber || orderToEdit.id} بنجاح`
          : `Order ${orderToEdit.orderNumber || orderToEdit.id} updated successfully`,
        type: 'success',
        category: 'order',
      });

      onClose();
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ في الحفظ' : 'Save Error',
        message: err.message || 'Could not update order',
        type: 'error',
        category: 'order',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-blue-500/30 rounded-3xl w-full max-w-5xl my-4 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Persistent Fixed Header */}
        <div className="p-4 bg-slate-955 border-b border-slate-800 space-y-3 shrink-0 text-start">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-400" />
              <h3 className="font-black text-white text-base">
                {isAr ? `تعديل بيانات الطلب الموحد (${orderToEdit.orderNumber || orderToEdit.id})` : `Edit Order (${orderToEdit.orderNumber || orderToEdit.id})`}
              </h3>
            </div>
            <button onClick={onClose} className="bg-slate-800 text-slate-400 hover:text-white p-1.5 rounded-xl cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Metrics bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl text-xs font-bold">
            <div className="bg-slate-955/60 p-2 rounded-xl border border-slate-800">
              <span className="block text-[9px] text-slate-500 font-black uppercase">{isAr ? 'العميل' : 'Customer'}</span>
              <span className="text-xs font-bold text-white truncate block">{formData.customerName || '—'}</span>
            </div>
            <div className="bg-slate-955/60 p-2 rounded-xl border border-slate-800">
              <span className="block text-[9px] text-slate-500 font-black uppercase">{isAr ? 'إجمالي الفاتورة' : 'Total Due'}</span>
              <span className="font-mono text-xs font-black text-emerald-400">{Math.ceil(totalOrderYER).toLocaleString()} {paymentCurrency}</span>
            </div>
            <div className="bg-slate-955/60 p-2 rounded-xl border border-slate-800">
              <span className="block text-[9px] text-slate-500 font-black uppercase">{isAr ? 'المبلغ المدفوع' : 'Paid'}</span>
              <span className="font-mono text-xs font-black text-blue-400">{valPaid.toLocaleString()} {paymentCurrency}</span>
            </div>
            <div className="bg-slate-955/60 p-2 rounded-xl border border-slate-800">
              <span className="block text-[9px] text-slate-500 font-black uppercase">{isAr ? 'المتبقي' : 'Remaining'}</span>
              <span className="font-mono text-xs font-black text-rose-400">{Math.ceil(remainingYER).toLocaleString()} {paymentCurrency}</span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="bg-slate-950/80 border-b border-slate-800/60 px-4 sm:px-8 py-3 shrink-0">
          <div className="flex items-center justify-between relative max-w-3xl mx-auto">
            <div className="absolute top-4 left-6 right-6 h-1 bg-slate-800 -translate-y-1/2 z-0 rounded-full"></div>
            <div
              className="absolute top-4 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 -translate-y-1/2 z-0 rounded-full transition-all duration-500 ease-out"
              style={{
                left: isAr ? 'auto' : '1.5rem',
                right: isAr ? '1.5rem' : 'auto',
                width: `${((currentStep - 1) / (STEPS.length - 1)) * 90}%`
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
                  className={`relative z-10 flex flex-col items-center group cursor-pointer transition-all ${
                    isActive ? 'scale-105' : 'hover:scale-102'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs transition-all duration-300 shadow-lg ${
                      isCompleted
                        ? 'bg-blue-500 text-white border-2 border-blue-400'
                        : isActive
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-2 border-indigo-300 shadow-blue-500/30 ring-4 ring-blue-500/20'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span
                    className={`block text-[10px] font-black mt-1 ${
                      isActive ? 'text-blue-400' : isCompleted ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {isAr ? step.titleAr : step.titleEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Validation Errors */}
        {stepErrors && (
          <div className="bg-rose-950/70 border-b border-rose-900/80 px-6 py-2 text-rose-300 text-xs font-black flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{stepErrors}</span>
            </div>
            <button onClick={() => setStepErrors(null)} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-start text-xs font-bold">
          
          {/* STEP 1: Customer & Source */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <span className="text-blue-400 uppercase text-[10px] block font-black">{isAr ? 'العميل والحساب' : 'Customer Account'}</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-3">
                    <label className="block text-slate-500 mb-2">{isAr ? 'تحديد طرف الطلب والحساب المالي' : 'Order party and financial account'}</label>
                    <OrderPartyPicker
                      isAr={isAr}
                      parties={orderParties}
                      selectedParty={selectedOrderParty}
                      staffOnly={Boolean(formData.isStaffOrder)}
                      onStaffOnlyChange={setIsStaffOrder}
                      onSelect={selectOrderParty}
                      onClear={clearOrderParty}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'اسم العميل' : 'Customer Name'}</label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'رقم الهاتف' : 'Phone'}</label>
                    <input
                      type="text"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <span className="text-blue-400 uppercase text-[10px] block font-black">{isAr ? 'المصدر والتتبع' : 'Source & Tracking'}</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'مصدر الطلب' : 'Order Source'}</label>
                    <select
                      value={formData.orderSourceId}
                      onChange={(e) => {
                        const s = sources.find((src) => src.id === e.target.value);
                        setFormData({
                          ...formData,
                          orderSourceId: e.target.value,
                          orderSourceName: s ? s.name || s.source_name : '',
                          orderSourceType: s ? s.type || 'App' : 'App',
                        });
                      }}
                      className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none cursor-pointer"
                    >
                      <option value="">{isAr ? '-- اختر المصدر --' : '-- Choose Source --'}</option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name || s.source_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'رقم الفاتورة الأصلي (سلة/متجر)' : 'External Reference'}</label>
                    <input
                      type="text"
                      value={formData.externalOrderNumber}
                      onChange={(e) => setFormData({ ...formData, externalOrderNumber: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">{isAr ? 'رقم التتبع الموحد' : 'Tracking Number'}</label>
                    <input
                      type="text"
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 text-white rounded-xl p-3 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Products & Items */}
          {currentStep === 2 && (
            <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800 space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-blue-400 uppercase text-[10px] font-black">{isAr ? 'الأصناف والمنتجات' : 'Products & Items'}</span>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer"
                >
                  ➕ {isAr ? 'إضافة منتج' : 'Add Item'}
                </button>
              </div>

              <div className="space-y-2.5">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                    <div className="col-span-4">
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'اسم المنتج' : 'Item Name'}</label>
                      <input
                        type="text"
                        value={item.productName || ''}
                        onChange={(e) => updateItemRow(idx, 'productName', e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2 text-[11px]"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'رابط المنتج' : 'Product URL'}</label>
                      <input
                        type="text"
                        value={item.productUrl || ''}
                        onChange={(e) => updateItemRow(idx, 'productUrl', e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2 text-[11px]"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'السعر (SAR)' : 'Price'}</label>
                      <input
                        type="number"
                        value={item.productPrice || 0}
                        onChange={(e) => updateItemRow(idx, 'productPrice', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2 text-[11px] font-mono text-center"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'الكمية' : 'Qty'}</label>
                      <input
                        type="number"
                        value={item.quantity || 1}
                        onChange={(e) => updateItemRow(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2 text-[11px] font-mono text-center"
                      />
                    </div>

                    <div className="col-span-1 flex justify-center pt-3">
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length === 1}
                        className="text-rose-500 hover:text-rose-400 p-1.5 rounded-lg disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Packaging Type Sub-Row */}
                    <div className="col-span-12 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-850 text-[10px] text-start">
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
                          className="bg-slate-950 border border-slate-800 text-white font-bold rounded-xl px-2.5 py-1 text-[11px] outline-none cursor-pointer focus:border-cyan-400"
                        >
                          <option value="">{isAr ? '-- بدون فئة --' : '-- No category --'}</option>
                          {itemCategories.map((category: any) => <option key={category.id} value={category.id}>{isAr ? category.nameAr : category.nameEn}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-amber-400 flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          {isAr ? 'نوع التغليف (order_option):' : 'Packaging Type:'}
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
                          className="bg-slate-950 border border-slate-800 text-white font-bold rounded-xl px-2.5 py-1 text-[11px] outline-none cursor-pointer focus:border-[#d4af37]"
                        >
                          <option value="">{isAr ? '-- بدون تغليف خاص (0) --' : '-- Standard (0) --'}</option>
                          {(packagingOptions || []).map((pkg: any) => (
                            <option key={pkg.id} value={pkg.id}>
                              {isAr ? pkg.nameAr : pkg.nameEn} {pkg.price > 0 ? `(+${pkg.price} SAR)` : '(مجاني)'}
                            </option>
                          ))}
                        </select>
                      </div>
                      {item.packagingOptionPrice > 0 && (
                        <span className="text-emerald-400 font-mono font-bold">
                          +{((parseFloat(item.packagingOptionPrice) || 0) * (parseFloat(item.quantity) || 1)).toLocaleString()} SAR
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Shipping & Logistics */}
          {currentStep === 3 && (
            <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800 space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-blue-400 uppercase text-[10px] font-black">{isAr ? 'مسارات الشحن' : 'Shipping Tracks'}</span>
                <button
                  type="button"
                  onClick={addShippingRow}
                  className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer"
                >
                  ➕ {isAr ? 'إضافة مسار شحن' : 'Add Track'}
                </button>
              </div>

              <div className="space-y-3">
                {shippings.map((sh, idx) => (
                  <div key={sh.id || idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                    <div>
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'شركة الشحن' : 'Carrier'}</label>
                      <select
                        value={sh.shippingCompany || ''}
                        onChange={(e) => updateShippingRow(idx, 'shippingCompany', e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2.5 text-[11px] cursor-pointer"
                      >
                        {shippingCompanies.map((sc) => (
                          <option key={sc.id} value={sc.name}>
                            {sc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'فئة الشحن (order_option)' : 'Shipping Category'}</label>
                      <select
                        value={sh.shippingCategoryId || ''}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const foundOpt = shippingCategoryOptions?.find((o: any) => o.id === selectedId);
                          updateShippingRow(idx, 'shippingCategoryId', selectedId);
                          updateShippingRow(idx, 'shippingCategoryName', foundOpt ? (isAr ? foundOpt.nameAr : foundOpt.nameEn) : '');
                          updateShippingRow(idx, 'shippingCategoryPrice', foundOpt ? (parseFloat(foundOpt.price) || 0) : 0);
                          if (foundOpt?.duration !== undefined) {
                            updateShippingRow(idx, 'shippingDuration', String(foundOpt.duration));
                          }
                        }}
                        className="w-full bg-slate-955 border border-slate-800 text-cyan-300 font-bold rounded-lg p-2.5 text-[11px] cursor-pointer"
                      >
                        <option value="">{isAr ? '-- عادي --' : '-- Standard --'}</option>
                        {(shippingCategoryOptions || []).map((cat: any) => (
                          <option key={cat.id} value={cat.id}>
                            {isAr ? cat.nameAr : cat.nameEn} {cat.duration ? `(${cat.duration}d)` : ''} {cat.price > 0 ? `(+${cat.price} SAR)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'تكلفة الشحن (SAR)' : 'Cost (SAR)'}</label>
                      <input
                        type="number"
                        value={sh.shippingCost || 0}
                        onChange={(e) => updateShippingRow(idx, 'shippingCost', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-955 border border-slate-800 text-[#d4af37] rounded-lg p-2.5 text-[11px] font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'مكان التصدير' : 'Source'}</label>
                      <input
                        type="text"
                        value={sh.shippingSource || ''}
                        onChange={(e) => updateShippingRow(idx, 'shippingSource', e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2.5 text-[11px]"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'الوجهة' : 'Destination'}</label>
                        <input
                          type="text"
                          value={sh.shippingDestination || ''}
                          onChange={(e) => updateShippingRow(idx, 'shippingDestination', e.target.value)}
                          className="w-full bg-slate-955 border border-slate-800 text-white rounded-lg p-2.5 text-[11px]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeShippingRow(idx)}
                        className="text-rose-500 hover:text-rose-400 p-1.5 rounded-lg pt-4 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="md:col-span-4 grid grid-cols-1 lg:grid-cols-7 gap-2.5 border-t border-cyan-500/15 pt-3">
                      <div className="lg:col-span-2">
                        <label className="block text-[9px] text-cyan-300 mb-0.5 font-black">{isAr ? 'فئة محتوى الشحنة' : 'Shipment content category'}</label>
                        <select
                          value={sh.contentCategoryId || ''}
                          onChange={(e) => updateShippingRow(idx, 'contentCategoryId', e.target.value)}
                          className="w-full bg-slate-950 border border-cyan-500/25 text-white rounded-lg p-2.5 text-[11px] cursor-pointer focus:border-cyan-400 outline-none"
                        >
                          <option value="">{isAr ? '-- بدون فئة --' : '-- No category --'}</option>
                          {itemCategories.map((category: any) => (
                            <option key={category.id} value={category.id}>{isAr ? category.nameAr : category.nameEn}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-500 mb-0.5">{isAr ? 'عدد الكراتين' : 'Cartons'}</label>
                        <input
                          type="number"
                          min="0"
                          value={sh.cartonCount ?? 0}
                          onChange={(e) => updateShippingRow(idx, 'cartonCount', Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 text-[11px] font-mono text-center"
                        />
                      </div>
                      <FeeSummary label={isAr ? 'جمارك' : 'Customs'} value={sh.customsFee} currency={sh.categoryFeeCurrency} />
                      <FeeSummary label={isAr ? 'ضريبة' : 'Tax'} value={sh.taxFee} currency={sh.categoryFeeCurrency} />
                      <FeeSummary label={isAr ? 'رسوم أخرى' : 'Other fees'} value={sh.otherCategoryFee} currency={sh.categoryFeeCurrency} />
                      <FeeSummary label={isAr ? 'إجمالي رسوم الفئة' : 'Category fees total'} value={sh.categoryFeesTotal} currency={sh.categoryFeeCurrency} emphasized />
                      <p className="lg:col-span-7 text-[9px] text-slate-500">
                        {isAr ? 'تُحفظ هذه الرسوم مع الشحنة فقط ولا تدخل في إجمالي الطلب أو مدفوعاته.' : 'These fees are stored with this shipment only and are excluded from the order total and payments.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Financials & Payment */}
          {currentStep === 4 && (
            <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800 space-y-4 animate-fade-in">
              <span className="text-blue-400 uppercase text-[10px] block font-black">{isAr ? 'القيم والمدفوعات' : 'Financials & Payments'}</span>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">{isAr ? `المبلغ المدفوع (${paymentCurrency})` : `Amount Paid (${paymentCurrency})`}</label>
                  <input
                    type="number"
                    value={formData.amountPaid}
                    onChange={(e) => setFormData({ ...formData, amountPaid: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-955 border border-slate-800 text-emerald-400 font-mono font-bold rounded-xl p-3 outline-none text-base"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">{isAr ? `رسوم التغليف العامة (${orderCurrency})` : `Packaging Fee (${orderCurrency})`}</label>
                  <input
                    type="number"
                    value={formData.packagingFee}
                    onChange={(e) => setFormData({ ...formData, packagingFee: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-955 border border-slate-800 text-white font-mono rounded-xl p-3 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">{isAr ? `أجرة التوصيل (${formData.deliveryCourierFeeCurrency || settings?.currency || 'YER'})` : `Delivery Fee (${formData.deliveryCourierFeeCurrency || settings?.currency || 'YER'})`}</label>
                  <input
                    type="number"
                    value={formData.deliveryCourierFee}
                    onChange={(e) => setFormData({ ...formData, deliveryCourierFee: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-955 border border-slate-800 text-white font-mono rounded-xl p-3 outline-none"
                  />
                  <p className="mt-1 text-[10px] font-mono text-amber-300/80">≈ {currencyTotals.deliveryFeeOrderCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })} {orderCurrency}</p>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">{isAr ? 'عملة الدفع' : 'Payment Currency'}</label>
                  <select
                    value={paymentCurrency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 text-white font-bold rounded-xl p-3 outline-none"
                  >
                    {activeCurrencies.map((currency: any) => <option className="bg-slate-900 text-white" key={currency.code} value={currency.code}>{currency.code}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">{isAr ? `إجمالي بعملة الطلب (${orderCurrency}):` : `Order Total (${orderCurrency}):`}</span>
                  <span className="font-mono text-amber-300 font-black text-sm">{Math.ceil(totalOrderSAR).toLocaleString()} {orderCurrency}</span>
                </div>
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">{isAr ? `إجمالي بعملة الدفع (${paymentCurrency}):` : `Payment Total (${paymentCurrency}):`}</span>
                  <span className="font-mono text-white font-black text-sm">{Math.ceil(totalOrderYER).toLocaleString()} {paymentCurrency}</span>
                </div>
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">{isAr ? 'المتبقي ذمة:' : 'Remaining Balance:'}</span>
                  <span className="font-mono text-rose-400 font-black text-sm">{Math.ceil(remainingYER).toLocaleString()} {paymentCurrency}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Summary & Confirm */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 bg-blue-950/20 border border-blue-900/30 rounded-2xl flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-blue-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-blue-300">
                    {isAr ? 'مراجعة التعديلات النهائية قبل الحفظ' : 'Review changes before saving'}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {isAr ? 'تأكد من مطابقة كافة البيانات المعدلة للطلب' : 'Verify order modifications below'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-slate-400 block border-b border-slate-800 pb-1">{isAr ? 'العميل:' : 'Customer:'}</span>
                  <p className="text-white">{formData.customerName}</p>
                  <p className="text-slate-400 font-mono">{formData.customerPhone}</p>
                </div>

                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-slate-400 block border-b border-slate-800 pb-1">{isAr ? 'المالية:' : 'Financials:'}</span>
                  <p className="text-amber-300 font-mono">إجمالي الطلب: {Math.ceil(totalOrderSAR).toLocaleString()} {orderCurrency}</p>
                  <p className="text-emerald-400 font-mono">إجمالي الدفع: {Math.ceil(totalOrderYER).toLocaleString()} {paymentCurrency}</p>
                  <p className="text-rose-400 font-mono">المتبقي: {Math.ceil(remainingYER).toLocaleString()} {paymentCurrency}</p>
                </div>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-800 flex justify-between items-center flex-wrap gap-3 shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition font-bold text-xs cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>

            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black rounded-xl transition text-xs flex items-center gap-1 cursor-pointer"
                >
                  {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  {isAr ? 'السابق' : 'Previous'}
                </button>
              )}

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black text-xs transition shadow-lg flex items-center gap-1 cursor-pointer"
                >
                  {isAr ? 'التالي' : 'Next'}
                  {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-600 text-white rounded-xl font-black text-xs transition shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmitting ? (isAr ? 'جاري التعديل...' : 'Updating...') : (isAr ? 'تأكيد التعديل والشحنة' : 'Save Order Changes')}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
