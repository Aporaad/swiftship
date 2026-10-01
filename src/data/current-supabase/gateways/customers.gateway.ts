import type { CustomersGateway } from '../../contracts/customers.gateway';
import type { CustomersViewModel } from '../../../features/customers/types';
import { createTableGateway } from '../tableGateway';

export const currentSupabaseCustomersGateway: CustomersGateway = createTableGateway<CustomersViewModel>('customers', 'customer_id', ['customer_id'], (row) => ({ id: String(row.customer_id ?? '') }));
