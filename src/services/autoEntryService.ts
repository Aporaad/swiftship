import useExchangeRates from '../hooks/useExchangeRates';
import { collection, getDocs, setDoc, doc, updateDoc, deleteDoc, db, supabase } from '../lib/supabase';
import { financialAccountService } from './financialAccountService';
import { financialEntryService } from './financialEntryService';
import {
  AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS,
  AutoEntryAmountSource,
  buildAutomaticVoucherKey,
  calculateAutoEntryAmount,
  getRuleAmountSources,
  normalizeOptionalAutoEntryCurrency,
} from './autoEntryRules';

export interface AutoEntryRule {
  id: string;
  statusId: number;         // رقم المرحلة والمرتبطة بـ order_status.id
  statusNameAr?: string;    // اسم المرحلة بالعربي للعرض السريع
  nameAr: string;           // اسم القيد بالعربي
  nameEn: string;           // اسم القيد بالإنجليزي
  isActive: boolean;
  debitAccount: {
    id: string;             // system account entityId or 'courier_linked' | 'customer_linked'
    code: string;
    name: string;
    type: 'system' | 'dynamic';
    defaultKey?: string;
  };
  creditAccount: {
    id: string;
    code: string;
    name: string;
    type: 'system' | 'dynamic';
    defaultKey?: string;
  };
  amountSource?: AutoEntryAmountSource;
  amountSources?: AutoEntryAmountSource[];
  amountStrategy?: 'sum';
  customAmount?: number;
  currency?: string;
  skipWhenZero?: boolean;
  descriptionTempAr: string;
  descriptionTempEn: string;
  createdAt?: number;
  /**
   * ترحيل القيد فوراً أم حفظه كمسودة غير مرحّلة
   * Auto post the entry immediately (posted) or save it as a draft (draft)
   * Default: true (posted immediately)
   */
  autoPost?: boolean;
}

