import {
  AuthService,
  hashRefreshToken,
  type AuthRepository,
  type AccessTokenIssuer,
} from '../../../src/modules/auth/auth.use-cases';

const now = new Date('2026-10-04T00:00:00.000Z');

function makeDependencies() {
  const repository: jest.Mocked<AuthRepository> = {
    findUsersByIdentifier: jest
      .fn()
      .mockResolvedValue([{ userId: 'u-1', role: 'employee', disabled: false, email: 'employee@example.test' }]),
    findCredential: jest.fn().mockResolvedValue({ passwordHash: 'argon-hash', passwordAlgorithm: 'argon2id' }),
    verifyLegacyPassword: jest.fn().mockResolvedValue(false),
    migrateLegacyPassword: jest.fn().mockResolvedValue(false),
    getLockedUntil: jest.fn().mockResolvedValue(null),
    recordFailedLogin: jest.fn().mockResolvedValue(undefined),
    clearFailedLogins: jest.fn().mockResolvedValue(undefined),
    createSession: jest.fn().mockResolvedValue(undefined),
    findRefreshToken: jest.fn().mockResolvedValue({
      userId: 'u-1',
      role: 'employee',
      disabled: false,
      sessionId: 'session-1',
      familyId: 'family-1',
      expiresAt: new Date('2026-10-05T00:00:00Z'),
      sessionExpiresAt: new Date('2026-11-03T00:00:00Z'),
      sessionRevokedAt: null,
      usedAt: null,
      revokedAt: null,
    }),
    rotateRefreshToken: jest.fn().mockResolvedValue(true),
    revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
    revokeRefreshTokenFamily: jest.fn().mockResolvedValue(undefined),
    findActiveSession: jest.fn().mockResolvedValue({ userId: 'u-1', role: 'employee', disabled: false }),
    listSessions: jest.fn().mockResolvedValue([]),
    revokeSession: jest.fn().mockResolvedValue(undefined),
    revokeAllSessions: jest.fn().mockResolvedValue(undefined),
    recordAuthEvent: jest.fn().mockResolvedValue(undefined),
    updatePasswordHash: jest.fn().mockResolvedValue(true),
    createPasswordResetToken: jest.fn().mockResolvedValue(true),
    completePasswordReset: jest.fn().mockResolvedValue(true),
    revokePasswordResetToken: jest.fn().mockResolvedValue(undefined),
    listPermissions: jest.fn().mockResolvedValue([]),
  };
  const issuer: jest.Mocked<AccessTokenIssuer> = { issue: jest.fn().mockResolvedValue('signed-access-token') };
  const service = new AuthService(
    repository,
    issuer,
    { accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 2_592_000, dummyPasswordHash: 'dummy-argon2id-hash' },
    jest.fn().mockResolvedValue(true),
    () => now,
  );
  return { repository, issuer, service };
}

