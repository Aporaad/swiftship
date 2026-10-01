/**
 * Canonical read contracts shared by finance feature UI boundaries.
 * These are view contracts, not database rows and not write payloads.
 */
export interface FinanceAccount {
  id: string;
  nameAr: string;
  nameEn?: string;
  curNo: number;
  currencyCode: string;
  isActive: boolean;
  isPosting: boolean;
  accSubId?: string;
  entityId?: string;
  entityType?: string;
  entityName?: string;
  balance?: number;
}

export interface FinanceCurrency {
  id: number;
  code: string;
  isDefault?: boolean;
}

export interface FinanceModule {
  id: string;
  code: string;
  nameAr: string;
  isActive?: boolean;
}

export interface FinanceEntryType {
  id: string;
  moduleId: string;
  code: string;
  nameAr: string;
  isActive?: boolean;
}
