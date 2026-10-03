/**
 * SwiftShip System — Phase 3 Gateway Registry Contract
 * 
 * Provides a unified Gateway Registry interface mapping feature domains to their
 * corresponding Table Gateway contracts.
 */

import type { AccountingGateway } from './accounting.gateway';
import type { AuthGateway } from './auth.gateway';
import type { CouriersGateway } from './couriers.gateway';
import type { CustomersGateway } from './customers.gateway';
import type { EmployeesGateway } from './employees.gateway';
import type { FinanceEntriesGateway } from './finance-entries.gateway';
import type { NotificationsGateway } from './notifications.gateway';
import type { OrdersGateway } from './orders.gateway';
import type { ProductsGateway } from './products.gateway';
import type { ReportsGateway } from './reports.gateway';
import type { RolesGateway } from './roles.gateway';
import type { SettingsGateway } from './settings.gateway';
import type { ShipmentsGateway } from './shipments.gateway';
import type { SiteManagementGateway } from './site-management.gateway';
import type { SourcesGateway } from './sources.gateway';
import type { UsersGateway } from './users.gateway';

export interface GatewayRegistryContract {
  readonly accounting: AccountingGateway;
  readonly auth: AuthGateway;
  readonly couriers: CouriersGateway;
  readonly customers: CustomersGateway;
  readonly employees: EmployeesGateway;
  readonly financeEntries: FinanceEntriesGateway;
  readonly notifications: NotificationsGateway;
  readonly orders: OrdersGateway;
  readonly products: ProductsGateway;
  readonly reports: ReportsGateway;
  readonly roles: RolesGateway;
  readonly settings: SettingsGateway;
  readonly shipments: ShipmentsGateway;
  readonly siteManagement: SiteManagementGateway;
  readonly sources: SourcesGateway;
  readonly users: UsersGateway;
}

export const REGISTERED_GATEWAY_DOMAINS = [
  'accounting',
  'auth',
  'couriers',
  'customers',
  'employees',
  'financeEntries',
  'notifications',
  'orders',
  'products',
  'reports',
  'roles',
  'settings',
  'shipments',
  'siteManagement',
  'sources',
  'users',
] as const;

export type GatewayDomain = (typeof REGISTERED_GATEWAY_DOMAINS)[number];
