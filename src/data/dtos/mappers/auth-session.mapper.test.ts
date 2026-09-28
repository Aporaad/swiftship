import { describe, expect, it } from 'vitest';
import {
  mapLegacyAuthUserToDto,
  mapLegacyAuthUserToSessionState,
} from './auth-session.mapper';

describe('auth session mapper', () => {
  it('maps only the safe current-user projection', () => {
    const legacyUser = {
      uid: 'user-1',
      email: 'user@example.com',
      emailVerified: true,
      displayName: 'Swift User',
      username: 'swift-user',
      role: 'Admin',
      isRoot: true,
      disabled: false,
      password: 'must-not-leak',
      systemPin: 'must-not-leak',
    };
    const dto = mapLegacyAuthUserToDto(legacyUser);

    expect(dto).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'Swift User',
      emailVerified: true,
      username: 'swift-user',
      role: 'Admin',
      isRoot: true,
    });
    expect(dto).not.toHaveProperty('password');
    expect(dto).not.toHaveProperty('systemPin');
  });

  it('does not treat a missing user object as an authenticated session', () => {
    expect(mapLegacyAuthUserToSessionState(null)).toEqual({ status: 'unauthenticated' });
  });

  it('maps disabled accounts to the locked state', () => {
    expect(mapLegacyAuthUserToSessionState({ uid: 'user-2', disabled: true })).toEqual({
      status: 'locked',
    });
  });
});
