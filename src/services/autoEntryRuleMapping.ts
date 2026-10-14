/**
 * autoEntryRuleMapping.ts
 * خرائط نقية لقواعد القيود التلقائية بين شكل alx_api وشكل النظام — بلا أي اعتماد على الخدمات.
 * Pure mapping between the alx_api auto-entry rule row and the system rule shape.
 *
 * لماذا وحدة مستقلة؟ لأن financialAccountAutomation يحتاج قراءة قاعدة واحدة عبر API
 * ولا يجوز أن يستورد autoEntryService (الذي يستورد financialAccountService) فينشأ دورة استيراد.
 * Kept separate so the automation can map a rule without importing the service layer (no import cycle).
 */
import {
  AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS,
  type AutoEntryAmountSource,
  getRuleAmountSources,
  normalizeOptionalAutoEntryCurrency,
} from './autoEntryRules';

export interface AutoEntryRuleAccount {
  /** معرف الحساب النظامي أو 'courier_linked' | 'customer_linked' | 'payment_account_linked' */
  id: string;
  code: string;
  name: string;
  type: 'system' | 'dynamic';
  defaultKey?: string;
}

export interface AutoEntryRule {
  id: string;
  statusId: number;         // رقم المرحلة والمرتبطة بـ order_status.id
  statusNameAr?: string;    // اسم المرحلة بالعربي للعرض السريع
  nameAr: string;           // اسم القيد بالعربي
  nameEn: string;           // اسم القيد بالإنجليزي
  isActive: boolean;
  debitAccount: AutoEntryRuleAccount;
  creditAccount: AutoEntryRuleAccount;
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

/** صف القاعدة كما يعيده API — rule row as returned by alx_api. */
export interface AutoEntryRuleRow {
  autoEntryId: string;
  statusId?: number | null;
  statusNameAr?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  isActive?: boolean | null;
  amountSource?: string | null;
  amountSources?: string[] | null;
  amountStrategy?: string | null;
  currency?: string | null;
  currencyNo?: number | null;
  skipWhenZero?: boolean | null;
  autoPost?: boolean | null;
  debitAccount?: string | null;
  creditAccount?: string | null;
  descriptionTemplateAr?: string | null;
  descriptionTemplateEn?: string | null;
  createdAt?: number | string | null;
}

const EMPTY_ACCOUNT: AutoEntryRuleAccount = { id: '', code: '', name: '', type: 'dynamic' };

// الطرفان (مدين/دائن) عمودا نص في auto_entries؛ نحمل الكائن كـ JSON ونفكه عند القراءة.
// debit/credit are text columns; we carry the account object as JSON and parse it back on read.
export function serializeAccount(account: AutoEntryRuleAccount): string {
  return JSON.stringify(account ?? EMPTY_ACCOUNT);
}

export function parseAccount(value: string | null | undefined): AutoEntryRuleAccount {
  if (!value) return { ...EMPTY_ACCOUNT };
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed as AutoEntryRuleAccount;
  } catch {
    // قيمة نصية قديمة — legacy plain-text value.
  }
  return { id: value, code: '', name: value, type: 'dynamic' };
}

export function fromApiRow(row: AutoEntryRuleRow): AutoEntryRule {
  const amountSources = (row.amountSources ?? []) as AutoEntryAmountSource[];
  return {
    id: row.autoEntryId,
    statusId: Number(row.statusId ?? 0),
    statusNameAr: row.statusNameAr ?? undefined,
    nameAr: row.nameAr ?? '',
    nameEn: row.nameEn ?? '',
    isActive: row.isActive !== false,
    debitAccount: parseAccount(row.debitAccount),
    creditAccount: parseAccount(row.creditAccount),
    amountSource: (row.amountSource ?? amountSources[0]) as AutoEntryAmountSource | undefined,
    amountSources: amountSources.length > 0 ? amountSources : undefined,
    amountStrategy: (row.amountStrategy as 'sum' | undefined) ?? undefined,
    currency: row.currency ?? undefined,
    skipWhenZero: row.skipWhenZero !== false,
    descriptionTempAr: row.descriptionTemplateAr ?? '',
    descriptionTempEn: row.descriptionTemplateEn ?? '',
    autoPost: row.autoPost !== false,
  };
}

export function toApiPayload(rule: AutoEntryRule) {
  const normalizedCurrency = normalizeOptionalAutoEntryCurrency(rule.currency);
  const amountSources = getRuleAmountSources(rule);
  return {
    statusId: rule.statusId > 0 ? rule.statusId : undefined,
    statusNameAr: rule.statusNameAr,
    nameAr: rule.nameAr,
    nameEn: rule.nameEn || rule.nameAr,
    isActive: rule.isActive !== false,
    amountSource: rule.amountSource ?? amountSources[0] ?? (AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS[0].id as AutoEntryAmountSource),
    amountSources: amountSources.length > 0 ? amountSources : [rule.amountSource ?? (AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS[0].id as AutoEntryAmountSource)],
    amountStrategy: 'sum' as const,
    // PATCH يستبدل الصف كاملًا؛ غياب currency يعني مسحها (سلوك الاستبدال القديم نفسه).
    // PATCH replaces the whole row; omitting currency clears it (same as the legacy replace).
    ...(normalizedCurrency ? { currency: normalizedCurrency } : {}),
    skipWhenZero: rule.skipWhenZero !== false,
    autoPost: rule.autoPost !== false,
    debitAccount: serializeAccount(rule.debitAccount),
    creditAccount: serializeAccount(rule.creditAccount),
    descriptionTemplateAr: rule.descriptionTempAr || rule.nameAr,
    descriptionTemplateEn: rule.descriptionTempEn || rule.nameEn || rule.nameAr,
  };
}
