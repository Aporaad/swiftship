import type { NotificationsCreateInput, NotificationsUpdateInput } from '../../../data/dtos/notifications.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const notificationRules = { userId: 'string', category: 'nonEmptyString', type: 'nonEmptyString', isPublic: 'boolean', title: 'string', message: 'nonEmptyString', link: 'string', orderId: 'string', associatedUserIds: 'stringArray' } as const;
export const notificationsCreateSchema = makeObjectSchema<NotificationsCreateInput>(['category', 'type', 'message'], notificationRules);
export const notificationsUpdateSchema = makeObjectSchema<NotificationsUpdateInput>([], { read: 'boolean', title: 'string', message: 'string', link: 'string' });
