import type { PortalRole, ApprovalStatus } from './portal.contracts';

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

export interface PortalAuthRepository {
  findIdentityByIdentifier(identifier: string): Promise<PortalAuthIdentity | null>;
  findCredential(portalUserId: string): Promise<PortalAuthCredential | null>;
  createSession(input: {
    sessionId: string;
    portalUserId: string;
    refreshTokenHash: string;
    familyId: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  revokeSession(sessionId: string, reason: string, revokedAt: Date): Promise<void>;
  revokeAllSessions(portalUserId: string, reason: string, revokedAt: Date): Promise<void>;
  updatePassword(input: {
    portalUserId: string;
    passwordHash: string;
    changedAt: Date;
  }): Promise<void>;
  recordEvent(input: {
    portalUserId: string | null;
    eventType: string;
    success: boolean;
    occurredAt: Date;
  }): Promise<void>;
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
}

export interface PortalAuthCredential {
  passwordHash: string;
  passwordAlgorithm: 'argon2id';
}
