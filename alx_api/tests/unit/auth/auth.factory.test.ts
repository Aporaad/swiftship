import { parseEnvironment } from '../../../src/config/env';
import type { DatabaseConnection } from '../../../src/db/pool';
import { createAuthUseCases } from '../../../src/modules/auth/auth.factory';

describe('createAuthUseCases', () => {
  it('does not construct a storage-backed service without an Ed25519 private key', () => {
    const environment = parseEnvironment({ NODE_ENV: 'test' });
    expect(() => createAuthUseCases({} as DatabaseConnection, environment)).toThrow('AUTH_SIGNING_KEY_NOT_CONFIGURED');
  });

  it('requires a valid Argon2id dummy hash before enabling credential verification', () => {
    const environment = parseEnvironment({ NODE_ENV: 'test', JWT_PRIVATE_KEY_PEM: 'configured-only-for-this-validation' });
    expect(() => createAuthUseCases({} as DatabaseConnection, environment)).toThrow('AUTH_DUMMY_ARGON2ID_HASH_NOT_CONFIGURED');
  });
});
