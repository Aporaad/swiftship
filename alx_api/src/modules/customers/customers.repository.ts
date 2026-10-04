import type { Pool } from 'pg';
import type { CustomerDto, CustomerRepository } from './customers.contracts';
type CustomerRow = CustomerDto & { total_count: string };
const columns = `customer_id AS "customerId", account_id AS "accountId", is_active AS "isActive", join_by AS "joinBy", referrer_id AS "referrerId", full_name AS "fullName", name_ar AS "nameAr", name_en AS "nameEn", customer_level AS "customerLevel", created_at AS "createdAt", updated_at AS "updatedAt", acquisition_source AS "acquisitionSource", preferred_categories AS "preferredCategories", location, address, onboarding_completed AS "onboardingCompleted"`;
function mapCustomer(row: CustomerRow): CustomerDto {
  return {
    customerId: row.customerId,
    accountId: row.accountId,
    isActive: row.isActive,
    joinBy: row.joinBy,
    referrerId: row.referrerId,
    fullName: row.fullName,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    customerLevel: row.customerLevel,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    acquisitionSource: row.acquisitionSource,
    preferredCategories: row.preferredCategories,
    location: row.location,
    address: row.address,
    onboardingCompleted: row.onboardingCompleted,
  };
}
export function createCustomersRepository(pool: Pool): CustomerRepository {
  return {
    async list(query) {
      const values: unknown[] = [];
      const filters: string[] = [];
      if (query.search) {
        values.push(`%${query.search}%`);
        filters.push(
          `(full_name ILIKE $${values.length} OR name_ar ILIKE $${values.length} OR name_en ILIKE $${values.length})`,
        );
      }
      if (query.isActive !== undefined) {
        values.push(query.isActive);
        filters.push(`is_active = $${values.length}`);
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      values.push(query.limit, query.offset);
      const result = await pool.query<CustomerRow>(
        `SELECT ${columns}, count(*) OVER()::text AS total_count FROM alx_api_private.customers_read ${where} ORDER BY created_at DESC NULLS LAST, customer_id ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      );
      return { items: result.rows.map(mapCustomer), total: Number(result.rows[0]?.total_count ?? 0) };
    },
    async findById(customerId) {
      const result = await pool.query<CustomerRow>(
        `SELECT ${columns}, 1::text AS total_count FROM alx_api_private.customers_read WHERE customer_id = $1 LIMIT 1`,
        [customerId],
      );
      return result.rows[0] ? mapCustomer(result.rows[0]) : null;
    },
  };
}
