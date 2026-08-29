import { supabase } from '../lib/supabase-firebase-adapter';

export type FinancialPaymentMethod = 'cash' | 'bank' | 'mixed' | 'deferred';
export type FinancialEntryCategory = 'General' | 'Compound' | 'Temp' | 'Reversing';
export type FinancialPostingStatus = 'draft' | 'posted';
export type FinancialTransactionType = 'Debit' | 'Credit';

export interface FinancialEntryPriceReference {
  id: number;
  seq: number;
}

export interface FinancialEntryLineInput {
  id?: string;
  accountId: string;
  accountCurNo: number;
  transType: FinancialTransactionType;
  amount: number;
  amountOriginal: number;
  currencyPrice?: FinancialEntryPriceReference;
  entityType?: string;
  entityId?: string;
  paymentMethod?: FinancialPaymentMethod;
  orderId?: string;
  shipmentId?: string;
  custodyId?: string;
  description?: string;
  note?: string;
}

export interface FinancialPaymentDetailInput {
  id?: string;
  paymentMethod: Exclude<FinancialPaymentMethod, 'mixed'>;
  accountId: string;
  amountOriginal: number;
  bankReference?: string;
  dueAt?: string;
  note?: string;
}

export interface FinancialEntryInput {
  id?: string;
  entryNumber: string;
  moduleId: string;
  entryTypeId: string;
  entryCategory: FinancialEntryCategory;
  postingStatus?: FinancialPostingStatus;
  amountOriginal: number;
  amountText?: string;
  currencyOriginalNo: number;
  currencyPrice?: FinancialEntryPriceReference;
  description: string;
  notes?: string;
  attachments?: string[];
  paymentMethod?: FinancialPaymentMethod;
  paymentDetails?: FinancialPaymentDetailInput[];
  orderId?: string;
  shipmentId?: string;
  custodyId?: string;
  automationKey?: string;
  autoRuleId?: string;
  isAutomatic?: boolean;
  effectiveAt?: string;
  createdByUid?: string;
  lines: FinancialEntryLineInput[];
}

export interface FinancialEntryWriteResult {
  id: string;
  entryNumber: string;
  postingStatus: FinancialPostingStatus;
  lineCount: number;
}

export interface CustodyAdvanceInput {
  id?: string;
  custodyNumber: string;
  recipientType: 'employee' | 'courier' | 'customer' | 'supplier' | 'other';
  recipientId: string;
  recipientName: string;
  recipientAccountId: string;
  amountOriginal: number;
  currencyOriginalNo: number;
  currencyPrice?: FinancialEntryPriceReference;
  note?: string;
  issuedAt?: string;
  createdByUid?: string;
}

export interface LegacyVoucherAccountTarget {
  id: string;
  curNo?: number;
  currency: string;
  entityType?: string;
  entityId?: string;
}

export interface LegacyVoucherInput {
  entryNumber: string;
  createdAt: number;
  description: string;
  attachments?: string[];
  notes?: string;
  amount: number;
  currency: string;
  amountDebitCurrency?: number;
  amountCreditCurrency?: number;
  module: string;
  refNumber: string;
  orderId?: string;
  shipmentId?: string;
  automationKey?: string;
  autoRuleId?: string;
  isAutomatic?: boolean;
  createdByUid?: string;
  paymentMethod?: FinancialPaymentMethod;
}

const hasValidPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const serializePriceReference = (price?: FinancialEntryPriceReference) => ({
  currencyPriceId: price?.id?.toString() ?? '',
  currencyPriceSeq: price?.seq?.toString() ?? '',
});

const legacyModuleRoute = (module: string): Pick<FinancialEntryInput, 'moduleId' | 'entryTypeId'> => {
  switch (String(module || '').trim().toLowerCase()) {
    case 'order': return { moduleId: 'module_orders', entryTypeId: 'type_order_value' };
    case 'payment': return { moduleId: 'module_orders', entryTypeId: 'type_order_payment' };
    case 'expense': return { moduleId: 'module_expenses', entryTypeId: 'type_expense' };
    case 'custody': return { moduleId: 'module_custody', entryTypeId: 'type_custody_issue' };
    case 'salary': return { moduleId: 'module_salaries', entryTypeId: 'type_salary_payment' };
    case 'exchange': return { moduleId: 'module_exchange', entryTypeId: 'type_exchange' };
    default: return { moduleId: 'module_accounting', entryTypeId: 'type_adjustment' };
  }
};

