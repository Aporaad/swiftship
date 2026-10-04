import { generateKeyPairSync } from 'node:crypto';
import { Ed25519AccessTokenIssuer, InvalidAccessTokenError, verifyAccessToken } from '../../../src/modules/auth/access-token';

const fixedNow = new Date('2026-10-04T00:00:00.000Z');
const keyPair = generateKeyPairSync('ed25519');
const privateKeyPem = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

function createIssuer(now: () => Date = () => fixedNow) {
  return new Ed25519AccessTokenIssuer(privateKeyPem, 'swiftship-api', 'swiftship-client', now);
}

describe('Ed25519 access token', () => {
  it('issues a short-lived token with validated standard claims', async () => {
    const token = await createIssuer().issue({
      subject: 'user-1', role: 'operator', sessionId: 'session-1', expiresInSeconds: 600,
    });
    const claims = verifyAccessToken(token, {
      publicKeyPem,
      issuer: 'swiftship-api',
      audience: 'swiftship-client',
      now: () => fixedNow,
    });

    expect(claims).toMatchObject({
      iss: 'swiftship-api', aud: 'swiftship-client', sub: 'user-1', sid: 'session-1', role: 'operator',
      iat: Math.floor(fixedNow.getTime() / 1_000), exp: Math.floor(fixedNow.getTime() / 1_000) + 600,
    });
    expect(claims.jti).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('rejects invalid lifetime and non-Ed25519 keys', async () => {
    await expect(createIssuer().issue({ subject: 'u', role: 'r', sessionId: 's', expiresInSeconds: 901 }))
      .rejects.toThrow(RangeError);
    expect(() => new Ed25519AccessTokenIssuer('not a key', 'iss', 'aud')).toThrow();
  });

  it('rejects a modified signature and mismatched issuer/audience', async () => {
    const token = await createIssuer().issue({
      subject: 'user-1', role: 'operator', sessionId: 'session-1', expiresInSeconds: 600,
    });
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) throw new Error('Expected a compact JWT with three segments.');
    const tampered = `${header}.${payload}.${signature.slice(0, -1)}${signature.endsWith('a') ? 'b' : 'a'}`;

    expect(() => verifyAccessToken(tampered, { publicKeyPem, issuer: 'swiftship-api', audience: 'swiftship-client', now: () => fixedNow }))
      .toThrow(InvalidAccessTokenError);
    expect(() => verifyAccessToken(token, { publicKeyPem, issuer: 'wrong-issuer', audience: 'swiftship-client', now: () => fixedNow }))
      .toThrow(InvalidAccessTokenError);
    expect(() => verifyAccessToken(token, { publicKeyPem, issuer: 'swiftship-api', audience: 'wrong-audience', now: () => fixedNow }))
      .toThrow(InvalidAccessTokenError);
  });

  it('rejects expired tokens', async () => {
    const token = await createIssuer().issue({
      subject: 'user-1', role: 'operator', sessionId: 'session-1', expiresInSeconds: 300,
    });
    expect(() => verifyAccessToken(token, {
      publicKeyPem,
      issuer: 'swiftship-api',
      audience: 'swiftship-client',
      now: () => new Date(fixedNow.getTime() + 301_000),
    })).toThrow(InvalidAccessTokenError);
  });
});
