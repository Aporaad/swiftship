import type { ProductsViewModel } from '../../features/products/types';
import type { EntityGateway } from './common.gateway';

export interface ProductsGateway extends EntityGateway<ProductsViewModel> {}
