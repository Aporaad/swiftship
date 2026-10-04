import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type {
  AuthPrincipalDto,
  AuthSessionDto,
  AuthTokenPairDto,
  AuthUseCases,
  PasswordResetDelivery,
} from './auth.contracts';
import { verifyAccessToken } from './access-token';
import { hashPassword, verifyPassword } from './password-hasher';

export interface AuthUser {
  userId: string;
  role: string;
  disabled: boolean;
  email?: string | null;
}

export interface PasswordCredential {
  passwordHash: string;
  passwordAlgorithm: 'argon2id';
}

export interface RefreshTokenRecord {
  userId: string;
  role: string;
  disabled: boolean;
  sessionId: string;
  familyId: string;
  expiresAt: Date;
  sessionExpiresAt: Date;
  sessionRevokedAt: Date | null;
  usedAt: Date | null;
  revokedAt: Date | null;
}

export interface AuthRepository {
  findUsersByIdentifier(identifier: string): Promise<readonly AuthUser[]>;
  findCredential(userId: string): Promise<PasswordCredential | null>;
  verifyLegacyPassword(userId: string, password: string): Promise<boolean>;
  migrateLegacyPassword(input: { userId: string; password: string; passwordHash: string }): Promise<boolean>;
  getLockedUntil(userId: string): Promise<Date | null>;
  recordFailedLogin(userId: string, occurredAt: Date): Promise<void>;
  clearFailedLogins(userId: string, occurredAt: Date): Promise<void>;
  createSession(input: {
    sessionId: string;
    familyId: string;
    userId: string;
    refreshTokenHash: string;
    createdAt: Date;
    refreshExpiresAt: Date;
  }): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  rotateRefreshToken(input: {
    oldTokenHash: string;
    newTokenHash: string;
    newTokenId: string;
    rotatedAt: Date;
    newExpiresAt: Date;
  }): Promise<boolean>;
  revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void>;
  revokeRefreshTokenFamily(tokenHash: string, revokedAt: Date): Promise<void>;
  findActiveSession(input: { userId: string; sessionId: string; now: Date }): Promise<AuthUser | null>;
  listSessions(input: { userId: string; currentSessionId: string; now: Date }): Promise<readonly AuthSessionDto[]>;
  revokeSession(input: { userId: string; sessionId: string; revokedAt: Date }): Promise<void>;
  revokeAllSessions(input: { userId: string; revokedAt: Date }): Promise<void>;
  recordAuthEvent(input: {
    userId: string | null;
    eventType: string;
    success: boolean;
    occurredAt: Date;
  }): Promise<void>;
  updatePasswordHash(input: { userId: string; passwordHash: string; changedAt: Date }): Promise<boolean>;
  createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<boolean>;
  completePasswordReset(input: { tokenHash: string; passwordHash: string; completedAt: Date }): Promise<boolean>;
  revokePasswordResetToken(input: { tokenHash: string; revokedAt: Date }): Promise<void>;
  listPermissions(userId: string): Promise<readonly string[]>;
}

export interface AccessTokenIssuer {
  issue(input: { subject: string; role: string; sessionId: string; expiresInSeconds: number }): Promise<string>;
}

export interface AuthServiceOptions {
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  dummyPasswordHash: string;
  accessTokenPublicKeyPem?: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  legacyPasswordAuthEnabled?: boolean;
  passwordChangesEnabled?: boolean;
  passwordResetTtlSeconds?: number;
}

export class AuthServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    readonly safeMessage: string,
  ) {
    super(safeMessage);
    this.name = 'AuthServiceError';
  }
}

