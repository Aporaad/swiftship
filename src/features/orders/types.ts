/**
 * orders/types.ts
 * ---------------
 * الأنواع الخاصة بوحدة الطلبات.
 * Types for the Orders feature module.
 * لا تُستورد هنا أي أنواع من Supabase أو Firebase مباشرة.
 */

export type { OrdersViewModel } from '../../data/dtos/orders.dto';

// ======== بيانات إنشاء الطلب (Order Create Form) ========

/** نموذج بيانات إنشاء الطلب - Order creation form data */
export interface OrderFormData {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orderPartyId: string;
  orderPartyType: string;
  isStaffOrder: boolean;
  employeeId: string;
  courierId: string;
  orderPartyAccountId: string;
  orderSourceId: string;
  orderSourceName: string;
  orderSourceType: string; // 'App' | 'Factory' | 'SHEIN'
  externalOrderNumber: string;
  trackingNumber: string;
  addShippingEnabled: boolean;
  shippingCompany: string;

  // روابط المناديب - Courier Links
  shippingCourierId: string;
  shippingCourierFeeRate: number;
  deliveryCourierId: string;
  deliveryCourierFee: number;
  deliveryCourierFeeCurrency: string;

  // الأسعار والعملات - Rates & Currencies
  orderCurrency: string;
  currency: string;
  exchangeRate: number;
  exchangeRateYER: number;
  exchangeRateUSD: number;
  bankCommissionRate: number;
  companyProfitRate: number;
  packagingFee: number;
  sheinRedPrice: number;

  // الدفع - Payment
  amountPaid: number;
  paymentMethod: string;
  notes: string;
  deductSourcingCostFromCourier: boolean;
  sourcing_cost: string;
}

// ======== بيانات تحديث الحالة (Status Update Form) ========

/** نموذج بيانات تحديث حالة الطلب - Order status update form data */
export interface UpdateFormData {
  orderStatus: string;
  deliveryStatus: string;
  locationYemen: string;
  internalNotes: string;
  shippingCourierId: string;
  deliveryCourierId: string;
}

// ======== صفوف المنتجات (Item Rows) ========

/** صف منتج واحد في نموذج الطلب - Single product row in order form */
export interface ItemRow {
  productName: string;
  productNameEn?: string;
  productUrl: string;
  quantity: number;
  productPrice: number;
  weight: number;
  cbm: number;
  length: number;
  width: number;
  height: number;
  trackingNumber: string;
  product_id?: string;
  productId?: string;
  packagingOptionId?: string;
  packagingOptionPrice?: number;
  isInsured?: boolean;
  insuranceFee?: number;
  itemCategoryId?: string;
  item_category_id?: string;
}

// ======== صفوف الشحن (Shipping Rows) ========

/** صف شحنة واحدة في نموذج الطلب - Single shipment row in order form */
export interface ShippingRow {
  id: string;
  shippingType: string;
  shippingCompany: string;
  shippingSource: string;
  shippingDestination: string;
  shippingDate: string;
  shippingDuration: string;
  expectedArrival: string;
  deliveryDate?: string;
  shippingCost: number;
  packagingFees: number;
  contentCategoryId?: string;
  contentCategoryName?: string;
  cartonCount?: number;
  customsFee?: number;
  taxFee?: number;
  otherCategoryFee?: number;
  categoryFeesTotal?: number;
  categoryFeeCurrency?: string;
  /** تُستخدم داخلياً لتحديد إذا كانت قيمة الشحن محسوبة تلقائياً */
  _isCalculated?: boolean;
}

// ======== بيانات الدفع (Payment Form) ========

/** توزيع دفعة واحدة في الدفع المختلط - Single allocation in mixed payment */
export interface PaymentAllocation {
  id: string;
  method: 'Cash' | 'Bank';
  amount: string;
  receivingAccountId: string;
  bankReference: string;
}

/** نموذج بيانات تحصيل الدفعة - Payment collection form data */
export interface PaymentFormData {
  amount: string;
  method: 'Cash' | 'Bank' | 'Deferred' | 'Mixed';
  receivingAccountId: string;
  bankReference: string;
  allocations: PaymentAllocation[];
  notes: string;
  pin: string;
  paymentCurrency?: string;
  voucherDate?: string;
  voucherNumber?: string;
}

// ======== حسابات الطلب (Order Calculations) ========

/** نتيجة حسابات الطلب المالية - Financial calculation results for an order */
export interface OrderCalculations {
  productsSum: number;
  itemsInsuranceSum: number;
  totalProductsCostWithAdjustments: number;
  totalWeight: number;
  totalCBM: number;
  priceSAR: number;
  shippingCostSAR: number;
  bankCommissionSAR: number;
  couponValue: number;
  totalOrderSAR: number;
  totalOrderYER: number;
  remainingYER: number;
  deliveryCourierFeeOrderCurrency: number;
  deliveryCourierFeeCurrency: string;
  paymentExchangeRate: number;
  profitSaudiSAR: number;
  profitCompanySAR: number;
  sourcingCostAmount: number;
}

// ======== تبويبات الطلبات (Orders Tabs) ========

/** أنواع تبويبات صفحة الطلبات - Orders page tab types */
export type OrdersTab =
  | 'orders'
  | 'products'
  | 'shipments'
  | 'tracking'
  | 'statuses'
  | 'options'
  | 'item-categories';

// ======== بيانات الكيانات المرتبطة (Related Entities) ========

/** بيانات شركة الشحن في النموذج - Shipping company form data */
export interface ShippingCompanyFormData {
  name: string;
  contact_person: string;
  phone: string;
  tracking_url: string;
  address: string;
  notes: string;
}

/** بيانات مصدر الطلب في النموذج - Source form data */
export interface SourceFormData {
  source_name: string;
  type: string;
  source_url: string;
  contact_info: string;
  location: string;
  notes: string;
}

/** بيانات العميل في النموذج - Customer form data */
export interface CustomerFormData {
  fullName: string;
  phone: string;
  email: string;
  gps_location: string;
  address: string;
  notes: string;
}
