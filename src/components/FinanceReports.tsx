import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from '../lib/supabase-adapter';
import { db } from '../lib/supabase-adapter';

/**
 * Compatibility report surface for callers outside the unified FinanceEntries page.
 * The report source is the normalized ledger only: posted main_entry headers and
 * their account_trans lines. No legacy expenditure collection is queried.
 */
export default function FinanceReports() {
  const [entries, setEntries] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    const unsubEntries = onSnapshot(
      query(collection(db, 'main_entry'), orderBy('effectiveAt', 'desc')),
      (snap) => setEntries(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))),
      (error) => console.warn('FinanceReports: main_entry subscription error:', error),
    );
    const unsubLines = onSnapshot(
      query(collection(db, 'account_trans'), orderBy('createdAt', 'desc')),
      (snap) => setLines(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))),
      (error) => console.warn('FinanceReports: account_trans subscription error:', error),
    );
    return () => {
      unsubEntries();
      unsubLines();
    };
  }, []);

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const postedLines = lines.filter((tx) => {
    const entry = entryById.get(tx.entryId || tx.main_entry_id);
    return tx.entry?.postingStatus === 'posted' || (entry && entry.postingStatus === 'posted');
  });

  return (
    <section aria-label="Normalized financial report" className="space-y-3">
      <h2 className="text-sm font-black text-white">Financial Reports</h2>
      <p className="text-xs text-slate-400">
        {postedLines.length.toLocaleString()} posted ledger lines from {entries.length.toLocaleString()} entry headers.
      </p>
    </section>
  );
}
