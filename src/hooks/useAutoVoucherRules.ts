/**
 * useAutoVoucherRules.ts
 * مزود قواعد القيود التلقائية — يقرأ من alx_api فقط عبر خدمة القيود التلقائية (بلا خرائط مكررة).
 * Auto voucher rules provider — reads exclusively from alx_api through autoEntryService,
 * so the row→rule mapping lives in exactly one place (autoEntryRuleMapping).
 */
import { useCallback, useEffect, useState } from 'react';
import { autoEntryService, type AutoEntryRule } from '../services/autoEntryService';

export type { AutoEntryRule, AutoEntryRuleAccount } from '../services/autoEntryService';

export function useAutoVoucherRules() {
  const [rules, setRules] = useState<AutoEntryRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState('');

  /**
   * إعادة التحميل بعد كل حفظ — لم يعد هناك مستمع لحظي، فالتحديث صريح.
   * Explicit refresh after every write; there is no realtime listener anymore.
   */
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await autoEntryService.loadRules();
      // الجدول فارغ → بذر القواعد الافتراضية مرة واحدة ثم عرض النتيجة.
      setRules(stored.length > 0 ? stored : await autoEntryService.ensureAutoEntries());
      setError('');
    } catch (loadError) {
      setRules([]);
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل قواعد القيود التلقائية.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rules, loading, error, reload };
}
