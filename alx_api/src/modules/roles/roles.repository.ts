import type { Pool } from 'pg';
import type { PageQuery, PageResult } from '../operations/operations.contracts';
import type { RoleInput, RoleRecord, RolesRepository, RoleUpdateInput, PermissionRecord } from './roles.contracts';

const roleSelect = `
  SELECT r.role_id AS "roleId", r.code, r.name, r.description,
         r.is_system_role AS "isSystemRole", r.created_at AS "createdAt", r.updated_at AS "updatedAt",
         COALESCE(array_agg(p.code ORDER BY p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions,
         count(*) OVER()::text AS _total
  FROM alx_api_private.roles r
  LEFT JOIN alx_api_private.role_permissions rp ON rp.role_id = r.role_id
  LEFT JOIN alx_api_private.permissions p ON p.permission_id = rp.permission_id`;

async function findRole(client: { query: Pool['query'] }, roleId: string): Promise<RoleRecord | null> {
  const result = await client.query<RoleRecord>(`${roleSelect} WHERE r.role_id = $1 GROUP BY r.role_id`, [roleId]);
  return result.rows[0] ?? null;
}

export function createRolesRepository(pool: Pool): RolesRepository {
  return {
    async listRoles(input: PageQuery): Promise<PageResult<RoleRecord>> {
      const values: unknown[] = [];
      const where = input.search ? 'WHERE r.code ILIKE $1 OR r.name ILIKE $1' : '';
      if (input.search) values.push(`%${input.search}%`);
      values.push(input.limit, input.offset);
      const result = await pool.query<RoleRecord & { _total: string }>(
        `${roleSelect} ${where} GROUP BY r.role_id ORDER BY r.name ASC, r.code ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      );
      return { items: result.rows.map(({ _total: _ignored, ...row }) => row), total: Number(result.rows[0]?._total ?? 0) };
    },
    async listPermissions(): Promise<readonly PermissionRecord[]> {
      const result = await pool.query<PermissionRecord>(
        'SELECT code, resource, action, description FROM alx_api_private.permissions ORDER BY resource ASC, action ASC, code ASC',
      );
      return result.rows;
    },
    async createRole(input: RoleInput): Promise<RoleRecord> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const created = await client.query<{ roleId: string }>(
          `INSERT INTO alx_api_private.roles (code, name, description, is_system_role, created_at, updated_at)
           VALUES ($1, $2, $3, false, NOW(), NOW()) RETURNING role_id AS "roleId"`,
          [input.code, input.name, input.description ?? null],
        );
        const roleId = created.rows[0]?.roleId;
        if (!roleId) throw new Error('ROLE_CREATE_FAILED');
        await replacePermissions(client, roleId, input.permissionCodes, input.actorId);
        const role = await findRole(client, roleId);
        if (!role) throw new Error('ROLE_CREATE_FAILED');
        await client.query('COMMIT');
        return role;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async updateRole(input: RoleUpdateInput): Promise<RoleRecord | null> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (input.name !== undefined || input.description !== undefined) {
          await client.query(
            `UPDATE alx_api_private.roles SET name = COALESCE($1, name), description = $2, updated_at = NOW()
             WHERE role_id = $3 AND is_system_role IS FALSE`,
            [input.name, input.description ?? null, input.roleId],
          );
        }
        if (input.permissionCodes !== undefined) await replacePermissions(client, input.roleId, input.permissionCodes, input.actorId);
        const role = await findRole(client, input.roleId);
        await client.query('COMMIT');
        return role;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async deleteRole(roleId: string, actorId?: string): Promise<boolean> {
      const result = await pool.query(
        `DELETE FROM alx_api_private.roles WHERE role_id = $1 AND is_system_role IS FALSE
         AND NOT EXISTS (SELECT 1 FROM alx_api_private.user_roles WHERE role_id = $1)
         RETURNING role_id`,
        [roleId, actorId ?? null],
      );
      return result.rowCount === 1;
    },
  };
}

async function replacePermissions(
  client: { query: Pool['query'] },
  roleId: string,
  permissionCodes: readonly string[],
  actorId?: string,
): Promise<void> {
  const uniqueCodes = [...new Set(permissionCodes)];
  const permissions = await client.query<{ permissionId: string }>(
    'SELECT permission_id AS "permissionId" FROM alx_api_private.permissions WHERE code = ANY($1::text[])',
    [uniqueCodes],
  );
  if (permissions.rowCount !== uniqueCodes.length) throw new Error('UNKNOWN_PERMISSION');
  await client.query('DELETE FROM alx_api_private.role_permissions WHERE role_id = $1', [roleId]);
  for (const permission of permissions.rows) {
    await client.query(
      `INSERT INTO alx_api_private.role_permissions (role_id, permission_id, assigned_by)
       VALUES ($1, $2, $3)`,
      [roleId, permission.permissionId, actorId ?? null],
    );
  }
}
