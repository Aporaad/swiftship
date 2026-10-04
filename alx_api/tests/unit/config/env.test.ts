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
  });

  it('rejects access-token lifetimes outside the 5–15 minute plan', () => {
    expect(() => parseEnvironment({ NODE_ENV: 'test', ACCESS_TOKEN_TTL_SECONDS: '901' })).toThrow();
    expect(() => parseEnvironment({ NODE_ENV: 'test', ACCESS_TOKEN_TTL_SECONDS: '299' })).toThrow();
  });

  it('requires a trusted CA and verify-full TLS for production', () => {
    expect(() => parseEnvironment({ NODE_ENV: 'production', DATABASE_SSL_MODE: 'require' })).toThrow();
    expect(() => parseEnvironment({ NODE_ENV: 'production', DATABASE_SSL_MODE: 'verify-full' })).toThrow();
    expect(() => parseEnvironment({
      NODE_ENV: 'production',
      DATABASE_SSL_MODE: 'verify-full',
      DATABASE_SSL_CA_PEM: '-----BEGIN CERTIFICATE-----\ntrusted-ca\n-----END CERTIFICATE-----',
    })).not.toThrow();
  });
});
