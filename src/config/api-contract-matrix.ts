export type ApiCoverageStatus = 'available' | 'partial' | 'missing';
export type ApiOperation = 'read' | 'write' | 'realtime';

export interface ApiDomainContract {
  domain: string;
  status: ApiCoverageStatus;
  operations: readonly ApiOperation[];
  apiOwner: string;
  cutoverPhase: number;
  notes: string;
}

/**
 * Phase 0 baseline. This is intentionally declarative; it does not select a
 * data source or perform a fallback. Each domain must move to `available`
 * before API-only mode is enabled for that domain.
 */
export const API_CONTRACT_MATRIX: readonly ApiDomainContract[] = [
  { domain: 'auth', status: 'available', operations: ['read', 'write'], apiOwner: 'alx_api/modules/auth', cutoverPhase: 2, notes: 'Session and token contract exists.' },
  { domain: 'accounting', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/finance', cutoverPhase: 5, notes: 'Accounting UI still contains direct legacy services.' },
  { domain: 'browser', status: 'missing', operations: ['read', 'write'], apiOwner: 'alx_api/cross-cutting', cutoverPhase: 6, notes: 'Browser viewer data sources are still legacy-backed.' },
  { domain: 'financeEntries', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/finance', cutoverPhase: 5, notes: 'Finance entry API exists; legacy services and fallback remain.' },
  { domain: 'orders', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations', cutoverPhase: 4, notes: 'Core order routes exist; legacy consumers remain.' },
  { domain: 'shipments', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations', cutoverPhase: 4, notes: 'Core shipment routes exist; UI still has legacy consumers.' },
  { domain: 'products', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations', cutoverPhase: 4, notes: 'Core product routes exist; returns/categories are separate gaps.' },
  { domain: 'customers', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/customers', cutoverPhase: 4, notes: 'HTTP gateway exists; legacy page paths remain.' },
  { domain: 'couriers', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations/reporting', cutoverPhase: 4, notes: 'CRUD and reporting routes exist; legacy reads remain.' },
  { domain: 'employees', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations/reporting', cutoverPhase: 4, notes: 'CRUD and reporting routes exist; legacy reads remain.' },
  { domain: 'users', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/users', cutoverPhase: 6, notes: 'HTTP routes exist; session and page fallbacks remain.' },
  { domain: 'roles', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/roles', cutoverPhase: 6, notes: 'HTTP routes exist; page fallback remains.' },
  { domain: 'finance', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/finance', cutoverPhase: 5, notes: 'Gateway exists; finance fallback and services remain.' },
  { domain: 'reports', status: 'partial', operations: ['read'], apiOwner: 'alx_api/modules/reporting', cutoverPhase: 5, notes: 'Reporting routes exist; dashboard/report legacy consumers remain.' },
  { domain: 'notifications', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/notifications', cutoverPhase: 6, notes: 'Routes exist; notification page/service still uses legacy.' },
  { domain: 'settings', status: 'missing', operations: ['read', 'write'], apiOwner: 'alx_api/modules/settings', cutoverPhase: 1, notes: 'Required for system name, logo, general and logistics settings.' },
  { domain: 'currencies', status: 'missing', operations: ['read', 'write', 'realtime'], apiOwner: 'alx_api/modules/currencies', cutoverPhase: 1, notes: 'Required for currency catalog, prices and exchange rates.' },
  { domain: 'siteManagement', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/portal', cutoverPhase: 6, notes: 'Announcements and website settings are not fully covered.' },
  { domain: 'sources', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations/reporting', cutoverPhase: 4, notes: 'Reporting exists; CRUD consumers remain.' },
  { domain: 'returns', status: 'missing', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations', cutoverPhase: 4, notes: 'Returned products still use legacy storage.' },
  { domain: 'statuses-options-categories', status: 'missing', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations', cutoverPhase: 4, notes: 'Order statuses/options/item categories need explicit contracts.' },
  { domain: 'activity-sessions-search', status: 'missing', operations: ['read', 'write'], apiOwner: 'alx_api/cross-cutting', cutoverPhase: 6, notes: 'Cross-cutting APIs are required before deleting legacy listeners.' },
] as const;

export function getApiDomainContract(domain: string): ApiDomainContract | undefined {
  return API_CONTRACT_MATRIX.find((contract) => contract.domain === domain);
}
