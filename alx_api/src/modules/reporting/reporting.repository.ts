import type { Pool } from 'pg';
import type { ReportingRepository, ReportingResource, ReportingRow } from './reporting.contracts';

type ResourceDefinition = {
  from: string;
  columns: string;
  idColumn: string;
  orderBy: string;
  searchColumns: string[];
  map?: (row: Record<string, unknown>) => ReportingRow;
};

const definitions: Record<ReportingResource, ResourceDefinition> = {
  couriers: {
    from: 'public.couriers',
    idColumn: 'courier_id',
    orderBy: 'created_at DESC NULLS LAST, courier_id ASC',
    searchColumns: ['full_name', 'name_ar', 'name_en'],
    columns:
      'courier_id AS "courierId", full_name AS "fullName", name_ar AS "nameAr", name_en AS "nameEn", account_id AS "accountId", currency, is_active AS "isActive", courier_type AS "type", courier_level AS "level", commission_rate AS "commissionRate", created_at AS "createdAt", updated_at AS "updatedAt", created_by AS "createdBy", updated_by AS "updatedBy"',
    map: (row) => ({ ...row, id: String(row.courierId) }),
  },
  employees: {
    from: 'public.employees',
    idColumn: 'employee_id',
    orderBy: 'created_at DESC NULLS LAST, employee_id ASC',
    searchColumns: ['full_name', 'name_ar', 'name_en', 'job_type'],
    columns:
      'employee_id AS "employeeId", full_name AS "fullName", name_ar AS "nameAr", name_en AS "nameEn", job_type AS "jobType", account_id AS "accountId", monthly_salary AS "monthlySalary", currency, commission_rate AS "commissionRate", created_at AS "createdAt", updated_at AS "updatedAt", created_by AS "createdBy", updated_by AS "updatedBy"',
    map: (row) => ({ ...row, id: String(row.employeeId) }),
  },
  sources: {
    from: 'public.sources',
    idColumn: 'source_id',
    orderBy: 'created_at DESC NULLS LAST, source_id ASC',
    searchColumns: ['name', 'name_ar', 'name_en', 'type'],
    columns:
      'source_id AS "sourceId", name, type, source_url AS "sourceUrl", account_id AS "accountId", name_ar AS "nameAr", name_en AS "nameEn", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt", created_by AS "createdBy", updated_by AS "updatedBy"',
    map: (row) => ({ ...row, id: String(row.sourceId) }),
  },
  shippingCompanies: {
    from: 'public.shipping_companies',
    idColumn: 'shipping_company_id',
    orderBy: 'created_at DESC NULLS LAST, shipping_company_id ASC',
    searchColumns: ['name', 'name_ar', 'name_en', 'code'],
    columns:
      'shipping_company_id AS "shippingCompanyId", name, shipping_company_url AS url, tracking_id_prefix AS "trackingIdPrefix", account_id AS "accountId", name_ar AS "nameAr", name_en AS "nameEn", is_active AS "isActive", address, code, country_id AS "countryId", phone, email, api_url AS "apiUrl", tracking_url_template AS "trackingUrlTemplate", api_enabled AS "apiEnabled", supports_tracking AS "supportsTracking", supports_webhook AS "supportsWebhook", created_at AS "createdAt", updated_at AS "updatedAt"',
    map: (row) => ({ ...row, id: String(row.shippingCompanyId) }),
  },
  users: {
    from: 'public.users',
    idColumn: 'user_id',
    orderBy: 'created_at DESC NULLS LAST, user_id ASC',
    searchColumns: ['full_name', 'username', 'email'],
    columns:
      'user_id AS "userId", role, username, email, disabled, linked_type AS "linkedType", linked_entity AS "linkedEntity", full_name AS "fullName", phone, address, created_at AS "createdAt", updated_at AS "updatedAt", last_seen AS "lastSeen"',
    map: (row) => ({ ...row, id: String(row.userId) }),
  },
  activityLogs: {
    from: 'public.activity_logs',
    idColumn: 'activity_log_id',
    orderBy: 'created_at DESC NULLS LAST, activity_log_id ASC',
    searchColumns: ['action', 'category', 'target', 'details'],
    columns:
      'activity_log_id AS "activityLogId", action, category, target, type, details, user_id AS "userId", created_at AS "createdAt"',
    map: (row) => ({ ...row, id: String(row.activityLogId) }),
  },
  reportTemplates: {
    from: 'public.report_templates',
    idColumn: 'report_template_id',
    orderBy: 'created_at DESC NULLS LAST, report_template_id ASC',
    searchColumns: ['name_ar', 'name_en'],
    columns:
      'report_template_id AS "reportTemplateId", data, filters, active_report AS "activeReport", name_ar AS "nameAr", name_en AS "nameEn", search_term AS "searchTerm", selected_company_id AS "selectedCompanyId", selected_courier_id AS "selectedCourierId", selected_customer_id AS "selectedCustomerId", selected_expense_category AS "selectedExpenseCategory", selected_user_id AS "selectedUserId", sort_by AS "sortBy", sort_order AS "sortOrder", created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"',
    map: (row) => ({ ...row, id: String(row.reportTemplateId) }),
  },
  expenses: {
    from: 'public.main_entry me JOIN public.account_trans at ON at.main_entry_id = me.main_entry_id JOIN public.accounts a ON a.account_id = at.account_id',
    idColumn: 'at.account_trans_id',
    orderBy: 'me.effective_at DESC NULLS LAST, at.account_trans_id ASC',
    searchColumns: ['me.description', 'me.entry_number', 'at.description'],
    columns:
      'at.account_trans_id AS "expenseId", at.account_trans_id AS id, me.main_entry_id AS "entryId", me.entry_number AS "entryNumber", me.description, COALESCE(at.description, me.description) AS "lineDescription", a.account_code AS "accountCode", a.acc_name_ar AS "accountNameAr", a.acc_name_en AS "accountNameEn", at.amount, at.amount_original AS "amountOriginal", at.currency_original_no AS "currencyOriginalNo", at.trans_type AS "transType", at.entity_type AS "entityType", at.entity_id AS "entityId", at.custody_id AS "custodyId", me.effective_at AS "effectiveAt", me.created_at AS "createdAt", me.posting_status AS "postingStatus", \'FINANCE_ENTRY\' AS category',
    map: (row) => ({ ...row, id: String(row.expenseId) }),
  },
};

export function createReportingRepository(pool: Pool): ReportingRepository {
  return {
    async list(resource, query) {
      const definition = definitions[resource];
      const values: unknown[] = [];
      const filters: string[] = [];
      if (query.search) {
        values.push(`%${query.search}%`);
        const placeholder = `$${values.length}`;
        filters.push(`(${definition.searchColumns.map((column) => `${column} ILIKE ${placeholder}`).join(' OR ')})`);
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      values.push(query.limit, query.offset);
      const result = await pool.query<Record<string, unknown>>(
        `SELECT ${definition.columns}, count(*) OVER()::text AS _total FROM ${definition.from} ${where} ORDER BY ${definition.orderBy} LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      );
      return {
        items: result.rows.map(({ _total: _ignored, ...row }) => definition.map?.(row) ?? (row as ReportingRow)),
        total: Number(result.rows[0]?._total ?? 0),
      };
    },
  };
}
