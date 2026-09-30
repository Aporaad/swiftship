import type { ReturnFormData } from './types';

export type ReturnFormValidationError = 'order' | 'product' | 'reason' | null;

/** المحافظة على نفس ترتيب التحقق الإجباري المستخدم في النموذج القديم. */
export function validateReturnForm(formData: ReturnFormData): ReturnFormValidationError {
  if (!formData.order_id?.trim()) return 'order';
  if (!formData.product_name?.trim()) return 'product';
  if (!formData.return_reason?.trim()) return 'reason';
  return null;
}
