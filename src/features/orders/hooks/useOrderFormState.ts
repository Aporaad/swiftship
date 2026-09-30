/**
 * useOrderFormState.ts
 * --------------------
 * Hook يُدير حالة نموذج إنشاء الطلب والمتغيرات المرتبطة به.
 * Manages the order creation form state and related variables.
 *
 * يفصل حالة النموذج عن واجهة المستخدم وعن منطق العمليات.
 * Separates form state from UI and mutation logic.
 */

import { useState } from 'react';
import { ORDER_DEFAULT_VALUES } from '../constants/orders.constants';
import type {
  OrderFormData,
  ShippingRow,
  ItemRow,
  PaymentFormData,
  UpdateFormData,
  CustomerFormData,
  ShippingCompanyFormData,
  SourceFormData,
} from '../types';

// ─── القيم الافتراضية ───────────────────────────────────────────────────────

/** الصف الافتراضي لمنتج جديد - Default new item row */
const defaultItemRow = (): ItemRow => ({
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
});

/** صف الشحن الافتراضي الجديد - Default new shipping row */
const defaultShippingRow = (): ShippingRow => ({
  id: Math.random().toString(36).substr(2, 9),
  shippingType: ORDER_DEFAULT_VALUES.shippingType,
  shippingCompany: ORDER_DEFAULT_VALUES.shippingCompany,
  shippingSource: '',
  shippingDestination: '',
  shippingDate: '',
  shippingDuration: '',
  expectedArrival: '',
  deliveryDate: '',
  shippingCost: 0,
  packagingFees: 0,
  contentCategoryId: '',
  contentCategoryName: '',
  cartonCount: 0,
  customsFee: 0,
  taxFee: 0,
  otherCategoryFee: 0,
  categoryFeesTotal: 0,
  categoryFeeCurrency: ORDER_DEFAULT_VALUES.categoryFeeCurrency,
});

/** بيانات نموذج الطلب الافتراضية - Default order form data */
const defaultOrderFormData = (orderCurrency: string, currency: string): OrderFormData => ({
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
  orderSourceType: ORDER_DEFAULT_VALUES.sourceType,
  externalOrderNumber: '',
  trackingNumber: '',
  addShippingEnabled: false,
  shippingCompany: ORDER_DEFAULT_VALUES.shippingCompany,
  shippingCourierId: '',
  shippingCourierFeeRate: 30,
  deliveryCourierId: '',
  deliveryCourierFee: 4000,
  deliveryCourierFeeCurrency: currency || ORDER_DEFAULT_VALUES.paymentCurrency,
  orderCurrency,
  currency: orderCurrency,
  exchangeRate: 1,
  exchangeRateYER: 140,
  exchangeRateUSD: 1,
  bankCommissionRate: 3,
  companyProfitRate: 12,
  packagingFee: 0,
  sheinRedPrice: 0,
  amountPaid: 0,
  paymentMethod: ORDER_DEFAULT_VALUES.paymentMethod,
  notes: '',
  deductSourcingCostFromCourier: false,
  sourcing_cost: 'system',
});

/** بيانات نموذج التحديث الافتراضية - Default status update form data */
const defaultUpdateFormData = (): UpdateFormData => ({
  orderStatus: ORDER_DEFAULT_VALUES.orderStatus,
  deliveryStatus: ORDER_DEFAULT_VALUES.deliveryStatus,
  locationYemen: ORDER_DEFAULT_VALUES.deliveryLocation,
  internalNotes: '',
  shippingCourierId: '',
  deliveryCourierId: '',
});

/** بيانات نموذج الدفع الافتراضية - Default payment form data */
const defaultPaymentFormData = (): PaymentFormData => ({
  amount: '',
  method: ORDER_DEFAULT_VALUES.paymentMethod,
  receivingAccountId: '',
  bankReference: '',
  allocations: [],
  notes: '',
  pin: '',
  paymentCurrency: ORDER_DEFAULT_VALUES.paymentCurrency,
  voucherDate: '',
  voucherNumber: '',
});

// ─── نتيجة الـ Hook ─────────────────────────────────────────────────────────

export interface OrderFormStateResult {
  // نموذج إنشاء الطلب
  formData: OrderFormData;
  setFormData: React.Dispatch<React.SetStateAction<OrderFormData>>;

  // صفوف المنتجات
  items: ItemRow[];
  setItems: React.Dispatch<React.SetStateAction<ItemRow[]>>;

