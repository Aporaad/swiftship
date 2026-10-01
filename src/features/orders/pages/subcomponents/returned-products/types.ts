import type { Dispatch, SetStateAction } from 'react';
import type { ReturnedProduct, ReturnStatus } from '../../../../../services/returnedProductService';


export interface ReturnedOrderRecord {
  id: string;
  orderNumber?: string;
  order_number?: string;
  customerName?: string;
  customer_name?: string;
  customer?: string;
  customerId?: string;
  customer_id?: string;
  customerPhone?: string;
  customer_phone?: string;
  phone?: string;
  currency?: string;
  items?: ReturnedOrderItemRecord[] | null;
}

export interface ReturnedCustomerRecord {
  id: string;
  fullName?: string | null;
  full_name?: string | null;
  customer_id?: string | null;
  name?: string | null;
}

export interface ReturnedProductRecord {
  product_id: string;
  product_name_ar?: string | null;
  product_name_en?: string | null;
  productName?: string | null;
  name?: string | null;
  product_url?: string | null;
  productUrl?: string | null;
}

export interface ReturnedOrderItemRecord {
  items_id: string;
  id?: string;
  order_id?: string | null;
  product_id?: string | null;
  product_price?: number | null;
  total_price?: number | string | null;
  productName?: string | null;
  product_name?: string | null;
  product_url?: string | null;
  productUrl?: string | null;
  productId?: string | null;
  product_cooler?: string | null;
  is_insured?: boolean | null;
  insurance_fee?: number | string | null;
  tracking_number?: string | null;
  quantity?: number | string | null;
  items_status?: string | null;
}

export interface ReturnOrder extends Partial<ReturnedOrderRecord> {
  customer?: string;
  totalAmount?: number | string;
  total_amount?: number | string;
  createdAt?: string | number | Date;
}

export type ReturnOrderItem = ReturnedOrderItemRecord;

export interface ReturnedProductsTabProps {
  isAr: boolean;
  canManage: boolean;
  orderCurrency?: string;
  /** قائمة الطلبات للبحث والاختيار منها - Orders list for search */
  orders?: ReturnedOrderRecord[];
  /** قائمة العملاء للبحث والاختيار منهم - Customers list for search */
  customers?: ReturnedCustomerRecord[];
  /** قائمة المنتجات الرئيسية - Master products list */
  masterProducts?: ReturnedProductRecord[];
  /** قائمة بنود الطلبات (حركة المنتجات) - Order items list */
  orderItems?: ReturnedOrderItemRecord[];
}

export type ReturnFormData = Omit<ReturnedProduct, 'return_id' | 'created_at' | 'updated_at'>;
export type ReturnListSetter = Dispatch<SetStateAction<string>>;
export type ReturnStatusSetter = Dispatch<SetStateAction<ReturnStatus>>;
export type ReturnStats = {
  total: number;
  pending: number;
  accepted: number;
  completed: number;
  total_refund_amount: number;
};
