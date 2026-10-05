import { describe, expect, it, vi } from 'vitest';
import { RoleApplicationService } from './roleApplicationService';

describe('RoleApplicationService', () => {
  it('normalizes permissions before delegating to the feature API', async () => {
    const saveRole = vi.fn().mockResolvedValue({ roleId: 'Admin' });
    const service = new RoleApplicationService({
      listRoles: vi.fn(),
      getRole: vi.fn(),
      saveRole,
      deleteRole: vi.fn(),
    });

    await service.save({
      roleId: ' Admin ',
      title: ' مدير النظام ',
      isDefault: true,
      permissions: ['view_orders', 'view_orders', ' edit_users '],
    });

    expect(saveRole).toHaveBeenCalledWith({
      roleId: 'Admin',
      title: 'مدير النظام',
      isDefault: true,
      permissions: ['edit_users', 'view_orders'],
    });
  });
});
