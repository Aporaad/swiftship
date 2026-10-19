import type { EntityId, NumericEntityId } from './identifiers';

/**
 * Canonical read contracts shared by finance feature UI boundaries.
 * These are view contracts, not database rows and not write payloads.
 */
export interface FinanceAccount {
  id: EntityId;
  nameAr: string;
  nameEn?: string;
  curNo: NumericEntityId;
  currencyCode: string;
  isActive: boolean;
  isPosting: boolean;
  accSubId?: EntityId;
  entityId?: EntityId;
  entityType?: string;
  entityName?: string;
  balance?: number;
}

/** عملة قراءة لمكوّنات المالية: الاسم والرمز والعلم وحالة التفعيل تلزم قائمة الاختيار الموحّدة.
 *  Currency read for finance UI: name, symbol, flag and active state feed the shared currency picker. */
export interface FinanceCurrency {
  id: NumericEntityId;
  code: string;
  isDefault?: boolean;
  isActive?: boolean;
  nameAr?: string;
  nameEn?: string;
  symbol?: string;
  flag?: string;
}

/** أي شكل تصل عليه العملة من الخدمات أو الـ API (snake_case و camelCase معًا).
 *  Any currency record shape returned by the services or the API. */
export interface FinanceCurrencySource {
  id?: string | number;
  cur_id?: string | number;
  currencyId?: string | number;
  curId?: string | number;
  code?: string | null;
  nameAr?: string | null;
  main_name_ar?: string | null;
  main_nameAR?: string | null;
  mainNameAr?: string | null;
  nameEn?: string | null;
  main_name_en?: string | null;
  mainNameEn?: string | null;
  symbol?: string | null;
  flag?: string | null;
  isDefault?: boolean;
  is_default?: boolean;
  isActive?: boolean;
  is_active?: boolean;
}

const firstText = (...values: (string | null | undefined)[]): string | undefined =>
  values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();

/** موضع واحد يبني قراءة العملة: الأسماء والرمز والعلم وحالة التفعيل، فلا تخترع كل شاشة شكلها.
 *  One place builds the currency read — names, symbol, flag, active state — instead of per-screen mappings. */
export function toFinanceCurrency(value: unknown): FinanceCurrency {
  const currency = (value ?? {}) as FinanceCurrencySource;
  return {
    id: Number(currency.cur_id ?? currency.currencyId ?? currency.curId ?? currency.id ?? 0),
    code: firstText(currency.code) || '',
    isDefault: (currency.isDefault ?? currency.is_default) === true,
    // غياب الحقل يعني نشطة: إسقاط عملات قاعدةٍ ما لم تُعيّن حالتها يترك القوائم فارغة.
    // A missing flag means active: dropping unflagged currencies would empty the pickers.
    isActive: (currency.isActive ?? currency.is_active ?? true) !== false,
    nameAr: firstText(currency.nameAr, currency.main_name_ar, currency.main_nameAR, currency.mainNameAr),
    nameEn: firstText(currency.nameEn, currency.main_name_en, currency.mainNameEn),
    symbol: firstText(currency.symbol),
    flag: firstText(currency.flag),
  };
}

export const toFinanceCurrencies = (values: readonly unknown[]): FinanceCurrency[] =>
  values.map(toFinanceCurrency).filter((currency) => currency.code.length > 0);

export interface FinanceModule {
  id: EntityId;
  code: string;
  nameAr: string;
  isActive?: boolean;
}

export interface FinanceEntryType {
  id: EntityId;
  moduleId: EntityId;
  code: string;
  nameAr: string;
  isActive?: boolean;
}
