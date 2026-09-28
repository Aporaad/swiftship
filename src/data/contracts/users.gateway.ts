import type { UsersViewModel } from '../../features/users/types';
import type { EntityGateway } from './common.gateway';

export interface UsersGateway extends EntityGateway<UsersViewModel> {}
