export type AccountEntityType = "customer" | "courier" | "employee" | "source" | "shipping_company" | "asset" | "system";

export interface FinancialAccount {
  id?: string;
  accountCode: string; // e.g. '1130-0001'
  accountPrefix: string; // e.g. '1130'
  accountNumber: string; // e.g. '0001'
  entityType: AccountEntityType;
  entityId: string; // PostgreSQL document ID of customer/courier/employee
  entityName: string; // Display name
  currency: string; // Default currency from settings
  balance: number; // Current balance in default currency
  debitTotal: number; // Total debits
  creditTotal: number; // Total credits
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  notes?: string;
  monthlySalary?: number; // Default monthly salary (for employees)
  type?: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  parentCode?: string;
  accSubId?: string;
  groupId?: string;
  accountSeq?: number;
  accNameAr?: string;
  accNameEn?: string;
  limitedBalance?: number;
  curNo?: number;
  lastRecalculatedAt?: number | string;
}

export interface AccountTransaction {
  id?: string;
  accountId: string; // Financial account ID
  accountCode: string; // Account code for display
  entityType: AccountEntityType;
  entityId: string;
  entityName: string;
  type: "Debit" | "Credit";
  amount: number; // Amount in target account currency
  currency: string; // Account currency (YER, USD, SAR)
  curNo?: number; // Reference to currency.cur_id
  amountOriginal: number; // Amount in original voucher currency
  currencyOriginal: string; // Original voucher currency
  description: string; // Transaction description
  refNumber: string; // Reference number (expense/order/adjustment)
  module://مهم:يجب اضافه العديد من التصنيفات
  | "expense"
  | "order"
  | "adjustment"
  | "custody"
  | "payment"
  | "salary"
  | string;
  salaryMonth?: string; // e.g. '2026-06' for salary payments
  createdAt: number;
  createdByUid?: string;
  createdByName?: string;
  mainEntryId?: string;
  mainEntryNumber?: string;
  orderId?: string;
  orderNumber?: string;
  shipmentId?: string;
  automationKey?: string;
  autoRuleId?: string;
}

export interface JournalEntry {
  id?: string;
  entryNumber: string; // رقم القيد (reference sequence)
  createdAt: number; // التاريخ (timestamp)
  description: string; // البيان
  attachments?: string[]; // المستندات الداعمة
  notes?: string; // ملاحظة أخرى

  // الطرف المدين (3 حقول: الاسم، الكود، المعرف)
  debitAccountId: string;
  debitAccountName: string;
  debitAccountCode: string;

  // الطرف الدائن (3 حقول: الاسم، الكود، المعرف)
  creditAccountId: string;
  creditAccountName: string;
  creditAccountCode: string;

  amount: number; // المبلغ الأصلي
  currency: string; // العملة الأصلية
  curNo?: number; // Reference to currency.cur_id
  amountDebitCurrency: number; // المبلغ بعملة المدين
  amountCreditCurrency: number; // المبلغ بعملة الدائن

  module: string; // فئة القيد (طلبات / مصروفات / قيد يومي / إلخ)
  refNumber: string; // المعني من الفئة (رقم الطلب / نوع المصروف / إلخ)
  orderId?: string;
  orderNumber?: string;
  shipmentId?: string;
  automationKey?: string;
  autoRuleId?: string;
  statusId?: number;
  isAutomatic?: boolean;
  amountSources?: string[];
  amountBreakdown?: Array<{ source: string; amount: number; currency: string; convertedAmount: number }>;
  /** حالة الترحيل: 'posted' فوري، 'draft' مسودة — Posting status: posted=immediate, draft=unposted */
  postingStatus?: 'posted' | 'draft';

  createdByUid: string; // المعرف للمستخدم المدخل للعملية
  createdByName: string; // الاسم للمستخدم المدخل للعملية
}

export interface AutomaticVoucherEntities {
  courier?: any;
  deliveryCourier?: any;
  shippingCourier?: any;
  customer?: any;
  orderParty?: any;
  purchaseSource?: any;
  shippingCompany?: any;
  sourcing_cost?: any;
  isAr?: boolean;
  rawAmount?: number;
  amountOriginal?: number;
  currencyOriginal?: string;
  expenseNumber?: string;
  profileName?: string;
  statusId?: number | string;
  automationKey?: string;
  autoRuleId?: string;
  amountSources?: string[];
  amountBreakdown?: any[];
  /** تجاوز اختياري للحساب المدين (مثل حساب الصندوق/البنك الذي اختاره المستخدم في نموذج إنشاء الطلب) */
  debitAccountOverride?: { id: string; code?: string; name?: string };
  /**
   * ترحيل القيد فوراً أم حفظه كمسودة غير مرحّلة
   * Auto post the entry immediately (posted) or save as draft (draft).
   * Defaults to true if not provided.
   */
  autoPost?: boolean;
}

// Account prefix ranges per entity type
// Customer accounts are ASSETS (owed to us)    → 1130
// Courier accounts are LIABILITIES (we owe or they hold custody) → 2120
// Employee accounts are LIABILITIES (salary obligations) → 2130
// Order sources are LIABILITIES (supplier payables) → 2140
// Shipping companies are LIABILITIES (carrier payables) → 2150
// Assets are ASSETS; a category-specific prefix can override the default 1200.
// System utility accounts                         → varies, default 5000
/** توافق مرحلي للحسابات التي سبقت زرع الشجرة فقط؛ لا يستعمل عند جاهزية الشجرة. */
export const LEGACY_ACCOUNT_PREFIXES: Record<AccountEntityType, string> = {
  customer: "1130",
  courier: "2120",
  employee: "2130",
  source: "2140",
  shipping_company: "2150",
  asset: "1240",
  system: "5000",
};
