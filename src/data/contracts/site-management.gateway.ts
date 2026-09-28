import type { SiteManagementViewModel } from '../../features/siteManagement/types';
import type { EntityGateway } from './common.gateway';

export interface SiteManagementGateway extends EntityGateway<SiteManagementViewModel> {}
