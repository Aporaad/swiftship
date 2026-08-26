import useExchangeRates from '../hooks/useExchangeRates';
import { collection, getDocs, setDoc, doc, updateDoc, deleteDoc, db, supabase } from '../lib/supabase';
import { financialAccountService } from './financialAccountService';
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
  };
  creditAccount: {
    id: string;
    code: string;
    name: string;
    type: 'system' | 'dynamic';
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
      code: '4000-0001',
      name: 'حساب أرباح الشركة (نظامي)',
      type: 'system',
    },
    descriptionTempAr: 'قيد قيمة الطلب رقم: {orderNumber}',
    descriptionTempEn: 'Charge for order: {orderNumber}',
  },
  {
    id: 'order_down_payment',
    statusId: 2,
    statusNameAr: 'معلق',
    nameAr: 'الدفعة المقدمة للطلب المستلمة نقدًا',
    nameEn: 'Order down payment received in cash',
    isActive: true,
    amountSource: 'amount_paid',
    debitAccount: {
      id: 'sys_cash_account',
      code: '1111-0',
      name: 'حساب الصندوق/الخزينة (نظامي)',
      type: 'system',
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
      code: '5100-4483',
      name: 'حساب تكلفة الشحن والعمولات (نظامي)',
      type: 'system',
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
      code: '5000-2788',
      name: 'حساب مصروفات التوصيل (نظامي)',
      type: 'system',
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
        });

        if (executed) executedRuleIds.push(rule.id);
      }
    } catch (err) {
      console.error(`[autoEntryService] Error executing auto entries for statusId ${statusId}:`, err);
    }
    return executedRuleIds;
  }
};
