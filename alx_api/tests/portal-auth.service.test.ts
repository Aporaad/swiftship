import type { AccessTokenIssuer } from '../src/modules/auth/auth.use-cases';
import type {
  PortalAuthIdentity,
  PortalAuthRepository,
  PortalRefreshTokenRecord,
} from '../src/modules/portal/portal-auth.contracts';
import { PortalAuthService } from '../src/modules/portal/portal-auth.service';

jest.mock('../src/modules/auth/password-hasher', () => ({
  hashPassword: jest.fn().mockResolvedValue('$argon2id$v=19$mocked-hash'),
  verifyPassword: jest.fn().mockResolvedValue(true),
}));

const now = new Date('2026-10-06T19:56:00.000Z');

const customer: PortalAuthIdentity = {
  portalUserId: 'portal-customer-1',
  username: 'sara',
  email: 'sara@example.test',
  fullName: 'Sara Ali',
  phone: '700000000',
  role: 'customer',
  approvalStatus: 'approved',
  onboardingCompleted: true,
  disabled: false,
};

function createRepository(): jest.Mocked<PortalAuthRepository> {
  return {
    findIdentityByIdentifier: jest.fn().mockResolvedValue(null),
    findIdentityById: jest.fn().mockResolvedValue(customer),
    findCredential: jest.fn().mockResolvedValue({
      passwordHash: '$argon2id$v=19$mocked-hash',
      passwordAlgorithm: 'argon2id',
    }),
    createSession: jest.fn().mockResolvedValue(undefined),
    findRefreshToken: jest.fn().mockResolvedValue(null),
    rotateRefreshToken: jest.fn().mockResolvedValue(true),
    revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
    revokeRefreshTokenFamily: jest.fn().mockResolvedValue(undefined),
    revokeSession: jest.fn().mockResolvedValue(undefined),
    revokeAllSessions: jest.fn().mockResolvedValue(undefined),
    updatePassword: jest.fn().mockResolvedValue(undefined),
    createPortalUser: jest.fn().mockImplementation(async (input: Parameters<PortalAuthRepository['createPortalUser']>[0]) => ({
      ...customer,
      portalUserId: input.portalUserId,
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      role: input.role,
      approvalStatus: input.approvalStatus,
      onboardingCompleted: input.onboardingCompleted,
    })),
    updatePortalProfile: jest.fn().mockResolvedValue(customer),
    recordEvent: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<PortalAuthRepository>;
}

function createService(repository = createRepository()) {
  const issuer = {
    issue: jest.fn().mockResolvedValue('signed-access-token'),
  } as unknown as AccessTokenIssuer;
  const service = new PortalAuthService(
    repository,
    issuer,
    {
      accessTokenTtlSeconds: 600,
      refreshTokenTtlSeconds: 86_400,
      accessTokenPublicKeyPem: 'unused-in-unit-test',
      jwtIssuer: 'swiftship-api',
      jwtAudience: 'swiftship-client',
      argon2MemoryKiB: 8_192,
      argon2TimeCost: 1,
      argon2Parallelism: 1,
    },
    () => now,
  );
  return { service, repository, issuer };
}

describe('PortalAuthService', () => {
  it('normalizes a customer registration and issues a session', async () => {
    const { service, repository } = createService();

    const result = await service.register({
      fullName: '  Sara Ali  ',
      phone: ' 700000000 ',
      email: ' SARA@Example.Test ',
      password: 'a-strong-password-123',
      role: 'customer',
    });

    expect(result.profile).toMatchObject({
      username: 'sara',
      email: 'sara@example.test',
      fullName: 'Sara Ali',
      phone: '700000000',
      approvalStatus: 'approved',
    });
    expect(result.pendingApproval).toBe(false);
    expect(result.tokens).toMatchObject({ tokenType: 'Bearer', expiresInSeconds: 600 });
    expect(repository.createPortalUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'sara@example.test',
      username: 'sara',
      approvalStatus: 'approved',
      createdAt: now,
    }));
    expect(repository.createSession).toHaveBeenCalledTimes(1);
  });

  it('holds courier registrations for approval without issuing tokens', async () => {
    const { service, repository } = createService();

    const result = await service.register({
      fullName: 'Ali Courier',
      phone: '700000001',
      email: 'courier@example.test',
      password: 'a-strong-password-123',
      role: 'courier',
    });

    expect(result.pendingApproval).toBe(true);
    expect(result.profile.approvalStatus).toBe('pending_approval');
    expect(result.tokens).toBeNull();
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it('rejects a duplicate email before creating an account', async () => {
    const repository = createRepository();
    repository.findIdentityByIdentifier.mockResolvedValueOnce(customer);
    const { service } = createService(repository);

    await expect(service.register({
      fullName: 'Sara Ali',
      phone: '700000000',
      email: 'SARA@example.test',
      password: 'a-strong-password-123',
      role: 'customer',
    })).rejects.toMatchObject({ statusCode: 409, code: 'PORTAL_ACCOUNT_EXISTS' });
    expect(repository.createPortalUser).not.toHaveBeenCalled();
  });

  it('revokes the whole refresh-token family and records an event when an old token is reused', async () => {
    const repository = createRepository();
    const replayedToken: PortalRefreshTokenRecord = {
      tokenId: 'token-old',
      sessionId: 'session-1',
      portalUserId: customer.portalUserId,
      familyId: 'family-1',
      expiresAt: new Date(now.getTime() + 60_000),
      sessionExpiresAt: new Date(now.getTime() + 60_000),
      sessionRevokedAt: null,
      usedAt: new Date(now.getTime() - 1_000),
      revokedAt: null,
    };
    repository.findRefreshToken.mockResolvedValue(replayedToken);
    const { service } = createService(repository);

    await expect(service.refresh('replayed-refresh-token')).rejects.toMatchObject({
      statusCode: 401,
      code: 'PORTAL_AUTH_INVALID_CREDENTIALS',
    });
    expect(repository.revokeRefreshTokenFamily).toHaveBeenCalledWith('family-1', now);
    expect(repository.recordEvent).toHaveBeenCalledWith({
      portalUserId: customer.portalUserId,
      eventType: 'refresh.reuse_detected',
      success: false,
      occurredAt: now,
    });
    expect(repository.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('revokes the complete session when logging out with a known refresh token', async () => {
    const repository = createRepository();
    repository.findRefreshToken.mockResolvedValue({
      tokenId: 'token-current',
      sessionId: 'session-logout',
      portalUserId: customer.portalUserId,
      familyId: 'family-logout',
      expiresAt: new Date(now.getTime() + 60_000),
      sessionExpiresAt: new Date(now.getTime() + 60_000),
      sessionRevokedAt: null,
      usedAt: null,
      revokedAt: null,
    });
    const { service } = createService(repository);

    await service.logout('current-refresh-token');

    expect(repository.revokeSession).toHaveBeenCalledWith('session-logout', 'logout', now);
    expect(repository.revokeRefreshToken).not.toHaveBeenCalled();
  });
});
