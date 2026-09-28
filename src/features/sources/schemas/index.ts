import type { SourcesCreateInput, SourcesUpdateInput } from '../../../data/dtos/sources.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const sourceRules = { name: 'nonEmptyString', type: 'string', sourceUrl: 'string', accountId: 'string', nameAr: 'string', nameEn: 'string' } as const;
export const sourcesCreateSchema = makeObjectSchema<SourcesCreateInput>(['name'], sourceRules);
export const sourcesUpdateSchema = makeObjectSchema<SourcesUpdateInput>([], sourceRules);
