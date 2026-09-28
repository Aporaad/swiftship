import type { UsersCreateInput, UsersUpdateInput } from '../../../data/dtos/users.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const userRules = { roleId: 'nonEmptyString', username: 'nonEmptyString', email: 'string', fullName: 'nonEmptyString', phone: 'string', address: 'string', disabled: 'boolean' } as const;
export const usersCreateSchema = makeObjectSchema<UsersCreateInput>(['roleId', 'username', 'fullName'], userRules);
export const usersUpdateSchema = makeObjectSchema<UsersUpdateInput>([], userRules);