export const DEFAULT_AUTO_ENTRIES: AutoEntryRule[] = [
  {
    id: 'order_charge',
    statusId: 2, // عند الاعتماد / التسجيل
    statusNameAr: 'معلق',
    nameAr: 'قيد إجمالي قيمة الطلب على العميل',
    nameEn: 'Charge total order value to customer account',
    isActive: true,
    amountSource: 'order_total',
    debitAccount: {
      id: 'customer_linked',
      code: '1130',
      name: 'حساب العميل المرتبط بالطلب (ديناميكي)',
      type: 'dynamic',
    },
    creditAccount: {
      id: 'sys_profit_account',
      code: '',
      name: 'حساب أرباح الشركة (نظامي)',
      type: 'system',
      defaultKey: 'sys_profit_account',
    },
    descriptionTempAr: 'قيد قيمة الطلب رقم: {orderNumber}',
    descriptionTempEn: 'Charge for order: {orderNumber}',
  },
  {
    id: 'order_down_payment',
    statusId: 2,
    statusNameAr: 'معلق',
    nameAr: 'الدفعة المقدمة للطلب المستلمة (صندوق / بنك / متعدد)',
    nameEn: 'Order down payment received (cash/bank/mixed)',
    isActive: true,
    autoPost: true,   // ترحيل فوري افتراضي
    amountSource: 'amount_paid',
    debitAccount: {
      id: 'payment_account_linked',
      code: '1110/1120',
      name: 'حساب الدفع القابض المختار بالطلب (ديناميكي)',
      type: 'dynamic',
    },
    creditAccount: {
      id: 'customer_linked',
      code: '1130',
      name: 'حساب العميل المرتبط بالطلب (ديناميكي)',
      type: 'dynamic',
    },
    descriptionTempAr: 'دفعة مقدمة للطلب رقم: {orderNumber}',
    descriptionTempEn: 'Down payment for order: {orderNumber}',
  },
  {
    id: 'courier_commission',
    statusId: 6, // وصل مركز التوزيع في اليمن
    statusNameAr: 'وصل مركز التوزيع في اليمن',
    nameAr: 'عمولة الشحن التلقائية للوكلاء/المناديب',
    nameEn: 'Auto shipping courier commission',
    isActive: true,
    amountSource: 'courier_commission',
    debitAccount: {
      id: 'sys_sourcing_cost',
      code: '',
      name: 'حساب تكلفة الشحن والعمولات (نظامي)',
      type: 'system',
      defaultKey: 'sys_sourcing_cost',
    },
    creditAccount: {
      id: 'courier_linked',
      code: '2120',
      name: 'حساب المندوب المرتبط بالشحنة (ديناميكي)',
      type: 'dynamic',
    },
    descriptionTempAr: 'عمولة شحن تلقائية للطلب رقم: {orderNumber}',
    descriptionTempEn: 'Auto-commission for order: {orderNumber}',
  },
  {
    id: 'custody_payment',
    statusId: 7, // مع المندوب للتوصيل
    statusNameAr: 'مع المندوب للتوصيل',
    nameAr: 'العهدة وتصفية دفعة العميل التلقائية للمندوب',
    nameEn: 'Auto-custody and payment settlement to courier',
    isActive: true,
    amountSource: 'amount_remaining',
    debitAccount: {
      id: 'courier_linked',
      code: '2120',
      name: 'حساب المندوب المرتبط بالشحنة (ديناميكي)',
      type: 'dynamic',
    },
    creditAccount: {
      id: 'customer_linked',
      code: '1130',
      name: 'حساب العميل المرتبط بالشحنة (ديناميكي)',
      type: 'dynamic',
    },
    descriptionTempAr: 'عهدة تلقائية مرحلة من تسليم الطلب رقم: {orderNumber}',
    descriptionTempEn: 'Auto-custody generated from delivery of order: {orderNumber}',
  },
  {
    id: 'delivery_wage',
    statusId: 8, // تم التسليم
    statusNameAr: 'تم التسليم',
    nameAr: 'أجور التوصيل التلقائية للمندوب',
    nameEn: 'Auto-wage for courier delivery',
    isActive: true,
    amountSource: 'delivery_wage',
    debitAccount: {
      id: 'sys_delivery_cost',
      code: '',
      name: 'حساب مصروفات التوصيل (نظامي)',
      type: 'system',
      defaultKey: 'sys_delivery_cost',
    },
    creditAccount: {
      id: 'courier_linked',
      code: '2120',
      name: 'حساب المندوب المرتبط بالشحنة (ديناميكي)',
      type: 'dynamic',
    },
    descriptionTempAr: 'أجور توصيل تلقائية لتسليم الطلب رقم: {orderNumber}',
    descriptionTempEn: 'Auto-wage for delivery of order: {orderNumber}',
  }
];

