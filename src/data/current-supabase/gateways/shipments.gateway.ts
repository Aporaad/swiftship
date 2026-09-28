import type { ShipmentsGateway } from '../../contracts/shipments.gateway';
import type { ShipmentsViewModel } from '../../../features/shipments/types';
import { createTableGateway } from '../tableGateway';

export const currentSupabaseShipmentsGateway: ShipmentsGateway = createTableGateway<ShipmentsViewModel>('shipments', 'shipment_id', (row) => ({ id: String(row.shipment_id ?? '') }));
