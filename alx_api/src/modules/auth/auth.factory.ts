import type { ApiEnvironment } from '../../config/env';
import type { DatabaseConnection } from '../../db/pool';
import { DrizzleAuthRepository } from './drizzle-auth.repository';
import { Ed25519AccessTokenIssuer } from './access-token';
import { AuthService } from './auth.use-cases';
import type { PasswordResetDelivery } from './auth.contracts';

const ARGON2ID_HASH_PATTERN =
  /^\$argon2id\$v=19\$m=\d+,(?:t=\d+,p=\d+|p=\d+,t=\d+)\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/;

/**
 * Explicit composition root for Auth. Call only after the private schema, forced
 * RLS policies, and least-privilege runtime grants have been verified in the DB.
 */
export function createAuthUseCases(
  database: DatabaseConnection,
  environment: ApiEnvironment,
  passwordResetDelivery?: PasswordResetDelivery,
): AuthService {
  const { jwtPrivateKeyPem, jwtPublicKeyPem, authDummyPasswordHash } = environment;
  if (!jwtPrivateKeyPem) throw new Error('AUTH_SIGNING_KEY_NOT_CONFIGURED');
  if (!jwtPublicKeyPem) throw new Error('AUTH_VERIFICATION_KEY_NOT_CONFIGURED');
  if (!authDummyPasswordHash || !ARGON2ID_HASH_PATTERN.test(authDummyPasswordHash)) {
    throw new Error('AUTH_DUMMY_ARGON2ID_HASH_NOT_CONFIGURED');
  }

  return new AuthService(
    new DrizzleAuthRepository(database.db),
    new Ed25519AccessTokenIssuer(jwtPrivateKeyPem, environment.jwtIssuer, environment.jwtAudience),
    {
      accessTokenTtlSeconds: environment.accessTokenTtlSeconds,
      refreshTokenTtlSeconds: environment.refreshTokenTtlSeconds,
      dummyPasswordHash: authDummyPasswordHash,
      accessTokenPublicKeyPem: jwtPublicKeyPem,
      jwtIssuer: environment.jwtIssuer,
      jwtAudience: environment.jwtAudience,
      legacyPasswordAuthEnabled: environment.legacyPasswordAuthEnabled,
      passwordChangesEnabled: environment.passwordChangesEnabled,
      passwordResetTtlSeconds: environment.passwordResetTtlSeconds,
    },
    undefined,
    undefined,
    undefined,
    passwordResetDelivery,
  );
}
