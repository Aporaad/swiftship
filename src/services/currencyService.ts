/**
 * currencyService
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the `currency` and `cur_price` Supabase tables.
 *
 * Schema (snake_case - actual DB columns):
 *  currency(cur_id, code, main_name_ar, sub_name_ar, main_name_en, sub_name_en,
 *            symbol, flag, is_default, is_active, created_at)
 *  cur_price(id, cur_no, price, day_date, seq, update_by, created_at)
 *
 * Exchange rate logic:
 *  الأسعار في cur_price تُعبّر دائماً عن: كم وحدة من العملة الأساس (is_default=true)
 *  تساوي 1 وحدة من العملة المذكورة.
 *  العملة الأساس دائماً = 1 (لا سعر لها في cur_price أو سعرها = 1).
 *  لتحويل من عملة A إلى عملة B:
 *    rate_A_vs_base = rates[A]  (كم وحدة أساس لكل وحدة A)
 *    rate_B_vs_base = rates[B]  (كم وحدة أساس لكل وحدة B)
 *    result = amount * rate_A_vs_base / rate_B_vs_base
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '../lib/supabase-adapter';
import { SELECT_FIELDS } from '../data/contracts/select-fields';

// ── Types ─────────────────────────────────────────────────────────────────────

/** بنية العملة المطابقة لأعمدة جدول currency (snake_case) */
export interface Currency {
  cur_id: number;
  code: string;
  // DB columns (snake_case)
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
  // enriched from cur_price
  currentPrice?: number;
  lastSeq?: number;
  lastUpdateBy?: string;
  lastUpdateDate?: string;
}

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
 * خريطة أسعار الصرف: كل عملة → كم وحدة من العملة الأساس تساوي 1 وحدة منها.
 * العملة الأساس (isDefault=true) دائماً = 1.
 * لا يوجد أي كود عملة مثبّت هنا — يُبنى ديناميكياً من جداول currency + cur_price.
 */
export interface ExchangeRates {
  /** كل مفتاح = رمز العملة (مثل "YER", "SAR", "USD", "EUR", ...) */
  [code: string]: number;
}

/**
 * أسعار احتياطية مؤقتة تُستخدم فقط في حالة فشل الاتصال بقاعدة البيانات.
 * لا تعتمد عليها في أي منطق حسابي — استخدمها فقط كـ fallback للعرض.
 * قيمة كل عملة = كم وحدة YER تساوي 1 وحدة منها (افتراض أن YER هي الأساس).
 */
export const DEFAULT_RATES: ExchangeRates = { YER: 1, SAR: 140, USD: 535 };

// ── Service ───────────────────────────────────────────────────────────────────

class CurrencyService {
  /**
   * Returns all currencies, enriched with the latest exchange-rate entry.
   * Only active currencies are returned when `onlyActive = true` (default).
   */
/**
   * دالة مساعدة: تحويل سجل DB (snake_case) إلى بنية Currency مع aliases للتوافق العكسي
   * Helper: map DB row (snake_case) to Currency interface with backward-compat aliases
   */
  private mapRow(row: any): Currency {
    return {
      ...row,
      // aliases للتوافق مع الكود القديم
      main_nameAR: row.main_name_ar ?? row.main_nameAR ?? '',
      sup_nameAR: row.sub_name_ar ?? row.sup_nameAR ?? '',
      main_nameEn: row.main_name_en ?? row.main_nameEn ?? '',
      sup_nameEn: row.sub_name_en ?? row.sup_nameEn ?? '',
      isDefault: row.is_default ?? row.isDefault ?? false,
      isActive: row.is_active ?? row.isActive ?? true,
      createdAt: row.created_at ?? row.createdAt ?? '',
      // الأعمدة الأصلية snake_case
      main_name_ar: row.main_name_ar ?? row.main_nameAR ?? '',
      sub_name_ar: row.sub_name_ar ?? row.sup_nameAR ?? '',
      main_name_en: row.main_name_en ?? row.main_nameEn ?? '',
      sub_name_en: row.sub_name_en ?? row.sup_nameEn ?? '',
      is_default: row.is_default ?? row.isDefault ?? false,
      is_active: row.is_active ?? row.isActive ?? true,
      created_at: row.created_at ?? row.createdAt ?? '',
    };
  }

