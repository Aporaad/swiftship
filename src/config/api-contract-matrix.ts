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
  { domain: 'accounting', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/finance', cutoverPhase: 5, notes: 'Service layer is API-only (phase 7-هـ): financialAccountService/Accounts/Automation/Purge, accountingHierarchyService, autoEntryService and financialEntrySettingsService all call alx_api through the shared src/services/financeApi.ts gateway. UI is API-only for ChartOfAccounts (financialAccountAdmin), AccountingHierarchyManagement (accountingHierarchyAdmin), AssetsPortfolio (financeAssetsService), FinanceReports, AutoVoucherRulesManager, ExpenseCategoriesManager and GlobalEntityLedgerModal (entityLedgerService, phase 7-ح). Legacy direct DB access remains only in FinanceAccounting and AccountingPage.' },
  { domain: 'browser', status: 'missing', operations: ['read', 'write'], apiOwner: 'alx_api/cross-cutting', cutoverPhase: 6, notes: 'Browser viewer data sources are still legacy-backed.' },
  { domain: 'financeEntries', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/finance', cutoverPhase: 5, notes: 'API-only since step 9: gateways have no legacy fallback and ledger edit/delete/custody settle/order payment run through atomic API flows. Accounting services are API-only as of phase 7-هـ and the entity ledger modal is API-only (phase 7-ح); legacy remains only in finance UI components.' },
  { domain: 'orders', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations', cutoverPhase: 4, notes: 'Order CRUD, history, status catalog, order items and the public tracking portal (public_tracking table + /api/v1/operations/tracking-profiles) are served over HTTP and consumed API-only. Legacy remains only in the auto-entry rules tab (finance phase).' },
  { domain: 'shipments', status: 'available', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations', cutoverPhase: 4, notes: 'Shipment CRUD and per-shipment tracking routes are consumed via HTTP only; shipment deletion has no API route and the gateway rejects it explicitly.' },
  { domain: 'products', status: 'available', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations', cutoverPhase: 4, notes: 'Master products (CRUD incl. delete, is_allowed and audit columns) and order items (/api/v1/operations/order-items CRUD with filters) are API-only via productService. DEPLOYMENT PREREQUISITE: migration 0022_products_is_allowed.sql must be applied before deploying the alx_api SQL that selects is_allowed, or the products list will fail. Item-category contracts remain open.' },
  { domain: 'customers', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/customers', cutoverPhase: 4, notes: 'HTTP gateway exists; legacy page paths remain.' },
  { domain: 'couriers', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations/reporting', cutoverPhase: 4, notes: 'CRUD and reporting routes exist; legacy reads remain.' },
  { domain: 'employees', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations/reporting', cutoverPhase: 4, notes: 'CRUD and reporting routes exist; legacy reads remain.' },
  { domain: 'users', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/users', cutoverPhase: 6, notes: 'HTTP routes exist; session and page fallbacks remain.' },
  { domain: 'roles', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/roles', cutoverPhase: 6, notes: 'HTTP routes exist; page fallback remains.' },
  { domain: 'finance', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/finance', cutoverPhase: 5, notes: 'Gateway exists; finance fallback and services remain.' },
  { domain: 'reports', status: 'partial', operations: ['read'], apiOwner: 'alx_api/modules/reporting', cutoverPhase: 5, notes: 'Reporting routes exist; dashboard/report legacy consumers remain.' },
  { domain: 'notifications', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/notifications', cutoverPhase: 6, notes: 'Routes exist; notification page/service still uses legacy.' },
  { domain: 'settings', status: 'available', operations: ['read', 'write'], apiOwner: 'alx_api/modules/settings', cutoverPhase: 1, notes: 'General, appearance and logistics settings now go through settingsCurrenciesApiGateway over /api/v1/settings; no direct Supabase reads remain.' },
  { domain: 'currencies', status: 'available', operations: ['read', 'write'], apiOwner: 'alx_api/modules/currencies', cutoverPhase: 1, notes: 'Currency catalog, prices and exchange rates served via /api/v1/currencies and /api/v1/settings/currencies; reads authenticate-only, writes remain permission-gated. Legacy realtime listeners were removed in favor of gateway fetch/refresh.' },
  { domain: 'siteManagement', status: 'available', operations: ['read', 'write'], apiOwner: 'alx_api/modules/site-content', cutoverPhase: 6, notes: 'WebsiteManagementPage is API-only through siteContentService over /api/v1/site/{tickets,announcements,job-applications,portal-orders}: tickets/announcements/jobs read+write and portal orders read (server-side portal filter replacing the whole-table orders scan), writes gated by manage_website and reads by view_website_management. Announcement/ticket/job writes are server-validated jsonb merges (admin sender and status cannot be spoofed). Remaining legacy consumers are separate domains: JobApplicationsModal and PendingPortalApprovalsModal still use legacy-compat.' },
  { domain: 'sources', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations/reporting', cutoverPhase: 4, notes: 'Reporting exists; CRUD consumers remain.' },
  { domain: 'returns', status: 'available', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations', cutoverPhase: 4, notes: 'Returned products are API-only: /api/v1/operations/returned-products CRUD with server-side filters (orderId, productId, customerId, returnStatus, returnType, dateFrom/dateTo, search) consumed by returnedProductService and the returned-products tab gateway (polling + write-notify replaces legacy onSnapshot). Gated by the *_orders permission family because no *_returned_products permissions are seeded.' },
  { domain: 'statuses-options-categories', status: 'partial', operations: ['read', 'write'], apiOwner: 'alx_api/modules/operations', cutoverPhase: 4, notes: 'Order statuses now have full contracts (/api/v1/operations/order-statuses CRUD) consumed by useOrderStatuses and the management tab; order options and item categories still need explicit contracts.' },
  { domain: 'activity-sessions-search', status: 'missing', operations: ['read', 'write'], apiOwner: 'alx_api/cross-cutting', cutoverPhase: 6, notes: 'Cross-cutting APIs are required before deleting legacy listeners.' },
] as const;

export function getApiDomainContract(domain: string): ApiDomainContract | undefined {
  return API_CONTRACT_MATRIX.find((contract) => contract.domain === domain);
}
