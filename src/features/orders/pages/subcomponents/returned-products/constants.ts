import type { ReturnFormData } from './types';

/** نمط حقل الإدخال المشترك - Shared input field style */
export const RETURN_INPUT_CLASS_NAME =
  'w-full bg-black/35 border border-slate-800 rounded-xl py-2.5 px-3 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60 transition';

/** نموذج بيانات المرتجع الفارغ - Empty return form data */
export const createEmptyReturnForm = (): ReturnFormData => ({
  order_id: '',
  order_item_id: '',
  product_id: '',
  customer_id: '',
  customer_name: '',
  product_name: '',
  product_url: '',
  quantity: 1,
  return_reason: '',
  return_type: 'استرداد',
  return_status: 'معلق',
  return_condition: 'مستخدم',
  refund_amount: 0,
  refund_currency: 'YER',
  is_insured: false,
  insurance_refund: 0,
  notes: '',
  returned_at: new Date().toISOString().split('T')[0],
  processed_by: '',
  processed_at: undefined,
});
