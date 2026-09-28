import type { RolesGateway } from '../../contracts/roles.gateway';
import type { GatewayPage, GatewayQuery } from '../../contracts/common.gateway';
import type { RoleViewModel } from '../../../features/roles/types';
import { supabase } from '../supabase.client';
import { mapRow, mapSupabaseError } from '../supabase.mapper';

function mapRole(row: Record<string, unknown>): RoleViewModel {
  return {
    roleId: String(row.role_id ?? ''),
    title: typeof row.title === 'string' ? row.title : null,
    isDefault: Boolean(row.is_default),
    permissions: Array.isArray(row.permissions)
      ? [...new Set(row.permissions.filter((value): value is string => typeof value === 'string'))].sort()
      : [],
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    updatedBy: typeof row.updated_by === 'string' ? row.updated_by : null,
  };
}

function page<T>(items: T[], query: GatewayQuery, count: number | null): GatewayPage<T> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  const offset = Math.max(query.offset ?? 0, 0);
  return { items, limit, offset, hasMore: (count ?? offset + items.length) > offset + items.length };
}

export class CurrentSupabaseRolesGateway implements RolesGateway {
  async list(query: GatewayQuery = {}): Promise<GatewayPage<RoleViewModel>> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const { data, error, count } = await supabase
      .from('roles')
      .select('role_id,title,is_default,permissions,created_at,updated_at,created_by,updated_by', { count: 'exact' })
      .range(offset, offset + limit - 1);
    if (error) throw mapSupabaseError(error);
    return page((data ?? []).map((row: unknown) => mapRow(row, mapRole)), { ...query, limit, offset }, count);
  }

  async getById(roleId: string): Promise<RoleViewModel | null> {
    const { data, error } = await supabase
      .from('roles')
      .select('role_id,title,is_default,permissions,created_at,updated_at,created_by,updated_by')
      .eq('role_id', roleId)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? mapRow(data, mapRole) : null;
  }

  async save(role: RoleViewModel): Promise<RoleViewModel> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('roles')
      .upsert({
        role_id: role.roleId,
        title: role.title,
        is_default: role.isDefault,
        permissions: [...new Set(role.permissions)].sort(),
        created_at: role.createdAt ?? now,
        updated_at: now,
        created_by: role.createdBy,
        updated_by: role.updatedBy,
      }, { onConflict: 'role_id' })
      .select('role_id,title,is_default,permissions,created_at,updated_at,created_by,updated_by')
      .single();
    if (error) throw mapSupabaseError(error);
    return mapRow(data, mapRole);
  }
}
