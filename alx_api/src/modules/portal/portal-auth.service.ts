import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { verifyAccessToken } from '../auth/access-token';
import { hashPassword, verifyPassword } from '../auth/password-hasher';
import type { AccessTokenIssuer } from '../auth/auth.use-cases';
import type {
  PortalAuthPrincipalDto,
  PortalAuthProfileDto,
  PortalAuthIdentity,
  PortalAuthRepository,
  PortalAuthTokenPairDto,
  PortalRegisterResultDto,
} from './portal-auth.contracts';

export class PortalAuthServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    readonly safeMessage: string,
  ) {
    super(safeMessage);
  }
}

const invalidCredentials = () => new PortalAuthServiceError(
  401,
  'PORTAL_AUTH_INVALID_CREDENTIALS',
  'بيانات دخول البوابة غير صحيحة.',
);

const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');

const deriveUsername = (email: string, provided?: string): string => {
  if (provided) return provided.trim().toLowerCase();

  const localPart = (email.split('@')[0] ?? 'portaluser').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/gi, '') || 'portaluser';
  const uniqueSuffix = createHash('sha256').update(email).digest('hex').slice(0, 8);
  return `${localPart.slice(0, 69)}_${uniqueSuffix}`;
};

export interface PortalAuthServiceOptions {
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  accessTokenPublicKeyPem: string;
  jwtIssuer: string;
  jwtAudience: string;
  argon2MemoryKiB: number;
  argon2TimeCost: number;
  argon2Parallelism: number;
}