  /**
   * Returns all currencies, enriched with the latest exchange-rate entry.
   * Only active currencies are returned when `onlyActive = true` (default).
   */
  async getAllCurrencies(onlyActive = false): Promise<Currency[]> {
    let q = (supabase as any).from('currency').select(SELECT_FIELDS.currency).order('cur_id');
    // استخدام snake_case للفلترة كما هو في قاعدة البيانات
    // Use snake_case filter as per actual DB schema
    if (onlyActive) q = q.eq('is_active', true);

    const { data: currencies, error } = await q;
    if (error) {
      console.error('[currencyService] getAllCurrencies error:', error);
      return [];
    }

    // Enrich each currency with its latest price from cur_price
    const { data: prices } = await (supabase as any)
      .from('cur_price')
      .select(SELECT_FIELDS.currencyRate)
      .order('seq', { ascending: false });

    const latestByCode: Record<number, CurPriceEntry> = {};
    (prices || []).forEach((p: any) => {
      if (!latestByCode[p.cur_no]) latestByCode[p.cur_no] = p;
    });

    return (currencies || []).map((c: any) => ({
      ...this.mapRow(c),
      currentPrice: latestByCode[c.cur_id]?.price ?? (c.is_default || c.isDefault ? 1 : undefined),
      lastSeq: latestByCode[c.cur_id]?.seq,
      lastUpdateBy: latestByCode[c.cur_id]?.update_by || latestByCode[c.cur_id]?.updateBy,
      lastUpdateDate: latestByCode[c.cur_id]?.day_date,
    }));
  }

  /**
   * Returns only ACTIVE currencies enriched with rates.
   */
  async getActiveCurrencies(): Promise<Currency[]> {
    return this.getAllCurrencies(true);
  }

  /**
   * يُعيد العملة الافتراضية للنظام (is_default = true) من جدول currency.
   * إذا لم توجد، يُعيد null.
   */
  async getDefaultCurrency(): Promise<Currency | null> {
    try {
      const { data, error } = await (supabase as any)
        .from('currency')
        .select(SELECT_FIELDS.currency)
        // استخدام اسم العمود الصحيح في DB
        // Use the correct snake_case column name
        .eq('is_default', true)
        .limit(1)
        .single();
      if (error || !data) return null;
      return this.mapRow(data) as Currency;
    } catch (e) {
      console.error('[currencyService] getDefaultCurrency error:', e);
      return null;
    }
  }

  /**
   * Fetches the latest exchange-rate map from the database.
   *
   * المنطق:
   * - العملة ذات is_default=true دائماً = 1 (هي عملة الأساس)
   * - كل عملة أخرى: price = كم وحدة من العملة الأساس تساوي 1 وحدة منها
   * - لا توجد أي أسعار ثابتة — كل شيء يأتي من جدول cur_price
   */
  async getLatestExchangeRates(): Promise<ExchangeRates> {
    try {
      // استخدام أسماء الأعمدة الصحيحة (snake_case)
      // Use correct snake_case column names as in the actual DB schema
      const { data: currencies, error: curErr } = await (supabase as any)
        .from('currency')
        .select('cur_id, code, is_default, is_active');

      if (curErr || !currencies || currencies.length === 0) {
        console.warn('[currencyService] getLatestExchangeRates: no currencies found, using DEFAULT_RATES as emergency fallback');
        return { ...DEFAULT_RATES };
      }

      // جلب آخر سعر لكل عملة (الصف ذو أعلى seq)
      const { data: prices } = await (supabase as any)
        .from('cur_price')
        .select('cur_no, price, seq')
        .order('seq', { ascending: false });

      const latestPrice: Record<number, number> = {};
      (prices || []).forEach((p: { cur_no: number; price: number; seq: number }) => {
        if (latestPrice[p.cur_no] === undefined) {
          latestPrice[p.cur_no] = parseFloat(p.price as any) || 0;
        }
      });

      // بناء خريطة الأسعار ديناميكياً من DB
      const rates: ExchangeRates = {};
      currencies.forEach((c: { cur_id: number; code: string; is_default: boolean; is_active: boolean }) => {
        if (c.is_default) {
          // العملة الأساس دائماً = 1
          rates[c.code] = 1;
        } else {
          const price = latestPrice[c.cur_id];
          if (price !== undefined && price > 0) {
            rates[c.code] = price;
          } else {
            rates[c.code] = 0;
            console.warn(`⚠️ [تنبيـه أسعـار الصـرف] العملة (${c.code}) لا يوجد لها سعر صرف مسجل في جدول cur_price! تم تعيين سعرها إلى 0.`);
          }
        }
      });

      return rates;
    } catch (e) {
      console.error('[currencyService] getLatestExchangeRates error:', e);
      return { ...DEFAULT_RATES };
    }
  }

