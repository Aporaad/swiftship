/**
 * currencyService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * خدمة العملات — API-only
 *
 * هذا الملف يستهلك HTTP gateway فقط (settingsCurrenciesApiGateway).
 * لا يوجد أي استدعاء مباشر لـ Supabase.
 *
 * المصادر:
 *  - جلب العملات: GET /api/v1/currencies
 *  - إضافة سعر صرف: POST /api/v1/currencies/:id/rates
 *
 * Currency Service — API-only mode
 * All reads/writes go through the HTTP gateway. No Supabase calls.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { settingsCurrenciesApiGateway } from '../data/http/settings-currencies-api.gateway';
import type { ApiCurrencyDto } from '../data/http/settings-currencies-api.gateway';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * بنية العملة كما تُعاد من الـ API
 * Currency structure as returned from API
 */
export interface Currency {
  cur_id: number;
  code: string;
  // أعمدة DB (snake_case)
  main_name_ar: string;
  sub_name_ar: string;
  main_name_en: string;
  sub_name_en: string;
  symbol: string;
  flag: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  // حقول متوافقة مع الكود القديم (camelCase aliases)
  /** @deprecated استخدم main_name_ar */
  main_nameAR?: string;
  /** @deprecated استخدم sub_name_ar */
  sup_nameAR?: string;
  /** @deprecated استخدم main_name_en */
  main_nameEn?: string;
  /** @deprecated استخدم sub_name_en */
  sup_nameEn?: string;
  /** @deprecated استخدم is_default */
  isDefault?: boolean;
  /** @deprecated استخدم is_active */
  isActive?: boolean;
  /** @deprecated استخدم created_at */
  createdAt?: string;
  // معلومات مُحسَّنة من سعر الصرف / enriched from cur_price
  currentPrice?: number;
  lastSeq?: number;
  lastUpdateBy?: string;
  lastUpdateDate?: string;
}

/**
 * بيانات سعر الصرف / Exchange rate entry
 */
export interface CurPriceEntry {
  id: number;
  cur_no: number;
  price: number;
  day_date: string;
  seq: number;
  update_by: string;
  created_at: string;
  /** @deprecated استخدم update_by */
  updateBy?: string;
  /** @deprecated استخدم created_at */
  createdAt?: string;
}

/**
 * خريطة أسعار الصرف:
 * كل عملة → كم وحدة من العملة الأساس تساوي 1 وحدة منها.
 * العملة الأساس (isDefault=true) دائماً = 1.
 *
 * Exchange rate map:
 * Each currency → how many base currency units equal 1 unit of that currency.
 * Default currency (isDefault=true) is always = 1.
 */
export interface ExchangeRates {
  [code: string]: number;
}

// ── تحويل DTO العملة من API إلى بنية Currency
// Map API currency DTO to Currency interface
function mapApiCurrencyToCurrency(c: ApiCurrencyDto): Currency {
  return {
    cur_id: c.currencyId,
    code: c.code,
    main_name_ar: c.mainNameAr || '',
    sub_name_ar: c.subNameAr || '',
    main_name_en: c.mainNameEn || '',
    sub_name_en: c.subNameEn || '',
    symbol: c.symbol || c.code,
    flag: c.flag || '',
    is_default: c.isDefault,
    is_active: c.isActive,
    created_at: c.lastUpdateDate || '',
    // camelCase aliases للتوافق العكسي / backward-compat aliases
    main_nameAR: c.mainNameAr || '',
    sup_nameAR: c.subNameAr || '',
    main_nameEn: c.mainNameEn || '',
    sup_nameEn: c.subNameEn || '',
    isDefault: c.isDefault,
    isActive: c.isActive,
    createdAt: c.lastUpdateDate || '',
    // حقول مُحسَّنة / enriched fields
    currentPrice: c.currentPrice ?? (c.isDefault ? 1 : undefined),
    lastSeq: c.lastSeq ?? undefined,
    lastUpdateBy: c.lastUpdateBy ?? undefined,
    lastUpdateDate: c.lastUpdateDate ?? undefined,
  };
}

// ── الخدمة / Service ──────────────────────────────────────────────────────────

class CurrencyService {
  /**
   * جلب جميع العملات مع آخر سعر صرف لكل منها.
   * Fetch all currencies enriched with latest exchange rate.
   *
   * @param onlyActive - إذا true يُعيد العملات النشطة فقط (true = active currencies only)
   */
  async getAllCurrencies(onlyActive = false): Promise<Currency[]> {
    try {
      const dtos = await settingsCurrenciesApiGateway.listCurrencies(!onlyActive ? false : true);
      return dtos.map(mapApiCurrencyToCurrency);
    } catch (err) {
      console.error('[currencyService] getAllCurrencies error:', err);
      return [];
    }
  }

  /**
   * جلب العملات النشطة فقط.
   * Fetch only active currencies.
   */
  async getActiveCurrencies(): Promise<Currency[]> {
    return this.getAllCurrencies(true);
  }

  /**
   * يُعيد العملة الافتراضية للنظام (is_default = true).
   * Returns the default system currency (is_default = true).
   * إذا لم توجد، يُعيد null.
   */
  async getDefaultCurrency(): Promise<Currency | null> {
    try {
      const currencies = await this.getAllCurrencies(false);
      return currencies.find(c => c.is_default) || null;
    } catch (err) {
      console.error('[currencyService] getDefaultCurrency error:', err);
      return null;
    }
  }

