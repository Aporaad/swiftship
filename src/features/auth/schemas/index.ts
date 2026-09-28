import type { AuthCreateInput, AuthUpdateInput } from '../../../data/dtos/auth.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

export const authCreateSchema = makeObjectSchema<AuthCreateInput>(['userId'], { userId: 'nonEmptyString', deviceInfo: 'string' });
export const authUpdateSchema = makeObjectSchema<AuthUpdateInput>([], { forceLogout: 'boolean' });
