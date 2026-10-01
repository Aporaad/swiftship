import type { EmployeesGateway } from '../../contracts/employees.gateway';
import type { EmployeesViewModel } from '../../../features/employees/types';
import { createTableGateway } from '../tableGateway';

export const currentSupabaseEmployeesGateway: EmployeesGateway = createTableGateway<EmployeesViewModel>('employees', 'employee_id', ['employee_id'], (row) => ({ id: String(row.employee_id ?? '') }));