  // صفوف الشحن (للإنشاء)
  shippings: ShippingRow[];
  setShippings: React.Dispatch<React.SetStateAction<ShippingRow[]>>;

  // صفوف الشحن (للتحديث)
  updateShippings: ShippingRow[];
  setUpdateShippings: React.Dispatch<React.SetStateAction<ShippingRow[]>>;

  // نموذج تحديث الحالة
  updateFormData: UpdateFormData;
  setUpdateFormData: React.Dispatch<React.SetStateAction<UpdateFormData>>;

  // نموذج الدفع
  paymentFormData: PaymentFormData;
  setPaymentFormData: React.Dispatch<React.SetStateAction<PaymentFormData>>;

  // نموذج بيانات العميل السريعة
  customerFormData: CustomerFormData;
  setCustomerFormData: React.Dispatch<React.SetStateAction<CustomerFormData>>;

  // نموذج شركة الشحن السريعة
  shippingCompanyFormData: ShippingCompanyFormData;
  setShippingCompanyFormData: React.Dispatch<React.SetStateAction<ShippingCompanyFormData>>;

  // نموذج المصدر السريع
  sourceFormData: SourceFormData;
  setSourceFormData: React.Dispatch<React.SetStateAction<SourceFormData>>;

  // خيارات الإنشاء الإضافية
  bankCommissionEnabled: boolean;
  setBankCommissionEnabled: (v: boolean) => void;
  bankCommissionRate: number;
  setBankCommissionRate: (v: number) => void;
  bankCommissionType: 'percentage' | 'fixed';
  setBankCommissionType: (v: 'percentage' | 'fixed') => void;
  couponEnabled: boolean;
  setCouponEnabled: (v: boolean) => void;
  couponRate: number;
  setCouponRate: (v: number) => void;
  cartShareCode: string;
  setCartShareCode: (v: string) => void;
  addShippingEnabled: boolean;
  setAddShippingEnabled: (v: boolean) => void;
  profitPerKgRate: number;
  setProfitPerKgRate: (v: number) => void;
  cbmShippingRateValue: number;
  setCbmShippingRateValue: (v: number) => void;
  packagingFeeEnabled: boolean;
  setPackagingFeeEnabled: (v: boolean) => void;
  packagingFeeRate: number;
  setPackagingFeeRate: (v: number) => void;
  homeDeliveryEnabled: boolean;
  setHomeDeliveryEnabled: (v: boolean) => void;
  viaShippingAgent: boolean;
  setViaShippingAgent: (v: boolean) => void;
  payLater: boolean;
  setPayLater: (v: boolean) => void;
  directApprove: boolean;
  setDirectApprove: (v: boolean) => void;

  /** إعادة تعيين نموذج الإنشاء - Reset creation form to defaults */
  resetCreateForm: (orderCurrency: string, currency: string, settings?: any, dbRates?: Record<string, number>) => void;

  // مساعدات صفوف المنتجات
  addItemRow: () => void;
  updateItemRow: (idx: number, field: string, val: any) => void;
  removeItemRow: (idx: number) => void;

  // مساعدات صفوف الشحن
  addShippingRow: (settings?: any, orderSourceType?: string) => void;
  updateShippingRow: (idx: number, fieldOrObj: string | Record<string, any>, val?: any) => void;
  removeShippingRow: (idx: number, orderSourceType?: string) => void;
  addUpdateShippingRow: () => void;
  updateUpdateShippingRow: (idx: number, fieldOrObj: string | Record<string, any>, val?: any) => void;
  removeUpdateShippingRow: (idx: number) => void;
}

/**
 * useOrderFormState
 * Hook يُدير جميع متغيرات الحالة المتعلقة بنموذج إنشاء/تعديل الطلب.
 * Manages all state variables related to order creation/edit form.
 *
 * @param orderCurrency - العملة الافتراضية للطلب
 * @param currency - عملة النظام
 */
