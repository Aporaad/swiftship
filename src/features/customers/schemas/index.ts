import type { CustomersCreateInput, CustomersUpdateInput } from '../../../data/dtos/customers.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const customerRules = { fullName: 'nonEmptyString', nameAr: 'string', nameEn: 'string', accountId: 'string', isActive: 'boolean', joinBy: 'string', referrerId: 'string', customerLevel: 'string', profile: 'object', portalAccount: 'object' } as const;
export const customersCreateSchema = makeObjectSchema<CustomersCreateInput>(['fullName'], customerRules);
export const customersUpdateSchema = makeObjectSchema<CustomersUpdateInput>([], customerRules);
