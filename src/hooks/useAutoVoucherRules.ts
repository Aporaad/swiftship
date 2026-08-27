import { useEffect, useState } from 'react';
import { collection, db, onSnapshot } from '../lib/supabase-firebase-adapter';

export interface AutoVoucherRule {
  id: string;
  actionCode?: string;
  nameAr: string;
  nameEn: string;
  descriptionTempAr: string;
  descriptionTempEn: string;
  debitAccount: any;
  creditAccount: any;
  isActive: boolean;
  requiredEntities?: string[];
}

let cachedRules: AutoVoucherRule[] | null = null;
const subscribers = new Set<() => void>();
let unsubscribeRules: (() => void) | null = null;

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

/** المصدر الرسمي لقواعد القيود التلقائية هو auto_entries؛ لا تقرأ هذه الواجهة وثيقة settings التاريخية. */
export function useAutoVoucherRules() {
  const [rules, setRules] = useState<AutoVoucherRule[]>(cachedRules || []);
  const [loading, setLoading] = useState<boolean>(!cachedRules);

  useEffect(() => {
    const handler = () => {
      if (cachedRules) {
        setRules(cachedRules);
        setLoading(false);
      }
    };
    subscribers.add(handler);
    if (!unsubscribeRules) {
      unsubscribeRules = onSnapshot(collection(db, 'auto_entries'), (snapshot: any) => {
        cachedRules = snapshot.docs.map((entry: any) => ({ id: entry.id, ...entry.data() }));
        notifySubscribers();
      });
    }
    return () => {
      subscribers.delete(handler);
      if (subscribers.size === 0 && unsubscribeRules) {
        unsubscribeRules();
        unsubscribeRules = null;
      }
    };
  }, []);

  return { rules, loading };
}
