import type { ReactNode } from 'react';

interface FinanceAccountingTabPanelProps {
  active: boolean;
  children: ReactNode;
}

/** Local tab boundary for FinanceAccounting; it intentionally does not alter child content or order. */
export default function FinanceAccountingTabPanel({ active, children }: FinanceAccountingTabPanelProps) {
  return active ? <>{children}</> : null;
}
