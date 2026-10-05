import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { CustomerDto, CustomerRepository, CustomerWriteInput } from './customers.contracts';

type CustomerRow = CustomerDto & { total_count?: string };
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

async function writeAudit(client: PoolClient, action: string, customerId: string, actorUserId: string): Promise<void> {
  const now = new Date();
  await client.query(
    `INSERT INTO public.activity_logs
      (activity_log_id, action, category, target, type, details, user_id, created_at, updated_at, created_by, updated_by)
     VALUES ($1, $2, 'customer', $3, 'api', $4, $5, $6, $6, $5, $5)`,
    [
      `audit_${randomUUID()}`,
      action,
      customerId,
      JSON.stringify({ source: 'alx_api', entityType: 'customer', entityId: customerId }),
      actorUserId,
      now,
    ],
  );
}

async function inTransaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function writeFields(input: CustomerWriteInput): { assignments: string[]; values: unknown[] } {
  const fields: Array<[keyof CustomerWriteInput, string]> = [
    ['accountId', 'account_id'],
    ['isActive', 'is_active'],
    ['joinBy', 'join_by'],
    ['referrerId', 'referrer_id'],
    ['fullName', 'full_name'],
    ['nameAr', 'name_ar'],
    ['nameEn', 'name_en'],
    ['customerLevel', 'customer_level'],
    ['acquisitionSource', 'acquisition_source'],
    ['preferredCategories', 'preferred_categories'],
    ['location', 'location'],
    ['address', 'address'],
    ['onboardingCompleted', 'onboarding_completed'],
  ];
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [property, column] of fields) {
    if (input[property] !== undefined) {
      values.push(input[property] ?? null);
      assignments.push(`${column} = $${values.length}`);
    }
  }
  return { assignments, values };
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
        `SELECT ${columns} FROM alx_api_private.customers_read WHERE customer_id = $1 LIMIT 1`,
        [customerId],
      );
      return result.rows[0] ? mapCustomer(result.rows[0]) : null;
    },
    async create(input, actorUserId) {
      return inTransaction(pool, async (client) => {
        const customerId = input.customerId ?? `cust_${randomUUID()}`;
        const fields = writeFields(input);
        const columnsToInsert = ['customer_id', ...fields.assignments.map((assignment) => assignment.split(' = ')[0]), 'created_at', 'updated_at', 'created_by', 'updated_by'];
        const values = [customerId, ...fields.values, new Date(), new Date(), actorUserId, actorUserId];
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const result = await client.query<CustomerRow>(
          `INSERT INTO public.customers (${columnsToInsert.join(', ')}) VALUES (${placeholders}) RETURNING ${columns}`,
          values,
        );
        const row = result.rows[0];
        if (!row) throw new Error('CUSTOMER_CREATE_RETURNED_NO_ROW');
        const customer = mapCustomer(row);
        await writeAudit(client, 'create_customer', customer.customerId, actorUserId);
        return customer;
      });
    },
    async update(customerId, input, actorUserId) {
      return inTransaction(pool, async (client) => {
        const fields = writeFields(input);
        if (fields.assignments.length === 0) return null;
        const values = [...fields.values, new Date(), actorUserId, customerId];
        const result = await client.query<CustomerRow>(
          `UPDATE public.customers SET ${fields.assignments.join(', ')}, updated_at = $${values.length - 2}, updated_by = $${values.length - 1} WHERE customer_id = $${values.length} RETURNING ${columns}`,
          values,
        );
        if (!result.rows[0]) return null;
        const customer = mapCustomer(result.rows[0]);
        await writeAudit(client, 'update_customer', customer.customerId, actorUserId);
        return customer;
      });
    },
    async archive(customerId, actorUserId) {
      return inTransaction(pool, async (client) => {
        const values = [new Date(), actorUserId, customerId];
        const result = await client.query<CustomerRow>(
          `UPDATE public.customers SET is_active = false, updated_at = $1, updated_by = $2 WHERE customer_id = $3 RETURNING ${columns}`,
          values,
        );
        if (!result.rows[0]) return null;
        const customer = mapCustomer(result.rows[0]);
        await writeAudit(client, 'archive_customer', customer.customerId, actorUserId);
        return customer;
      });
    },
  };
}
