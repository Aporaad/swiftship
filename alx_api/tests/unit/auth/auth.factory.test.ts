import { generateKeyPairSync } from 'node:crypto';
import { parseEnvironment } from '../../../src/config/env';
import type { DatabaseConnection } from '../../../src/db/pool';
import { createAuthUseCases } from '../../../src/modules/auth/auth.factory';

const keyPair = generateKeyPairSync('ed25519');
const privateKeyPem = keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const publicKeyPem = keyPair.publicKey.export({ format: 'pem', type: 'spki' }).toString();

describe('createAuthUseCases', () => {
  it('does not construct a storage-backed service without an Ed25519 private key', () => {
    const environment = parseEnvironment({ NODE_ENV: 'test' });
    expect(() => createAuthUseCases({} as DatabaseConnection, environment)).toThrow('AUTH_SIGNING_KEY_NOT_CONFIGURED');
  });

  it('requires a public verification key before enabling bearer authentication', () => {
    const environment = parseEnvironment({ NODE_ENV: 'test', JWT_PRIVATE_KEY_PEM: privateKeyPem });
    expect(() => createAuthUseCases({} as DatabaseConnection, environment)).toThrow(
      'AUTH_VERIFICATION_KEY_NOT_CONFIGURED',
    );
  });

  it('requires a valid Argon2id dummy hash before enabling credential verification', () => {
    const environment = parseEnvironment({
      NODE_ENV: 'test',
      JWT_PRIVATE_KEY_PEM: privateKeyPem,
      JWT_PUBLIC_KEY_PEM: publicKeyPem,
    });
    expect(() => createAuthUseCases({} as DatabaseConnection, environment)).toThrow(
      'AUTH_DUMMY_ARGON2ID_HASH_NOT_CONFIGURED',
    );
  });
});