export class PortalAuthService {
  constructor(
    private readonly repository: PortalAuthRepository,
    private readonly issuer: AccessTokenIssuer,
    private readonly options: PortalAuthServiceOptions,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async login(input: { identifier: string; password: string }): Promise<PortalAuthTokenPairDto> {
    const identity = await this.repository.findIdentityByIdentifier(input.identifier);
    if (!identity || identity.disabled || identity.approvalStatus === 'rejected') {
      await this.repository.recordEvent({
        portalUserId: identity?.portalUserId ?? null,
        eventType: 'login.failure',
        success: false,
        occurredAt: this.now(),
      });
      throw invalidCredentials();
    }

    const credential = await this.repository.findCredential(identity.portalUserId);
    if (!credential || !(await verifyPassword(input.password, credential.passwordHash))) {
      await this.repository.recordEvent({
        portalUserId: identity.portalUserId,
        eventType: 'login.failure',
        success: false,
        occurredAt: this.now(),
      });
      throw invalidCredentials();
    }

    if (identity.approvalStatus !== 'approved') {
      throw new PortalAuthServiceError(403, 'PORTAL_ACCOUNT_PENDING', 'حساب البوابة بانتظار اعتماد الإدارة.');
    }

    return this.issueSession(identity.portalUserId, identity.role);
  }

  async register(input: {
    fullName: string;
    phone: string;
    email: string;
    password: string;
    role: 'customer' | 'courier' | 'supplier';
    username?: string;
    address?: string;
    joinBy?: string;
    referrerId?: string;
    companyName?: string;
    commercialRegister?: string;
    courierType?: 'local' | 'sourcing';
    identityDocNote?: string;
  }): Promise<PortalRegisterResultDto> {
    const email = input.email.trim().toLowerCase();
    const username = deriveUsername(email, input.username);
    const emailExists = await this.repository.findIdentityByIdentifier(email);
    const usernameExists = await this.repository.findIdentityByIdentifier(username);
    if (emailExists || usernameExists) {
      throw new PortalAuthServiceError(409, 'PORTAL_ACCOUNT_EXISTS', 'يوجد حساب Portal بهذه البيانات مسبقاً.');
    }

    const createdAt = this.now();
    const approvalStatus = input.role === 'customer' ? 'approved' : 'pending_approval';
    const passwordHash = await hashPassword(input.password, {
      memoryCostKiB: this.options.argon2MemoryKiB,
      timeCost: this.options.argon2TimeCost,
      parallelism: this.options.argon2Parallelism,
    });
    let identity: PortalAuthIdentity;
    try {
      identity = await this.repository.createPortalUser({
        portalUserId: randomUUID(),
        username,
        email,
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        role: input.role,
        approvalStatus,
        onboardingCompleted: input.role !== 'customer',
        passwordHash,
        createdAt,
        ...(input.address !== undefined ? { address: input.address.trim() } : {}),
        ...(input.joinBy !== undefined ? { joinBy: input.joinBy.trim() } : {}),
        ...(input.referrerId !== undefined ? { referrerId: input.referrerId.trim() } : {}),
        ...(input.companyName !== undefined ? { companyName: input.companyName.trim() } : {}),
        ...(input.commercialRegister !== undefined ? { commercialRegister: input.commercialRegister.trim() } : {}),
        ...(input.courierType !== undefined ? { courierType: input.courierType } : {}),
        ...(input.identityDocNote !== undefined ? { identityDocNote: input.identityDocNote.trim() } : {}),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'PORTAL_ACCOUNT_EXISTS') {
        throw new PortalAuthServiceError(409, 'PORTAL_ACCOUNT_EXISTS', 'يوجد حساب Portal بهذه البيانات مسبقاً.');
      }
      throw error;
    }

    return {
      profile: this.toProfile(identity),
      pendingApproval: approvalStatus !== 'approved',
      tokens: approvalStatus === 'approved'
        ? await this.issueSession(identity.portalUserId, identity.role)
        : null,
    };
  }

  async refresh(refreshToken: string): Promise<PortalAuthTokenPairDto> {
    const now = this.now();
    const oldTokenHash = hashRefreshToken(refreshToken);
    const record = await this.repository.findRefreshToken(oldTokenHash);
    if (!record) throw invalidCredentials();

    if (record.usedAt) {
      await this.repository.revokeRefreshTokenFamily(record.familyId, now);
      await this.repository.recordEvent({
        portalUserId: record.portalUserId,
        eventType: 'refresh.reuse_detected',
        success: false,
        occurredAt: now,
      });
      throw invalidCredentials();
    }

    if (
      record.revokedAt
      || record.sessionRevokedAt
      || record.expiresAt <= now
      || record.sessionExpiresAt <= now
    ) {
      await this.repository.revokeRefreshToken(oldTokenHash, now);
      throw invalidCredentials();
    }

    const identity = await this.repository.findIdentityById(record.portalUserId);
    if (!identity || identity.disabled || identity.approvalStatus !== 'approved') {
      throw invalidCredentials();
    }

    const nextRefreshToken = randomBytes(48).toString('base64url');
    const nextTokenId = randomUUID();
    const nextExpiry = new Date(now.getTime() + this.options.refreshTokenTtlSeconds * 1000);
    const rotated = await this.repository.rotateRefreshToken({
      oldTokenHash,
      newTokenHash: hashRefreshToken(nextRefreshToken),
      newTokenId: nextTokenId,
      rotatedAt: now,
      newExpiresAt: nextExpiry,
    });
    if (!rotated) throw invalidCredentials();

    return {
      accessToken: await this.issuer.issue({
        subject: identity.portalUserId,
        role: identity.role,
        sessionId: record.sessionId,
        expiresInSeconds: this.options.accessTokenTtlSeconds,
      }),
      refreshToken: nextRefreshToken,
      tokenType: 'Bearer',
      expiresInSeconds: this.options.accessTokenTtlSeconds,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const revokedAt = this.now();
    const tokenHash = hashRefreshToken(refreshToken);
    const record = await this.repository.findRefreshToken(tokenHash);
    if (!record) {
      await this.repository.revokeRefreshToken(tokenHash, revokedAt);
      return;
    }

    await this.repository.revokeSession(record.sessionId, 'logout', revokedAt);
  }

  authenticateAccessToken(accessToken: string): PortalAuthPrincipalDto {
    const claims = verifyAccessToken(accessToken, {
      publicKeyPem: this.options.accessTokenPublicKeyPem,
      issuer: this.options.jwtIssuer,
      audience: this.options.jwtAudience,
    });
    return {
      portalUserId: claims.sub,
      sessionId: claims.sid,
      role: claims.role as PortalAuthPrincipalDto['role'],
      approvalStatus: 'approved',
    };
  }

  async profile(portalUserId: string): Promise<PortalAuthProfileDto> {
    const identity = await this.repository.findIdentityById(portalUserId);
    if (!identity || identity.disabled) throw invalidCredentials();
    return this.toProfile(identity);
  }

  async updateProfile(input: {
    portalUserId: string;
    fullName?: string;
    phone?: string;
    address?: string;
  }): Promise<PortalAuthProfileDto> {
    return this.toProfile(await this.repository.updatePortalProfile({
      ...input,
      updatedAt: this.now(),
    }));
  }

  async changePassword(input: {
    portalUserId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const credential = await this.repository.findCredential(input.portalUserId);
    if (!credential || !(await verifyPassword(input.currentPassword, credential.passwordHash))) {
      throw invalidCredentials();
    }

    const passwordHash = await hashPassword(input.newPassword, {
      memoryCostKiB: this.options.argon2MemoryKiB,
      timeCost: this.options.argon2TimeCost,
      parallelism: this.options.argon2Parallelism,
    });
    await this.repository.updatePassword({
      portalUserId: input.portalUserId,
      passwordHash,
      changedAt: this.now(),
    });
  }

  private toProfile(identity: PortalAuthIdentity): PortalAuthProfileDto {
    return {
      portalUserId: identity.portalUserId,
      username: identity.username,
      email: identity.email,
      fullName: identity.fullName,
      phone: identity.phone,
      role: identity.role,
      approvalStatus: identity.approvalStatus,
      onboardingCompleted: identity.onboardingCompleted,
      ...(identity.address ? { address: identity.address } : {}),
      ...(identity.linkedAccId ? { linkedAccId: identity.linkedAccId } : {}),
      ...(identity.linkedCustomerId ? { linkedCustomerId: identity.linkedCustomerId } : {}),
      ...(identity.linkedCourierId ? { linkedCourierId: identity.linkedCourierId } : {}),
      ...(identity.linkedSourceId ? { linkedSourceId: identity.linkedSourceId } : {}),
      ...(identity.financialAccountId ? { financialAccountId: identity.financialAccountId } : {}),
      ...(identity.financialAccountCode ? { financialAccountCode: identity.financialAccountCode } : {}),
      ...(identity.financialCurrency ? { financialCurrency: identity.financialCurrency } : {}),
      ...(identity.joinBy ? { joinBy: identity.joinBy } : {}),
      ...(identity.referrerId ? { referrerId: identity.referrerId } : {}),
    };
  }

  private async issueSession(portalUserId: string, role: string): Promise<PortalAuthTokenPairDto> {
    const createdAt = this.now();
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(createdAt.getTime() + this.options.refreshTokenTtlSeconds * 1000);

    await this.repository.createSession({
      sessionId,
      portalUserId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      familyId,
      createdAt,
      expiresAt,
    });

    return {
      accessToken: await this.issuer.issue({
        subject: portalUserId,
        role,
        sessionId,
        expiresInSeconds: this.options.accessTokenTtlSeconds,
      }),
      refreshToken,
      tokenType: 'Bearer',
      expiresInSeconds: this.options.accessTokenTtlSeconds,
    };
  }
}