  /**
   * يحسب نسبة التحويل المباشر بين عملتين باستخدام العملة الأساس كوسيط.
   *
   * المعادلة:
   *   إذا كانت رات الأسعار تُعبّر عن "كم وحدة أساس = 1 وحدة من العملة X":
   *   تحويل A → B = amount * rates[A] / rates[B]
   *
   * @returns الخريطة الكاملة للأسعار (نفس getLatestExchangeRates)
   *          استخدمها مع convertToTargetCurrency في financialAccountService
   */
  async getExchangeRatesFromBetweenTwoCurrencies(_fromCurrency: string, _toCurrency: string): Promise<ExchangeRates> {
    // المنطق الصحيح: نُعيد الخريطة الكاملة — التحويل يتم في convertToTargetCurrency
    // باستخدام: result = amount * rates[from] / rates[to]
    // لا نحتاج بناء خريطة خاصة لكل زوج — الخريطة الكاملة تكفي
    return this.getLatestExchangeRates();
  }


  /**
   * Adds a new exchange-rate entry for a currency (creates a new row with seq+1).
   * Preserves history — never updates existing rows.
   */
  async addExchangeRatePrice(
    curNo: number,
    newPrice: number,
    updatedBy: string
  ): Promise<{ success: boolean; newSeq?: number; error?: string }> {
    try {
      // Find max seq for this currency
      const { data: latest } = await (supabase as any)
        .from('cur_price')
        .select('seq')
        .eq('cur_no', curNo)
        .order('seq', { ascending: false })
        .limit(1)
        .single();

      const nextSeq = (latest?.seq ?? 0) + 1;

      const { data, error } = await (supabase as any)
        .from('cur_price')
        .insert({
          cur_no: curNo,
          price: newPrice,
          day_date: new Date().toISOString(),
          seq: nextSeq,
          // استخدام اسم العمود الصحيح في DB
          // Use the correct snake_case column name
          update_by: updatedBy || 'user',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[currencyService] addExchangeRatePrice error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, newSeq: data?.seq };
    } catch (e: any) {
      console.error('[currencyService] addExchangeRatePrice exception:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Returns the full price history for a specific currency, ordered by seq ascending.
   */
  async getRateHistory(curNo: number): Promise<CurPriceEntry[]> {
    const { data, error } = await (supabase as any)
      .from('cur_price')
      .select(SELECT_FIELDS.currencyRate)
      .eq('cur_no', curNo)
      .order('seq', { ascending: true });

    if (error) {
      console.error('[currencyService] getRateHistory error:', error);
      return [];
    }
    return data || [];
  }

  /**
   * Adds a brand new currency to the `currency` table with an initial rate entry.
   */
  async addCurrency(
    data: {
      code: string;
      main_nameAR?: string;
      main_name_ar?: string;
      sup_nameAR?: string;
      sub_name_ar?: string;
      main_nameEn?: string;
      main_name_en?: string;
      sup_nameEn?: string;
      sub_name_en?: string;
      symbol?: string;
      flag?: string;
      isDefault?: boolean;
      is_default?: boolean;
      isActive?: boolean;
      is_active?: boolean;
      initialRate: number;
    },
    createdBy: string
  ): Promise<{ success: boolean; currency?: Currency; error?: string }> {
    try {
      // Find max cur_id to ensure a valid cur_id if default sequence is not returned
      const { data: maxCur } = await (supabase as any)
        .from('currency')
        .select('cur_id')
        .order('cur_id', { ascending: false })
        .limit(1)
        .single();

      const nextCurId = ((maxCur?.cur_id as number) || 0) + 1;

      // استخدام أسماء الأعمدة الصحيحة (snake_case) كما هي في قاعدة البيانات
      // Use correct snake_case column names matching the actual DB schema
      const payload: any = {
        cur_id: nextCurId,
        code: data.code.toUpperCase(),
        main_name_ar: data.main_name_ar || data.main_nameAR || '',
        sub_name_ar: data.sub_name_ar || data.sup_nameAR || '',
        main_name_en: data.main_name_en || data.main_nameEn || data.code.toUpperCase(),
        sub_name_en: data.sub_name_en || data.sup_nameEn || '',
        symbol: data.symbol || data.code,
        flag: data.flag || '',
        is_default: data.is_default ?? data.isDefault ?? false,
        is_active: data.is_active ?? data.isActive ?? true,
      };

      const { data: cur, error: curErr } = await (supabase as any)
        .from('currency')
        .insert(payload)
        .select()
        .single();

      if (curErr) {
        console.error('[currencyService] addCurrency error:', curErr);
        return { success: false, error: curErr.message };
      }

      // Add the first rate entry in cur_price
      if (cur && cur.cur_id) {
        await this.addExchangeRatePrice(cur.cur_id, data.initialRate, createdBy);
      }

      return { success: true, currency: cur ? this.mapRow(cur) : undefined };
    } catch (e: any) {
      console.error('[currencyService] addCurrency exception:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Updates currency metadata (name, symbol, is_default, is_active, etc.)
   * Does NOT update the exchange rate — use addExchangeRatePrice for that.
   */
  async updateCurrency(
    curId: number,
    updates: Partial<Omit<Currency, 'cur_id' | 'created_at' | 'createdAt' | 'currentPrice' | 'lastSeq' | 'lastUpdateBy' | 'lastUpdateDate'>>
  ): Promise<{ success: boolean; error?: string }> {
    // تحويل أي حقول camelCase إلى snake_case قبل الإرسال لقاعدة البيانات
    // Map any camelCase fields to snake_case before sending to DB
    const dbUpdates: any = { ...updates };
    if ('isDefault' in dbUpdates) { dbUpdates.is_default = dbUpdates.isDefault; delete dbUpdates.isDefault; }
    if ('isActive' in dbUpdates) { dbUpdates.is_active = dbUpdates.isActive; delete dbUpdates.isActive; }
    if ('main_nameAR' in dbUpdates) { dbUpdates.main_name_ar = dbUpdates.main_nameAR; delete dbUpdates.main_nameAR; }
    if ('sup_nameAR' in dbUpdates) { dbUpdates.sub_name_ar = dbUpdates.sup_nameAR; delete dbUpdates.sup_nameAR; }
    if ('main_nameEn' in dbUpdates) { dbUpdates.main_name_en = dbUpdates.main_nameEn; delete dbUpdates.main_nameEn; }
    if ('sup_nameEn' in dbUpdates) { dbUpdates.sub_name_en = dbUpdates.sup_nameEn; delete dbUpdates.sup_nameEn; }
    if ('createdAt' in dbUpdates) { delete dbUpdates.createdAt; }
    if ('created_at' in dbUpdates) { delete dbUpdates.created_at; }

    const { error } = await (supabase as any)
      .from('currency')
      .update(dbUpdates)
      .eq('cur_id', curId);

    if (error) {
      console.error('[currencyService] updateCurrency error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  /**
   * Toggles is_active flag for a currency.
   * Disabling a currency means it won't be usable in orders/vouchers.
   */
  async toggleActive(curId: number, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    return this.updateCurrency(curId, { is_active: isActive });
  }

  /**
   * Deletes a currency (and all its rate history via CASCADE).
   * Will fail if the currency is referenced elsewhere with ON DELETE RESTRICT.
   */
  async deleteCurrency(curId: number): Promise<{ success: boolean; error?: string }> {
    const { error } = await (supabase as any)
      .from('currency')
      .delete()
      .eq('cur_id', curId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }
}

export const currencyService = new CurrencyService();
export default currencyService;
