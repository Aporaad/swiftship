import type { AccountingCreateInput, AccountingUpdateInput } from '../../../data/dtos/accounting.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const accountRules = { accountCode: 'nonEmptyString', nameAr: 'nonEmptyString', nameEn: 'string', type: 'nonEmptyString', currencyId: 'number', limitedBalance: 'number', notes: 'string' } as const;
export const accountingCreateSchema = makeObjectSchema<AccountingCreateInput>(['accountCode', 'nameAr', 'type'], accountRules);
export const accountingUpdateSchema = makeObjectSchema<AccountingUpdateInput>([], accountRules);
