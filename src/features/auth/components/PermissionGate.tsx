/**
 * PermissionGate Component — حارس العرض المبني على الصلاحيات
 * Permission-based UI Visibility Guard
 *
 * يُستخدم لإخفاء أو إظهار عناصر الواجهة بناءً على الصلاحيات.
 * Used to conditionally render UI elements based on user permissions.
 *
 * قواعد الاستخدام / Usage rules:
 * - هذا للتحكم في العرض فقط — التحقق النهائي في الخادم
 * - This is for display control only — final auth is server-side
 * - لا تستخدم PermissionGate لاتخاذ قرارات أمنية
 * - Do NOT use PermissionGate for security decisions
 *
 * @example
 * // عرض زر الحذف فقط لمن يملك الصلاحية / Show delete button only if permitted
 * <PermissionGate permission="delete_orders">
 *   <button>حذف</button>
 * </PermissionGate>
 *
 * @example
 * // أي صلاحية من القائمة / Any permission from list
 * <PermissionGate anyOf={['edit_orders', 'delete_orders']}>
 *   <ActionMenu />
 * </PermissionGate>
 *
 * @example
 * // مع عنصر بديل / With fallback element
 * <PermissionGate permission="edit_orders" fallback={<ViewOnlyBadge />}>
 *   <EditButton />
 * </PermissionGate>
 */

import type { ReactNode } from 'react';
import { usePermission } from '../hooks/usePermission';
import type { PermissionName } from '../../../shared/permissions';


interface PermissionGateBaseProps {
  /** العنصر البديل عند غياب الصلاحية / Fallback element when permission is missing */
  fallback?: ReactNode;
  children: ReactNode;
}

interface SinglePermissionProps extends PermissionGateBaseProps {
  /** صلاحية واحدة مطلوبة / Single required permission */
  permission: PermissionName;
  anyOf?: never;
  allOf?: never;
}

interface AnyOfPermissionProps extends PermissionGateBaseProps {
  permission?: never;
  /** تمرير إذا كانت أي صلاحية من القائمة كافية / Pass if any one permission is sufficient */
  anyOf: PermissionName[];
  allOf?: never;
}

interface AllOfPermissionProps extends PermissionGateBaseProps {
  permission?: never;
  anyOf?: never;
  /** تمرير إذا كانت جميع الصلاحيات مطلوبة / Pass if ALL permissions are required */
  allOf: PermissionName[];
}

type PermissionGateProps =
  | SinglePermissionProps
  | AnyOfPermissionProps
  | AllOfPermissionProps;

/**
 * حارس عرض مبني على الصلاحيات — يعرض الأطفال فقط إذا توفرت الصلاحية.
 * Permission-aware render guard — renders children only if permitted.
 */
export function PermissionGate({
  permission,
  anyOf,
  allOf,
  fallback = null,
  children,
}: PermissionGateProps): ReactNode {
  const { can, canAny, canAll } = usePermission();

  let permitted = false;

  if (Array.isArray(anyOf)) {
    permitted = canAny(...anyOf);
  } else if (Array.isArray(allOf)) {
    permitted = canAll(...allOf);
  } else if (typeof permission === 'string') {
    permitted = can(permission);
  }

  return permitted ? children : fallback;
}
