import type { AuthGateway } from '../../../data/contracts/auth.gateway';
import type { AuthLoginProfileDto, CurrentUserDto } from '../../../data/dtos/auth.dto';

export type StaffLoginFailureCode =
  | 'USERNAME_NOT_FOUND'
  | 'CREDENTIALS_UNVERIFIED'
  | 'ACCOUNT_DISABLED'
  | 'COURIER_NOT_ALLOWED';

export class StaffLoginError extends Error {
  constructor(readonly code: StaffLoginFailureCode) {
    super(code);
    this.name = 'StaffLoginError';
  }
}

export type StaffLoginGateway = Pick<
  AuthGateway,
  | 'authenticate'
  | 'cancelPendingSignIn'
  | 'completeSignIn'
  | 'ensureInitialRootProfile'
  | 'findEmailByUsername'
  | 'getLoginProfile'
  | 'verifySystemPin'
>;

export interface StaffLoginResult {
  user: CurrentUserDto;
  profile: AuthLoginProfileDto | null;
  requiresSystemPin: boolean;
}

export async function beginStaffLogin(
  identifier: string,
  password: string,
  gateway: StaffLoginGateway,
): Promise<StaffLoginResult> {
  let normalizedIdentifier = identifier.trim().toLowerCase();
  if (!normalizedIdentifier.includes('@') && normalizedIdentifier !== 'admin') {
    const email = await gateway.findEmailByUsername(normalizedIdentifier);
    if (!email) throw new StaffLoginError('USERNAME_NOT_FOUND');
    normalizedIdentifier = email;
  }

  const user = await gateway.authenticate(normalizedIdentifier, password);
  if (!user.id) throw new StaffLoginError('CREDENTIALS_UNVERIFIED');

  let profile = await gateway.getLoginProfile(user.id);
  if (!profile) profile = await gateway.ensureInitialRootProfile(user.id);

  if (profile?.disabled) {
    gateway.cancelPendingSignIn();
    throw new StaffLoginError('ACCOUNT_DISABLED');
  }

  if (
    (profile?.role !== null && profile?.role !== undefined && ['Courier', 'courier'].includes(profile.role)) ||
    profile?.roleId === 'courier'
  ) {
    gateway.cancelPendingSignIn();
    throw new StaffLoginError('COURIER_NOT_ALLOWED');
  }

  const requiresSystemPin = profile?.requiresSystemPin ?? false;
  if (!requiresSystemPin) gateway.completeSignIn(user.id);
  return { user, profile, requiresSystemPin };
}

export async function verifyStaffLoginPin(
  userId: string,
  pin: string,
  gateway: StaffLoginGateway,
): Promise<boolean> {
  if (!await gateway.verifySystemPin(userId, pin)) return false;
  gateway.completeSignIn(userId);
  return true;
}
