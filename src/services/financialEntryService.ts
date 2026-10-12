import type { PaymentStatus, PostingStatus } from '../shared/contracts/value-primitives';
import { financeApiWriteGateway } from '../components/financeAccounting/FinanceApiWriteGateway';
import { settingsCurrenciesApiGateway } from '../data/http/settings-currencies-api.gateway';
import currencyService from './currencyService';

export type FinancialPaymentMethod = 'cash' | 'bank' | 'mixed' | 'deferred';
export type FinancialEntryCategory = 'General' | 'Compound' | 'Temp' | 'Reversing';
export type FinancialPostingStatus = Exclude<PostingStatus, 'voided'>;
export type FinancialTransactionType = 'Debit' | 'Credit';

export interface FinancialEntryPriceReference {
  id: number;
  seq: number;
}

export interface FinancialEntryLineInput {
  id?: string;
  accountId: string;
  accountCurNo: number;
  accountCurrencyPrice?: FinancialEntryPriceReference;
  transType: FinancialTransactionType;
  amount: number;
  amountText?: string;
  amountOriginal: number;
  amountOriginalText?: string;
  currencyOriginalNo: number;
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
  entryNumber?: string;
  moduleId: string;
  entryTypeId: string;
  entryCategory: FinancialEntryCategory;
  postingStatus?: FinancialPostingStatus;
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
  /** حالة الترحيل: 'posted' للترحيل الفوري، 'draft' للمسودة — Posting status: posted = immediate, draft = unposted */
  postingStatus?: FinancialPostingStatus;
}

/** مدخل بيانات إنشاء قيد مركب (متعدد الأطراف) من واجهة الترحيل التلقائي */
/** Input for creating a compound entry (multi-line) from the legacy automation interface */
export interface CompoundLegacyVoucherInput extends Omit<LegacyVoucherInput, 'amount'> {
  /** أسطر القيد المركب — Compound entry lines (Debit + Credit sides) */
  lines: Array<{
    account: LegacyVoucherAccountTarget;
    transType: FinancialTransactionType;
    amountOriginal: number;
    paymentMethod?: Exclude<FinancialPaymentMethod, 'mixed'>;
    bankReference?: string;
  }>;
}

const hasValidPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const serializePriceReference = (
  price?: FinancialEntryPriceReference,
  idKey = 'currencyPriceId',
  seqKey = 'currencyPriceSeq'
) => {
  if (!price || !price.id || !price.seq) return {};
  return {
    [idKey]: String(price.id),
    [seqKey]: String(price.seq),
  };
};

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
  if (!entry || !entry.moduleId || !entry.entryTypeId || !entry.description?.trim()) {
    throw new Error('الفئة والنوع والبيان حقول إلزامية.');
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

  let debitOriginalTotal = 0;
  let creditOriginalTotal = 0;

  const lines = entry.lines.map((line) => {
    if (!line.accountId || !Number.isInteger(line.accountCurNo) || !Number.isInteger(line.currencyOriginalNo) || !hasValidPositiveNumber(line.amount) || !hasValidPositiveNumber(line.amountOriginal)) {
      throw new Error('كل ساق تحتاج حسابًا ومبلغًا ومبلغًا أصليًا ومرجع عملة صحيحين.');
    }
    if (line.transType !== 'Debit' && line.transType !== 'Credit') {
      throw new Error('نوع الساق يجب أن يكون Debit أو Credit.');
    }

    if (line.transType === 'Debit') debitOriginalTotal += line.amountOriginal;
    else creditOriginalTotal += line.amountOriginal;

    return {
      id: line.id,
      accountId: line.accountId,
      accountCurNo: String(line.accountCurNo),
      ...serializePriceReference(line.accountCurrencyPrice, 'accountCurrencyPriceId', 'accountCurrencyPriceSeq'),
      transType: line.transType,
      amount: String(line.amount),
      amountText: line.amountText || '',
      amountOriginal: String(line.amountOriginal),
      amountOriginalText: line.amountOriginalText || '',
      currencyOriginalNo: String(line.currencyOriginalNo),
      ...serializePriceReference(line.currencyPrice, 'currencyPriceId', 'currencyPriceSeq'),
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

  const diff = Math.abs(debitOriginalTotal - creditOriginalTotal);
  if (diff > 0.05) {
    throw new Error('القيد غير متوازن: مجموع أسطر المدين الأصلي لا يطابق مجموع أسطر الدائن الأصلي.');
  }

  let paymentDetailsInput = entry.paymentDetails;
  if ((!paymentDetailsInput || paymentDetailsInput.length === 0) && (entry.paymentMethod === 'cash' || entry.paymentMethod === 'bank')) {
    const targetLine = lines.find((l) => l.paymentMethod === entry.paymentMethod || l.transType === 'Debit');
    if (targetLine && targetLine.accountId && hasValidPositiveNumber(Number(targetLine.amountOriginal))) {
      paymentDetailsInput = [{
        paymentMethod: entry.paymentMethod as 'cash' | 'bank',
        accountId: targetLine.accountId,
        amountOriginal: Number(targetLine.amountOriginal),
      }];
    }
  }

  const paymentDetails = (paymentDetailsInput || []).map((detail) => {
    const numAmt = Number(detail.amountOriginal);
    if (!detail.accountId || !hasValidPositiveNumber(numAmt)) {
      throw new Error('كل تفصيل دفع يحتاج طريقة غير مختلطة وحسابًا ماليًا ومبلغًا موجبًا.');
    }
    return {
      id: detail.id || '', paymentMethod: detail.paymentMethod, accountId: detail.accountId,
      amountOriginal: String(numAmt), bankReference: detail.bankReference?.trim() || '',
      dueAt: detail.dueAt || '', note: detail.note || '',
    };
  });

  return {
    id: entry.id || '',
    entryNumber: entry.entryNumber?.trim() || '',
    moduleId: entry.moduleId,
    entryTypeId: entry.entryTypeId,
    entryCategory: entry.entryCategory,
    postingStatus: entry.postingStatus || 'draft',
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
    // مرجع العملة عبر API فقط — GET /api/v1/currencies
    // Currency reference via API only.
    const currencies = await settingsCurrenciesApiGateway.listCurrencies(false);
    const match = currencies.find((c) => String(c.code).trim().toUpperCase() === normalizedCode);
    if (!match) throw new Error(`لا يوجد مرجع عملة نشط ومثبت للرمز ${normalizedCode}.`);
    return { curId: Number(match.currencyId), isDefault: Boolean(match.isDefault) };
  }

  private async resolvePrice(currencyId: number, effectiveAt: string): Promise<{ price: number; reference: FinancialEntryPriceReference }> {
    const match = await currencyService.getPriceReferenceAt(currencyId, effectiveAt || new Date().toISOString());
    if (!match || !hasValidPositiveNumber(match.price)) {
      throw new Error('تعذر إثبات سعر الصرف في تاريخ القيد؛ لن يُنشأ القيد متعدد العملات.');
    }
    return match;
  }

  private async buildLegacyVoucherLine(
    target: LegacyVoucherAccountTarget,
    transType: FinancialTransactionType,
    amountOriginal: number,
    originalCurrency: { curId: number; isDefault: boolean },
    effectiveAt: string,
    suppliedAmount?: number,
  ): Promise<FinancialEntryLineInput> {
    if (!target.id) {
      throw new Error('الحساب المالي المختار لا يملك معرفاً صالحاً.');
    }
    const accountCurrency = await this.resolveCurrency(target.currency);
    const targetCurNo = (target.curNo && Number.isInteger(target.curNo) && target.curNo > 0)
      ? target.curNo
      : accountCurrency.curId;

    if (accountCurrency.curId !== targetCurNo) {
      throw new Error('رمز عملة الحساب لا يطابق مرجع عملته؛ لن يُنشأ القيد.');
    }
    if (accountCurrency.curId === originalCurrency.curId) {
      return {
        accountId: target.id,
        accountCurNo: targetCurNo,
        transType,
        amount: amountOriginal,
        amountOriginal,
        currencyOriginalNo: originalCurrency.curId,
        entityType: target.entityType,
        entityId: target.entityId,
      };
    }

    // إذا كانت كلتا العملتين غير افتراضيتين (مثل USD -> SAR والعملة الافتراضية للنظام YER)
    // يتم تحويل المبلغ بالاعتماد على أسعار الصرف الرسمية المسجلة لكلتا العملتين في cur_price
    if (!originalCurrency.isDefault && !accountCurrency.isDefault) {
      const [priceOriginal, priceAccount] = await Promise.all([
        this.resolvePrice(originalCurrency.curId, effectiveAt),
        this.resolvePrice(accountCurrency.curId, effectiveAt),
      ]);

      const amountInDefaultCurrency = amountOriginal * priceOriginal.price;
      const derivedAmount = priceAccount.price > 0 ? amountInDefaultCurrency / priceAccount.price : amountOriginal;
      const amount = hasValidPositiveNumber(suppliedAmount) ? suppliedAmount : derivedAmount;

      return {
        accountId: target.id,
        accountCurNo: targetCurNo,
        accountCurrencyPrice: priceAccount.reference,
        transType,
        amount,
        amountOriginal,
        currencyOriginalNo: originalCurrency.curId,
        currencyPrice: priceOriginal.reference,
        entityType: target.entityType,
        entityId: target.entityId,
      };
    }

    const pricedCurrency = originalCurrency.isDefault ? accountCurrency : originalCurrency;
    const price = await this.resolvePrice(pricedCurrency.curId, effectiveAt);
    const derivedAmount = originalCurrency.isDefault
      ? (price.price > 0 ? amountOriginal / price.price : amountOriginal)
      : amountOriginal * price.price;
    const amount = hasValidPositiveNumber(suppliedAmount) ? suppliedAmount : derivedAmount;

    return {
      accountId: target.id,
      accountCurNo: targetCurNo,
      accountCurrencyPrice: price.reference,
      transType,
      amount,
      amountOriginal,
      currencyOriginalNo: originalCurrency.curId,
      currencyPrice: price.reference,
      entityType: target.entityType,
      entityId: target.entityId,
    };
  }

  async buildLegacyVoucherInput(
    voucher: LegacyVoucherInput,
    debitAccount: LegacyVoucherAccountTarget,
    creditAccount: LegacyVoucherAccountTarget,
    routeOverride?: { moduleId?: string; entryTypeId?: string; entryCategory?: FinancialEntryCategory },
  ): Promise<FinancialEntryInput> {
    if (!hasValidPositiveNumber(voucher.amount)) throw new Error('مبلغ القيد يجب أن يكون موجبًا.');
    const effectiveAt = new Date(voucher.createdAt || Date.now()).toISOString();
    const originalCurrency = await this.resolveCurrency(voucher.currency);
    const [debitLine, creditLine] = await Promise.all([
      this.buildLegacyVoucherLine(debitAccount, 'Debit', voucher.amount, originalCurrency, effectiveAt, voucher.amountDebitCurrency),
      this.buildLegacyVoucherLine(creditAccount, 'Credit', voucher.amount, originalCurrency, effectiveAt, voucher.amountCreditCurrency),
    ]);
    const route = legacyModuleRoute(voucher.module);
    // احترام postingStatus الممرر — respect passed postingStatus (posted by default for backward compat)
    const postingStatus: FinancialPostingStatus = voucher.postingStatus || 'posted';
    return {
      moduleId: routeOverride?.moduleId || route.moduleId,
      entryTypeId: routeOverride?.entryTypeId || route.entryTypeId,
      entryNumber: voucher.entryNumber,
      entryCategory: routeOverride?.entryCategory || 'General',
      postingStatus,
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
    };
  }

  async createFromLegacyVoucher(
    voucher: LegacyVoucherInput,
    debitAccount: LegacyVoucherAccountTarget,
    creditAccount: LegacyVoucherAccountTarget,
  ): Promise<FinancialEntryWriteResult> {
    return this.create(await this.buildLegacyVoucherInput(voucher, debitAccount, creditAccount));
  }

  /**
   * تعديل قيد مرحّل من دفتر الأستاذ — إجراء API المعتمد: إلغاء ترحيل ثم استبدال ثم إعادة ترحيل.
   * يرفض المسار المخزني تعديل القيود المرحّلة مباشرة، لذا تمر التعديلات بهذه الدورة الذرية عبر الـHTTP.
   * Posted-entry edit through the API: unpost → replace draft → re-post.
   */
  async replaceLedgerEntry(
    entryId: string,
    voucher: LegacyVoucherInput,
    debitAccount: LegacyVoucherAccountTarget,
    creditAccount: LegacyVoucherAccountTarget,
    actorUid?: string,
    routeOverride?: { moduleId?: string; entryTypeId?: string; entryCategory?: FinancialEntryCategory },
  ): Promise<FinancialEntryWriteResult> {
    if (!entryId?.trim()) throw new Error('معرف القيد مطلوب للتعديل.');
    await this.unpostOrder(entryId, actorUid);
    const input = await this.buildLegacyVoucherInput(
      { ...voucher, postingStatus: 'draft' },
      debitAccount,
      creditAccount,
      routeOverride,
    );
    const replaced = await this.replaceDraft(entryId, input);
    await this.post(entryId, actorUid);
    return { ...replaced, postingStatus: 'posted' };
  }

  /**
   * حذف قيد مرحّل من دفتر الأستاذ — إلغاء ترحيل ثم حذف المسودة عبر الـAPI.
   * Posted-entry delete through the API: unpost then delete the resulting draft.
   */
  async deleteLedgerEntry(entryId: string, actorUid?: string): Promise<{ id: string; deleted: true }> {
    if (!entryId?.trim()) throw new Error('معرف القيد مطلوب للحذف.');
    await this.unpostOrder(entryId, actorUid);
    return this.deleteDraft(entryId);
  }

  /**
   * إنشاء قيد مركب واحد من متعدد الأطراف (مثل الدفع المتعدد: صندوق + بنك + عميل)
   * Creates a single compound (multi-line) entry for multi-party transactions (e.g. mixed payment: cash + bank + customer)
   *
   * @param voucher - بيانات القيد الأساسية مع الأسطر المحددة — Base voucher data with explicit lines
   * @returns FinancialEntryWriteResult — نتيجة إنشاء القيد
   */
  async createCompoundFromLegacyVoucher(
    voucher: CompoundLegacyVoucherInput,
  ): Promise<FinancialEntryWriteResult> {
    if (!Array.isArray(voucher.lines) || voucher.lines.length < 3) {
      throw new Error('القيد المركب يتطلب ثلاثة أسطر على الأقل (طرف مدين + طرف مدين + طرف دائن على الأقل).');
    }

    const effectiveAt = new Date(voucher.createdAt || Date.now()).toISOString();
    const originalCurrency = await this.resolveCurrency(voucher.currency);
    const route = legacyModuleRoute(voucher.module);
    const postingStatus: FinancialPostingStatus = voucher.postingStatus || 'posted';

    // بناء أسطر القيد المركب — Build compound entry lines
    const builtLines: FinancialEntryLineInput[] = await Promise.all(
      voucher.lines.map(async (lineInput) => {
        const line = await this.buildLegacyVoucherLine(
          lineInput.account,
          lineInput.transType,
          lineInput.amountOriginal,
          originalCurrency,
          effectiveAt,
        );
        // إضافة طريقة الدفع لكل سطر إن وُجدت — attach per-line payment method if provided
        return {
          ...line,
          paymentMethod: lineInput.paymentMethod,
        };
      })
    );

    // بناء تفاصيل الدفع للأسطر ذات طريقة دفع محددة — build paymentDetails from lines that carry a payment method
    const paymentDetails: FinancialPaymentDetailInput[] = voucher.lines
      .filter((l) => l.paymentMethod === 'cash' || l.paymentMethod === 'bank')
      .map((l) => ({
        paymentMethod: l.paymentMethod as Exclude<FinancialPaymentMethod, 'mixed'>,
        accountId: l.account.id,
        amountOriginal: l.amountOriginal,
        bankReference: l.bankReference || '',
      }));

    return this.create({
      ...route,
      entryNumber: voucher.entryNumber,
      // القيد المركب دائمًا من النوع Compound — compound entries are always of category Compound
      entryCategory: 'Compound',
      postingStatus,
      description: voucher.description,
      notes: voucher.notes,
      attachments: voucher.attachments,
      // طريقة الدفع المركبة — mixed payment method at header level
      paymentMethod: 'mixed',
      paymentDetails: paymentDetails.length > 0 ? paymentDetails : undefined,
      orderId: voucher.orderId,
      shipmentId: voucher.shipmentId,
      automationKey: voucher.automationKey,
      autoRuleId: voucher.autoRuleId,
      isAutomatic: voucher.isAutomatic,
      effectiveAt,
      createdByUid: voucher.createdByUid,
      lines: builtLines,
    });
  }

  async create(entry: FinancialEntryInput): Promise<FinancialEntryWriteResult> {
    const payload = buildFinancialEntryPayload(entry);
    return (await financeApiWriteGateway.createEntry(payload)) as unknown as FinancialEntryWriteResult;
  }

  async createCustodyAdvance(custody: CustodyAdvanceInput, entry: FinancialEntryInput): Promise<{ id: string; custodyNumber: string; issuedEntryId: string; status: 'open' }> {
    if (!custody.custodyNumber?.trim() || !custody.recipientId || !custody.recipientName?.trim() || !custody.recipientAccountId) {
      throw new Error('رقم العهدة وطرفها وحسابه المالي حقول إلزامية.');
    }
    if (!hasValidPositiveNumber(custody.amountOriginal) || !Number.isInteger(custody.currencyOriginalNo)) {
      throw new Error('مبلغ العهدة ومرجع عملتها غير صالحين.');
    }
    const custodyPayload: Record<string, unknown> = {
      custodyNumber: custody.custodyNumber.trim(),
      recipientId: custody.recipientId,
      recipientName: custody.recipientName.trim(),
      recipientAccountId: custody.recipientAccountId,
      amountOriginal: custody.amountOriginal,
      currencyOriginalNo: custody.currencyOriginalNo,
    };
    if (custody.id) custodyPayload.id = custody.id;
    if (custody.recipientType) custodyPayload.recipientType = custody.recipientType;
    if (custody.currencyPrice?.id) custodyPayload.currencyPriceId = custody.currencyPrice.id;
    if (custody.currencyPrice?.seq) custodyPayload.currencyPriceSeq = custody.currencyPrice.seq;
    if (custody.note) custodyPayload.note = custody.note;
    if (custody.issuedAt) custodyPayload.issuedAt = custody.issuedAt;
    const entryPayload = buildFinancialEntryPayload({ ...entry, custodyId: '' });
    return (await financeApiWriteGateway.createCustodyAdvance(custodyPayload, entryPayload)) as unknown as { id: string; custodyNumber: string; issuedEntryId: string; status: 'open' };
  }

  async settleCustodyAdvance(custodyId: string, entry: FinancialEntryInput, settledByUid?: string): Promise<{ id: string; settlementEntryId: string; status: 'partial' | 'settled'; amountOutstanding: number }> {
    if (!custodyId?.trim()) throw new Error('معرف العهدة مطلوب للتسوية.');
    const payload = buildFinancialEntryPayload({ ...entry, custodyId });
    return (await financeApiWriteGateway.settleCustodyAdvance(custodyId, payload)) as unknown as { id: string; settlementEntryId: string; status: 'partial' | 'settled'; amountOutstanding: number };
  }

  async recordOrderPayment(orderId: string, paymentAmount: number, entry: FinancialEntryInput, updatedByUid?: string): Promise<{ orderId: string; entryId: string; amountPaid: number; amountRemaining: number; paymentStatus: Exclude<PaymentStatus, 'Unpaid'> }> {
    if (!orderId?.trim() || !hasValidPositiveNumber(paymentAmount)) throw new Error('معرف الطلب ومبلغ الدفعة الموجب مطلوبان.');
    if (entry.orderId !== orderId) throw new Error('مرجع الطلب ومبلغ سند القبض يجب أن يطابقا الدفعة.');
    const payload = buildFinancialEntryPayload(entry);
    return (await financeApiWriteGateway.recordOrderPayment(orderId, paymentAmount, payload)) as unknown as { orderId: string; entryId: string; amountPaid: number; amountRemaining: number; paymentStatus: Exclude<PaymentStatus, 'Unpaid'> };
  }

  async deleteDraft(entryId: string): Promise<{ id: string; deleted: true }> {
    if (!entryId?.trim()) throw new Error('معرف مسودة القيد مطلوب.');
    return (await financeApiWriteGateway.deleteEntry(entryId)) as unknown as { id: string; deleted: true };
  }

  async replaceDraft(entryId: string, entry: FinancialEntryInput): Promise<FinancialEntryWriteResult> {
    if (!entryId?.trim()) throw new Error('معرف مسودة القيد مطلوب.');
    const payload = buildFinancialEntryPayload({ ...entry, postingStatus: 'draft' });
    return (await financeApiWriteGateway.replaceDraft(entryId, payload)) as unknown as FinancialEntryWriteResult;
  }

  async voidDraft(entryId: string, voidedByUid?: string): Promise<{ id: string; postingStatus: 'voided' }> {
    if (!entryId?.trim()) throw new Error('معرف مسودة القيد مطلوب.');
    return (await financeApiWriteGateway.voidDraft(entryId)) as { id: string; postingStatus: 'voided' };
  }

  async reverse(entryId: string, entryNumber: string, createdByUid?: string, notes = ''): Promise<FinancialEntryWriteResult & { reversesEntryId: string }> {
    if (!entryId?.trim() || !entryNumber?.trim()) throw new Error('معرف القيد ورقم القيد العكسي مطلوبان.');
    return (await financeApiWriteGateway.reverseEntry(entryId, notes.trim() || `عكس القيد ${entryNumber.trim()}`)) as unknown as FinancialEntryWriteResult & { reversesEntryId: string };
  }

  async post(entryId: string, postedByUid?: string): Promise<{ id: string; postingStatus: 'posted' }> {
    if (!entryId?.trim()) throw new Error('معرف القيد مطلوب للترحيل.');
    return (await financeApiWriteGateway.postEntry(entryId)) as { id: string; postingStatus: 'posted' };
  }
  /**
   * حذف قيد — عبر DELETE /api/v1/finance/entries/:id مع صلاحية النوع المحدد
   * Deletes an entry via the Finance API with the entry-type's delete permission.
   */
  async deletePosted(entryId: string, deletedByUid?: string): Promise<{ id: string; deleted: true }> {
    if (!entryId?.trim()) throw new Error('معرف القيد مطلوب للحذف.');
    return (await financeApiWriteGateway.deleteEntry(entryId)) as unknown as { id: string; deleted: true };
  }

  /**
   * تعديل قيد — عبر PATCH /api/v1/finance/entries/:id مع صلاحية النوع المحدد
   * Updates an entry via the Finance API with the entry-type's edit permission.
   */
  async replacePosted(entryId: string, entry: FinancialEntryInput): Promise<FinancialEntryWriteResult> {
    if (!entryId?.trim()) throw new Error('معرف القيد مطلوب للتعديل.');
    return this.replaceDraft(entryId, entry);
  }

  /**
   * إلغاء ترحيل قيد — عبر POST /api/v1/finance/entries/:id/unpost بصلاحية unpost_posted_orders
   * Unposts an entry via the Finance API (requires unpost_posted_orders permission).
   */
  async unpostOrder(entryId: string, unpostedByUid?: string): Promise<{ id: string; postingStatus: 'draft'; unposted: true }> {
    if (!entryId?.trim()) throw new Error('معرف القيد مطلوب لإلغاء الترحيل.');
    return (await financeApiWriteGateway.unpostEntry(entryId)) as unknown as { id: string; postingStatus: 'draft'; unposted: true };
  }
}

export const financialEntryService = new FinancialEntryService();