describe('AuthService', () => {
  it('normalizes the identifier and persists only a hash of a fresh refresh token', async () => {
    const { repository, issuer, service } = makeDependencies();
    const result = await service.login({ identifier: '  Employee@Example.test ', password: 'secret' });

    expect(repository.findUsersByIdentifier).toHaveBeenCalledWith('employee@example.test');
    expect(result).toMatchObject({ accessToken: 'signed-access-token', tokenType: 'Bearer', expiresInSeconds: 900 });
    expect(result.refreshToken).not.toBe('signed-access-token');
    const session = repository.createSession.mock.calls[0]?.[0];
    expect(session?.refreshTokenHash).not.toBe(result.refreshToken);
    expect(session?.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(issuer.issue).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'u-1', role: 'employee', sessionId: expect.any(String) }),
    );
  });

  it('rejects duplicate identifiers without selecting an arbitrary account', async () => {
    const { repository, service } = makeDependencies();
    repository.findUsersByIdentifier.mockResolvedValue([
      { userId: 'u-1', role: 'employee', disabled: false },
      { userId: 'u-2', role: 'employee', disabled: false },
    ]);
    await expect(service.login({ identifier: 'duplicate', password: 'secret' })).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
    });
    expect(repository.findCredential).not.toHaveBeenCalled();
  });

  it('does not authenticate a disabled account and still performs password verification', async () => {
    const { repository, issuer } = makeDependencies();
    const verifier = jest.fn().mockResolvedValue(true);
    const service = new AuthService(
      repository,
      issuer,
      { accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 2_592_000, dummyPasswordHash: '$argon2id$dummy-hash' },
      verifier,
      () => now,
    );
    repository.findUsersByIdentifier.mockResolvedValue([{ userId: 'u-1', role: 'employee', disabled: true }]);
    await expect(service.login({ identifier: 'employee', password: 'secret' })).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(verifier).toHaveBeenCalled();
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it('returns the same generic failure when a credential is not migrated', async () => {
    const { repository, service } = makeDependencies();
    repository.findCredential.mockResolvedValue(null);
    await expect(service.login({ identifier: 'employee', password: 'secret' })).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('upgrades a correctly verified legacy password to Argon2id before creating a session', async () => {
    const { repository, issuer } = makeDependencies();
    repository.findCredential.mockResolvedValue(null);
    repository.verifyLegacyPassword.mockResolvedValue(true);
    repository.migrateLegacyPassword.mockResolvedValue(true);
    const passwordHasher = jest.fn().mockResolvedValue('$argon2id$test-hash');
    const service = new AuthService(
      repository,
      issuer,
      { accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 2_592_000, dummyPasswordHash: '$argon2id$dummy-hash' },
      jest.fn().mockResolvedValue(true),
      () => now,
      passwordHasher,
    );

    await service.login({ identifier: 'employee', password: 'legacy-password' });

    expect(repository.verifyLegacyPassword).toHaveBeenCalledWith('u-1', 'legacy-password');
    expect(passwordHasher).toHaveBeenCalledWith('legacy-password');
    expect(repository.migrateLegacyPassword).toHaveBeenCalledWith({
      userId: 'u-1',
      password: 'legacy-password',
      passwordHash: '$argon2id$test-hash',
    });
    expect(repository.createSession).toHaveBeenCalledTimes(1);
  });

  it('does not migrate a rejected legacy password or offer PIN as a fallback', async () => {
    const { repository, issuer } = makeDependencies();
    repository.findCredential.mockResolvedValue(null);
    repository.verifyLegacyPassword.mockResolvedValue(false);
    const passwordHasher = jest.fn();
    const service = new AuthService(
      repository,
      issuer,
      { accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 2_592_000, dummyPasswordHash: '$argon2id$dummy-hash' },
      jest.fn().mockResolvedValue(true),
      () => now,
      passwordHasher,
    );

    await expect(service.login({ identifier: 'employee', password: 'wrong-password' })).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
    });

    expect(repository.migrateLegacyPassword).not.toHaveBeenCalled();
    expect(passwordHasher).not.toHaveBeenCalled();
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it('records a failed login and returns a generic authentication error', async () => {
    const { repository } = makeDependencies();
    const verifier = jest.fn().mockResolvedValue(false);
    const serviceWithFailure = new AuthService(
      repository,
      { issue: jest.fn().mockResolvedValue('unused') },
      { accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 2_592_000, dummyPasswordHash: '$argon2id$dummy-hash' },
      verifier,
      () => now,
    );
    await expect(serviceWithFailure.login({ identifier: 'employee', password: 'wrong' })).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(repository.recordFailedLogin).toHaveBeenCalledWith('u-1', now);
  });

  it('rotates a valid refresh token and never returns its stored hash', async () => {
    const { repository, service } = makeDependencies();
    const result = await service.refresh({ refreshToken: 'a'.repeat(48) });
    expect(repository.rotateRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        oldTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        newTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(result.refreshToken).not.toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects a refresh token when its session has expired', async () => {
    const { repository, service } = makeDependencies();
    repository.findRefreshToken.mockResolvedValue({
      userId: 'u-1',
      role: 'employee',
      disabled: false,
      sessionId: 'session-1',
      familyId: 'family-1',
      expiresAt: new Date('2026-10-05T00:00:00Z'),
      sessionExpiresAt: new Date('2026-10-03T00:00:00Z'),
      sessionRevokedAt: null,
      usedAt: null,
      revokedAt: null,
    });
    await expect(service.refresh({ refreshToken: 'a'.repeat(48) })).rejects.toMatchObject({ statusCode: 401 });
    expect(repository.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('revokes the family when rotation loses an atomic race', async () => {
    const { repository, service } = makeDependencies();
    repository.rotateRefreshToken.mockResolvedValue(false);
    await expect(service.refresh({ refreshToken: 'a'.repeat(48) })).rejects.toMatchObject({ statusCode: 401 });
    expect(repository.revokeRefreshTokenFamily).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/), now);
  });

  it('rejects reused or expired refresh tokens', async () => {
    const { repository, service } = makeDependencies();
    repository.findRefreshToken.mockResolvedValue({
      userId: 'u-1',
      role: 'employee',
      disabled: false,
      sessionId: 'session-1',
      familyId: 'family-1',
      expiresAt: new Date('2026-10-03T00:00:00Z'),
      sessionExpiresAt: new Date('2026-11-03T00:00:00Z'),
      sessionRevokedAt: null,
      usedAt: null,
      revokedAt: null,
    });
    await expect(service.refresh({ refreshToken: 'a'.repeat(48) })).rejects.toMatchObject({ statusCode: 401 });
    expect(repository.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('revokes the whole refresh-token family when a consumed token is reused', async () => {
    const { repository, service } = makeDependencies();
    repository.findRefreshToken.mockResolvedValue({
      userId: 'u-1',
      role: 'employee',
      disabled: false,
      sessionId: 'session-1',
      familyId: 'family-1',
      expiresAt: new Date('2026-10-05T00:00:00Z'),
      sessionExpiresAt: new Date('2026-11-03T00:00:00Z'),
      sessionRevokedAt: null,
      usedAt: new Date('2026-10-03T23:59:00Z'),
      revokedAt: null,
    });
    await expect(service.refresh({ refreshToken: 'a'.repeat(48) })).rejects.toMatchObject({ statusCode: 401 });
    expect(repository.revokeRefreshTokenFamily).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/), now);
    expect(repository.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('revokes a refresh token using its hash only', async () => {
    const { repository, service } = makeDependencies();
    const token = 'b'.repeat(48);
    await service.logout({ refreshToken: token });
    expect(repository.revokeRefreshToken).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/), now);
    expect(repository.revokeRefreshToken.mock.calls[0]?.[0]).not.toBe(token);
  });

  it('blocks password change/reset until legacy auth is explicitly cut over', async () => {
    const { repository, issuer } = makeDependencies();
    const delivery = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      repository,
      issuer,
      { accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 2_592_000, dummyPasswordHash: 'dummy' },
      jest.fn().mockResolvedValue(true),
      () => now,
      jest.fn().mockResolvedValue('$argon2id$test-hash'),
      delivery,
    );
    await expect(
      service.changePassword({ userId: 'u-1', currentPassword: 'old', newPassword: 'new-password-long' }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'AUTH_PASSWORD_CHANGE_UNAVAILABLE' });
    await expect(service.requestPasswordReset({ identifier: 'employee@example.test' })).rejects.toMatchObject({
      statusCode: 503,
      code: 'AUTH_PASSWORD_CHANGE_UNAVAILABLE',
    });
    expect(repository.updatePasswordHash).not.toHaveBeenCalled();
    expect(repository.createPasswordResetToken).not.toHaveBeenCalled();
  });

  it('changes a password only after verifying the current Argon2id hash and delegates atomic revocation', async () => {
    const { repository, issuer } = makeDependencies();
    const passwordVerifier = jest.fn().mockResolvedValue(true);
    const passwordHasher = jest.fn().mockResolvedValue('$argon2id$v=19$test-new-hash');
    const service = new AuthService(
      repository,
      issuer,
      {
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 2_592_000,
        dummyPasswordHash: 'dummy',
        legacyPasswordAuthEnabled: false,
        passwordChangesEnabled: true,
      },
      passwordVerifier,
      () => now,
      passwordHasher,
    );
    await service.changePassword({ userId: 'u-1', currentPassword: 'old-password', newPassword: 'new-password-long' });
    expect(passwordVerifier).toHaveBeenCalledWith('old-password', 'argon-hash');
    expect(passwordHasher).toHaveBeenCalledWith('new-password-long');
    expect(repository.updatePasswordHash).toHaveBeenCalledWith({
      userId: 'u-1',
      passwordHash: '$argon2id$v=19$test-new-hash',
      changedAt: now,
    });
  });

  it('stores only a reset-token hash, responds generically, and never reveals the account identifier', async () => {
    const { repository, issuer } = makeDependencies();
    const delivery = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      repository,
      issuer,
      {
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 2_592_000,
        dummyPasswordHash: 'dummy',
        legacyPasswordAuthEnabled: false,
        passwordChangesEnabled: true,
        passwordResetTtlSeconds: 900,
      },
      jest.fn().mockResolvedValue(true),
      () => now,
      jest.fn().mockResolvedValue('$argon2id$v=19$test-hash'),
      delivery,
    );

    const result = await service.requestPasswordReset({ identifier: 'employee@example.test' });
    const delivered = delivery.send.mock.calls[0]?.[0];
    expect(result.message).not.toContain('employee@example.test');
    expect(delivered?.email).toBe('employee@example.test');
    expect(repository.createPasswordResetToken).toHaveBeenCalledWith({
      userId: 'u-1',
      tokenHash: hashRefreshToken(delivered?.token ?? ''),
      createdAt: now,
      expiresAt: new Date(now.getTime() + 900_000),
    });
    expect(repository.createPasswordResetToken.mock.calls[0]?.[0].tokenHash).not.toBe(delivered?.token);
  });

  it('completes a one-time reset with a new Argon2id hash and does not accept unknown tokens', async () => {
    const { repository, issuer } = makeDependencies();
    const passwordHasher = jest.fn().mockResolvedValue('$argon2id$v=19$new-hash');
    const service = new AuthService(
      repository,
      issuer,
      {
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 2_592_000,
        dummyPasswordHash: 'dummy',
        legacyPasswordAuthEnabled: false,
        passwordChangesEnabled: true,
      },
      jest.fn().mockResolvedValue(true),
      () => now,
      passwordHasher,
    );
    await service.completePasswordReset({
      token: 'reset-token-value-with-sufficient-length-0123456789',
      newPassword: 'new-password-long',
    });
    expect(repository.completePasswordReset).toHaveBeenCalledWith({
      tokenHash: hashRefreshToken('reset-token-value-with-sufficient-length-0123456789'),
      passwordHash: '$argon2id$v=19$new-hash',
      completedAt: now,
    });
    expect(passwordHasher).toHaveBeenCalledWith('new-password-long');
  });
});
