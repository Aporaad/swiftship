export function buildDefaultAutomaticVoucherRules(): any[] {
    const defaultRules = [
      {
        id: "order_charge",
        nameAr: "قيد قيمة الطلب على العميل",
        nameEn: "Charge order value to customer",
        isActive: false,
        debitAccount: {
          id: "customer_linked",
          code: "1130",
          name: "حساب العميل المرتبط بالطلب (ديناميكي)",
          type: "dynamic",
        },
        creditAccount: {
          id: "sys_profit_account",
          code: "4000-0001",
          name: "حساب أرباح الشركة (نظامي)",
          type: "system",
        },
        descriptionTempAr: "قيد قيمة الطلب رقم: {orderNumber}",
        descriptionTempEn: "Charge for order: {orderNumber}",
      },
      {
        id: "order_down_payment",
        nameAr: "الدفعة المقدمة للطلب المستلمة نقدًا",
        nameEn: "Order down payment received in cash",
        isActive: true,
        debitAccount: {
          id: "sys_cash_account",
          code: "1111-0",
          name: "حساب الصندوق/الخزينة (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "customer_linked",
          code: "1130",
          name: "حساب العميل المرتبط بالطلب (ديناميكي)",
          type: "dynamic",
        },
        descriptionTempAr: "دفعة مقدمة للطلب رقم: {orderNumber}",
        descriptionTempEn: "Down payment for order: {orderNumber}",
      },
      {
        id: "sourcing_cost_courier",
        nameAr: "تكاليف المنتجات الأصلية المضافة لعهدة المندوب",
        nameEn: "Adding sourcing cost to courier custody",
        isActive: false,
        debitAccount: {
          id: "sys_sourcing_cost",
          code: "5100-4483",
          name: "حساب تكلفة الشراء/السورسينج (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "courier_linked",
          code: "2120",
          name: "حساب المندوب المرتبط بالطلب (ديناميكي)",
          type: "dynamic",
        },
        descriptionTempAr:
          "إضافة تكاليف المنتجات الأصلية والشحن للطلب للمندوب: {orderNumber}",
        descriptionTempEn:
          "Adding sourcing products and shipping cost to courier: {orderNumber}",
      },
      {
        id: "sourcing_cost_system",
        nameAr: "تكلفة شراء منتجات الطلب المدفوعة نقدًا",
        nameEn: "Sourcing products cost paid from cash",
        isActive: false,
        debitAccount: {
          id: "sys_sourcing_cost",
          code: "5100-4483",
          name: "حساب تكلفة الشراء/السورسينج (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "sys_cash_account",
          code: "1111-0",
          name: "حساب الصندوق/الخزينة (نظامي)",
          type: "system",
        },
        descriptionTempAr: "تكلفة شراء منتجات الطلب وشحنه: {orderNumber}",
        descriptionTempEn: "Sourcing products and shipping cost for order: {orderNumber}",
      },
      {
        id: "packaging_fee",
        nameAr: "رسوم التغليف التلقائية",
        nameEn: "Auto packaging fee",
        isActive: false,
        debitAccount: {
          id: "sys_cash_account",
          code: "1111-0",
          name: "حساب الصندوق/الخزينة (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "sys_packaging_fees",
          code: "5100-7355",
          name: "حساب رسوم التغليف (نظامي)",
          type: "system",
        },
        descriptionTempAr: "رسوم تغليف للطلب: {orderNumber}",
        descriptionTempEn: "Packaging fee for order: {orderNumber}",
      },
      {
        id: "international_shipping",
        nameAr: "تكلفة الشحن الدولي للطلب المدفوعة نقدًا",
        nameEn: "International shipping cost paid from cash",
        isActive: false,
        debitAccount: {
          id: "sys_shipping_costs",
          code: "5300-7118",
          name: "حساب تكلفة الشحن (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "sys_cash_account",
          code: "1111-0",
          name: "حساب الصندوق/الخزينة (نظامي)",
          type: "system",
        },
        descriptionTempAr: "تكلفة الشحن الدولي للطلب: {orderNumber}",
        descriptionTempEn:
          "International shipping cost for order: {orderNumber}",
      },
      {
        id: "order_payment",
        nameAr: "دفعة مسددة للطلب نقدًا/تحويل",
        nameEn: "Order payment received",
        isActive: false,
        debitAccount: {
          id: "sys_cash_account",
          code: "1111-0",
          name: "حساب الصندوق/الخزينة (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "customer_linked",
          code: "1130",
          name: "حساب العميل المرتبط بالطلب (ديناميكي)",
          type: "dynamic",
        },
        descriptionTempAr: "دفعة سداد للطلب رقم: {orderNumber}",
        descriptionTempEn: "Payment for order: {orderNumber}",
      },
      {
        id: "delivery_wage",
        nameAr: "أجور التوصيل التلقائية للمندوب",
        nameEn: "Auto-wage for courier delivery",
        isActive: false,
        debitAccount: {
          id: "sys_delivery_cost",
          code: "5000-2788",
          name: "حساب مصروفات التوصيل (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "courier_linked",
          code: "2120",
          name: "حساب المندوب المرتبط بالشحنة (ديناميكي)",
          type: "dynamic",
        },
        descriptionTempAr: "أجور توصيل تلقائية لتسليم الطلب رقم: {orderNumber}",
        descriptionTempEn: "Auto-wage for delivery of order: {orderNumber}",
      },
      {
        id: "custody_payment",
        nameAr: "العهدة وتصفية دفعة العميل التلقائية",
        nameEn: "Auto-custody and payment settlement",
        isActive: false,
        debitAccount: {
          id: "courier_linked",
          code: "2120",
          name: "حساب المندوب المرتبط بالشحنة (ديناميكي)",
          type: "dynamic",
        },
        creditAccount: {
          id: "customer_linked",
          code: "1130",
          name: "حساب العميل المرتبط بالشحنة (ديناميكي)",
          type: "dynamic",
        },
        descriptionTempAr:
          "عهدة تلقائية مرحلة من تسليم الطلب رقم: {orderNumber}",
        descriptionTempEn:
          "Auto-custody generated from delivery of order: {orderNumber}",
      },
      {
        id: "courier_commission",
        nameAr: "عمولة الشحن التلقائية للوكلاء/المناديب",
        nameEn: "Auto shipping courier commission",
        isActive: false,
        debitAccount: {
          id: "sys_sourcing_cost",
          code: "5100-4483",
          name: "حساب تكلفة الشحن والعمولات (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "courier_linked",
          code: "2120",
          name: "حساب المندوب المرتبط بالشحنة (ديناميكي)",
          type: "dynamic",
        },
        descriptionTempAr: "عمولة شحن تلقائية للطلب رقم: {orderNumber}",
        descriptionTempEn: "Auto-commission for order: {orderNumber}",
      },
      {
        id: "company_profit",
        nameAr: "صافي أرباح الشركة للطلب التلقائي",
        nameEn: "Company net profit",
        isActive: false,
        debitAccount: {
          id: "sys_cash_account",
          code: "1111-0",
          name: "حساب الصندوق/الخزينة (نظامي)",
          type: "system",
        },
        creditAccount: {
          id: "sys_profit_account",
          code: "4000-0001",
          name: "حساب أرباح الشركة (نظامي)",
          type: "system",
        },
        descriptionTempAr: "صافي أرباح الشركة للطلب: {orderNumber}",
        descriptionTempEn: "Company profit for order: {orderNumber}",
      },
    ];
    const normalizedDefaultRules = defaultRules.map((rule) => {
      const normalizeAccount = (account: any) => account?.type === 'system'
        ? { ...account, defaultKey: account.defaultKey || account.id, code: '' }
        : account;
      return {
        ...rule,
        debitAccount: normalizeAccount(rule.debitAccount),
        creditAccount: normalizeAccount(rule.creditAccount),
      };
    });
  return normalizedDefaultRules;
}
