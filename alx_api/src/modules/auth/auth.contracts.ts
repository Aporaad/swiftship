export interface AuthTokenPairDto {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}

export interface AuthPrincipalDto {
  userId: string;
  sessionId: string;
  role: string;
}

export interface AuthSessionDto {
  sessionId: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  isCurrent: boolean;
}

export interface PasswordResetDelivery {
  send(input: { email: string; token: string; expiresAt: Date }): Promise<void>;
}

export interface AuthUseCases {
  login(input: { identifier: string; password: string }): Promise<AuthTokenPairDto>;
  refresh(input: { refreshToken: string }): Promise<AuthTokenPairDto>;
  logout(input: { refreshToken: string }): Promise<void>;
  authenticateAccessToken(input: { accessToken: string }): Promise<AuthPrincipalDto>;
  listSessions(input: { userId: string; currentSessionId: string }): Promise<readonly AuthSessionDto[]>;
  revokeSession(input: { userId: string; sessionId: string }): Promise<void>;
  logoutAll(input: { userId: string }): Promise<void>;
  changePassword(input: { userId: string; currentPassword: string; newPassword: string }): Promise<void>;
  requestPasswordReset(input: { identifier: string }): Promise<{ message: string }>;
  completePasswordReset(input: { token: string; newPassword: string }): Promise<void>;
  listPermissions(input: { userId: string }): Promise<readonly string[]>;
}