/**
 * يحول بيانات واجهة الإدخال إلى الحمولة الوحيدة التي يسمح بإرسالها إلى الإجراء الذري.
 * لا ينفذ هذا المسار أي insert/update منفصل ولا ينشئ سعر صرف أو قيمة تحويل بديلة.
 */
export function buildFinancialEntryPayload(entry: FinancialEntryInput): Record<string, unknown> {
  if (!entry || !entry.entryNumber?.trim() || !entry.moduleId || !entry.entryTypeId || !entry.description?.trim()) {
    throw new Error('رقم القيد والفئة والنوع والبيان حقول إلزامية.');
  }
  if (!hasValidPositiveNumber(entry.amountOriginal) || !Number.isInteger(entry.currencyOriginalNo)) {
    throw new Error('المبلغ الأصلي ومرجع عملته حقول إلزامية وصحيحة.');
  }
  if (!Array.isArray(entry.lines) || entry.lines.length < 2) {
    throw new Error('يتطلب القيد ساقين محاسبيتين على الأقل.');
  }
  if (entry.entryCategory === 'General' && entry.lines.length !== 2) {
    throw new Error('القيد العام يجب أن يحتوي على ساقين فقط.');
  }
  if (entry.entryCategory === 'Compound' && entry.lines.length < 3) {
    throw new Error('القيد المركب يجب أن يحتوي على ثلاثة أسطر على الأقل.');
  }

  let debitTotal = 0;
  let creditTotal = 0;
  const lines = entry.lines.map((line) => {
    if (!line.accountId || !Number.isInteger(line.accountCurNo) || !hasValidPositiveNumber(line.amount) || !hasValidPositiveNumber(line.amountOriginal)) {
      throw new Error('كل ساق تحتاج حسابًا ومبلغًا ومبلغًا أصليًا ومرجع عملة صحيحين.');
    }
    if (line.transType !== 'Debit' && line.transType !== 'Credit') {
      throw new Error('نوع الساق يجب أن يكون Debit أو Credit.');
    }
    if (line.accountCurNo === entry.currencyOriginalNo && line.amount !== line.amountOriginal) {
      throw new Error('عندما تتطابق عملة الحساب مع عملة الرأس يجب أن يساوي amount قيمة amountOriginal.');
    }
    if (line.accountCurNo !== entry.currencyOriginalNo && !line.currencyPrice && !entry.currencyPrice) {
      throw new Error('الساق متعددة العملات تحتاج مرجع سعر صرف مثبتًا قبل الحفظ.');
    }

    if (line.transType === 'Debit') debitTotal += line.amount;
    else creditTotal += line.amount;

    return {
      id: line.id,
      accountId: line.accountId,
      accountCurNo: String(line.accountCurNo),
      transType: line.transType,
      amount: String(line.amount),
      amountOriginal: String(line.amountOriginal),
      ...serializePriceReference(line.currencyPrice),
      entityType: line.entityType || '',
      entityId: line.entityId || '',
      paymentMethod: line.paymentMethod || '',
      orderId: line.orderId || '',
      shipmentId: line.shipmentId || '',
      custodyId: line.custodyId || '',
      description: line.description || '',
      note: line.note || '',
    };
  });

  const isBalancedDebitCredit = Math.abs(debitTotal - creditTotal) < 0.01;
  const isBalancedWithHeader = Math.abs(debitTotal - entry.amountOriginal) < 0.01;

  if (!isBalancedDebitCredit || !isBalancedWithHeader) {
    throw new Error('القيد غير متوازن بعملة الرأس: يجب أن يساوي مجموع المدين والدائن مبلغ رأس القيد.');
  }

  const paymentDetails = (entry.paymentDetails || []).map((detail) => {
    if (!detail.accountId || !hasValidPositiveNumber(detail.amountOriginal)) {
      throw new Error('كل تفصيل دفع يحتاج طريقة غير مختلطة وحسابًا ماليًا ومبلغًا موجبًا.');
    }
    return {
      id: detail.id || '', paymentMethod: detail.paymentMethod, accountId: detail.accountId,
      amountOriginal: String(detail.amountOriginal), bankReference: detail.bankReference?.trim() || '',
      dueAt: detail.dueAt || '', note: detail.note || '',
    };
  });

  return {
    id: entry.id || '',
    entryNumber: entry.entryNumber.trim(),
    moduleId: entry.moduleId,
    entryTypeId: entry.entryTypeId,
    entryCategory: entry.entryCategory,
    postingStatus: entry.postingStatus || 'draft',
    amountOriginal: String(entry.amountOriginal),
    amountText: entry.amountText || '',
    currencyOriginalNo: String(entry.currencyOriginalNo),
    ...serializePriceReference(entry.currencyPrice),
    description: entry.description.trim(),
    notes: entry.notes || '',
    attachments: entry.attachments || [],
    paymentMethod: entry.paymentMethod || '',
    paymentDetails,
    orderId: entry.orderId || '',
    shipmentId: entry.shipmentId || '',
    custodyId: entry.custodyId || '',
    automationKey: entry.automationKey || '',
    autoRuleId: entry.autoRuleId || '',
    isAutomatic: Boolean(entry.isAutomatic),
    effectiveAt: entry.effectiveAt || '',
    createdByUid: entry.createdByUid || '',
    lines,
  };
}

