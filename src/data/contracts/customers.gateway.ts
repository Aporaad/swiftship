import type { CustomersViewModel } from '../../features/customers/types';
import type { EntityGateway } from './common.gateway';

export interface CustomersGateway extends EntityGateway<CustomersViewModel> {}
