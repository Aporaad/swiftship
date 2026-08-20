import useExchangeRates from '../hooks/useExchangeRates';
import { collection, getDocs, setDoc, doc, updateDoc, deleteDoc, db } from '../lib/supabase';
import { financialAccountService } from './financialAccountService';

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
  amountSource?: 'order_total' | 'amount_paid' | 'amount_remaining' | 'sourcing_cost' | 'shipping_cost' | 'delivery_wage' | 'courier_commission' | 'company_profit' | 'custom';
  customAmount?: number;
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
    await setDoc(doc(db, 'auto_entries', id), {
      ...rule,
      id,
      updatedAt: Date.now()
    }, { merge: true });
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
      customer?: any;
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
      const sourcing_cost_courier = context.sourcing_cost === 'system' ? await financialAccountService.getAccountById('sys_orders_cost') : context.courier;
      for (const rule of rules) {
        if (!rule.isActive) continue;

        // Trigger financial voucher
        const amount_paid = order.amountPaid || 0;
        const amount_remaining = order.amountRemaining || 0;
        const delivery_wage = order.deliveryCourierFee || 0;
        const courier_commission = order.profitSaudiSAR || 0;
        const order_total = order.totalCostSAR || 0;
        let currency = order.orderCurrency || 'SAR';

        let amounts = rule.amountSource === 'amount_paid' ? amount_paid
          : rule.amountSource === 'amount_remaining' ? amount_remaining
            : rule.amountSource === 'delivery_wage' ? delivery_wage
              : rule.amountSource === 'courier_commission' ? courier_commission
                : rule.amountSource === 'order_total' ? order_total
                  : rule.amountSource === 'shipping_cost' ? order.shippingCostAmount
                    : rule.amountSource === 'company_profit' ? order.profitCompanySAR
                      : rule.amountSource === 'sourcing_cost' ? order.sourcingCostAmount : 0;

        /*if (order.currency !== order.order_currency) {
          const rate = dbRates[order.order_currency]?.[order.currency] || 1;
          amounts   = amounts * rate;
        }*/
        await financialAccountService.triggerAutomaticVoucher(rule.id, order, {
          courier: context.courier,
          customer: context.customer,
          sourcing_cost: sourcing_cost_courier,
          isAr: context.isAr ?? true,
          rawAmount: amounts,// context.rawAmountOverride,
          amountOriginal: amounts || 0,
          currencyOriginal: currency || 'SAR',
          profileName: context.profileName || 'System Status Automation'
        });

        executedRuleIds.push(rule.id);
      }
    } catch (err) {
      console.error(`[autoEntryService] Error executing auto entries for statusId ${statusId}:`, err);
    }
    return executedRuleIds;
  }
};
