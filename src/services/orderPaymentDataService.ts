import { supabase } from '../lib/supabase';
import { autoEntryService } from './autoEntryService';

/**
 * نوع وسيلة الدفع في نموذج الطلب (مطابق لنموذج سند القبض):
 * Cash = نقدي (صندوق) | Bank = بنكي (حوالة) | Mixed = متعدد (نقد + بنك) | Deferred = آجل (دين)
 */
export type OrderPaymentMethod = 'Cash' | 'Bank' | 'Mixed' | 'Deferred';

/** توزيع دفعة مقدمة على حساب قبض محدد (صندوق أو بنك) */
export interface OrderDownPaymentAllocation {
  method: 'cash' | 'bank';
  accountId: string;
  accountCode?: string;
  accountName?: string;
  amount: number;
  bankReference?: string;
}

/** حقول الدفع كما تُدار في formData بنماذج إنشاء/تعديل الطلب */
export interface OrderPaymentFormFields {
  paymentMethod?: OrderPaymentMethod | string;
  amountPaid?: number | string;
  cashAccountId?: string;
  bankAccountId?: string;
  bankReference?: string;
  cashAmount?: number | string;
  bankAmount?: number | string;
  paidCurrency?: string;
}

const num = (value: any): number => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * تحويل حقول نموذج الدفع إلى توزيعات قيد الدفعة المقدمة،
 * مع إثراء كل توزيع برمز واسم الحساب من قائمة الحسابات المالية.
 */
export function buildDownPaymentAllocations(
  fields: OrderPaymentFormFields,
  financialAccounts: any[] = []
): OrderDownPaymentAllocation[] {
  const method = (fields.paymentMethod || 'Cash') as OrderPaymentMethod;
  const enrich = (accountId: string) => {
    const account = financialAccounts.find((acc: any) => acc && acc.id === accountId);
    return {
      accountCode: account?.accSubId || account?.accountCode || account?.account_code || '',
      accountName: account?.name || account?.accNameAr || account?.acc_name_ar || accountId,
    };
  };

  if (method === 'Cash' && fields.cashAccountId) {
    return [{ method: 'cash', accountId: fields.cashAccountId, amount: num(fields.amountPaid), ...enrich(fields.cashAccountId) }];
  }

  if (method === 'Bank' && fields.bankAccountId) {
    return [{
      method: 'bank',
      accountId: fields.bankAccountId,
      amount: num(fields.amountPaid),
      bankReference: fields.bankReference || '',
      ...enrich(fields.bankAccountId),
    }];
  }

  if (method === 'Mixed') {
    const allocations: OrderDownPaymentAllocation[] = [];
    const cashVal = num(fields.cashAmount);
    const bankVal = num(fields.bankAmount);
    if (fields.cashAccountId && cashVal > 0) {
      allocations.push({ method: 'cash', accountId: fields.cashAccountId, amount: cashVal, ...enrich(fields.cashAccountId) });
    }
    if (fields.bankAccountId && bankVal > 0) {
      allocations.push({ method: 'bank', accountId: fields.bankAccountId, amount: bankVal, bankReference: fields.bankReference || '', ...enrich(fields.bankAccountId) });
    }
    return allocations;
  }

  // آجل: لا قبض فعلي الآن
  return [];
}

/**
 * التحقق من صحة حقول الدفع في نموذج الطلب قبل الحفظ.
 * يعني رسالة الخطأ بالعربية/الإنجليزية أو null إذا كانت البيانات سليمة.
 */
