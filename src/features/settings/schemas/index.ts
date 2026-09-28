import type { SettingsCreateInput, SettingsUpdateInput } from '../../../data/dtos/settings.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const settingsRules = { category: 'nonEmptyString', settings: 'object' } as const;
export const settingsCreateSchema = makeObjectSchema<SettingsCreateInput>(['category', 'settings'], settingsRules);
export const settingsUpdateSchema = makeObjectSchema<SettingsUpdateInput>([], settingsRules);
