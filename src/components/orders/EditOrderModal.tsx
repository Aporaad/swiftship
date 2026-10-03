import React, { useState, useEffect } from 'react';
import {
  X, Edit2, DollarSign, AlertCircle,
  User, ShoppingCart, Truck, CheckCircle2, ChevronRight, ChevronLeft
} from 'lucide-react';
import { doc, updateDoc, addDoc, collection, db } from '../../data/legacy/legacy-adapter';
import { notificationService } from '../../services/notificationService';
import { activityLogService } from '../../services/activityLogService';
import { calculateShipmentCategoryFees } from '../../services/itemCategoryService';
import { financialAccountService } from '../../services/financialAccountService';
import { buildOrderParties, findOrderParty, toOrderPartyPayload, type OrderParty } from '../../services/orderPartyService';
import { calculateOrderPaymentTotals } from '../../services/orderCurrencyService';
import { validateOrderPaymentInput } from '../../services/orderPaymentDataService';
import FinancialCalculatorModal from '../finance/FinancialCalculatorModal';
import ProductPickerModal, { SystemProductRecord } from './ProductPickerModal';
import EditOrderStep1 from '../../features/orders/components/edit-order-modal/EditOrderStep1';
import EditOrderStep2 from '../../features/orders/components/edit-order-modal/EditOrderStep2';
import EditOrderStep3 from '../../features/orders/components/edit-order-modal/EditOrderStep3';
import EditOrderStep4 from '../../features/orders/components/edit-order-modal/EditOrderStep4';
import EditOrderStep5 from '../../features/orders/components/edit-order-modal/EditOrderStep5';
import { adaptEditOrderSnapshot } from './editOrderModal.adapter';
import type { OrderFormData, ItemRow, ShippingRow } from '../../features/orders/types';
import type { ItemCategory } from '../../services/itemCategoryService';
import type { Settings } from '../../context/SettingsContext';
import type { Currency } from '../../services/currencyService';
import type { FinanceCurrency } from '../../shared/contracts/finance.contracts';

type UnknownRecord = Record<string, unknown>;
type SourceOption = { id: string; name?: string | null; source_name?: string | null; type?: string | null };
type SelectOption = { id: string; nameAr?: string | null; nameEn?: string | null; price?: number | string | null; duration?: number | string | null };
type ShippingCompanyOption = { id: string; name: string };
type CurrencyOption = Currency & { price?: number | string | null; rate?: number | string | null };
type AccountOption = { id: string; name?: string | null; account_name?: string | null; accNameAr?: string | null; accSubId?: string | null; code?: string | null };
type ItemCategoryOption = Partial<ItemCategory> & SelectOption;
type ModalSettings = Partial<Settings>;
type EditableItemRow = ItemRow & {
  id?: string;
  items_id?: string;
  product_name?: string;
  product_name_ar?: string;
  product_name_en?: string;
  product_url?: string;
  product_price?: number;
  packaging_option_id?: string;
  is_insured?: boolean;
  insurance_fee?: number;
  items_status?: string;
  itemsStatus?: string;
  created_at?: string;
  tracking_number?: string;
};
type EditableShippingRow = ShippingRow & {
  shipping_status?: string;
  shipment_status?: string;
  tracking_number?: string;
  shipping_category_id?: string;
  content_category_id?: string;
  content_category_name?: string;
  createdAt?: number;
};

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderToEdit: unknown;
  customers: readonly unknown[];
  employees: readonly unknown[];
  sources: SourceOption[];
  couriers: readonly unknown[];
  shippingCompanies: ShippingCompanyOption[];
  activeCurrencies: CurrencyOption[];
  financialAccounts?: AccountOption[];
  packagingOptions?: SelectOption[];
  shippingCategoryOptions?: SelectOption[];
  itemCategories?: ItemCategoryOption[];
  settings: ModalSettings;
  isAr: boolean;
}

