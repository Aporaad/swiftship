export type ReportingResource =
  'expenses' | 'couriers' | 'sources' | 'shippingCompanies' | 'users' | 'activityLogs' | 'reportTemplates';

export interface ReportingQuery {
  limit: number;
  offset: number;
  search?: string | undefined;
}

export interface ReportingRow {
  id: string;
  [key: string]: unknown;
}

export interface ReportingRepository {
  list(resource: ReportingResource, query: ReportingQuery): Promise<{ items: ReportingRow[]; total: number }>;
}
