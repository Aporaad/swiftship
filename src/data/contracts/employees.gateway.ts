import type { EmployeesViewModel } from '../../features/employees/types';
import type { EntityGateway } from './common.gateway';

export interface EmployeesGateway extends EntityGateway<EmployeesViewModel> {}
