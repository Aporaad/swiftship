import type { RolesGateway } from '../../contracts/roles.gateway';
import type { GatewayPage, GatewayQuery } from '../../contracts/common.gateway';
import type { RoleViewModel } from '../../../features/roles/types';
import { supabase } from '../supabase.client';
import { mapRow, mapSupabaseError } from '../supabase.mapper';
import { asIsoUtc } from '../../dtos/common.dto';

/**
 * صلاحيات الأدوار صارت صفوفًا في role_permission بعد إسقاط roles.permissions (jsonb).
 * Role permissions are rows in role_permission now that the roles.permissions jsonb column is gone,
 * so every read assembles the string array the UI expects from that child table.
 */
const ROLE_COLUMNS = 'role_id,code,title,description,is_default,created_at,updated_at,created_by,updated_by';

function mapRole(row: Record<string, unknown>, permissions: readonly string[] = []): RoleViewModel {
  return {
    roleId: String(row.role_id ?? ''),
    title: typeof row.title === 'string' ? row.title : null,
    code: typeof row.code === 'string' ? row.code : null,
    description: typeof row.description === 'string' ? row.description : null,
    isDefault: Boolean(row.is_default),
    permissions: [...new Set(permissions.filter((value): value is string => typeof value === 'string'))].sort(),
    createdAt: typeof row.created_at === 'string' ? asIsoUtc(row.created_at) : null,
    updatedAt: typeof row.updated_at === 'string' ? asIsoUtc(row.updated_at) : null,
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    updatedBy: typeof row.updated_by === 'string' ? row.updated_by : null,
  };
}

/** جلب الصلاحيات لعدد من الأدوار في استدعاء واحد ثم تجميعها حسب الدور. */
async function permissionsByRole(roleIds: readonly string[]): Promise<Map<string, string[]>> {
  const grouped = new Map<string, string[]>();
  if (roleIds.length === 0) return grouped;
  const { data, error } = await supabase
    .from('role_permission')
    .select('role_id,permission_code')
    .in('role_id', [...roleIds]);
  if (error) throw mapSupabaseError(error);
  for (const value of (data ?? []) as unknown[]) {
    const row = value as Record<string, unknown> | null;
    const roleId = typeof row?.role_id === 'string' ? row.role_id : '';
    const code = typeof row?.permission_code === 'string' ? row.permission_code : '';
    if (!roleId || !code) continue;
    const codes = grouped.get(roleId);
    if (codes) codes.push(code);
    else grouped.set(roleId, [code]);
  }
  return grouped;
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
      .select(ROLE_COLUMNS, { count: 'exact' })
      .range(offset, offset + limit - 1);
    if (error) throw mapSupabaseError(error);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const grouped = await permissionsByRole(rows.map((row) => String(row.role_id ?? '')));
    const items = rows.map((row) => mapRole(row, grouped.get(String(row.role_id ?? '')) ?? []));
    return page(items, { ...query, limit, offset }, count);
  }

  async getById(roleId: string): Promise<RoleViewModel | null> {
    const { data, error } = await supabase
      .from('roles')
      .select(ROLE_COLUMNS)
      .eq('role_id', roleId)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    if (!data) return null;
    const grouped = await permissionsByRole([roleId]);
    return mapRow(data, (row) => mapRole(row, grouped.get(roleId) ?? []));
  }

  async save(role: RoleViewModel): Promise<RoleViewModel> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('roles')
      .upsert({
        role_id: role.roleId,
        title: role.title,
        code: role.code ?? null,
        description: role.description ?? null,
        is_default: role.isDefault,
        created_at: role.createdAt ?? now,
        updated_at: now,
        created_by: role.createdBy,
        updated_by: role.updatedBy,
      }, { onConflict: 'role_id' })
      .select(ROLE_COLUMNS)
      .single();
    if (error) throw mapSupabaseError(error);

    // استبدال صفوف الصلاحيات بالكامل بدل كتابة مصفوفة داخل الجدول الأب.
    // The child rows are replaced wholesale (delete by role_id then insert) instead of writing roles.permissions.
    const codes = [...new Set(role.permissions.filter((value): value is string => typeof value === 'string' && value.length > 0))].sort();
    const { error: deleteError } = await supabase
      .from('role_permission')
      .delete()
      .eq('role_id', role.roleId);
    if (deleteError) throw mapSupabaseError(deleteError);
    if (codes.length > 0) {
      const { error: insertError } = await supabase
        .from('role_permission')
        .insert(codes.map((permission_code) => ({ role_id: role.roleId, permission_code })));
      if (insertError) throw mapSupabaseError(insertError);
    }

    return mapRow(data, (row) => mapRole(row, codes));
  }
}
