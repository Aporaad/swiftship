import type { ShipmentsViewModel } from '../../features/shipments/types';
import type { EntityGateway } from './common.gateway';

export interface ShipmentsGateway extends EntityGateway<ShipmentsViewModel> {}
