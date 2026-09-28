import type { CouriersCreateInput, CouriersUpdateInput } from '../../../data/dtos/couriers.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const courierRules = { fullName: 'nonEmptyString', nameAr: 'string', nameEn: 'string', accountId: 'string', currency: 'string', type: 'string', level: 'string', commissionRate: 'number', isActive: 'boolean', profile: 'object' } as const;
export const couriersCreateSchema = makeObjectSchema<CouriersCreateInput>(['fullName'], courierRules);
export const couriersUpdateSchema = makeObjectSchema<CouriersUpdateInput>([], courierRules);
