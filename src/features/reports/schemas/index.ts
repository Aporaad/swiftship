import type { ReportsCreateInput, ReportsUpdateInput } from '../../../data/dtos/reports.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

export const reportsCreateSchema = makeObjectSchema<ReportsCreateInput>(['template'], { template: 'object' });
export const reportsUpdateSchema = makeObjectSchema<ReportsUpdateInput>([], { template: 'object' });
