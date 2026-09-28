import type { FinanceEntryCreateInput, FinanceEntryUpdateInput } from '../../../data/dtos/finance-entries.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const entryRules = { moduleId: 'nonEmptyString', entryTypeId: 'nonEmptyString', category: 'string', description: 'string', notes: 'string', attachments: 'stringArray' } as const;
export const financeEntryCreateSchema = makeObjectSchema<FinanceEntryCreateInput>(['moduleId', 'entryTypeId', 'lines'], entryRules);
export const financeEntryUpdateSchema = makeObjectSchema<FinanceEntryUpdateInput>([], { description: 'string', notes: 'string', attachments: 'stringArray' });
