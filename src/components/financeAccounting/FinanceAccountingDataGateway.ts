/**
 * FinanceAccountingDataGateway.ts
 *
 * بوابة بيانات المحاسبة المالية (Gateway for financial accounting data)
 *
 * هذه البوابة لا تعتمد على legacy-compat أو Supabase مباشرة.
 * تعيد قيماً فارغة آمنة لمنع تحطم الواجهة عند عدم توفر البيانات.
 * البيانات الفعلية تأتي عبر FinanceApiDataGateway عبر HTTP API.
 *
 * This gateway does NOT depend on legacy-compat or direct Supabase.
 * Returns safe empty values to prevent UI crashes when data is unavailable.
 * Real data comes via FinanceApiDataGateway via HTTP API.
 */

type Unsubscribe = () => void;

/**
 * بوابة بيانات محاسبية آمنة لا تعتمد على Supabase أو legacy-compat.
 * تُستخدم كـ fallback آمن فقط — البيانات الفعلية تأتي عبر HTTP API.
 * Safe accounting data gateway with no Supabase/legacy-compat dependency.
 * Used as a safe fallback only — real data comes via HTTP API.
 */
export const financeAccountingDataGateway = {
  /**
   * الاشتراك في مجموعة بيانات محاسبية — يعيد قائمة فارغة فوراً.
   * Subscribe to an accounting collection — returns empty list immediately.
   */
  subscribeCollection<T = Record<string, unknown>>(
    _collectionName: string,
    onData: (rows: T[]) => void,
    _onError: (error: unknown) => void,
  ): Unsubscribe {
    // إعادة قائمة فارغة آمنة بدون استدعاء Supabase أو legacy-compat
    // Return safe empty list without calling Supabase or legacy-compat
    void Promise.resolve().then(() => onData([]));
    return () => {
      // لا يوجد اشتراك للإلغاء — No subscription to cancel
    };
  },

  /**
   * الاشتراك في مجموعة محاسبية مرتبة — يعيد قائمة فارغة فوراً.
   * Subscribe to an ordered accounting collection — returns empty list immediately.
   */
  subscribeOrderedCollection<T = Record<string, unknown>>(
    _collectionName: string,
    _field: string,
    onData: (rows: T[]) => void,
    _onError: (error: unknown) => void,
  ): Unsubscribe {
    // إعادة قائمة فارغة آمنة — Return safe empty list
    void Promise.resolve().then(() => onData([]));
    return () => {
      // لا يوجد اشتراك للإلغاء — No subscription to cancel
    };
  },
};
