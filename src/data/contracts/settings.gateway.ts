import type { SettingsViewModel } from '../../features/settings/types';
import type { EntityGateway } from './common.gateway';

export interface SettingsGateway extends EntityGateway<SettingsViewModel> {}
