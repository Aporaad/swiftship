import type { CurrentUserDto, SessionState } from '../auth.dto';

export interface LegacyAuthUserSnapshot {
  uid: string;
  email?: string | null;
  emailVerified?: boolean;
  displayName?: string | null;
  username?: string | null;
  role?: string | null;
  isRoot?: boolean;
  disabled?: boolean;
}

export function mapLegacyAuthUserToDto(user: LegacyAuthUserSnapshot): CurrentUserDto {
  return {
    id: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    emailVerified: user.emailVerified ?? false,
    username: user.username ?? null,
    role: user.role ?? null,
    isRoot: user.isRoot ?? false,
  };
}

export function mapLegacyAuthUserToSessionState(
  user: LegacyAuthUserSnapshot | null,
): SessionState {
  if (!user) return { status: 'unauthenticated' };
  if (user.disabled) return { status: 'locked' };
  return { status: 'authenticated', user: mapLegacyAuthUserToDto(user) };
}
