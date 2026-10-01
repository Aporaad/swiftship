import type { NotificationsGateway } from '../../contracts/notifications.gateway';
import type { NotificationsViewModel } from '../../../features/notifications/types';
import { createTableGateway } from '../tableGateway';

export const currentSupabaseNotificationsGateway: NotificationsGateway = createTableGateway<NotificationsViewModel>('notifications', 'notification_id', ['notification_id'], (row) => ({ id: String(row.notification_id ?? '') }));
