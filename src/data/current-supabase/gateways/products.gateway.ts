import type { ProductsGateway } from '../../contracts/products.gateway';
import type { ProductsViewModel } from '../../../features/products/types';
import { createTableGateway } from '../tableGateway';

export const currentSupabaseProductsGateway: ProductsGateway = createTableGateway<ProductsViewModel>('products', 'product_id', ['product_id'], (row) => ({ productId: String(row.product_id ?? '') }));
