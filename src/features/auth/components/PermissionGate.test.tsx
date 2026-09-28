import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERM } from '../../../shared/permissions';

const permissionMocks = vi.hoisted(() => ({
  can: vi.fn<(permission: string) => boolean>(),
  canAny: vi.fn<(...permissions: string[]) => boolean>(),
  canAll: vi.fn<(...permissions: string[]) => boolean>(),
}));

vi.mock('../hooks/usePermission', () => ({
  usePermission: () => permissionMocks,
}));

import { PermissionGate } from './PermissionGate';

describe('PermissionGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMocks.can.mockReturnValue(false);
    permissionMocks.canAny.mockReturnValue(false);
    permissionMocks.canAll.mockReturnValue(false);
  });

  it('renders children when the required permission is granted', () => {
    permissionMocks.can.mockReturnValue(true);

    expect(
      PermissionGate({ permission: PERM.EDIT_ORDERS, children: 'allowed' }),
    ).toBe('allowed');
    expect(permissionMocks.can).toHaveBeenCalledWith(PERM.EDIT_ORDERS);
  });

  it('renders the fallback when the required permission is missing', () => {
    expect(
      PermissionGate({
        permission: PERM.EDIT_ORDERS,
        children: 'hidden',
        fallback: 'read-only',
      }),
    ).toBe('read-only');
  });

  it('uses anyOf when one permission is sufficient', () => {
    permissionMocks.canAny.mockReturnValue(true);

    expect(
      PermissionGate({
        anyOf: [PERM.EDIT_ORDERS, PERM.DELETE_ORDERS],
        children: 'allowed',
      }),
    ).toBe('allowed');
    expect(permissionMocks.canAny).toHaveBeenCalledWith(
      PERM.EDIT_ORDERS,
      PERM.DELETE_ORDERS,
    );
  });

  it('uses allOf when every permission is required', () => {
    permissionMocks.canAll.mockReturnValue(true);

    expect(
      PermissionGate({
        allOf: [PERM.VIEW_ORDERS, PERM.EDIT_ORDERS],
        children: 'allowed',
      }),
    ).toBe('allowed');
    expect(permissionMocks.canAll).toHaveBeenCalledWith(
      PERM.VIEW_ORDERS,
      PERM.EDIT_ORDERS,
    );
  });

  it('renders null by default when no permission is granted', () => {
    expect(
      PermissionGate({ permission: PERM.DELETE_ORDERS, children: 'hidden' }),
    ).toBeNull();
  });
});
