import type { UsersGateway } from '../../contracts/users.gateway';
import type { UsersViewModel } from '../../../features/users/types';
import { createTableGateway } from '../tableGateway';

export const currentSupabaseUsersGateway: UsersGateway = createTableGateway<UsersViewModel>('users', 'user_id', (row) => ({ id: String(row.user_id ?? '') }));
