import { describe, expect, it, vi } from 'vitest';
import type { AuthLoginProfileDto, CurrentUserDto } from '../../../data/dtos/auth.dto';
import type { StaffLoginGateway } from './staff-login.service';
import { beginStaffLogin, verifyStaffLoginPin } from './staff-login.service';

const user: CurrentUserDto = {
  id: 'user-1',
  email: 'staff@example.test',
  displayName: 'Staff',
  emailVerified: true,
  username: 'staff',
  role: 'Staff',
  isRoot: false,
};

const profile: AuthLoginProfileDto = {
  id: 'user-1',
  email: 'staff@example.test',
  username: 'staff',
  displayName: 'Staff',
  role: 'Staff',
  roleId: 'staff',
  isRoot: false,
  disabled: false,
  requiresSystemPin: false,
};

function createGateway(
  overrides: Partial<StaffLoginGateway> = {},
): StaffLoginGateway {
  return {
    authenticate: vi.fn().mockResolvedValue(user),
    cancelPendingSignIn: vi.fn(),
    completeSignIn: vi.fn(),
    ensureInitialRootProfile: vi.fn().mockResolvedValue(null),
    findEmailByUsername: vi.fn().mockResolvedValue('staff@example.test'),
    getLoginProfile: vi.fn().mockResolvedValue(profile),
    verifySystemPin: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe('staff login service', () => {
  it('resolves a username, checks the profile and completes a non-PIN sign-in', async () => {
    const gateway = createGateway();
    const result = await beginStaffLogin(' STAFF ', 'secret', gateway);

    expect(gateway.findEmailByUsername).toHaveBeenCalledWith('staff');
    expect(gateway.authenticate).toHaveBeenCalledWith('staff@example.test', 'secret');
    expect(gateway.completeSignIn).toHaveBeenCalledWith('user-1');
    expect(result.requiresSystemPin).toBe(false);
  });

  it('does not complete sign-in for a disabled or courier account', async () => {
    const disabledGateway = createGateway({
      getLoginProfile: vi.fn().mockResolvedValue({ ...profile, disabled: true }),
    });
    await expect(beginStaffLogin('staff@example.test', 'secret', disabledGateway))
      .rejects.toMatchObject({ code: 'ACCOUNT_DISABLED' });
    expect(disabledGateway.cancelPendingSignIn).toHaveBeenCalledOnce();
    expect(disabledGateway.completeSignIn).not.toHaveBeenCalled();

    const courierGateway = createGateway({
      getLoginProfile: vi.fn().mockResolvedValue({ ...profile, role: 'Courier' }),
    });
    await expect(beginStaffLogin('staff@example.test', 'secret', courierGateway))
      .rejects.toMatchObject({ code: 'COURIER_NOT_ALLOWED' });
    expect(courierGateway.completeSignIn).not.toHaveBeenCalled();
  });

  it('defers session completion until the system PIN has been verified', async () => {
    const gateway = createGateway({
      getLoginProfile: vi.fn().mockResolvedValue({ ...profile, requiresSystemPin: true }),
      verifySystemPin: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
    });
    const result = await beginStaffLogin('staff@example.test', 'secret', gateway);

    expect(result.requiresSystemPin).toBe(true);
    expect(gateway.completeSignIn).not.toHaveBeenCalled();
    await expect(verifyStaffLoginPin('user-1', 'wrong', gateway)).resolves.toBe(false);
    await expect(verifyStaffLoginPin('user-1', 'correct', gateway)).resolves.toBe(true);
    expect(gateway.completeSignIn).toHaveBeenCalledOnce();
  });

  it('rejects an unknown username before credential authentication', async () => {
    const gateway = createGateway({ findEmailByUsername: vi.fn().mockResolvedValue(null) });
    await expect(beginStaffLogin('missing', 'secret', gateway))
      .rejects.toMatchObject({ code: 'USERNAME_NOT_FOUND' });
    expect(gateway.authenticate).not.toHaveBeenCalled();
  });
});