export function validateOrderPaymentInput(
  fields: OrderPaymentFormFields,
  totalInPaymentCurrency: number,
  isAr: boolean
): string | null {
  const method = (fields.paymentMethod || 'Cash') as OrderPaymentMethod;
  const paid = num(fields.amountPaid);

  if (method === 'Deferred') {
    if (paid > 0) {
      return isAr
        ? '⚠️ الدفع آجل: يجب أن تكون الدفعة المقدمة صفر (لا قبض فعلي الآن)'
        : '⚠️ Deferred payment: the advance amount must be zero (no cash received now)';
    }
    return null;
  }

  if (paid <= 0) return null;

  if (totalInPaymentCurrency > 0 && paid > totalInPaymentCurrency + 0.0001) {
    return isAr
      ? `⚠️ الدفعة المقدمة (${paid}) أكبر من إجمالي الطلب (${Math.ceil(totalInPaymentCurrency)})`
      : `⚠️ Advance payment (${paid}) exceeds the order total (${Math.ceil(totalInPaymentCurrency)})`;
  }

  if (method === 'Cash' && !fields.cashAccountId) {
    return isAr
      ? '⚠️ يرجى اختيار حساب الصندوق القابض للدفعة النقدية'
      : '⚠️ Please select the receiving cash box account';
  }

  if (method === 'Bank') {
    if (!fields.bankAccountId) {
      return isAr
        ? '⚠️ يرجى اختيار حساب البنك القابض للدفعة البنكية'
        : '⚠️ Please select the receiving bank account';
    }
    if (!fields.bankReference || !String(fields.bankReference).trim()) {
      return isAr
        ? '⚠️ يرجى إدخال رقم مرجع الحوالة البنكية'
        : '⚠️ Please enter the bank transfer reference #';
    }
  }

  if (method === 'Mixed') {
    const cashVal = num(fields.cashAmount);
    const bankVal = num(fields.bankAmount);
    if (!fields.cashAccountId || !fields.bankAccountId) {
      return isAr
        ? '⚠️ الدفع المتعدد يتطلب اختيار حساب الصندوق وحساب البنك معاً'
        : '⚠️ Mixed payment requires both a cash box and a bank account';
    }
    if (cashVal <= 0 || bankVal <= 0) {
      return isAr
        ? '⚠️ يرجى إدخال مبلغ الصندوق ومبلغ البنك (يجب أن يكونا أكبر من صفر)'
        : '⚠️ Please enter both cash and bank split amounts (> 0)';
    }
    if (Math.abs(cashVal + bankVal - paid) > 0.0001) {
      return isAr
        ? `⚠️ مجموع التوزيع (${cashVal + bankVal}) لا يطابق الدفعة المقدمة (${paid})`
        : `⚠️ Split total (${cashVal + bankVal}) does not match the advance payment (${paid})`;
    }
    if (!fields.bankReference || !String(fields.bankReference).trim()) {
      return isAr
        ? '⚠️ يرجى إدخال رقم مرجع الحوالة البنكية للجزء البنكي'
        : '⚠️ Please enter the bank transfer reference # for the bank portion';
    }
  }

  return null;
}

/** التحقق من وجود قيد دفعة مقدمة سابق للطلب (لمنع التكرار عند التعديل) */
export async function hasDownPaymentEntry(orderId: string): Promise<boolean> {
  try {
    const { data, error } = await (supabase as any)
      .from('main_entry')
      .select('id')
      .eq('order_id', orderId)
      .eq('auto_rule_id', 'order_down_payment')
      .limit(1);
    if (error) {
      console.warn('[orderPaymentDataService] hasDownPaymentEntry query failed:', error.message);
      return false;
    }
    return (data || []).length > 0;
  } catch (err) {
    console.warn('[orderPaymentDataService] hasDownPaymentEntry error:', err);
    return false;
  }
}

/**
 * إطلاق قيد (أو قيود) الدفعة المقدمة للطلب عبر القيد التلقائي،
 * بحيث يُدَين كل حساب صندوق/بنك اختاره المستخدم بدل الحساب النظامي الافتراضي.
 * يعيد قائمة معرفات القواعد المنفذة.
 */
export async function executeOrderDownPaymentEntries(options: {
  order: any;
  statusId: number | string;
  fields: OrderPaymentFormFields;
  financialAccounts?: any[];
  customer?: any;
  courier?: any;
  orderParty?: any;
  isAr?: boolean;
  profileName?: string;
}): Promise<string[]> {
  const { order, statusId, fields, financialAccounts = [], customer, courier, orderParty, isAr, profileName } = options;
  const allocations = buildDownPaymentAllocations(fields, financialAccounts);
  if (allocations.length === 0) return [];

  return autoEntryService.executeAutoEntriesForStatus(statusId, order, {
    customer,
    orderParty: orderParty || customer,
    courier,
    isAr,
    profileName,
    paidCurrency: String(fields.paidCurrency || order?.paidCurrency || order?.currency || 'YER'),
    downPaymentAllocations: allocations,
  });
}
