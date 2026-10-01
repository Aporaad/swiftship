import type { EntityId, NumericEntityId } from './identifiers';

/**
 * Canonical read contracts shared by finance feature UI boundaries.
 * These are view contracts, not database rows and not write payloads.
 */
export interface FinanceAccount {
  id: EntityId;
  nameAr: string;
  nameEn?: string;
  curNo: NumericEntityId;
  currencyCode: string;
  isActive: boolean;
  isPosting: boolean;
  accSubId?: EntityId;
  entityId?: EntityId;
  entityType?: string;
  entityName?: string;
  balance?: number;
}

export interface FinanceCurrency {
  id: NumericEntityId;
  code: string;
  isDefault?: boolean;
}

export interface FinanceModule {
  id: EntityId;
  code: string;
  nameAr: string;
  isActive?: boolean;
}

export interface FinanceEntryType {
  id: EntityId;
  moduleId: EntityId;
  code: string;
  nameAr: string;
  isActive?: boolean;
}
