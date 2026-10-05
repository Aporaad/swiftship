import type { Pool } from 'pg';
import type { PageQuery, PageResult } from '../operations/operations.contracts';
import type { CreateUserInput, UpdateUserInput, UsersRepository } from './users.contracts';

const userColumns =
  'user_id AS "userId", role, username, email, disabled, full_name AS "fullName", linked_type AS "linkedType", linked_entity AS "linkedEntity", phone, address, is_root AS "isRoot", created_at AS "createdAt", updated_at AS "updatedAt"';

export function createUsersRepository(pool: Pool): UsersRepository {
  return {
    async listUsers(input: PageQuery): Promise<PageResult<Record<string, unknown>>> {
      const values: unknown[] = [];
      const where = input.search
        ? 'WHERE (username ILIKE $1 OR full_name ILIKE $1 OR email ILIKE $1 OR user_id ILIKE $1)'
        : '';
      if (input.search) values.push(`%${input.search}%`);
      values.push(input.limit, input.offset);
      const result = await pool.query<Record<string, unknown>>(
        `SELECT ${userColumns}, count(*) OVER()::text AS _total FROM public.users ${where} ORDER BY created_at DESC NULLS LAST, user_id ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      );
      return {
        items: result.rows.map(({ _total, ...row }) => row),
        total: Number(result.rows[0]?._total ?? 0),
      };
    },

    async getUser(userId: string): Promise<Record<string, unknown> | null> {
      const result = await pool.query(
        `SELECT ${userColumns} FROM public.users WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      return result.rows[0] ?? null;
    },

    async createUser(input: CreateUserInput): Promise<Record<string, unknown>> {
      const userId = input.userId ?? `usr_${crypto.randomUUID()}`;
      const result = await pool.query(
        `INSERT INTO public.users (user_id, role, username, email, disabled, full_name, linked_type, linked_entity, phone, address, created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), $11, $11)
         RETURNING ${userColumns}`,
        [
          userId,
          input.role ?? 'Employee',
          input.username,
          input.email ?? null,
          input.disabled ?? false,
          input.fullName ?? input.username,
          input.linkedType ?? null,
          input.linkedEntity ?? null,
          input.phone ?? null,
          input.address ?? null,
          input.actorId ?? null,
        ],
      );
      return result.rows[0];
    },

    async updateUser(input: UpdateUserInput): Promise<Record<string, unknown> | null> {
      const result = await pool.query(
        `UPDATE public.users SET
           username = COALESCE($1, username),
           email = COALESCE($2, email),
           full_name = COALESCE($3, full_name),
           role = COALESCE($4, role),
           disabled = COALESCE($5, disabled),
           phone = COALESCE($6, phone),
           address = COALESCE($7, address),
           linked_type = COALESCE($8, linked_type),
           linked_entity = COALESCE($9, linked_entity),
           updated_by = $10,
           updated_at = NOW()
         WHERE user_id = $11
         RETURNING ${userColumns}`,
        [
          input.username,
          input.email,
          input.fullName,
          input.role,
          input.disabled,
          input.phone,
          input.address,
          input.linkedType,
          input.linkedEntity,
          input.actorId ?? null,
          input.userId,
        ],
      );
      return result.rows[0] ?? null;
    },

    /**
     * حذف ناعم (Soft Delete): تعطيل المستخدم بدلاً من حذفه نهائياً للحفاظ على سجل التدقيق.
     * Soft Delete: disables the user instead of physically removing for audit trail.
     */
    async deleteUser(userId: string, actorId?: string): Promise<boolean> {
      const result = await pool.query(
        `UPDATE public.users SET disabled = true, updated_by = $1, updated_at = NOW()
         WHERE user_id = $2 AND (is_root IS FALSE OR is_root IS NULL)
         RETURNING user_id`,
        [actorId ?? null, userId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async listUserRoles(userId: string): Promise<readonly string[]> {
      const result = await pool.query<{ code: string }>(
        `SELECT r.code
         FROM alx_api_private.user_roles ur
         JOIN alx_api_private.roles r ON ur.role_id = r.role_id
         WHERE ur.user_id = $1 AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
        [userId],
      );
      return result.rows.map((row) => row.code);
    },

    async setUserRoles(userId: string, roleCodes: readonly string[], actorId?: string): Promise<readonly string[]> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM alx_api_private.user_roles WHERE user_id = $1', [userId]);

        if (roleCodes.length > 0) {
          const roles = await client.query<{ roleId: string; code: string }>(
            `SELECT role_id AS "roleId", code FROM alx_api_private.roles WHERE code = ANY($1::text[])`,
            [roleCodes],
          );
          for (const role of roles.rows) {
            await client.query(
              `INSERT INTO alx_api_private.user_roles (user_id, role_id, assigned_by, assigned_at)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (user_id, role_id) DO UPDATE SET assigned_at = NOW()`,
              [userId, role.roleId, actorId ?? null],
            );
          }
        }
        await client.query('COMMIT');
        return roleCodes;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
