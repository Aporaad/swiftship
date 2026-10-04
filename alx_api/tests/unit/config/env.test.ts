import { parseEnvironment } from '../../../src/config/env';

describe('parseEnvironment JWT settings', () => {
  it('uses bounded secure defaults and does not invent key material', () => {
    const environment = parseEnvironment({ NODE_ENV: 'test' });
    expect(environment.jwtPrivateKeyPem).toBeUndefined();
    expect(environment.jwtPublicKeyPem).toBeUndefined();
    expect(environment.authDummyPasswordHash).toBeUndefined();
    expect(environment.jwtIssuer).toBe('swiftship-api');
    expect(environment.jwtAudience).toBe('swiftship-client');
    expect(environment.accessTokenTtlSeconds).toBe(600);
    expect(environment.refreshTokenTtlSeconds).toBe(2_592_000);
    expect(environment.legacyPasswordAuthEnabled).toBe(true);
    expect(environment.passwordChangesEnabled).toBe(false);
    expect(environment.passwordResetTtlSeconds).toBe(900);
  });

  it('rejects access-token lifetimes outside the 5–15 minute plan', () => {
    expect(() => parseEnvironment({ NODE_ENV: 'test', ACCESS_TOKEN_TTL_SECONDS: '901' })).toThrow();
    expect(() => parseEnvironment({ NODE_ENV: 'test', ACCESS_TOKEN_TTL_SECONDS: '299' })).toThrow();
  });

  it('requires a trusted CA and verify-full TLS for production', () => {
    expect(() => parseEnvironment({ NODE_ENV: 'production', DATABASE_SSL_MODE: 'require' })).toThrow();
    expect(() => parseEnvironment({ NODE_ENV: 'production', DATABASE_SSL_MODE: 'verify-full' })).toThrow();
    expect(() =>
      parseEnvironment({
        NODE_ENV: 'production',
        DATABASE_SSL_MODE: 'verify-full',
        DATABASE_SSL_CA_PEM: '-----BEGIN CERTIFICATE-----\ntrusted-ca\n-----END CERTIFICATE-----',
      }),
    ).not.toThrow();
  });
});

describe('local PostgreSQL settings', () => {
  it('allows explicit plaintext TLS mode and the fixed RLS runtime role only outside production', () => {
    const environment = parseEnvironment({
      NODE_ENV: 'development',
      DATABASE_SSL_MODE: 'disable',
      DATABASE_RUNTIME_ROLE: 'alx_api_runtime',
    });
    expect(environment.databaseSslMode).toBe('disable');
    expect(environment.databaseRuntimeRole).toBe('alx_api_runtime');
  });

  it('rejects SSL-disable and runtime-role impersonation in production', () => {
    expect(() => parseEnvironment({ NODE_ENV: 'production', DATABASE_SSL_MODE: 'disable' })).toThrow();
    expect(() =>
      parseEnvironment({
        NODE_ENV: 'production',
        DATABASE_SSL_MODE: 'verify-full',
        DATABASE_SSL_CA_PEM: '-----BEGIN CERTIFICATE-----\\ntrusted-ca\\n-----END CERTIFICATE-----',
        DATABASE_RUNTIME_ROLE: 'alx_api_runtime',
      }),
    ).toThrow();
  });

  it('requires legacy authentication to be disabled before password change/reset can be enabled', () => {
    expect(() =>
      parseEnvironment({
        NODE_ENV: 'test',
        LEGACY_PASSWORD_AUTH_ENABLED: 'true',
        AUTH_PASSWORD_CHANGES_ENABLED: 'true',
      }),
    ).toThrow();
    expect(
      parseEnvironment({
        NODE_ENV: 'test',
        LEGACY_PASSWORD_AUTH_ENABLED: 'false',
        AUTH_PASSWORD_CHANGES_ENABLED: 'true',
      }).passwordChangesEnabled,
    ).toBe(true);
    expect(() => parseEnvironment({ NODE_ENV: 'test', PASSWORD_RESET_TTL_SECONDS: '100' })).toThrow();
  });
});
