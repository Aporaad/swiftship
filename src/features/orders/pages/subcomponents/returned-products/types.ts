import type { Dispatch, SetStateAction } from 'react';
import type { ReturnedProduct, ReturnStatus } from '../../../../../services/returnedProductService';

export interface ReturnedProductsTabProps {
  isAr: boolean;
  canManage: boolean;
  orderCurrency?: string;
  /** قائمة الطلبات للبحث والاختيار منها - Orders list for search */
  orders?: any[];
  /** قائمة العملاء للبحث والاختيار منهم - Customers list for search */
  customers?: any[];
  /** قائمة المنتجات الرئيسية - Master products list */
  masterProducts?: any[];
  /** قائمة بنود الطلبات (حركة المنتجات) - Order items list */
  orderItems?: any[];
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
