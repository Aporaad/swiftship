import type { BrowserCreateInput, BrowserUpdateInput } from '../../../data/dtos/browser.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const browserRules = { name: 'nonEmptyString', url: 'nonEmptyString', username: 'string', password: 'string', isPinned: 'boolean', autoLogin: 'boolean', sortOrder: 'number' } as const;
export const browserCreateSchema = makeObjectSchema<BrowserCreateInput>(['name', 'url'], browserRules);
export const browserUpdateSchema = makeObjectSchema<BrowserUpdateInput>([], browserRules);
