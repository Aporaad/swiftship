import type { ApprovalStatus, PortalRole } from './portal.contracts';

export interface PortalAuthPrincipalDto {
  portalUserId: string;
  sessionId: string;
  role: PortalRole;
  approvalStatus: ApprovalStatus;
}

export interface PortalAuthTokenPairDto {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}

export interface PortalAuthProfileDto {
  portalUserId: string;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  role: PortalRole;
  approvalStatus: ApprovalStatus;
  onboardingCompleted: boolean;
}

export interface PortalRegisterResultDto {
  profile: PortalAuthProfileDto;
  pendingApproval: boolean;
  tokens: PortalAuthTokenPairDto | null;
}

export interface PortalAuthRepository {
  findIdentityByIdentifier(identifier: string): Promise<PortalAuthIdentity | null>;
  findIdentityById(portalUserId: string): Promise<PortalAuthIdentity | null>;
  findCredential(portalUserId: string): Promise<PortalAuthCredential | null>;
  createSession(input: {
    sessionId: string;
    portalUserId: string;
    refreshTokenHash: string;
    familyId: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<PortalRefreshTokenRecord | null>;
  rotateRefreshToken(input: {
    oldTokenHash: string;
    newTokenHash: string;
    newTokenId: string;
    rotatedAt: Date;
    newExpiresAt: Date;
  }): Promise<boolean>;
  revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void>;
  revokeSession(sessionId: string, reason: string, revokedAt: Date): Promise<void>;
  revokeAllSessions(portalUserId: string, reason: string, revokedAt: Date): Promise<void>;
  updatePassword(input: { portalUserId: string; passwordHash: string; changedAt: Date }): Promise<void>;
  createPortalUser(input: {
    portalUserId: string;
    username: string;
    email: string;
    fullName: string;
    phone: string;
    role: PortalRole;
    approvalStatus: ApprovalStatus;
    onboardingCompleted: boolean;
    passwordHash: string;
    createdAt: Date;
  }): Promise<PortalAuthIdentity>;
  updatePortalProfile(input: {
    portalUserId: string;
    username?: string;
    email?: string;
    fullName?: string;
    phone?: string;
    updatedAt: Date;
  }): Promise<PortalAuthIdentity>;
  recordEvent(input: { portalUserId: string | null; eventType: string; success: boolean; occurredAt: Date }): Promise<void>;
}

export interface PortalAuthIdentity {
  portalUserId: string;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  role: PortalRole;
  approvalStatus: ApprovalStatus;
  onboardingCompleted: boolean;
  disabled: boolean;
}

export interface PortalAuthCredential {
  passwordHash: string;
  passwordAlgorithm: 'argon2id';
}

export interface PortalRefreshTokenRecord {
  tokenId: string;
  sessionId: string;
  portalUserId: string;
  familyId: string;
  expiresAt: Date;
  sessionExpiresAt: Date;
  sessionRevokedAt: Date | null;
  usedAt: Date | null;
  revokedAt: Date | null;
}