const INVALID_CREDENTIALS = (): AuthServiceError =>
  new AuthServiceError(401, 'AUTH_INVALID_CREDENTIALS', 'بيانات المصادقة غير صحيحة.');

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export class AuthService implements AuthUseCases {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokenIssuer: AccessTokenIssuer,
    private readonly options: AuthServiceOptions,
    private readonly passwordVerifier: (password: string, hash: string) => Promise<boolean> = verifyPassword,
    private readonly now: () => Date = () => new Date(),
    private readonly passwordHasher: (password: string) => Promise<string> = hashPassword,
    private readonly passwordResetDelivery?: PasswordResetDelivery,
  ) {}

  async login(input: { identifier: string; password: string }): Promise<AuthTokenPairDto> {
    const identifier = input.identifier.trim().toLocaleLowerCase('en-US');
    const users = await this.repository.findUsersByIdentifier(identifier);
    const user = users.length === 1 ? users[0] : undefined;
    const now = this.now();
    const credential = user ? await this.repository.findCredential(user.userId) : null;
    const lockedUntil = user ? await this.repository.getLockedUntil(user.userId) : null;
    const isLocked = lockedUntil !== null && lockedUntil.getTime() > now.getTime();
    let passwordMatches = false;

    if (credential?.passwordAlgorithm === 'argon2id') {
      try {
        passwordMatches = await this.passwordVerifier(input.password, credential.passwordHash);
      } catch {
        passwordMatches = false;
      }
    } else if (this.options.legacyPasswordAuthEnabled !== false) {
      try {
        await this.passwordVerifier(input.password, this.options.dummyPasswordHash);
      } catch {
        // Keep the same generic authentication response for malformed credentials.
      }

      if (user && !user.disabled && !isLocked) {
        const legacyPasswordMatches = await this.repository.verifyLegacyPassword(user.userId, input.password);
        if (legacyPasswordMatches) {
          const passwordHash = await this.passwordHasher(input.password);
          const migrated = await this.repository.migrateLegacyPassword({
            userId: user.userId,
            password: input.password,
            passwordHash,
          });

          if (migrated) {
            passwordMatches = true;
          } else {
            const concurrentCredential = await this.repository.findCredential(user.userId);
            if (concurrentCredential?.passwordAlgorithm === 'argon2id') {
              try {
                passwordMatches = await this.passwordVerifier(input.password, concurrentCredential.passwordHash);
              } catch {
                passwordMatches = false;
              }
            }
          }
        }
      }
    } else {
      try {
        await this.passwordVerifier(input.password, this.options.dummyPasswordHash);
      } catch {
        // Do not consult the legacy password source after explicit client cutover.
      }
    }

    if (!user || user.disabled || !passwordMatches || isLocked) {
      if (user && !user.disabled && !isLocked) await this.repository.recordFailedLogin(user.userId, now);
      await this.repository.recordAuthEvent({
        userId: user?.userId ?? null,
        eventType: 'auth.login.failed',
        success: false,
        occurredAt: now,
      });
      throw INVALID_CREDENTIALS();
    }

    await this.repository.clearFailedLogins(user.userId, now);
    return this.createTokenPair(user, now, randomUUID());
  }

  async refresh(input: { refreshToken: string }): Promise<AuthTokenPairDto> {
    const now = this.now();
    const oldTokenHash = hashRefreshToken(input.refreshToken);
    const stored = await this.repository.findRefreshToken(oldTokenHash);
    if (stored?.usedAt !== null && stored?.usedAt !== undefined) {
      await this.repository.revokeRefreshTokenFamily(oldTokenHash, now);
      throw INVALID_CREDENTIALS();
    }
    if (
      !stored ||
      stored.disabled ||
      stored.revokedAt !== null ||
      stored.expiresAt.getTime() <= now.getTime() ||
      stored.sessionRevokedAt !== null ||
      stored.sessionExpiresAt.getTime() <= now.getTime()
    ) {
      throw INVALID_CREDENTIALS();
    }

    const user: AuthUser = { userId: stored.userId, role: stored.role, disabled: stored.disabled };
    const sessionId = stored.sessionId;
    const nextRefreshToken = randomBytes(48).toString('base64url');
    const nextTokenHash = hashRefreshToken(nextRefreshToken);
    const nextExpiry = new Date(now.getTime() + this.options.refreshTokenTtlSeconds * 1_000);
    const accessToken = await this.tokenIssuer.issue({
      subject: user.userId,
      role: user.role,
      sessionId,
      expiresInSeconds: this.options.accessTokenTtlSeconds,
    });
    const rotated = await this.repository.rotateRefreshToken({
      oldTokenHash,
      newTokenHash: nextTokenHash,
      newTokenId: randomUUID(),
      rotatedAt: now,
      newExpiresAt: nextExpiry,
    });
    if (!rotated) {
      await this.repository.revokeRefreshTokenFamily(oldTokenHash, now);
      throw INVALID_CREDENTIALS();
    }

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      tokenType: 'Bearer',
      expiresInSeconds: this.options.accessTokenTtlSeconds,
    };
  }

  async logout(input: { refreshToken: string }): Promise<void> {
    await this.repository.revokeRefreshToken(hashRefreshToken(input.refreshToken), this.now());
  }

  async authenticateAccessToken(input: { accessToken: string }): Promise<AuthPrincipalDto> {
    const { accessTokenPublicKeyPem, jwtIssuer, jwtAudience } = this.options;
    if (!accessTokenPublicKeyPem || !jwtIssuer || !jwtAudience) throw INVALID_CREDENTIALS();

    let claims;
    try {
      claims = verifyAccessToken(input.accessToken, {
        publicKeyPem: accessTokenPublicKeyPem,
        issuer: jwtIssuer,
        audience: jwtAudience,
        now: this.now,
      });
    } catch {
      throw INVALID_CREDENTIALS();
    }

    const activeUser = await this.repository.findActiveSession({
      userId: claims.sub,
      sessionId: claims.sid,
      now: this.now(),
    });
    if (!activeUser || activeUser.disabled) throw INVALID_CREDENTIALS();

    return { userId: activeUser.userId, sessionId: claims.sid, role: activeUser.role };
  }

  async listSessions(input: { userId: string; currentSessionId: string }): Promise<readonly AuthSessionDto[]> {
    return this.repository.listSessions({ ...input, now: this.now() });
  }

  async revokeSession(input: { userId: string; sessionId: string }): Promise<void> {
    await this.repository.revokeSession({ ...input, revokedAt: this.now() });
  }

  async logoutAll(input: { userId: string }): Promise<void> {
    await this.repository.revokeAllSessions({ userId: input.userId, revokedAt: this.now() });
  }

  async changePassword(input: { userId: string; currentPassword: string; newPassword: string }): Promise<void> {
    this.requirePasswordCutover();
    const credential = await this.repository.findCredential(input.userId);
    if (!credential) throw INVALID_CREDENTIALS();
    let passwordMatches: boolean;
    try {
      passwordMatches = await this.passwordVerifier(input.currentPassword, credential.passwordHash);
    } catch {
      passwordMatches = false;
    }
    if (!passwordMatches) {
      await this.repository.recordAuthEvent({
        userId: input.userId,
        eventType: 'password.change.failed',
        success: false,
        occurredAt: this.now(),
      });
      throw INVALID_CREDENTIALS();
    }
    const changed = await this.repository.updatePasswordHash({
      userId: input.userId,
      passwordHash: await this.passwordHasher(input.newPassword),
      changedAt: this.now(),
    });
    if (!changed) throw INVALID_CREDENTIALS();
  }

  async requestPasswordReset(input: { identifier: string }): Promise<{ message: string }> {
    this.requirePasswordCutover();
    if (!this.passwordResetDelivery) {
      throw new AuthServiceError(503, 'AUTH_PASSWORD_RESET_UNAVAILABLE', 'خدمة إرسال رابط الاستعادة غير مهيأة.');
    }
    const message = 'إذا كان الحساب موجوداً، فسيصل رابط إعادة التعيين إلى وسيلة التواصل المسجلة.';
    const identifier = input.identifier.trim().toLocaleLowerCase('en-US');
    const users = await this.repository.findUsersByIdentifier(identifier);
    const user = users.length === 1 ? users[0] : undefined;
    if (!user || user.disabled || !user.email) return { message };

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashRefreshToken(token);
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + (this.options.passwordResetTtlSeconds ?? 900) * 1_000);
    const created = await this.repository.createPasswordResetToken({
      userId: user.userId,
      tokenHash,
      createdAt,
      expiresAt,
    });
    if (!created) return { message };

    try {
      await this.passwordResetDelivery.send({ email: user.email, token, expiresAt });
    } catch {
      await this.repository.revokePasswordResetToken({ tokenHash, revokedAt: this.now() });
      throw new AuthServiceError(503, 'AUTH_PASSWORD_RESET_UNAVAILABLE', 'تعذر إرسال رابط إعادة التعيين حالياً.');
    }
    await this.repository.recordAuthEvent({
      userId: user.userId,
      eventType: 'password.reset.requested',
      success: true,
      occurredAt: this.now(),
    });
    return { message };
  }

  async completePasswordReset(input: { token: string; newPassword: string }): Promise<void> {
    this.requirePasswordCutover();
    const completed = await this.repository.completePasswordReset({
      tokenHash: hashRefreshToken(input.token),
      passwordHash: await this.passwordHasher(input.newPassword),
      completedAt: this.now(),
    });
    if (!completed) throw INVALID_CREDENTIALS();
  }

  async listPermissions(input: { userId: string }): Promise<readonly string[]> {
    return this.repository.listPermissions(input.userId);
  }

  private requirePasswordCutover(): void {
    if (this.options.legacyPasswordAuthEnabled !== false || this.options.passwordChangesEnabled !== true) {
      throw new AuthServiceError(
        503,
        'AUTH_PASSWORD_CHANGE_UNAVAILABLE',
        'تدفق تغيير كلمة المرور متوقف حتى اكتمال تحويل العملاء إلى API.',
      );
    }
  }

  private async createTokenPair(user: AuthUser, now: Date, sessionId: string): Promise<AuthTokenPairDto> {
    const familyId = randomUUID();
    const refreshToken = randomBytes(48).toString('base64url');
    const accessToken = await this.tokenIssuer.issue({
      subject: user.userId,
      role: user.role,
      sessionId,
      expiresInSeconds: this.options.accessTokenTtlSeconds,
    });
    await this.repository.createSession({
      sessionId,
      familyId,
      userId: user.userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      createdAt: now,
      refreshExpiresAt: new Date(now.getTime() + this.options.refreshTokenTtlSeconds * 1_000),
    });
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresInSeconds: this.options.accessTokenTtlSeconds,
    };
  }
}