const asRecord = (value: unknown): UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as UnknownRecord : {};
const textValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
const numericValue = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? Number.parseFloat(String(value)) : typeof value === 'string' ? Number.parseFloat(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};
const itemRowFromUnknown = (value: unknown): EditableItemRow => {
  // Data from the adapter is deliberately narrowed at this boundary; unknown legacy fields are retained by the spread.
  const row = asRecord(value);
  return {
    ...row,
    productName: textValue(row.productName ?? row.product_name ?? row.name),
    productUrl: textValue(row.productUrl ?? row.product_url),
    quantity: numericValue(row.quantity, 1),
    productPrice: numericValue(row.productPrice ?? row.product_price ?? row.price ?? row.unitPrice),
    weight: numericValue(row.weight),
    cbm: numericValue(row.cbm),
    length: numericValue(row.length),
    width: numericValue(row.width),
    height: numericValue(row.height),
    trackingNumber: textValue(row.trackingNumber ?? row.tracking_number),
    isInsured: Boolean(row.isInsured ?? row.is_insured),
    insuranceFee: numericValue(row.insuranceFee ?? row.insurance_fee),
  };
};
const shippingRowFromUnknown = (value: unknown): EditableShippingRow => {
  // Adapter rows may use either camelCase or legacy snake_case keys; normalize them without an unsafe cast.
  const row = asRecord(value);
  return {
    ...row,
    id: textValue(row.id),
    shippingType: textValue(row.shippingType, 'بري'),
    shippingCompany: textValue(row.shippingCompany, 'Aramex'),
    shippingSource: textValue(row.shippingSource),
    shippingDestination: textValue(row.shippingDestination),
    shippingDate: textValue(row.shippingDate),
    shippingDuration: textValue(row.shippingDuration),
    expectedArrival: textValue(row.expectedArrival),
    shippingCost: numericValue(row.shippingCost),
    packagingFees: numericValue(row.packagingFees),
    contentCategoryId: textValue(row.contentCategoryId ?? row.content_category_id),
    contentCategoryName: textValue(row.contentCategoryName ?? row.content_category_name),
    cartonCount: numericValue(row.cartonCount),
    customsFee: numericValue(row.customsFee),
    taxFee: numericValue(row.taxFee),
    otherCategoryFee: numericValue(row.otherCategoryFee),
    categoryFeesTotal: numericValue(row.categoryFeesTotal),
    categoryFeeCurrency: textValue(row.categoryFeeCurrency, 'SAR'),
  };
};

const STEPS = [
  { id: 1, titleAr: 'العميل والمصدر', titleEn: 'Customer & Source', icon: User },
  { id: 2, titleAr: 'المنتجات والأصناف', titleEn: 'Products & Items', icon: ShoppingCart },
  { id: 3, titleAr: 'الشحن والمناديب', titleEn: 'Shipping & Logistics', icon: Truck },
  { id: 4, titleAr: 'المالية والدفع', titleEn: 'Financials & Payment', icon: DollarSign },
  { id: 5, titleAr: 'الخلاصة والتأكيد', titleEn: 'Summary & Confirm', icon: CheckCircle2 },
];

