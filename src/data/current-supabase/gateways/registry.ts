import type { GatewayRegistryContract } from '../../contracts/gatewayRegistry';
import { CurrentSupabaseBrowserGateway } from './browser.gateway';
import { CurrentSupabaseFinanceEntriesGateway } from './finance-entries.gateway';
import { CurrentSupabaseOrdersGateway } from './orders.gateway';
import { CurrentSupabaseRolesGateway } from './roles.gateway';
import { CurrentSupabaseAuthGateway } from './auth.gateway';
import { currentSupabaseAccountingGateway } from './accounting.gateway';
import { currentSupabaseCouriersGateway } from './couriers.gateway';
import { currentSupabaseCustomersGateway } from './customers.gateway';
import { currentSupabaseEmployeesGateway } from './employees.gateway';
import { currentSupabaseNotificationsGateway } from './notifications.gateway';
import { currentSupabaseProductsGateway } from './products.gateway';
import { currentSupabaseReportsGateway } from './reports.gateway';
import { currentSupabaseSettingsGateway, currentSupabaseSiteManagementGateway } from './site-settings.gateway';
import { currentSupabaseShipmentsGateway } from './shipments.gateway';
import { currentSupabaseSourcesGateway } from './sources.gateway';
import { currentSupabaseUsersGateway } from './users.gateway';

/**
 * Concrete transitional registry. It only wires feature gateways; it does not
 * contain business rules or orchestration.
 */
export function createCurrentSupabaseGatewayRegistry(): GatewayRegistryContract {
  return {
    accounting: currentSupabaseAccountingGateway,
    auth: new CurrentSupabaseAuthGateway(),
    browser: new CurrentSupabaseBrowserGateway(),
    couriers: currentSupabaseCouriersGateway,
    customers: currentSupabaseCustomersGateway,
    employees: currentSupabaseEmployeesGateway,
    financeEntries: new CurrentSupabaseFinanceEntriesGateway(),
    notifications: currentSupabaseNotificationsGateway,
    orders: new CurrentSupabaseOrdersGateway(),
    products: currentSupabaseProductsGateway,
    reports: currentSupabaseReportsGateway,
    roles: new CurrentSupabaseRolesGateway(),
    settings: currentSupabaseSettingsGateway,
    shipments: currentSupabaseShipmentsGateway,
    siteManagement: currentSupabaseSiteManagementGateway,
    sources: currentSupabaseSourcesGateway,
    users: currentSupabaseUsersGateway,
  };
}
