import { useEffect, useState } from 'react';

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
  autoPost?: boolean;
  requiredEntities?: string[];
}

export function useAutoVoucherRules() {
  const [rules, setRules] = useState<AutoVoucherRule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setRules([]);
    setLoading(false);
  }, []);

  return { rules, loading };
}
