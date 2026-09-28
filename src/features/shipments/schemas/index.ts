import type { ShipmentsCreateInput, ShipmentsUpdateInput } from '../../../data/dtos/shipments.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const shipmentRules = { orderId: 'string', trackingNumber: 'nonEmptyString', shippingCompanyId: 'string', courierId: 'string', status: 'string', shippingCost: 'number', weight: 'number', shippingCategoryId: 'string', contentCategoryId: 'string', contentCategoryName: 'string', cartonCount: 'number', customsFee: 'number', taxFee: 'number', otherCategoryFee: 'number', categoryFeesTotal: 'number', categoryFeeCurrency: 'string', shipmentData: 'object' } as const;
export const shipmentsCreateSchema = makeObjectSchema<ShipmentsCreateInput>(['orderId'], shipmentRules);
export const shipmentsUpdateSchema = makeObjectSchema<ShipmentsUpdateInput>([], shipmentRules);
