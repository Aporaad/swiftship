import type { CouriersGateway } from '../../contracts/couriers.gateway';
import type { CouriersViewModel } from '../../../features/couriers/types';
import { createTableGateway } from '../tableGateway';

export const currentSupabaseCouriersGateway: CouriersGateway = createTableGateway<CouriersViewModel>('couriers', 'courier_id', (row) => ({ id: String(row.courier_id ?? '') }));
