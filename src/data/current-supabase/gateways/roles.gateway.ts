import type { RolesGateway } from '../../contracts/roles.gateway';
import type { GatewayPage, GatewayQuery } from '../../contracts/common.gateway';
import type { RoleViewModel } from '../../../features/roles/types';
import { rolesApiDataGateway } from '../../../features/roles/services/rolesApiDataGateway';

/**
 *بوابة الأدوار بعد توحيد RBAC (المرحله P2 / الترحيل 0040).
 * Roles gateway after the RBAC unification (P2 / migration 0040).
 *
 * public.roles و public.role_permission أُسقطا: لم يعد للإصدار الانتقالي مصدر قراءة مباشر في Supabase،
 * فالبيانات تُجلب من /api/v1/roles حيث تُقرأ من alx_api_private الموحّدة وحدها.
 * public.roles and public.role_permission are dropped, so this transitional gateway no longer has a direct
 * Supabase source; every read goes through /api/v1/roles, which is backed only by the unified alx_api_private RBAC.
 */
type ApiRole = Awaited<ReturnType<typeof rolesApiDataGateway.list>>[number];

/** إزالة التكرار وترتيب أكواد الصلاحيات حتى يبقى سلوك الواجهة ثابتًا مهما كان ترتيب API. */
function uniquePermissions(permissions: readonly string[]): string[] {
  return [...new Set(permissions.filter((value): value is string => typeof value === 'string' && value.length > 0))].sort();
}

/** تحويل سجل الـ API إلى نموذج العرض الذي تتوقعه الواجهة (لا حقول تدقيق لدى API المؤقتة). */
function toViewModel(role: ApiRole): RoleViewModel {
  return {
    roleId: role.id,
    title: role.title,
    code: role.code ?? null,
    description: role.description ?? null,
    isDefault: role.isDefault ?? false,
    permissions: uniquePermissions(role.permissions ?? []),
    createdAt: null,
    updatedAt: null,
    createdBy: null,
    updatedBy: null,
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
    const roles = (await rolesApiDataGateway.list()).map(toViewModel);
    const term = query.search?.trim().toLowerCase();
    const filtered = !term
      ? roles
      : roles.filter((role) =>
          [role.roleId, role.title, role.code, role.description].some((value) => typeof value === 'string' && value.toLowerCase().includes(term)),
        );
    return page(filtered.slice(offset, offset + limit), { ...query, limit, offset }, filtered.length);
  }

  async getById(roleId: string): Promise<RoleViewModel | null> {
    const roles = await rolesApiDataGateway.list();
    const found = roles.find((role) => role.id === roleId);
    return found ? toViewModel(found) : null;
  }

  async save(role: RoleViewModel): Promise<RoleViewModel> {
    const permissionCodes = uniquePermissions(role.permissions);
    const name = role.title ?? role.code ?? role.roleId;
    const description = role.description ?? undefined;

    const existing = (await rolesApiDataGateway.list()).find((item) => item.id === role.roleId);
    if (existing) {
      const updated = await rolesApiDataGateway.update(existing.id, { name, description, permissionCodes });
      return toViewModel(updated);
    }

    // الرمز حقل إلزامي في الجداول الموحّدة؛ دونه لا يمكن إنشاء الدور عبر API.
    // The unified tables require a code, so creation cannot proceed without one.
    if (!role.code) throw new Error('ROLE_CODE_REQUIRED');
    const created = await rolesApiDataGateway.create({ code: role.code, name, description, permissionCodes });
    return toViewModel(created);
  }
}