export const autoEntryService = {
  /**
   * Ensuring auto_entries collection is seeded with defaults if empty
   */
  async ensureAutoEntries(): Promise<AutoEntryRule[]> {
    try {
      const snap = await getDocs(collection(db, 'auto_entries'));
      if (snap.empty) {
        for (const rule of DEFAULT_AUTO_ENTRIES) {
          await setDoc(doc(db, 'auto_entries', rule.id), {
            ...rule,
            createdAt: Date.now()
          });
        }
        return DEFAULT_AUTO_ENTRIES;
      }
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AutoEntryRule));
    } catch (err) {
      console.error('[autoEntryService] ensureAutoEntries failed:', err);
      return DEFAULT_AUTO_ENTRIES;
    }
  },

  /**
   * Get auto entries linked to a specific statusId
   */
  async getAutoEntriesForStatus(statusId: number | string): Promise<AutoEntryRule[]> {
    try {
      const all = await this.ensureAutoEntries();
      const numId = typeof statusId === 'number' ? statusId : parseInt(String(statusId), 10);
      return all.filter(r => (r.statusId === numId || String(r.statusId) === String(statusId)) && r.isActive);
    } catch (err) {
      console.error('[autoEntryService] getAutoEntriesForStatus failed:', err);
      return [];
    }
  },

  /**
   * Create or update an auto entry rule
   */
  async saveAutoEntry(rule: AutoEntryRule): Promise<void> {
    const id = rule.id || `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const { currency, ...ruleWithoutCurrency } = rule;
    const normalizedCurrency = normalizeOptionalAutoEntryCurrency(currency);
    const payload = {
      ...ruleWithoutCurrency,
      id,
      updatedAt: Date.now(),
      ...(normalizedCurrency ? { currency: normalizedCurrency } : {}),
    };
    if (!normalizedCurrency) {
      const { error } = await (supabase as any).from('auto_entries').update({ currency: null }).eq('id', id);
      if (error) console.warn('[autoEntryService] Unable to clear the stored voucher currency:', error.message);
    }
    // كتابة مستبدِلة متعمدة: حذف currency من الوثيقة عند الاعتماد على عملة الطلب الافتراضية.
    await setDoc(doc(db, 'auto_entries', id), payload);
  },

  /**
   * Delete an auto entry rule
   */
  async deleteAutoEntry(ruleId: string): Promise<void> {
    await deleteDoc(doc(db, 'auto_entries', ruleId));
  },

  /**
   * Execute auto entries for a given statusId when order transitions
   */
  async executeAutoEntriesForStatus(
    statusId: number | string,
    order: any,
    context: {
      courier?: any;
      deliveryCourier?: any;
      shippingCourier?: any;
      customer?: any;
      orderParty?: any;
      purchaseSource?: any;
      shippingCompany?: any;
      sourcing_cost?: any;
      isAr?: boolean;
      profileName?: string;
      rawAmountOverride?: number;
      amountOriginal?: number;
      currencyOriginal?: string;
      paidCurrency?: string;
      /** توزيعات الدفعة المقدمة (نقد/بنك) — تُنفَّذ قيداً لكل توزيع على الحساب الذي اختاره المستخدم */
      downPaymentAllocations?: Array<{
        method?: 'cash' | 'bank';
        accountId: string;
        accountCode?: string;
        accountName?: string;
        amount: number;
        bankReference?: string;
      }>;
    }
  ): Promise<string[]> {
    const executedRuleIds: string[] = [];
    try {
      const resolvedStatusId = statusId ?? order?.order_status_id ?? order?.orderStatusId ?? 1;
      const rules = await this.getAutoEntriesForStatus(resolvedStatusId);
      const exchangeRates = await financialAccountService.getExchangeRates();
      for (const rule of rules) {
        if (!rule.isActive) continue;
        const calculated = calculateAutoEntryAmount(
          order,
          rule,
          (amount, fromCurrency, toCurrency) => financialAccountService.convertToTargetCurrency(
            amount,
            fromCurrency,
            toCurrency,
            exchangeRates,
          ),
        );
        const amount = context.rawAmountOverride !== undefined
          ? context.rawAmountOverride
          : calculated.amount;
        const currency = context.currencyOriginal || calculated.currency;
        const amountSources = getRuleAmountSources(rule);
        const automationKey = buildAutomaticVoucherKey(String(order.id || order.orderNumber), rule.id, resolvedStatusId);

        if ((rule.skipWhenZero ?? true) && amount <= 0) {
          continue;
        }

        // ============================================================
        // قيد الدفعة المقدمة — Order Down Payment Entry Logic
        // ============================================================
        // إذا كان نوع الدفع متعدد (نقد + بنك): ننشئ قيداً مركباً واحداً بثلاثة أطراف
        // If payment is mixed (cash + bank): create a single 3-party compound entry
        // أما إذا كان الدفع بطريقة واحدة: ننشئ قيداً بسيطاً (سطر واحد للمدين)
        // Otherwise (single payment method): create a regular debit entry per allocation

        // بناء قائمة توزيعات الدفع (نقد + بنك) — build payment allocations (cash + bank)
        const effectiveAllocations = (context.downPaymentAllocations && context.downPaymentAllocations.length > 0)
          ? context.downPaymentAllocations
          : (order?.paymentMethod === 'Mixed' || ((order?.cashAmount || 0) > 0 && (order?.bankAmount || 0) > 0))
            ? [
                ...(order?.cashAccountId && (order?.cashAmount || 0) > 0
                  ? [{ method: 'cash' as const, accountId: order.cashAccountId, amount: Number(order.cashAmount) || 0 }]
                  : []),
                ...(order?.bankAccountId && (order?.bankAmount || 0) > 0
                  ? [{ method: 'bank' as const, accountId: order.bankAccountId, amount: Number(order.bankAmount) || 0, bankReference: order.bankReference || '' }]
                  : [])
              ]
            : undefined;

        if (rule.id === 'order_down_payment' && effectiveAllocations && effectiveAllocations.length > 0) {

          const paidCurrency = String(context.paidCurrency || order?.paidCurrency || order?.currency || 'YER').toUpperCase();
          const activeAllocations = effectiveAllocations.filter(
            (alloc) => alloc && alloc.accountId && (Number(alloc.amount) || 0) > 0
          );
          if (activeAllocations.length === 0) continue;

          // القيد المركب: يتطلب طرفين مدينين (صندوق + بنك) وطرف دائن (العميل)
          // Compound entry: requires 2 debit lines (cash + bank) and 1 credit line (customer)
          if (activeAllocations.length >= 2) {
            // حساب العميل الدائن — resolve credit account (customer)
            const orderPartyAccount = context.orderParty || context.customer;
            const customerAccountId = orderPartyAccount?.financialAccountId
              || orderPartyAccount?.accountId
              || orderPartyAccount?.linkedAccountId
              || orderPartyAccount?.account_id;

            if (!customerAccountId) {
              console.warn('[autoEntryService] لا يمكن إنشاء القيد المركب: حساب العميل غير مرتبط.', { orderId: order?.id, automationKey });
              continue;
            }

            const totalAmount = activeAllocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
            if (!(totalAmount > 0)) continue;

            // التحقق من عدم تنفيذ القيد مسبقاً (منع التكرار) — duplicate check
            const previousExec = await (supabase as any)
              .from('main_entry')
              .select('id')
              .eq('automation_key', automationKey)
              .limit(1);
            if ((previousExec.data || []).length > 0) {
              console.info('[autoEntryService] Compound entry duplicate prevented.', { automationKey });
              executedRuleIds.push(rule.id);
              continue;
            }

            // جلب تفاصيل حساب العميل الدائن — fetch customer credit account details
            const customerAccount = await financialAccountService.getAccountById(customerAccountId);
            const customerCurNo = customerAccount?.curNo || 0;
            const customerCurrencyCode = customerAccount?.currency || currency;

            // بناء أسطر القيد المركب — build compound entry lines asynchronously with resolved account details
            const debitLines = await Promise.all(
              activeAllocations.map(async (alloc) => {
                const allocAmount = Number(alloc.amount) || 0;
                const convertedAllocAmount = currency === paidCurrency
                  ? allocAmount
                  : financialAccountService.convertToTargetCurrency(allocAmount, paidCurrency, currency, exchangeRates);

                const allocAcc = await financialAccountService.getAccountById(alloc.accountId);
                return {
                  account: {
                    id: alloc.accountId,
                    curNo: allocAcc?.curNo || 0,
                    currency: allocAcc?.currency || currency,
                    entityType: allocAcc?.entityType,
                    entityId: allocAcc?.entityId,
                  },
                  transType: 'Debit' as const,
                  amountOriginal: convertedAllocAmount,
                  paymentMethod: ((alloc as any).method === 'bank' ? 'bank' : 'cash') as 'cash' | 'bank',
                  bankReference: (alloc as any).bankReference || '',
                };
              })
            );

            const compoundLines = [
              ...debitLines,
              {
                account: {
                  id: customerAccountId,
                  curNo: customerCurNo,
                  currency: customerCurrencyCode,
                  entityType: customerAccount?.entityType,
                  entityId: customerAccount?.entityId,
                },
                transType: 'Credit' as const,
                amountOriginal: totalAmount,
              },
            ];

            // تحديد حالة ترحيل القيد بناءً على autoPost — determine posting status from autoPost
            const postingStatus = rule.autoPost === false ? 'draft' : 'posted';

            try {
              await financialEntryService.createCompoundFromLegacyVoucher({
                entryNumber: automationKey,
                createdAt: Date.now(),
                description: (context.isAr ?? true)
                  ? (rule.descriptionTempAr || rule.nameAr).replace('{orderNumber}', order?.orderNumber || '')
                  : (rule.descriptionTempEn || rule.nameEn).replace('{orderNumber}', order?.orderNumber || ''),
                currency,
                module: 'payment',
                refNumber: order?.orderNumber || '',
                orderId: order?.id,
                automationKey,
                autoRuleId: rule.id,
                isAutomatic: true,
                createdByUid: context.profileName || 'system',
                postingStatus,
                lines: compoundLines,
              });
              console.info('[autoEntryService] قيد مركب للدفع المتعدد أُنشئ بنجاح — Compound entry created for mixed payment.', { automationKey, totalAmount, currency, postingStatus });
              executedRuleIds.push(rule.id);
            } catch (compoundErr) {
              console.error('[autoEntryService] فشل إنشاء القيد المركب — Failed to create compound entry:', compoundErr);
            }
            continue;
          }

          // دفعة واحدة: قيد بسيط لكل توزيع — Single allocation: simple debit per allocation
          for (let allocIndex = 0; allocIndex < activeAllocations.length; allocIndex++) {
            const allocation = activeAllocations[allocIndex];
            const allocAmount = Number(allocation.amount) || 0;
            const convertedAllocAmount = currency === paidCurrency
              ? allocAmount
              : financialAccountService.convertToTargetCurrency(allocAmount, paidCurrency, currency, exchangeRates);
            if (!(convertedAllocAmount > 0)) continue;
            const executedAllocation = await financialAccountService.triggerAutomaticVoucher(rule.id, order, {
              courier: context.courier,
              deliveryCourier: context.deliveryCourier,
              shippingCourier: context.shippingCourier,
              customer: context.customer,
              orderParty: context.orderParty || context.customer,
              purchaseSource: context.purchaseSource,
              shippingCompany: context.shippingCompany,
              sourcing_cost: context.sourcing_cost,
              isAr: context.isAr ?? true,
              rawAmount: convertedAllocAmount,
              amountOriginal: convertedAllocAmount,
              currencyOriginal: currency,
              profileName: context.profileName || 'System Status Automation',
              statusId: resolvedStatusId,
              automationKey: `${automationKey}:alloc:${allocIndex + 1}`,
              autoRuleId: rule.id,
              amountSources,
              debitAccountOverride: {
                id: allocation.accountId,
                code: (allocation as any).accountCode || '',
                name: (allocation as any).accountName || '',
              },
              // مرجع الحوالة البنكية يظهر كرقم مرجعي للسند
              expenseNumber: allocation.bankReference || order?.orderNumber || '',
              // تمرير autoPost من قاعدة القيد — pass autoPost from rule to respect posting preference
              autoPost: rule.autoPost,
            });
            if (executedAllocation) executedRuleIds.push(rule.id);
          }
          continue;
        }

        const executed = await financialAccountService.triggerAutomaticVoucher(rule.id, order, {
          courier: context.courier,
          deliveryCourier: context.deliveryCourier,
          shippingCourier: context.shippingCourier,
          customer: context.customer,
          orderParty: context.orderParty || context.customer,
          purchaseSource: context.purchaseSource,
          shippingCompany: context.shippingCompany,
          sourcing_cost: context.sourcing_cost,
          isAr: context.isAr ?? true,
          rawAmount: amount,
          amountOriginal: context.amountOriginal ?? amount,
          currencyOriginal: currency,
          profileName: context.profileName || 'System Status Automation',
          statusId: resolvedStatusId,
          automationKey,
          autoRuleId: rule.id,
          amountSources,
          amountBreakdown: calculated.breakdown,
          autoPost: rule.autoPost,
        });

        if (executed) executedRuleIds.push(rule.id);
      }
    } catch (err) {
      console.error(`[autoEntryService] Error executing auto entries for statusId ${statusId}:`, err);
    }
    return executedRuleIds;
  }
};
