import type {
  OrderItemCreateInput,
  ProductsCreateInput,
  ProductCategoryCreateInput,
  ReturnedProductCreateInput,
} from '../../../data/dtos/products.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const productRules = {
  nameAr: 'nonEmptyString', nameEn: 'string', url: 'string', priceCurrencyId: 'number', unitPrice: 'number',
  categoryId: 'string', isAllowed: 'boolean', cbm: 'number', width: 'number', height: 'number', length: 'number', weight: 'number',
} as const;
export const productsCreateSchema = makeObjectSchema<ProductsCreateInput>(['nameAr'], productRules);
export const productsUpdateSchema = makeObjectSchema<Partial<ProductsCreateInput>>([], productRules);

const categoryRules = {
  code: 'string', nameAr: 'string', nameEn: 'string', description: 'string', hsCodeHint: 'string', customsPerCarton: 'number',
  taxPerCarton: 'number', otherFeesPerCarton: 'number', customsRate: 'number', taxRate: 'number', feeCurrency: 'string',
  requiresReview: 'boolean', isActive: 'boolean', details: 'object',
} as const;
export const productCategoryCreateSchema = makeObjectSchema<ProductCategoryCreateInput>([], categoryRules);
export const productCategoryUpdateSchema = makeObjectSchema<Partial<ProductCategoryCreateInput>>([], categoryRules);

const orderItemRules = {
  orderId: 'nonEmptyString', productId: 'string', productPrice: 'number', productUrl: 'string', trackingNumber: 'string',
  sourceId: 'string', sourceUrl: 'string', cooler: 'string', note: 'string', quantity: 'number', totalPrice: 'number',
  totalWeight: 'number', totalCbm: 'number', packagingOptionId: 'string', packagingOptionPrice: 'number', isInsured: 'boolean',
  insuranceFee: 'number', status: 'string',
} as const;
export const orderItemCreateSchema = makeObjectSchema<OrderItemCreateInput>(['orderId'], orderItemRules);
export const orderItemUpdateSchema = makeObjectSchema<Partial<OrderItemCreateInput>>([], orderItemRules);

const returnedProductRules = {
  orderId: 'nonEmptyString', orderItemId: 'string', productId: 'string', customerId: 'string', customerName: 'string',
  productName: 'string', productUrl: 'string', quantity: 'number', reason: 'string', type: 'string', status: 'nonEmptyString',
  condition: 'string', refundAmount: 'number', refundCurrency: 'string', isInsured: 'boolean', insuranceRefund: 'number', notes: 'string',
} as const;
export const returnedProductCreateSchema = makeObjectSchema<ReturnedProductCreateInput>(['orderId', 'quantity', 'status'], returnedProductRules);
export const returnedProductUpdateSchema = makeObjectSchema<Partial<ReturnedProductCreateInput>>([], returnedProductRules);
