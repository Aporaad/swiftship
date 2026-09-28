import type { NotificationsViewModel } from '../../features/notifications/types';
import type { EntityGateway } from './common.gateway';

export interface NotificationsGateway extends EntityGateway<NotificationsViewModel> {}
