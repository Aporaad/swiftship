import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthTokenPairDto, AuthUseCases } from './auth.contracts';
import { verifyPassword } from './password-hasher';

export interface AuthUser {
  userId: string;
  role: string;
  disabled: boolean;
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
}

export interface AccessTokenIssuer {
  issue(input: { subject: string; role: string; sessionId: string; expiresInSeconds: number }): Promise<string>;
}

export interface AuthServiceOptions {
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  dummyPasswordHash: string;
}

export class AuthServiceError extends Error {
  constructor(
    readonly statusCode: 401,
    readonly code: 'AUTH_INVALID_CREDENTIALS',
    readonly safeMessage: string,
  ) {
    super(safeMessage);
    this.name = 'AuthServiceError';
  }
}

const INVALID_CREDENTIALS = (): AuthServiceError => new AuthServiceError(
  401,
  'AUTH_INVALID_CREDENTIALS',
  'بيانات المصادقة غير صحيحة.',
);

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
  ) {}

  async login(input: { identifier: string; password: string }): Promise<AuthTokenPairDto> {
    const identifier = input.identifier.trim().toLocaleLowerCase('en-US');
    const users = await this.repository.findUsersByIdentifier(identifier);
    const user = users.length === 1 ? users[0] : undefined;
    const now = this.now();
    const credential = user ? await this.repository.findCredential(user.userId) : null;
    const lockedUntil = user ? await this.repository.getLockedUntil(user.userId) : null;
    const hashToVerify = credential?.passwordAlgorithm === 'argon2id'
      ? credential.passwordHash
      : this.options.dummyPasswordHash;

    let passwordMatches = false;
    try {
      passwordMatches = await this.passwordVerifier(input.password, hashToVerify);
    } catch {
      passwordMatches = false;
    }
    const isLocked = lockedUntil !== null && lockedUntil.getTime() > now.getTime();
    if (!user || user.disabled || !credential || credential.passwordAlgorithm !== 'argon2id' || !passwordMatches || isLocked) {
      if (user && !user.disabled && !isLocked) await this.repository.recordFailedLogin(user.userId, now);
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
      !stored
      || stored.disabled
      || stored.revokedAt !== null
      || stored.expiresAt.getTime() <= now.getTime()
      || stored.sessionRevokedAt !== null
      || stored.sessionExpiresAt.getTime() <= now.getTime()
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
