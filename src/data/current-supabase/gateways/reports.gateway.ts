import type { ReportsGateway } from '../../contracts/reports.gateway';
import type { ReportsViewModel } from '../../../features/reports/types';
import { createTableGateway } from '../tableGateway';

export const currentSupabaseReportsGateway: ReportsGateway = createTableGateway<ReportsViewModel>('report_templates', 'report_template_id', (row) => ({ id: String(row.report_template_id ?? '') }));
