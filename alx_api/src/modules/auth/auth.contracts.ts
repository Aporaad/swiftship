export interface AuthTokenPairDto {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}

export interface AuthUseCases {
  login(input: { identifier: string; password: string }): Promise<AuthTokenPairDto>;
  refresh(input: { refreshToken: string }): Promise<AuthTokenPairDto>;
  logout(input: { refreshToken: string }): Promise<void>;
}