export function useOrderFormState(
  orderCurrency: string,
  currency: string,
): OrderFormStateResult {
  const [formData, setFormData] = useState<OrderFormData>(
    defaultOrderFormData(orderCurrency, currency),
  );
  const [items, setItems] = useState<ItemRow[]>([defaultItemRow()]);
  const [shippings, setShippings] = useState<ShippingRow[]>([defaultShippingRow()]);
  const [updateShippings, setUpdateShippings] = useState<ShippingRow[]>([]);
  const [updateFormData, setUpdateFormData] = useState<UpdateFormData>(defaultUpdateFormData());
  const [paymentFormData, setPaymentFormData] = useState<PaymentFormData>(defaultPaymentFormData());
  const [customerFormData, setCustomerFormData] = useState<CustomerFormData>({
    fullName: '',
    phone: '',
    email: '',
    gps_location: '',
    address: '',
    notes: '',
  });
  const [shippingCompanyFormData, setShippingCompanyFormData] = useState<ShippingCompanyFormData>({
    name: '',
    contact_person: '',
    phone: '',
    tracking_url: '',
    address: '',
    notes: '',
  });
  const [sourceFormData, setSourceFormData] = useState<SourceFormData>({
    source_name: '',
    type: ORDER_DEFAULT_VALUES.sourceType,
    source_url: '',
    contact_info: '',
    location: '',
    notes: '',
  });

  // خيارات الإنشاء
  const [bankCommissionEnabled, setBankCommissionEnabled] = useState(false);
  const [bankCommissionRate, setBankCommissionRate] = useState(3);
  const [bankCommissionType, setBankCommissionType] = useState<'percentage' | 'fixed'>('percentage');
  const [couponEnabled, setCouponEnabled] = useState(false);
  const [couponRate, setCouponRate] = useState(0);
  const [cartShareCode, setCartShareCode] = useState('');
  const [addShippingEnabled, setAddShippingEnabled] = useState(false);
  const [profitPerKgRate, setProfitPerKgRate] = useState(19);
  const [cbmShippingRateValue, setCbmShippingRateValue] = useState(1400);
  const [packagingFeeEnabled, setPackagingFeeEnabled] = useState(false);
  const [packagingFeeRate, setPackagingFeeRate] = useState(0);
  const [homeDeliveryEnabled, setHomeDeliveryEnabled] = useState(false);
  const [viaShippingAgent, setViaShippingAgent] = useState(false);
  const [payLater, setPayLater] = useState(false);
  const [directApprove, setDirectApprove] = useState(false);

  /** إعادة تعيين نموذج إنشاء الطلب بالقيم الافتراضية من الإعدادات */
  const resetCreateForm = (
    oc: string,
    cur: string,
    settings?: any,
    dbRates?: Record<string, number>,
  ) => {
    setFormData({
      ...defaultOrderFormData(oc, cur),
      currency: oc,
      exchangeRate: dbRates?.[oc] || 1,
      exchangeRateYER: dbRates?.[oc] || 1,
      exchangeRateUSD: dbRates?.['USD'] || 1,
      bankCommissionRate: settings?.defaultBankCommissionRate ?? 3,
      companyProfitRate: settings?.defaultCompanyProfitRate ?? 12,
      packagingFee: settings?.defaultPackagingFee ?? 0,
      deliveryCourierFee: settings?.defaultDeliveryFee ?? 4000,
      shippingCourierFeeRate: settings?.defaultCourierCommissionRate ?? 30,
    });
    setItems([defaultItemRow()]);
    setShippings([defaultShippingRow()]);
    setBankCommissionEnabled(false);
    setBankCommissionRate(3);
    setBankCommissionType('percentage');
    setCouponEnabled(false);
    setCouponRate(0);
    setCartShareCode('');
    setPackagingFeeEnabled(false);
    setPackagingFeeRate(0);
    setHomeDeliveryEnabled(false);
    setPayLater(false);
    setDirectApprove(false);
  };

  // ── مساعدات صفوف المنتجات ──

  /** إضافة صف منتج جديد - Add a new product row */
  const addItemRow = () => {
    setItems((prev) => [...prev, defaultItemRow()]);
  };

  /** تعديل حقل في صف منتج محدد - Update a field in a product row */
  const updateItemRow = (idx: number, field: string, val: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  /** حذف صف منتج (لا يمكن حذف الأخير) - Remove a product row (cannot remove last) */
  const removeItemRow = (idx: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── مساعدات صفوف الشحن (الإنشاء) ──

  /** إضافة صف شحن جديد - Add a new shipping row */
  const addShippingRow = (settings?: any, orderSourceType?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const defaultDuration =
      orderSourceType === 'SHEIN'
        ? settings?.defaultSheinDuration ?? 12
        : orderSourceType === 'Factory'
        ? settings?.defaultFactoryDuration ?? 20
        : settings?.defaultAppDuration ?? 10;
    const arrivalDate = new Date();
    arrivalDate.setDate(arrivalDate.getDate() + defaultDuration);
    const expectedArrival = arrivalDate.toISOString().split('T')[0];

    setShippings((prev) => [
      ...prev,
      {
        ...defaultShippingRow(),
        shippingDate: today,
        shippingDuration: String(defaultDuration),
        expectedArrival,
      },
    ]);

    if (orderSourceType === 'App') {
      setAddShippingEnabled(true);
    }
  };

  /** تعديل حقل في صف شحن محدد - Update a field in a shipping row */
  const updateShippingRow = (
    idx: number,
    fieldOrObj: string | Record<string, any>,
    val?: any,
  ) => {
    setShippings((prev) => {
      const updated = [...prev];
      if (typeof fieldOrObj === 'string') {
        updated[idx] = { ...updated[idx], [fieldOrObj]: val };
        if (fieldOrObj === 'shippingCost') {
          updated[idx]._isCalculated = false;
        }
      } else {
        updated[idx] = { ...updated[idx], ...fieldOrObj };
        if ('shippingCost' in fieldOrObj) {
          updated[idx]._isCalculated = false;
        }
      }
      return updated;
    });
  };

  /** حذف صف شحن - Remove a shipping row */
  const removeShippingRow = (idx: number, orderSourceType?: string) => {
    if (shippings.length === 1) {
      setShippings([]);
      if (orderSourceType === 'App') {
        setAddShippingEnabled(false);
      }
      return;
    }
    setShippings((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── مساعدات صفوف الشحن (التحديث) ──

  /** إضافة صف شحن للتحديث - Add a shipping row for status update */
  const addUpdateShippingRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setUpdateShippings((prev) => [
      ...prev,
      {
        ...defaultShippingRow(),
        shippingDate: today,
        shippingDuration: '',
        expectedArrival: '',
      },
    ]);
  };

  /** تعديل حقل في صف شحن التحديث - Update a field in an update shipping row */
  const updateUpdateShippingRow = (
    idx: number,
    fieldOrObj: string | Record<string, any>,
    val?: any,
  ) => {
    setUpdateShippings((prev) => {
      const updated = [...prev];
      if (typeof fieldOrObj === 'string') {
        updated[idx] = { ...updated[idx], [fieldOrObj]: val };
      } else {
        updated[idx] = { ...updated[idx], ...fieldOrObj };
      }
      return updated;
    });
  };

  /** حذف صف شحن التحديث - Remove an update shipping row */
  const removeUpdateShippingRow = (idx: number) => {
    setUpdateShippings((prev) => prev.filter((_, i) => i !== idx));
  };

  return {
    formData,
    setFormData,
    items,
    setItems,
    shippings,
    setShippings,
    updateShippings,
    setUpdateShippings,
    updateFormData,
    setUpdateFormData,
    paymentFormData,
    setPaymentFormData,
    customerFormData,
    setCustomerFormData,
    shippingCompanyFormData,
    setShippingCompanyFormData,
    sourceFormData,
    setSourceFormData,
    bankCommissionEnabled,
    setBankCommissionEnabled,
    bankCommissionRate,
    setBankCommissionRate,
    bankCommissionType,
    setBankCommissionType,
    couponEnabled,
    setCouponEnabled,
    couponRate,
    setCouponRate,
    cartShareCode,
    setCartShareCode,
    addShippingEnabled,
    setAddShippingEnabled,
    profitPerKgRate,
    setProfitPerKgRate,
    cbmShippingRateValue,
    setCbmShippingRateValue,
    packagingFeeEnabled,
    setPackagingFeeEnabled,
    packagingFeeRate,
    setPackagingFeeRate,
    homeDeliveryEnabled,
    setHomeDeliveryEnabled,
    viaShippingAgent,
    setViaShippingAgent,
    payLater,
    setPayLater,
    directApprove,
    setDirectApprove,
    resetCreateForm,
    addItemRow,
    updateItemRow,
    removeItemRow,
    addShippingRow,
    updateShippingRow,
    removeShippingRow,
    addUpdateShippingRow,
    updateUpdateShippingRow,
    removeUpdateShippingRow,
  };
}

export {
  defaultItemRow as createDefaultItemRow,
  defaultShippingRow as createDefaultShippingRow,
  defaultOrderFormData as createDefaultOrderFormData,
  defaultUpdateFormData as createDefaultUpdateFormData,
  defaultPaymentFormData as createDefaultPaymentFormData,
};