  /**
   * يُعيد خريطة أسعار الصرف من API.
   *
   * المنطق:
   * - العملة ذات is_default=true دائماً = 1 (هي عملة الأساس)
   * - كل عملة أخرى: price = كم وحدة من العملة الأساس تساوي 1 وحدة منها
   *
   * Exchange rate logic:
   * - Default currency always = 1 (base currency)
   * - Other currencies: price = how many base currency units = 1 unit of that currency
   */
  async getLatestExchangeRates(): Promise<ExchangeRates> {
    try {
      const dtos = await settingsCurrenciesApiGateway.listCurrencies(false);
      if (!dtos || dtos.length === 0) {
        console.warn('[currencyService] getLatestExchangeRates: no currencies returned from API');
        return {};
      }

      const rates: ExchangeRates = {};
      dtos.forEach((c: ApiCurrencyDto) => {
        if (c.isDefault) {
          // العملة الأساس = 1 دائماً / Base currency always = 1
          rates[c.code] = 1;
        } else {
          const price = c.currentPrice;
          if (price !== undefined && price !== null && price > 0) {
            rates[c.code] = price;
          } else {
            rates[c.code] = 0;
            console.warn(`⚠️ [تنبيـه أسعـار الصـرف] العملة (${c.code}) لا يوجد لها سعر صرف مسجل! سعرها = 0.`);
          }
        }
      });

      return rates;
    } catch (err) {
      console.error('[currencyService] getLatestExchangeRates error:', err);
      return {};
    }
  }

  /**
   * يُعيد خريطة أسعار الصرف الكاملة — التحويل يتم في convertToTargetCurrency.
   * Returns the full exchange rate map — conversion happens in convertToTargetCurrency.
   */
  async getExchangeRatesFromBetweenTwoCurrencies(
    _fromCurrency: string,
    _toCurrency: string
  ): Promise<ExchangeRates> {
    // نُعيد الخريطة الكاملة — التحويل يتم باستخدام: result = amount * rates[from] / rates[to]
    // Return full map — conversion: result = amount * rates[from] / rates[to]
    return this.getLatestExchangeRates();
  }

  /**
   * إضافة سعر صرف جديد لعملة.
   * Add a new exchange rate entry for a currency.
   */
  async addExchangeRatePrice(
    curNo: number,
    newPrice: number,
    _updatedBy: string
  ): Promise<{ success: boolean; newSeq?: number; error?: string }> {
    try {
      await settingsCurrenciesApiGateway.addCurrencyRate(curNo, newPrice);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[currencyService] addExchangeRatePrice error:', err);
      return { success: false, error: message };
    }
  }

  /**
   * تاريخ أسعار العملة — غير متاح مباشرة عبر API الحالي.
   * Currency rate history — not directly available via current API.
   * يُعيد مصفوفة فارغة ريثما تُضاف نقطة نهاية API لذلك.
   * Returns empty array until a dedicated API endpoint is added.
   */
  async getRateHistory(_curNo: number): Promise<CurPriceEntry[]> {
    console.warn('[currencyService] getRateHistory: endpoint not yet available in API');
    return [];
  }

  /**
   * إضافة عملة جديدة — غير متاح مباشرة عبر API الحالي.
   * Add new currency — not directly available via current API.
   * يُعيد خطأ حتى تُضاف نقطة نهاية CRUD كاملة.
   */
  async addCurrency(
    _data: {
      code: string;
      main_name_ar?: string;
      main_nameAR?: string;
      sub_name_ar?: string;
      sup_nameAR?: string;
      main_name_en?: string;
      main_nameEn?: string;
      sub_name_en?: string;
      sup_nameEn?: string;
      symbol?: string;
      flag?: string;
      isDefault?: boolean;
      is_default?: boolean;
      isActive?: boolean;
      is_active?: boolean;
      initialRate: number;
    },
    _createdBy: string
  ): Promise<{ success: boolean; currency?: Currency; error?: string }> {
    return { success: false, error: 'إضافة العملة تتم عبر واجهة إدارة العملات في API (غير مدعومة حالياً بهذا المسار)' };
  }

  /**
   * تحديث بيانات عملة — غير متاح مباشرة عبر API الحالي.
   * Update currency metadata — not directly available via current API.
   */
  async updateCurrency(
    _curId: number,
    _updates: Partial<Currency>
  ): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'تحديث العملة يتم عبر واجهة إدارة العملات في API (غير مدعومة حالياً بهذا المسار)' };
  }

  /**
   * تفعيل/تعطيل عملة — غير متاح مباشرة عبر API الحالي.
   * Toggle currency active status — not directly available via current API.
   */
  async toggleActive(_curId: number, _isActive: boolean): Promise<{ success: boolean; error?: string }> {
    return this.updateCurrency(_curId, {});
  }

  /**
   * حذف عملة — غير متاح مباشرة عبر API الحالي.
   * Delete currency — not directly available via current API.
   */
  async deleteCurrency(_curId: number): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'حذف العملة يتم عبر واجهة إدارة العملات في API (غير مدعومة حالياً بهذا المسار)' };
  }
}

export const currencyService = new CurrencyService();
export default currencyService;