export default function EditOrderModal({
  isOpen,
  onClose,
  orderToEdit: orderToEditInput,
  customers,
  employees,
  sources,
  couriers,
  shippingCompanies,
  activeCurrencies,
  financialAccounts = [],
  packagingOptions = [],
  shippingCategoryOptions = [],
  itemCategories = [],
  settings,
  isAr,
}: EditOrderModalProps) {
  const normalizedOrder = adaptEditOrderSnapshot(orderToEditInput);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepErrors, setStepErrors] = useState<string | null>(null);
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);

  // Filter available cash box and bank accounts from financialAccounts
  const cashAccountsList = (financialAccounts || []).filter(
    (a) => a.accSubId === '111' || (a.id && String(a.id).startsWith('111'))
  );
  const bankAccountsList = (financialAccounts || []).filter(
    (a) => a.accSubId === '112' || (a.id && String(a.id).startsWith('112'))
  );

  const getCurrencyRate = (code: string) => {
    if (code === 'YER') return 1;
    const found = activeCurrencies?.find((c) => c.code === code);
    if (found && numericValue(found.currentPrice) > 0) return numericValue(found.currentPrice);
    if (found && numericValue(found.price) > 0) return numericValue(found.price);
    if (code === 'SAR') return 140;
    if (code === 'USD') return 535;
    return 1;
  };

  // Form State
  const [formData, setFormData] = useState<OrderFormData>({
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    orderPartyId: '',
    orderPartyType: 'customer',
    isStaffOrder: false,
    employeeId: '',
    courierId: '',
    orderPartyAccountId: '',
    orderSourceId: '',
    orderSourceName: '',
    orderSourceType: 'App',
    externalOrderNumber: '',
    trackingNumber: '',
    shippingCompany: 'Aramex',
    addShippingEnabled: false,
    shippingCourierFeeRate: 0,
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
    deductSourcingCostFromCourier: false,
    sourcing_cost: '',
  });

  const [items, setItems] = useState<EditableItemRow[]>([]);
  const [shippings, setShippings] = useState<EditableShippingRow[]>([]);

  // Load existing order data on mount/open
  useEffect(() => {
    if (isOpen && normalizedOrder) {
      setCurrentStep(1);
      setStepErrors(null);
      const loadedOrderCurrency = normalizedOrder.orderCurrency || normalizedOrder.currency || settings?.defaultOrderCurrency || settings?.currency || 'SAR';

      setFormData({
        customerId: normalizedOrder.customerId || '',
        customerName: normalizedOrder.customerName || '',
        customerPhone: normalizedOrder.customerPhone || '',
        customerAddress: normalizedOrder.customerAddress || '',
        orderPartyId: normalizedOrder.orderPartyId || normalizedOrder.customerId || '',
        orderPartyType: normalizedOrder.orderPartyType || (normalizedOrder.isStaffOrder ? 'employee' : 'customer'),
        isStaffOrder: Boolean(normalizedOrder.isStaffOrder || (normalizedOrder.orderPartyType && normalizedOrder.orderPartyType !== 'customer')),
        employeeId: normalizedOrder.employeeId || '',
        courierId: normalizedOrder.courierId || '',
        orderPartyAccountId: normalizedOrder.orderPartyAccountId || normalizedOrder.order_party_account_id || '',
        orderSourceId: normalizedOrder.orderSourceId || '',
        orderSourceName: normalizedOrder.orderSourceName || '',
        orderSourceType: normalizedOrder.orderSourceType || 'App',
        externalOrderNumber: normalizedOrder.externalOrderNumber || '',
        trackingNumber: normalizedOrder.trackingNumber || '',
        shippingCompany: normalizedOrder.shippingCompany || 'Aramex',
        addShippingEnabled: false,
        shippingCourierFeeRate: 0,
        shippingCourierId: normalizedOrder.shippingCourierId || '',
        deliveryCourierId: normalizedOrder.deliveryCourierId || '',
        deliveryCourierFee: normalizedOrder.deliveryCourierFee ?? 4000,
        deliveryCourierFeeCurrency: normalizedOrder.deliveryCourierFeeCurrency || settings?.currency || 'YER',
        orderCurrency: loadedOrderCurrency,
        currency: loadedOrderCurrency,
        exchangeRate: 1,
        exchangeRateYER: normalizedOrder.exchangeRateYER || 1,
        exchangeRateUSD: normalizedOrder.exchangeRateUSD || 1,
        bankCommissionRate: normalizedOrder.bankCommissionRate ?? 3,
        companyProfitRate: normalizedOrder.companyProfitRate ?? 12,
        packagingFee: normalizedOrder.packagingFee || 0,
        sheinRedPrice: normalizedOrder.sheinRedPrice || 0,
        amountPaid: normalizedOrder.amountPaid || 0,
        paymentMethod: normalizedOrder.paymentMethod || 'Cash',
        cashAccountId: normalizedOrder.cashAccountId || normalizedOrder.cash_account_id || '',
        bankAccountId: normalizedOrder.bankAccountId || normalizedOrder.bank_account_id || '',
        bankReference: normalizedOrder.bankReference || normalizedOrder.bank_reference || '',
        cashAmount: normalizedOrder.cashAmount || normalizedOrder.cash_amount || 0,
        bankAmount: normalizedOrder.bankAmount || normalizedOrder.bank_amount || 0,
        notes: normalizedOrder.notes || '',
        deductSourcingCostFromCourier: false,
        sourcing_cost: '',
      });

      setItems(
        normalizedOrder.items && normalizedOrder.items.length > 0
          ? normalizedOrder.items.map(itemRowFromUnknown)
          : [{ productName: '', productUrl: '', quantity: 1, productPrice: 0, weight: 0, cbm: 0, length: 0, width: 0, height: 0, trackingNumber: '', isInsured: false, insuranceFee: 0 }]
      );

      setShippings(
        normalizedOrder.shippingDetails && normalizedOrder.shippingDetails.length > 0
          ? normalizedOrder.shippingDetails.map(shippingRowFromUnknown)
          : []
      );
    }
  }, [isOpen, normalizedOrder, settings]);

  if (!isOpen || !normalizedOrder) return null;

  const orderParties = buildOrderParties(customers, employees, couriers);
  const selectedOrderParty = findOrderParty(formData, customers, employees, couriers);
  const setIsStaffOrder = (value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      customerId: '', customerName: '', customerPhone: '', customerAddress: '',
      orderPartyId: '', employeeId: '', courierId: '', orderPartyAccountId: '',
      isStaffOrder: value, orderPartyType: value ? 'employee' : 'customer',
    }));
  };
  const clearOrderParty = () => {
    setFormData((prev) => ({
      ...prev, customerId: '', customerName: '', customerPhone: '', customerAddress: '',
      orderPartyId: '', employeeId: '', courierId: '', orderPartyAccountId: '',
    }));
  };
  const selectOrderParty = async (party: OrderParty) => {
    const entityType = party.type === 'employee' ? 'employee' : party.type === 'courier' ? 'courier' : 'customer';
    const account = party.accountId
      ? null
      : await financialAccountService.createAccountForEntity(entityType, party.id, party.name, settings?.currency || 'YER');
    const resolved = account ? { ...party, accountId: account.id } : party;
    setFormData((prev) => ({ ...prev, ...toOrderPartyPayload(resolved) }));
  };

  // Item handlers
  const addItemRow = () => {
    const defaultInsuranceFee = settings?.defaultProductInsuranceFee || 0;
    setItems([
      ...items,
      {
        productName: '',
        productUrl: '',
        quantity: 1,
        productPrice: 0,
        weight: 0,
        cbm: 0,
        length: 0,
        width: 0,
        height: 0,
        trackingNumber: '',
        isInsured: false,
        insuranceFee: defaultInsuranceFee,
      },
    ]);
  };

  const handleSelectProductFromPicker = (selectedProd: SystemProductRecord) => {
    const defaultInsuranceFee = settings?.defaultProductInsuranceFee || 0;
    const defaultInsuranceType = settings?.defaultProductInsuranceType || 'fixed';
    let rowInsuranceFee = 0;
    if (defaultInsuranceType === 'percentage') {
      rowInsuranceFee = (selectedProd.price ?? 0) * (defaultInsuranceFee / 100);
    } else {
      rowInsuranceFee = defaultInsuranceFee * 1;
    }

    setItems((prev) => [
      ...prev,
      {
        productName: selectedProd.name ?? '',
        productUrl: selectedProd.image_url || '',
        quantity: 1,
        productPrice: selectedProd.price || 0,
        weight: 0,
        cbm: 0,
        length: 0,
        width: 0,
        height: 0,
        trackingNumber: '',
        isInsured: false,
        insuranceFee: rowInsuranceFee,
      },
    ]);
  };

  const updateItemRow = (idx: number, field: keyof ItemRow | 'itemCategoryName' | 'packagingOptionName', val: ItemRow[keyof ItemRow] | string | null | undefined) => {
    setItems((prev) => {
      const updated = [...prev];
      const nextItem = { ...updated[idx], [field]: val };

      const price = numericValue(nextItem.productPrice);
      const qty = numericValue(nextItem.quantity, 1);
      const defaultInsuranceFee = settings?.defaultProductInsuranceFee || 0;
      const defaultInsuranceType = settings?.defaultProductInsuranceType || 'fixed';

      if (nextItem.isInsured) {
        if (defaultInsuranceType === 'percentage') {
          nextItem.insuranceFee = (price * qty) * (defaultInsuranceFee / 100);
        } else {
          nextItem.insuranceFee = defaultInsuranceFee * qty;
        }
      } else {
        nextItem.insuranceFee = 0;
      }

      updated[idx] = nextItem;
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

  const updateShippingRow = (idx: number, field: keyof ShippingRow, val?: unknown) => {
    setShippings((prev) => {
      const updated = [...prev];
      const nextShipping = { ...updated[idx], [field]: val };

      if (field === 'contentCategoryId' || field === 'cartonCount') {
        const categoryId = field === 'contentCategoryId' ? val : nextShipping.contentCategoryId;
        const category = itemCategories.find((entry) => entry.id === categoryId);
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
    (sum, i) => sum + (numericValue(i.quantity) * numericValue(i.productPrice)),
    0
  );
  const itemsPackagingSum = items.reduce(
    (sum, i) => sum + (numericValue(i.packagingOptionPrice) * numericValue(i.quantity, 1)),
    0
  );
  const itemsInsuranceSum = items.reduce(
    (sum, i) => sum + (i.isInsured ? numericValue(i.insuranceFee) : 0),
    0
  );
  const shippingsCategorySum = shippings.reduce(
    (sum, s) => sum + numericValue(s.shippingCategoryPrice),
    0
  );
  const shippingsCostSum = shippings.reduce(
    (sum, s) => sum + numericValue(s.shippingCost) + numericValue(s.packagingFees) + numericValue(s.shippingCategoryPrice),
    0
  );
  const orderCurrency = formData.orderCurrency || settings?.defaultOrderCurrency || settings?.currency || 'SAR';
  const paymentCurrency = formData.currency || orderCurrency;
  const currencyRates = activeCurrencies.reduce((rates: Record<string, number>, currency) => {
    const value = numericValue(currency.currentPrice ?? currency.price ?? currency.rate);
    if (currency.code && Number.isFinite(value) && value > 0) rates[currency.code] = value;
    return rates;
  }, {});
  const currencyTotals = calculateOrderPaymentTotals({
    orderSubtotal: productsSum + itemsPackagingSum + itemsInsuranceSum + shippingsCostSum + numericValue(formData.packagingFee || 0),
    deliveryFeeOriginal: numericValue(formData.deliveryCourierFee) || 0,
    deliveryFeeCurrency: formData.deliveryCourierFeeCurrency || settings?.currency || 'YER',
    orderCurrency,
    paymentCurrency,
    rates: currencyRates,
  });
  const totalOrderSAR = currencyTotals.totalOrderCurrency;
  const totalOrderYER = currencyTotals.totalPaymentCurrency;
  const valPaid = numericValue(formData.amountPaid) || 0;
  const remainingYER = totalOrderYER - valPaid;
  const calculatorCurrencies: FinanceCurrency[] = activeCurrencies.map((currency) => ({
    id: currency.cur_id,
    code: currency.code,
    isDefault: currency.is_default,
  }));

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

    if (step === 4) {
      const err = validateOrderPaymentInput(formData, totalOrderYER, isAr);
      if (err) {
        setStepErrors(err);
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
        // أعمدة مباشرة - تُكتب في الأعمدة الأساسية وتُحذف من data
        customerId: formData.customerId || '',
        orderPartyId: formData.orderPartyId || formData.customerId || '',
        orderPartyType: formData.orderPartyType || 'customer',
        isStaffOrder: Boolean(formData.isStaffOrder),
        employeeId: formData.employeeId || null,
        courierId: formData.courierId || null,
        orderPartyAccountId: formData.orderPartyAccountId || null,
        orderSourceId: formData.orderSourceId || null,
        orderSourceType: formData.orderSourceType || null,
        trackingNumber: formData.trackingNumber || normalizedOrder.orderNumber,
        deliveryCourierId: formData.deliveryCourierId || null,
        shippingCourierId: formData.shippingCourierId || null,
        createdByName: normalizedOrder.createdByName || normalizedOrder.created_by_name || 'Admin',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin',
        // بيانات مالية وحسابية - تُخزَّن في data
        externalOrderNumber: formData.externalOrderNumber,
        shippingCompany: formData.shippingCompany,
        deliveryCourierFee: numericValue(formData.deliveryCourierFee) || 0,
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
        packagingFee: numericValue(formData.packagingFee) || 0,
        productInsuranceFee: itemsInsuranceSum,
        product_insurance_fee: itemsInsuranceSum,
        sheinRedPrice: numericValue(formData.sheinRedPrice) || 0,
        productsSum,
        totalCostSAR: totalOrderSAR,
        totalCostYER: totalOrderYER,
        amountPaid: valPaid,
        amountRemaining: Math.max(0, remainingYER),
        paymentStatus: payStatus,
        paymentMethod: formData.paymentMethod || 'Cash',
        cashAccountId: formData.cashAccountId || null,
        bankAccountId: formData.bankAccountId || null,
        bankReference: formData.bankReference || '',
        cashAmount: numericValue(formData.cashAmount) || 0,
        bankAmount: numericValue(formData.bankAmount) || 0,
      };


      // تحديث بيانات الطلب الأساسية في جدول الطلبات
      // Update primary order record in orders table
      await updateDoc(doc(db, 'orders', normalizedOrder.id), payload);

      const targetOrderId = normalizedOrder.id || normalizedOrder.orderNumber;

      // حفظ وإدراج منتجات الطلب في جدول المنتجات المخصص
      // ─── حفظ المنتجات الرئيسية في products وبنود الطلب في order_items ───
      // Save master products in 'products' table (if new) and line items in 'order_items' table
      if (items && items.length > 0) {
        for (const item of items) {
          const qty = numericValue(item.quantity || 1);
          const unitPrice = numericValue(item.productPrice || item.price || item.unitPrice || 0);
          const weight = numericValue(item.weight || 0);
          const cbm = numericValue(item.cbm || 0);
          const isInsured = Boolean(item.isInsured || item.is_insured);
          const insuranceFee = isInsured ? (numericValue(item.insuranceFee || item.insurance_fee) || 0) : 0;

          // 1) التأكد من وجود المنتج الرئيسي أو إنشائه
          let masterProductId = item.product_id || item.productId || null;
          if (!masterProductId) {
            masterProductId = 'prod_' + Math.random().toString(36).substring(2, 11);
            await addDoc(masterProductId, collection(db, 'products'), {
              product_id: masterProductId,
              product_name_ar: item.productName || item.product_name || item.name || 'منتج',
              product_name_en: item.productNameEn || item.productName || 'Product',
              product_url: item.productUrl || item.product_url || '',
              unit_price: unitPrice,
              item_category_id: item.itemCategoryId || item.item_category_id || null,
              is_allowed: true,
              cbm: cbm,
              width: numericValue(item.width || 0),
              height: numericValue(item.height || 0),
              length: numericValue(item.length || 0),
              weight: weight,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }

          // 2) حفظ بند الطلب في جدول order_items
          const itemId = item.items_id || item.id || ('item_' + Math.random().toString(36).substring(2, 11));
          const itemPayload = {
            items_id: itemId,
            order_id: targetOrderId,
            product_id: masterProductId,
            product_price: unitPrice,
            product_url: item.productUrl || item.product_url || '',
            tracking_number: item.trackingNumber || item.tracking_number || '',
            produc_source_id: formData.orderSourceId || null,
            produc_source_url: item.productUrl || item.product_url || '',
            product_cooler: item.productName || item.product_name || item.name || 'منتج',
            nota: item.notes || item.description || '',
            quantity: qty,
            total_price: qty * unitPrice,
            total__weight: weight * qty,
            total_cbm: cbm * qty,
            packaging_option_id: item.packagingOptionId || item.packaging_option_id || null,
            packaging_option_price: numericValue(item.packagingOptionPrice || 0),
            is_insured: isInsured,
            insurance_fee: insuranceFee,
            items_status: item.items_status || item.itemsStatus || 'قيد الطلب',
            created_at: item.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (item.items_id || item.id) {
            await updateDoc(doc(db, 'order_items', itemId), itemPayload);
          } else {
            await addDoc(itemId, collection(db, 'order_items'), itemPayload);
          }
        }
      }


      // حفظ وإدراج شحنات الطلب في جدول الشحنات المخصص
      // Save order shipments into dedicated shipments table
      if (shippings && shippings.length > 0) {
        for (const ship of shippings) {
          const shipId = ship.id || ('sh_' + Math.random().toString(36).substring(2, 11));
          const shipPayload = {
            order_id: targetOrderId,
            orderId: targetOrderId,
            tracking_number: ship.trackingNumber || ship.tracking_number || formData.trackingNumber || normalizedOrder.orderNumber,
            trackingNumber: ship.trackingNumber || ship.tracking_number || formData.trackingNumber || normalizedOrder.orderNumber,
            shipping_company_id: ship.shippingCompany || formData.shippingCompany || 'Aramex',
            shippingCompanyId: ship.shippingCompany || formData.shippingCompany || 'Aramex',
            courier_id: formData.deliveryCourierId || formData.shippingCourierId || null,
            courierId: formData.deliveryCourierId || formData.shippingCourierId || null,
            shipment_status: ship.shipmentStatus || ship.shipment_status || 'طلب معلق',
            shipmentStatus: ship.shipmentStatus || ship.shipment_status || 'طلب معلق',
            shipping_cost: numericValue(ship.shippingCost || 0),
            shippingCost: numericValue(ship.shippingCost || 0),
            weight: numericValue(ship.weight || 0),
            shipping_category_id: ship.shippingCategoryId || ship.shipping_category_id || null,
            content_category_id: ship.contentCategoryId || ship.content_category_id || null,
            content_category_name: ship.contentCategoryName || ship.content_category_name || '',
            carton_count: numericValue(ship.cartonCount || 0),
            customs_fee: numericValue(ship.customsFee || 0),
            tax_fee: numericValue(ship.taxFee || 0),
            other_category_fee: numericValue(ship.otherCategoryFee || 0),
            category_fees_total: numericValue(ship.categoryFeesTotal || 0),
            category_fee_currency: ship.categoryFeeCurrency || '',
            createdAt: ship.createdAt || Date.now()
          };
          if (ship.id) {
            await updateDoc(doc(db, 'shipments', ship.id), shipPayload);
          } else {
            await addDoc(shipId, collection(db, 'shipments'), { id: shipId, ...shipPayload });
          }
        }
      }

      activityLogService.log('edit_order', normalizedOrder.orderNumber || normalizedOrder.id, {
        updatedFields: Object.keys(payload),
      });

      notificationService.notify({
        title: isAr ? 'تم تعديل الطلب' : 'Order Updated',
        message: isAr
          ? `تم حفظ التعديلات على الطلب رقم ${normalizedOrder.orderNumber || normalizedOrder.id} بنجاح`
          : `Order ${normalizedOrder.orderNumber || normalizedOrder.id} updated successfully`,
        type: 'success',
        category: 'order',
      });

      onClose();
    } catch (err: unknown) {
      console.error(err);
      const boundaryMessage = asRecord(err).message;
      const errorMessage = err instanceof Error
        ? err.message
        : typeof boundaryMessage === 'string' ? boundaryMessage : 'Could not update order';
      notificationService.notify({
        title: isAr ? 'خطأ في الحفظ' : 'Save Error',
        message: errorMessage,
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
                {isAr ? `تعديل بيانات الطلب الموحد (${normalizedOrder.orderNumber || normalizedOrder.id})` : `Edit Order (${normalizedOrder.orderNumber || normalizedOrder.id})`}
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
                  className={`relative z-10 flex flex-col items-center group cursor-pointer transition-all ${isActive ? 'scale-105' : 'hover:scale-102'
                    }`}
                >
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs transition-all duration-300 shadow-lg ${isCompleted
                      ? 'bg-blue-500 text-white border-2 border-blue-400'
                      : isActive
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-2 border-indigo-300 shadow-blue-500/30 ring-4 ring-blue-500/20'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span
                    className={`block text-[10px] font-black mt-1 ${isActive ? 'text-blue-400' : isCompleted ? 'text-slate-300' : 'text-slate-500'
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
          {/* STEP 1: Customer & Source */}
          {currentStep === 1 && (
            <EditOrderStep1
              isAr={isAr}
              orderParties={orderParties}
              selectedOrderParty={selectedOrderParty}
              formData={formData}
              setFormData={setFormData}
              setIsStaffOrder={setIsStaffOrder}
              selectOrderParty={selectOrderParty}
              clearOrderParty={clearOrderParty}
              sources={sources}
            />
          )}

          {/* STEP 2: Products & Items */}
          {/* STEP 2: Products & Items */}
          {currentStep === 2 && (
            <EditOrderStep2
              isAr={isAr}
              items={items}
              addItemRow={addItemRow}
              updateItemRow={updateItemRow}
              removeItemRow={removeItemRow}
              setIsProductPickerOpen={setIsProductPickerOpen}
              itemCategories={itemCategories}
              packagingOptions={packagingOptions}
              orderCurrency={orderCurrency}
            />
          )}

          {/* STEP 3: Shipping & Logistics */}
          {currentStep === 3 && (
            <EditOrderStep3
              isAr={isAr}
              shippings={shippings}
              addShippingRow={addShippingRow}
              updateShippingRow={updateShippingRow}
              removeShippingRow={removeShippingRow}
              shippingCompanies={shippingCompanies}
              shippingCategoryOptions={shippingCategoryOptions}
              itemCategories={itemCategories}
            />
          )}

          {/* STEP 4: Financials & Payment */}
          {currentStep === 4 && (
            <EditOrderStep4
              isAr={isAr}
              formData={formData}
              settings={settings}
              setFormData={setFormData}
              orderCurrency={orderCurrency}
              paymentCurrency={paymentCurrency}
              productsSum={productsSum}
              shippingsCostSum={shippingsCostSum}
              itemsPackagingSum={itemsPackagingSum}
              shippingsCategorySum={shippingsCategorySum}
              totalOrderSAR={totalOrderSAR}
              totalOrderYER={totalOrderYER}
              currencyTotals={currencyTotals}
              activeCurrencies={activeCurrencies}
              getCurrencyRate={getCurrencyRate}
              cashAccountsList={cashAccountsList}
              bankAccountsList={bankAccountsList}
              setIsCalcOpen={setIsCalcOpen}
              remainingYER={remainingYER}
            />
          )}

          {/* STEP 5: Summary & Confirm */}
          {currentStep === 5 && (
            <EditOrderStep5
              isAr={isAr}
              formData={formData}
              totalOrderSAR={totalOrderSAR}
              totalOrderYER={totalOrderYER}
              remainingYER={remainingYER}
              orderCurrency={orderCurrency}
              paymentCurrency={paymentCurrency}
            />
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

      {/* Financial Calculator & Exchange Modal */}
      <FinancialCalculatorModal
        isOpen={isCalcOpen}
        onClose={() => setIsCalcOpen(false)}
        currencies={calculatorCurrencies}
      />

      {/* Product Catalog Picker Modal */}
      <ProductPickerModal
        isOpen={isProductPickerOpen}
        onClose={() => setIsProductPickerOpen(false)}
        onSelectProduct={handleSelectProductFromPicker}
        isAr={isAr}
      />
    </div>
  );
}
