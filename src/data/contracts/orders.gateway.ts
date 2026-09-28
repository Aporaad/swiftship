import type { OrdersViewModel } from '../../features/orders/types';
import type { EntityGateway } from './common.gateway';

export interface OrdersGateway extends EntityGateway<OrdersViewModel> {
  changeStatus(orderId: string, orderStatusId: string, actorId: string): Promise<OrdersViewModel>;
}
