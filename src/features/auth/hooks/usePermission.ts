/**
 * usePermission Hook — توحيد فحص الصلاحيات في الواجهة
 * Unified Permission Check Hook for UI
 *
 * هذا الـ Hook هو المرجع الوحيد لفحص الصلاحيات في الواجهة.
 * يستوعب منطق "Admin يملك كل شيء" داخله، بحيث لا تحتاج الصفحات
 * إلى كتابة: role === 'Admin' || hasPermission(...)
 *
 * This hook is the single entry point for permission checks in UI.
 * Admin wildcard logic is encapsulated here — pages MUST NOT write:
 *   role === 'Admin' || hasPermission(...)
 *
 * قواعد الاستخدام / Usage rules:
 * - استخدم `can('permission_key')` بدلاً من أي فحص آخر
 * - هذا لإخفاء/إظهار عناصر UI فقط — التحقق النهائي في الخادم
 * - This is for UI display only — final auth check is server-side
 */

import { useMemo } from 'react';
import { useRole } from '../../../hooks/useRole';
import type { PermissionName } from '../../../shared/permissions';


export interface UsePermissionResult {
  /**
   * تحقق من صلاحية واحدة
   * Check if the current user has a single permission
   */
  can(permission: PermissionName): boolean;

  /**
   * تحقق من امتلاك جميع الصلاحيات المطلوبة
   * Check if the current user has ALL of the given permissions
   */
  canAll(...permissions: PermissionName[]): boolean;

  /**
   * تحقق من امتلاك أي من الصلاحيات المطلوبة
   * Check if the current user has ANY of the given permissions
   */
  canAny(...permissions: PermissionName[]): boolean;

  /** هل التحميل جارٍ / Whether permissions are still loading */
  loading: boolean;
}

/**
 * Hook مركزي لفحص صلاحيات واجهة المستخدم.
 * Central hook for UI permission checking.
 *
 * @example
 * const { can } = usePermission();
 * if (can('edit_orders')) { ... }
 * // لا تكتب: role === 'Admin' || hasPermission('edit_orders')
 */
export function usePermission(): UsePermissionResult {
  const { hasPermission, loading } = useRole();

  return useMemo(() => ({
    /**
     * فحص صلاحية واحدة — يعيد true إذا كان المستخدم يملك الصلاحية
     * أو يملك صلاحية الـ wildcard '*' (مثل Admin)
     *
     * Single permission check — returns true if user has the permission
     * or has wildcard '*' (e.g. Admin role)
     */
    can(permission: PermissionName): boolean {
      return hasPermission(permission);
    },

    /**
     * يعيد true إذا كان المستخدم يملك جميع الصلاحيات المحددة
     * Returns true only if user has ALL listed permissions
     */
    canAll(...permissions: PermissionName[]): boolean {
      return permissions.every(p => hasPermission(p));
    },

    /**
     * يعيد true إذا كان المستخدم يملك أي واحدة من الصلاحيات المحددة
     * Returns true if user has ANY of the listed permissions
     */
    canAny(...permissions: PermissionName[]): boolean {
      return permissions.some(p => hasPermission(p));
    },

    loading,
  }), [hasPermission, loading]);
}
