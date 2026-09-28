import type { RolesCreateInput, RolesUpdateInput } from '../../../data/dtos/roles.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const roleRules = { roleId: 'nonEmptyString', title: 'nonEmptyString', code: 'string', description: 'string', isDefault: 'boolean', permissions: 'stringArray' } as const;
export const rolesCreateSchema = makeObjectSchema<RolesCreateInput>(['roleId', 'title', 'permissions'], roleRules);
export const rolesUpdateSchema = makeObjectSchema<RolesUpdateInput>([], roleRules);
