import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { onSnapshot, doc, setDoc } from 'firebase/firestore';

export interface AutoVoucherRule {
  id: string;
  actionCode: string;
  nameAr: string;
  nameEn: string;
  descriptionTempAr: string;
  descriptionTempEn: string;
  debitAccount: any;
  creditAccount: any;
  isActive: boolean;
  requiredEntities: string[];
}

let cachedRules: AutoVoucherRule[] | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach(cb => cb());
}

let isSubscribed = false;

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

    if (!isSubscribed) {
      isSubscribed = true;
      const ref = doc(db, 'settings', 'automatic_voucher_rules');
      
      onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          const docData = snap.data();
          if (docData && docData.data && Array.isArray(docData.data)) {
            cachedRules = docData.data;
            notifySubscribers();
          }
        }
      });
    }

    return () => {
      subscribers.delete(handler);
    };
  }, []);

  return { rules, loading };
}
