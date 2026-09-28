import type { SiteManagementGateway } from '../../contracts/site-management.gateway';
import type { SettingsGateway } from '../../contracts/settings.gateway';
import type { SiteManagementViewModel } from '../../../features/siteManagement/types';
import type { SettingsViewModel } from '../../../features/settings/types';
import { createTableGateway } from '../tableGateway';

export const currentSupabaseSiteManagementGateway: SiteManagementGateway = createTableGateway<SiteManagementViewModel>('announcements', 'announcement_id', (row) => ({ siteId: String(row.announcement_id ?? '') }));
export const currentSupabaseSettingsGateway: SettingsGateway = createTableGateway<SettingsViewModel>('settings', 'setting_id', (row) => ({ id: String(row.setting_id ?? '') }));
