import { useEffect, useState } from 'react';
import { readFinancePage } from '../services/financeApi';

interface ReportTotals {
  postedLines: number;
  entryHeaders: number;
}

const LEDGER_LINES_PATH = '/api/v1/finance/account-movements';
const ENTRY_HEADERS_PATH = '/api/v1/finance/entries';

/**
 * Compatibility report surface for callers outside the unified FinanceEntries page.
 * مصدر التقرير هو دفتر الأستاذ المُطبع عبر alx_api فقط: مسارات الحركات تُعيد سطور account_trans
 * المرحّلة (posting_status = posted) حصراً، ورؤوس القيود تُقرأ من main_entry.
 * The report source is the normalized ledger served by alx_api: the movements route already filters
 * account_trans to posted lines only, and entry headers come from main_entry. No legacy collection is read.
 */
export default function FinanceReports() {
  const [totals, setTotals] = useState<ReportTotals | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // limit=1 لأن العدد الدقيق يأتي من meta.total — لا حاجة لسحب الصفوف نفسها.
        // limit=1 because the exact count arrives in meta.total; the rows themselves are not needed.
        const [lines, entries] = await Promise.all([
          readFinancePage(LEDGER_LINES_PATH, { limit: 1, offset: 0 }),
          readFinancePage(ENTRY_HEADERS_PATH, { limit: 1, offset: 0 }),
        ]);
        if (cancelled) return;
        setTotals({ postedLines: lines.total, entryHeaders: entries.total });
      } catch (err) {
        console.warn('FinanceReports: تعذر تحميل ملخص دفتر الأستاذ:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر تحميل التقرير المالي.');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-label="Normalized financial report" className="space-y-3">
      <h2 className="text-sm font-black text-white">Financial Reports</h2>
      {error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : (
        <p className="text-xs text-slate-400">
          {totals === null
            ? 'جاري تحميل ملخص دفتر الأستاذ…'
            : `${totals.postedLines.toLocaleString()} posted ledger lines from ${totals.entryHeaders.toLocaleString()} entry headers.`}
        </p>
      )}
    </section>
  );
}