class FinancialEntryService {
  private async resolveCurrency(code: string): Promise<{ curId: number; isDefault: boolean }> {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode) throw new Error('رمز العملة مطلوب لإنشاء القيد.');
    const { data, error } = await (supabase as any)
      .from('currency')
      .select('cur_id, isDefault')
      .eq('code', normalizedCode)
      .limit(1)
      .maybeSingle();
    if (error || !data?.cur_id) throw new Error(`لا يوجد مرجع عملة نشط ومثبت للرمز ${normalizedCode}.`);
    return { curId: Number(data.cur_id), isDefault: Boolean(data.isDefault) };
  }

  private async resolvePrice(currencyId: number, effectiveAt: string): Promise<{ price: number; reference: FinancialEntryPriceReference }> {
    const { data, error } = await (supabase as any)
      .from('cur_price')
      .select('id, seq, price')
      .eq('cur_no', currencyId)
      .lte('day_date', effectiveAt)
      .order('day_date', { ascending: false })
      .order('seq', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data || !hasValidPositiveNumber(Number(data.price))) {
      throw new Error('تعذر إثبات سعر الصرف في تاريخ القيد؛ لن يُنشأ القيد متعدد العملات.');
    }
    return {
      price: Number(data.price),
      reference: { id: Number(data.id), seq: Number(data.seq) },
    };
  }

  private async buildLegacyVoucherLine(
    target: LegacyVoucherAccountTarget,
    transType: FinancialTransactionType,
    amountOriginal: number,
    originalCurrency: { curId: number; isDefault: boolean },
    effectiveAt: string,
    suppliedAmount?: number,
  ): Promise<FinancialEntryLineInput> {
    if (!target.id || !Number.isInteger(target.curNo)) {
      throw new Error('الحساب المالي المختار لا يملك مرجع عملة صالحًا.');
    }
    const accountCurrency = await this.resolveCurrency(target.currency);
    if (accountCurrency.curId !== target.curNo) {
      throw new Error('رمز عملة الحساب لا يطابق مرجع عملته؛ لن يُنشأ القيد.');
    }
    if (accountCurrency.curId === originalCurrency.curId) {
      return {
        accountId: target.id,
        accountCurNo: target.curNo,
        transType,
        amount: amountOriginal,
        amountOriginal,
        entityType: target.entityType,
        entityId: target.entityId,
      };
    }
    if (!originalCurrency.isDefault && !accountCurrency.isDefault) {
      throw new Error('التحويل المباشر بين عملتين غير افتراضيتين يحتاج قيد صرافة صريحًا بمراجع سعر لكل عملة.');
    }

    const pricedCurrency = originalCurrency.isDefault ? accountCurrency : originalCurrency;
    const price = await this.resolvePrice(pricedCurrency.curId, effectiveAt);
    const derivedAmount = originalCurrency.isDefault
      ? amountOriginal / price.price
      : amountOriginal * price.price;
    const amount = hasValidPositiveNumber(suppliedAmount) ? suppliedAmount : derivedAmount;

    return {
      accountId: target.id,
      accountCurNo: target.curNo,
      transType,
      amount,
      amountOriginal,
      currencyPrice: price.reference,
      entityType: target.entityType,
      entityId: target.entityId,
    };
  }

  async createFromLegacyVoucher(
    voucher: LegacyVoucherInput,
    debitAccount: LegacyVoucherAccountTarget,
    creditAccount: LegacyVoucherAccountTarget,
  ): Promise<FinancialEntryWriteResult> {
    if (!hasValidPositiveNumber(voucher.amount)) throw new Error('مبلغ القيد يجب أن يكون موجبًا.');
    const effectiveAt = new Date(voucher.createdAt || Date.now()).toISOString();
    const originalCurrency = await this.resolveCurrency(voucher.currency);
    const [debitLine, creditLine] = await Promise.all([
      this.buildLegacyVoucherLine(debitAccount, 'Debit', voucher.amount, originalCurrency, effectiveAt, voucher.amountDebitCurrency),
      this.buildLegacyVoucherLine(creditAccount, 'Credit', voucher.amount, originalCurrency, effectiveAt, voucher.amountCreditCurrency),
    ]);
    const route = legacyModuleRoute(voucher.module);
    return this.create({
      ...route,
      entryNumber: voucher.entryNumber,
      entryCategory: 'General',
      postingStatus: 'posted',
      amountOriginal: voucher.amount,
      currencyOriginalNo: originalCurrency.curId,
      description: voucher.description,
      notes: voucher.notes,
      attachments: voucher.attachments,
      paymentMethod: voucher.paymentMethod,
      orderId: voucher.orderId,
      shipmentId: voucher.shipmentId,
      automationKey: voucher.automationKey,
      autoRuleId: voucher.autoRuleId,
      isAutomatic: voucher.isAutomatic,
      effectiveAt,
      createdByUid: voucher.createdByUid,
      lines: [debitLine, creditLine],
    });
  }

  async create(entry: FinancialEntryInput): Promise<FinancialEntryWriteResult> {
    const payload = buildFinancialEntryPayload(entry);
    const { data, error } = await (supabase as any).rpc('secure_create_financial_entry', { p_entry: payload });
    if (error) throw new Error(`[FinancialEntryService] تعذر إنشاء القيد: ${error.message || error}`);
    if (!data?.id) throw new Error('[FinancialEntryService] لم يُرجع الإجراء الذري معرف القيد المنشأ.');
    return data as FinancialEntryWriteResult;
  }

  async createCustodyAdvance(custody: CustodyAdvanceInput, entry: FinancialEntryInput): Promise<{ id: string; custodyNumber: string; issuedEntryId: string; status: 'open' }> {
    if (!custody.custodyNumber?.trim() || !custody.recipientId || !custody.recipientName?.trim() || !custody.recipientAccountId) {
      throw new Error('رقم العهدة وطرفها وحسابه المالي حقول إلزامية.');
    }
    if (!hasValidPositiveNumber(custody.amountOriginal) || !Number.isInteger(custody.currencyOriginalNo)) {
      throw new Error('مبلغ العهدة ومرجع عملتها غير صالحين.');
    }
    if (entry.amountOriginal !== custody.amountOriginal || entry.currencyOriginalNo !== custody.currencyOriginalNo) {
      throw new Error('يجب أن يطابق قيد إنشاء العهدة مبلغ العهدة وعملتها.');
    }
    const payload = buildFinancialEntryPayload({ ...entry, custodyId: '' });
    const custodyPayload = {
      id: custody.id || '', custodyNumber: custody.custodyNumber.trim(), recipientType: custody.recipientType,
      recipientId: custody.recipientId, recipientName: custody.recipientName.trim(), recipientAccountId: custody.recipientAccountId,
      amountOriginal: String(custody.amountOriginal), currencyOriginalNo: String(custody.currencyOriginalNo),
      ...serializePriceReference(custody.currencyPrice), note: custody.note || '', issuedAt: custody.issuedAt || '', createdByUid: custody.createdByUid || '',
    };
    const { data, error } = await (supabase as any).rpc('secure_create_custody_advance', { p_custody: custodyPayload, p_entry: payload });
    if (error) throw new Error(`[FinancialEntryService] تعذر إنشاء العهدة: ${error.message || error}`);
    return data;
  }

  async settleCustodyAdvance(custodyId: string, entry: FinancialEntryInput, settledByUid?: string): Promise<{ id: string; settlementEntryId: string; status: 'partial' | 'settled'; amountOutstanding: number }> {
    if (!custodyId?.trim()) throw new Error('معرف العهدة مطلوب للتسوية.');
    const payload = buildFinancialEntryPayload({ ...entry, custodyId });
    const { data, error } = await (supabase as any).rpc('secure_settle_custody_advance', {
      p_custody_id: custodyId, p_entry: payload,
    });
    if (error) throw new Error(`[FinancialEntryService] تعذر تسوية العهدة: ${error.message || error}`);
    return data;
  }

  async recordOrderPayment(orderId: string, paymentAmount: number, entry: FinancialEntryInput, updatedByUid?: string): Promise<{ orderId: string; entryId: string; amountPaid: number; amountRemaining: number; paymentStatus: 'Paid' | 'Partial Paid' }> {
    if (!orderId?.trim() || !hasValidPositiveNumber(paymentAmount)) throw new Error('معرف الطلب ومبلغ الدفعة الموجب مطلوبان.');
    if (entry.orderId !== orderId || entry.amountOriginal !== paymentAmount) throw new Error('مرجع الطلب ومبلغ سند القبض يجب أن يطابقا الدفعة.');
    const { data, error } = await (supabase as any).rpc('secure_record_order_payment', {
      p_order_id: orderId, p_payment_amount: paymentAmount, p_entry: buildFinancialEntryPayload(entry),
    });
    if (error) throw new Error(`[FinancialEntryService] تعذر تحصيل دفعة الطلب: ${error.message || error}`);
    return data;
  }

  async deleteDraft(entryId: string): Promise<{ id: string; deleted: true }> {
    if (!entryId?.trim()) throw new Error('معرف مسودة القيد مطلوب.');
    const { data, error } = await (supabase as any).rpc('secure_delete_financial_entry_draft', { p_entry_id: entryId });
    if (error) throw new Error(`[FinancialEntryService] تعذر حذف مسودة القيد: ${error.message || error}`);
    return data;
  }

  async replaceDraft(entryId: string, entry: FinancialEntryInput): Promise<FinancialEntryWriteResult> {
    if (!entryId?.trim()) throw new Error('معرف مسودة القيد مطلوب.');
    const { data, error } = await (supabase as any).rpc('secure_replace_financial_entry_draft', {
      p_entry_id: entryId,
      p_entry: buildFinancialEntryPayload({ ...entry, postingStatus: 'draft' }),
    });
    if (error) throw new Error(`[FinancialEntryService] تعذر تعديل مسودة القيد: ${error.message || error}`);
    return data;
  }

  async voidDraft(entryId: string, voidedByUid?: string): Promise<{ id: string; postingStatus: 'voided' }> {
    if (!entryId?.trim()) throw new Error('معرف مسودة القيد مطلوب.');
    const { data, error } = await (supabase as any).rpc('secure_void_financial_entry_draft', { p_entry_id: entryId });
    if (error) throw new Error(`[FinancialEntryService] تعذر إبطال مسودة القيد: ${error.message || error}`);
    return data;
  }

  async reverse(entryId: string, entryNumber: string, createdByUid?: string, notes = ''): Promise<FinancialEntryWriteResult & { reversesEntryId: string }> {
    if (!entryId?.trim() || !entryNumber?.trim()) throw new Error('معرف القيد ورقم القيد العكسي مطلوبان.');
    const { data, error } = await (supabase as any).rpc('secure_reverse_financial_entry', {
      p_entry_id: entryId, p_reversal: { entryNumber: entryNumber.trim(), notes },
    });
    if (error) throw new Error(`[FinancialEntryService] تعذر إنشاء القيد العكسي: ${error.message || error}`);
    return data;
  }

  async post(entryId: string, postedByUid?: string): Promise<{ id: string; postingStatus: 'posted' }> {
    if (!entryId?.trim()) throw new Error('معرف القيد مطلوب للترحيل.');
    const { data, error } = await (supabase as any).rpc('secure_post_financial_entry', { p_entry_id: entryId });
    if (error) throw new Error(`[FinancialEntryService] تعذر ترحيل القيد: ${error.message || error}`);
    return data as { id: string; postingStatus: 'posted' };
  }
}

export const financialEntryService = new FinancialEntryService();
