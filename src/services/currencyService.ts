/**
 * currencyService
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the `currency` and `cur_price` Supabase tables.
 *
 * Schema:
 *  currency(cur_id, code, main_nameAR, sup_nameAR, main_nameEn, sup_nameEn,
 *            symbol, flag, isDefault, isActive, createdAt)
 *  cur_price(id, cur_no, price, day_date, seq, updateBy, createdAt)
 *
 * Exchange rate logic:
 *  الأسعار في cur_price تُعبّر دائماً عن: كم وحدة من العملة الأساس (isDefault=true)
 *  تساوي 1 وحدة من العملة المذكورة.
 *  العملة الأساس دائماً = 1 (لا سعر لها في cur_price أو سعرها = 1).
 *  لتحويل من عملة A إلى عملة B:
 *    rate_A_vs_base = rates[A]  (كم وحدة أساس لكل وحدة A)
 *    rate_B_vs_base = rates[B]  (كم وحدة أساس لكل وحدة B)
 *    result = amount * rate_A_vs_base / rate_B_vs_base
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '../lib/supabase-firebase-adapter';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Currency {
  cur_id: number;
  code: string;
  main_nameAR: string;
  sup_nameAR: string;
  main_nameEn: string;
  sup_nameEn: string;
  symbol: string;
  flag: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
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
  updateBy: string;
  createdAt: string;
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
  async getAllCurrencies(onlyActive = false): Promise<Currency[]> {
    let q = (supabase as any).from('currency').select('*').order('cur_id');
    if (onlyActive) q = q.eq('isActive', true);

    const { data: currencies, error } = await q;
    if (error) {
      console.error('[currencyService] getAllCurrencies error:', error);
      return [];
    }

    // Enrich each currency with its latest price from cur_price
    const { data: prices } = await (supabase as any)
      .from('cur_price')
      .select('*')
      .order('seq', { ascending: false });

    const latestByCode: Record<number, CurPriceEntry> = {};
    (prices || []).forEach((p: CurPriceEntry) => {
      if (!latestByCode[p.cur_no]) latestByCode[p.cur_no] = p;
    });

    return (currencies || []).map((c: Currency) => ({
      ...c,
      currentPrice: latestByCode[c.cur_id]?.price ?? (c.isDefault ? 1 : undefined),
      lastSeq: latestByCode[c.cur_id]?.seq,
      lastUpdateBy: latestByCode[c.cur_id]?.updateBy,
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
   * يُعيد العملة الافتراضية للنظام (isDefault = true) من جدول currency.
   * إذا لم توجد، يُعيد null.
   */
  async getDefaultCurrency(): Promise<Currency | null> {
    try {
      const { data, error } = await (supabase as any)
        .from('currency')
        .select('*')
        .eq('isDefault', true)
        .limit(1)
        .single();
      if (error || !data) return null;
      return data as Currency;
    } catch (e) {
      console.error('[currencyService] getDefaultCurrency error:', e);
      return null;
    }
  }

  /**
   * Fetches the latest exchange-rate map from the database.
   *
   * المنطق:
   * - العملة ذات isDefault=true دائماً = 1 (هي عملة الأساس)
   * - كل عملة أخرى: price = كم وحدة من العملة الأساس تساوي 1 وحدة منها
   * - لا توجد أي أسعار ثابتة — كل شيء يأتي من جدول cur_price
   */
  async getLatestExchangeRates(): Promise<ExchangeRates> {
    try {
      const { data: currencies, error: curErr } = await (supabase as any)
        .from('currency')
        .select('cur_id, code, isDefault, isActive');

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
      currencies.forEach((c: { cur_id: number; code: string; isDefault: boolean; isActive: boolean }) => {
        if (c.isDefault) {
          // العملة الأساس دائماً = 1
          rates[c.code] = 1;
        } else {
          const price = latestPrice[c.cur_id];
          if (price !== undefined && price > 0) {
            rates[c.code] = price;
          } else {
            // لا توجد أسعار ثابتة — كل شيء يأتي من جدول cur_price. وإذا لم يجد سعراً، يُظهر 0 مع تنبيه للمستخدم
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
          updateBy: updatedBy || 'user',
          createdAt: new Date().toISOString(),
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
      .select('*')
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
      main_nameAR: string;
      sup_nameAR?: string;
      main_nameEn: string;
      sup_nameEn?: string;
      symbol?: string;
      flag?: string;
      isDefault?: boolean;
      isActive?: boolean;
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

      const payload: any = {
        cur_id: nextCurId,
        code: data.code.toUpperCase(),
        main_nameAR: data.main_nameAR,
        sup_nameAR: data.sup_nameAR || '',
        main_nameEn: data.main_nameEn || data.code.toUpperCase(),
        sup_nameEn: data.sup_nameEn || '',
        symbol: data.symbol || data.code,
        flag: data.flag || '',
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
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

      return { success: true, currency: cur };
    } catch (e: any) {
      console.error('[currencyService] addCurrency exception:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Updates currency metadata (name, symbol, isDefault, isActive, etc.)
   * Does NOT update the exchange rate — use addExchangeRatePrice for that.
   */
  async updateCurrency(
    curId: number,
    updates: Partial<Omit<Currency, 'cur_id' | 'createdAt' | 'currentPrice' | 'lastSeq' | 'lastUpdateBy' | 'lastUpdateDate'>>
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await (supabase as any)
      .from('currency')
      .update(updates)
      .eq('cur_id', curId);

    if (error) {
      console.error('[currencyService] updateCurrency error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  /**
   * Toggles isActive flag for a currency.
   * Disabling a currency means it won't be usable in orders/vouchers.
   */
  async toggleActive(curId: number, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    return this.updateCurrency(curId, { isActive });
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
