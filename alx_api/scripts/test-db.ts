import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { createApiApp } from '../src/app';
import { parseEnvironment } from '../src/config/env';
import { isDatabaseReady } from '../src/db/health';
import { Ed25519AccessTokenIssuer, verifyAccessToken } from '../src/modules/auth/access-token';
import { AuthService, hashRefreshToken } from '../src/modules/auth/auth.use-cases';
import { DrizzleAuthRepository } from '../src/modules/auth/drizzle-auth.repository';
import { hashPassword, verifyPassword } from '../src/modules/auth/password-hasher';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error('TEST_DATABASE_URL is required for the isolated database test.');
}

const databaseUrl = new URL(connectionString);
const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
const socketHost = databaseUrl.searchParams.get('host');
const isLocalHost =
  ['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname) || socketHost === '/var/run/postgresql';
if (databaseUrl.protocol !== 'postgres:' && databaseUrl.protocol !== 'postgresql:') {
  throw new Error('TEST_DATABASE_URL must use PostgreSQL.');
}
if (!isLocalHost || databaseName !== 'alx_api_test') {
  throw new Error(
    'Refusing destructive migration tests unless the host is local and database is exactly alx_api_test.',
  );
}

const pool = new Pool({
  connectionString,
  max: 1,
  application_name: 'alx-api-isolated-migration-test',
  statement_timeout: 10_000,
});

const TEST_PASSWORD = 'test-only-old-password';
const LOCKOUT_PASSWORD = 'test-only-lockout-password';
const ISSUER = 'swiftship-api-local-test';
const AUDIENCE = 'swiftship-api-local-test-client';
const ACCESS_TTL_SECONDS = 600;
const REFRESH_TTL_SECONDS = 2_592_000;

async function ensureTestRoles(): Promise<void> {
  await pool.query(`
    DO $test_roles$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
      END IF;
    END
    $test_roles$;
  `);
}

async function resetIsolatedTestDatabase(): Promise<void> {
  await pool.query('DROP SCHEMA IF EXISTS alx_api_private CASCADE');
  await pool.query('DROP TABLE IF EXISTS public.users CASCADE');
  const runtimeRole = await pool.query("SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'alx_api_runtime' LIMIT 1");
  if (runtimeRole.rowCount) {
    await pool.query('DROP OWNED BY alx_api_runtime');
    await pool.query('DROP ROLE alx_api_runtime');
  }
  await ensureTestRoles();
  await pool.query(`
    CREATE TABLE public.users (
      user_id text PRIMARY KEY,
      username text,
      email text,
      role text NOT NULL DEFAULT 'employee',
      disabled boolean NOT NULL DEFAULT false,
      password text,
      system_pin text
    );
  `);
}

async function readMigration(fileName: string): Promise<string> {
  return readFile(resolve('src/db/migrations', fileName), 'utf8');
}

function tokenHash(seed: string): string {
  return createHash('sha256').update(`${seed}:${randomUUID()}`).digest('hex');
}

async function run(): Promise<void> {
  try {
    const identity = await pool.query(
      'SELECT current_database() AS database_name, current_user AS connected_role LIMIT 1',
    );
    assert.equal(identity.rows[0]?.database_name, 'alx_api_test');
    await resetIsolatedTestDatabase();

    await pool.query(await readMigration('0002_auth_private_storage.sql'));
    await pool.query(await readMigration('0003_auth_rls_runtime_access.sql'));
    await pool.query(await readMigration('0004_legacy_password_upgrade.sql'));
    await pool.query(await readMigration('0005_auth_core_passwords_and_events.sql'));
    await pool.query(await readMigration('0006_rbac_foundation.sql'));
    await pool.query(await readMigration('0009_operations_idempotency.sql'));

    const securedTables = await pool.query(`
      SELECT relation.relname AS table_name,
             relation.relrowsecurity AS rls_enabled,
             relation.relforcerowsecurity AS rls_forced
      FROM pg_catalog.pg_class AS relation
      INNER JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'alx_api_private'
        AND relation.relkind = 'r'
      ORDER BY relation.relname
      LIMIT 10;
    `);
    assert.equal(securedTables.rowCount, 11, 'expected six Auth, four normalized RBAC, and one operations table');
    assert.ok(securedTables.rows.every((table) => table.rls_enabled && table.rls_forced));

    const grants = await pool.query(`
      SELECT has_schema_privilege('anon', 'alx_api_private', 'USAGE') AS anon_schema,
             has_schema_privilege('authenticated', 'alx_api_private', 'USAGE') AS authenticated_schema,
             has_schema_privilege('service_role', 'alx_api_private', 'USAGE') AS service_schema,
             has_schema_privilege('alx_api_runtime', 'alx_api_private', 'USAGE') AS runtime_schema,
             has_table_privilege('alx_api_runtime', 'alx_api_private.api_login_users', 'SELECT') AS runtime_login_view,
             has_table_privilege('alx_api_runtime', 'alx_api_private.user_credentials', 'SELECT') AS runtime_credentials,
             has_table_privilege('alx_api_runtime', 'alx_api_private.password_reset_tokens', 'SELECT') AS runtime_reset_tokens,
             has_table_privilege('alx_api_runtime', 'alx_api_private.auth_events', 'SELECT') AS runtime_auth_events,
             has_table_privilege('alx_api_runtime', 'alx_api_private.auth_events', 'INSERT') AS runtime_auth_event_insert,
             has_table_privilege('alx_api_runtime', 'alx_api_private.roles', 'SELECT') AS runtime_rbac_select,
             has_table_privilege('alx_api_runtime', 'alx_api_private.roles', 'INSERT') AS runtime_rbac_insert,
             has_table_privilege('alx_api_runtime', 'public.users', 'SELECT') AS runtime_public_users,
             has_function_privilege('alx_api_runtime', 'alx_api_private.verify_legacy_password(text,text)', 'EXECUTE') AS runtime_legacy_verify,
             has_function_privilege('alx_api_runtime', 'alx_api_private.migrate_legacy_password(text,text,text)', 'EXECUTE') AS runtime_legacy_migrate,
             has_function_privilege('alx_api_runtime', 'alx_api_private.update_password_hash(text,text,timestamp with time zone)', 'EXECUTE') AS runtime_password_change,
             has_function_privilege('alx_api_runtime', 'alx_api_private.create_password_reset_token(text,text,timestamp with time zone,timestamp with time zone)', 'EXECUTE') AS runtime_create_reset,
             has_function_privilege('alx_api_runtime', 'alx_api_private.complete_password_reset(text,text,timestamp with time zone)', 'EXECUTE') AS runtime_complete_reset,
             has_function_privilege('anon', 'alx_api_private.verify_legacy_password(text,text)', 'EXECUTE') AS anon_legacy_verify,
             has_function_privilege('authenticated', 'alx_api_private.migrate_legacy_password(text,text,text)', 'EXECUTE') AS authenticated_legacy_migrate
      LIMIT 1;
    `);
    const grantState = grants.rows[0] as Record<string, boolean>;
    assert.deepEqual(
      [grantState.anon_schema, grantState.authenticated_schema, grantState.service_schema],
      [false, false, false],
    );
    assert.deepEqual(
      [grantState.runtime_schema, grantState.runtime_login_view, grantState.runtime_credentials],
      [true, true, true],
    );
    assert.deepEqual(
      [grantState.runtime_reset_tokens, grantState.runtime_auth_events, grantState.runtime_public_users],
      [false, false, false],
    );
    assert.deepEqual(
      [grantState.runtime_auth_event_insert, grantState.runtime_rbac_select, grantState.runtime_rbac_insert],
      [true, true, false],
    );
    assert.deepEqual([grantState.runtime_legacy_verify, grantState.runtime_legacy_migrate], [true, true]);
    assert.deepEqual(
      [grantState.runtime_password_change, grantState.runtime_create_reset, grantState.runtime_complete_reset],
      [true, true, true],
    );
    assert.deepEqual([grantState.anon_legacy_verify, grantState.authenticated_legacy_migrate], [false, false]);

    await pool.query(
      `INSERT INTO public.users (user_id, username, email, role, disabled, password, system_pin)
       VALUES ($1, $2, $3, $4, false, $5, NULL), ($6, $7, $8, $4, false, $9, NULL)`,
      [
        'test-legacy-user',
        'legacy-test',
        'legacy-test@example.test',
        'employee',
        TEST_PASSWORD,
        'test-lockout-user',
        'lockout-test',
        'lockout-test@example.test',
        LOCKOUT_PASSWORD,
      ],
    );

    const role = await pool.query(
      "INSERT INTO alx_api_private.roles (code, name) VALUES ('test_employee', 'Synthetic Test Role') RETURNING role_id",
    );
    const permission = await pool.query(
      "INSERT INTO alx_api_private.permissions (code, resource, action) VALUES ('orders.read', 'orders', 'read') RETURNING permission_id",
    );
    await pool.query('INSERT INTO alx_api_private.user_roles (user_id, role_id) VALUES ($1, $2)', [
      'test-legacy-user',
      role.rows[0]?.role_id,
    ]);
    await pool.query('INSERT INTO alx_api_private.role_permissions (role_id, permission_id) VALUES ($1, $2)', [
      role.rows[0]?.role_id,
      permission.rows[0]?.permission_id,
    ]);
    await assert.rejects(
      pool.query("INSERT INTO alx_api_private.permissions (code, resource, action) VALUES ('*', 'all', 'all')"),
      /api_permissions_code_check/,
    );

    const dummyPasswordHash = await hashPassword('test-only-dummy-password');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const repository = new DrizzleAuthRepository(drizzle(pool, { schema }));
    const tokenIssuer = new Ed25519AccessTokenIssuer(privateKeyPem, ISSUER, AUDIENCE);
    const authService = new AuthService(repository, tokenIssuer, {
      accessTokenTtlSeconds: ACCESS_TTL_SECONDS,
      refreshTokenTtlSeconds: REFRESH_TTL_SECONDS,
      dummyPasswordHash,
      accessTokenPublicKeyPem: publicKeyPem,
      jwtIssuer: ISSUER,
      jwtAudience: AUDIENCE,
    });
    assert.deepEqual(await repository.listPermissions('test-legacy-user'), ['orders.read']);
    assert.deepEqual(await repository.listPermissions('test-lockout-user'), [], 'RBAC must deny by default');

    // PostgreSQL role scoping is applied on the sole pooled connection before any API-style query.
    await pool.query('SET ROLE alx_api_runtime');
    const runtimeIdentity = await pool.query(
      'SELECT current_database() AS database_name, current_user AS connected_role LIMIT 1',
    );
    assert.equal(runtimeIdentity.rows[0]?.connected_role, 'alx_api_runtime');
    assert.equal(await isDatabaseReady(pool), true, 'API readiness checks should pass as the runtime role');

    await pool.query('BEGIN');
    try {
      await pool.query('SET LOCAL ROLE alx_api_runtime');
      const visibleLoginUsers = await pool.query(
        'SELECT count(*)::integer AS visible_users FROM alx_api_private.api_login_users LIMIT 1',
      );
      assert.equal(
        visibleLoginUsers.rows[0]?.visible_users,
        2,
        'only two synthetic local test identities should be visible',
      );
    } finally {
      await pool.query('ROLLBACK');
    }

    const environment = parseEnvironment({
      NODE_ENV: 'test',
      DATABASE_SSL_MODE: 'disable',
      JWT_ISSUER: ISSUER,
      JWT_AUDIENCE: AUDIENCE,
      AUTH_RATE_LIMIT_MAX: '40',
      RATE_LIMIT_MAX: '100',
    });
    const app = createApiApp({
      environment,
      auth: authService,
      readiness: async () => ({ database: await isDatabaseReady(pool) }),
    });

    const readiness = await request(app).get('/api/v1/health/ready');
    assert.equal(readiness.status, 200, `readiness failed: ${JSON.stringify(readiness.body)}`);
    assert.deepEqual(readiness.body.data.checks, { database: true, auth: true });

    const invalidLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'legacy-test', password: 'wrong-test-password' });
    assert.equal(invalidLogin.status, 401);
    assert.equal(invalidLogin.body.error.code, 'AUTH_INVALID_CREDENTIALS');
    assert.ok(!JSON.stringify(invalidLogin.body).includes('wrong-test-password'));
    assert.equal(await repository.findCredential('test-legacy-user'), null);

    const firstLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: ' LEGACY-TEST ', password: TEST_PASSWORD });
    assert.equal(firstLogin.status, 200, `first login failed: ${JSON.stringify(firstLogin.body)}`);
    assert.equal(firstLogin.body.data.tokenType, 'Bearer');
    const firstPair = firstLogin.body.data as { accessToken: string; refreshToken: string };
    const claims = verifyAccessToken(firstPair.accessToken, {
      publicKeyPem,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    assert.equal(claims.sub, 'test-legacy-user');

    const currentUser = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${firstPair.accessToken}`);
    assert.equal(currentUser.status, 200);
    assert.equal(currentUser.body.data.userId, 'test-legacy-user');
    const initialSessions = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${firstPair.accessToken}`);
    assert.equal(initialSessions.status, 200);
    assert.equal(initialSessions.body.data.sessions.length, 1);
    assert.equal(initialSessions.body.data.sessions[0].isCurrent, true);
    assert.ok(!JSON.stringify(initialSessions.body).includes('tokenHash'));

    const migratedCredential = await repository.findCredential('test-legacy-user');
    assert.equal(migratedCredential?.passwordAlgorithm, 'argon2id');
    assert.ok(migratedCredential?.passwordHash.startsWith('$argon2id$'));
    assert.equal(await verifyPassword(TEST_PASSWORD, migratedCredential?.passwordHash ?? ''), true);
    assert.equal(await repository.verifyLegacyPassword('test-legacy-user', 'wrong-test-password'), false);
    assert.equal(await repository.verifyLegacyPassword('test-legacy-user', TEST_PASSWORD), true);

    const refreshed = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: firstPair.refreshToken });
    assert.equal(refreshed.status, 200, `refresh failed: ${JSON.stringify(refreshed.body)}`);
    const rotatedPair = refreshed.body.data as { accessToken: string; refreshToken: string };
    assert.notEqual(rotatedPair.refreshToken, firstPair.refreshToken);
    assert.equal(
      await repository
        .findRefreshToken(hashRefreshToken(firstPair.refreshToken))
        .then((record) => record?.usedAt !== null),
      true,
    );

    const reusedRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstPair.refreshToken });
    assert.equal(reusedRefresh.status, 401);
    const rotatedAfterReuse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotatedPair.refreshToken });
    assert.equal(rotatedAfterReuse.status, 401, 'reuse of an old token must revoke its whole family');

    const secondLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'legacy-test', password: TEST_PASSWORD });
    assert.equal(secondLogin.status, 200, 'subsequent logins must verify the migrated Argon2id hash');
    const secondPair = secondLogin.body.data as { accessToken: string; refreshToken: string };

    const secondSessions = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${secondPair.accessToken}`);
    assert.equal(secondSessions.status, 200);
    assert.equal(secondSessions.body.data.sessions.length, 1);
    const secondClaims = verifyAccessToken(secondPair.accessToken, {
      publicKeyPem,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const revokeOwnSession = await request(app)
      .delete(`/api/v1/auth/sessions/${secondClaims.sid}`)
      .set('Authorization', `Bearer ${secondPair.accessToken}`);
    assert.equal(revokeOwnSession.status, 200);
    const revokedAccessToken = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondPair.accessToken}`);
    assert.equal(revokedAccessToken.status, 401, 'revoking a session must invalidate its access token immediately');

    // A session insert failure must roll back the already-issued session row.
    const failedSessionId = randomUUID();
    await assert.rejects(
      repository.createSession({
        sessionId: failedSessionId,
        familyId: randomUUID(),
        userId: 'test-legacy-user',
        refreshTokenHash: hashRefreshToken(secondPair.refreshToken),
        createdAt: new Date(),
        refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1_000),
      }),
    );
    const rolledBackSession = await pool.query(
      'SELECT session_id FROM alx_api_private.api_sessions WHERE session_id = $1 LIMIT 1',
      [failedSessionId],
    );
    assert.equal(rolledBackSession.rowCount, 0, 'failed token insert must roll back its session insert');

    // A refresh failure after consuming the old row must roll the consumption back atomically.
    const thirdLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'legacy-test', password: TEST_PASSWORD });
    const fourthLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'legacy-test', password: TEST_PASSWORD });
    assert.equal(thirdLogin.status, 200, `third login failed: ${JSON.stringify(thirdLogin.body)}`);
    assert.equal(fourthLogin.status, 200, `fourth login failed: ${JSON.stringify(fourthLogin.body)}`);
    const thirdPair = thirdLogin.body.data as { refreshToken: string };
    const fourthPair = fourthLogin.body.data as { refreshToken: string };
    await assert.rejects(
      repository.rotateRefreshToken({
        oldTokenHash: hashRefreshToken(thirdPair.refreshToken),
        newTokenHash: hashRefreshToken(fourthPair.refreshToken),
        newTokenId: randomUUID(),
        rotatedAt: new Date(),
        newExpiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1_000),
      }),
    );
    const tokenAfterRollback = await repository.findRefreshToken(hashRefreshToken(thirdPair.refreshToken));
    assert.equal(tokenAfterRollback?.usedAt, null, 'failed replacement insert must roll back used_at');

    // Concurrent repository callers must consume a refresh token at most once.
    const concurrentLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'legacy-test', password: TEST_PASSWORD });
    const concurrentPair = concurrentLogin.body.data as { accessToken: string; refreshToken: string };
    const concurrentOldHash = hashRefreshToken(concurrentPair.refreshToken);
    const concurrentResults = await Promise.all([
      repository.rotateRefreshToken({
        oldTokenHash: concurrentOldHash,
        newTokenHash: tokenHash('concurrent-one'),
        newTokenId: randomUUID(),
        rotatedAt: new Date(),
        newExpiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1_000),
      }),
      repository.rotateRefreshToken({
        oldTokenHash: concurrentOldHash,
        newTokenHash: tokenHash('concurrent-two'),
        newTokenId: randomUUID(),
        rotatedAt: new Date(),
        newExpiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1_000),
      }),
    ]);
    assert.deepEqual(concurrentResults.sort(), [false, true]);

    const logoutAll = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${concurrentPair.accessToken}`);
    assert.equal(logoutAll.status, 200);
    const accessAfterLogoutAll = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${concurrentPair.accessToken}`);
    assert.equal(accessAfterLogoutAll.status, 401);

    // Failed-login state is transactionally persisted, locks progressively, and resets after success.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'lockout-test', password: 'incorrect-test-password' });
      assert.equal(response.status, 401);
    }
    const lockedUntil = await repository.getLockedUntil('test-lockout-user');
    assert.ok(lockedUntil && lockedUntil.getTime() > Date.now());
    const blockedCorrectPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'lockout-test', password: LOCKOUT_PASSWORD });
    assert.equal(blockedCorrectPassword.status, 401);
    await repository.clearFailedLogins('test-lockout-user', new Date());
    assert.equal(await repository.getLockedUntil('test-lockout-user'), null);

    const logout = await request(app).post('/api/v1/auth/logout').send({ refreshToken: secondPair.refreshToken });
    assert.equal(logout.status, 200);
    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: secondPair.refreshToken });
    assert.equal(refreshAfterLogout.status, 401);

    // Password change/reset are tested only in a second local service configured as if clients cut over.
    let deliveredResetToken: string | undefined;
    const resetDelivery = {
      async send(input: { email: string; token: string; expiresAt: Date }): Promise<void> {
        assert.equal(input.email, 'legacy-test@example.test');
        assert.ok(input.expiresAt.getTime() > Date.now());
        deliveredResetToken = input.token;
      },
    };
    const cutoverService = new AuthService(
      repository,
      tokenIssuer,
      {
        accessTokenTtlSeconds: ACCESS_TTL_SECONDS,
        refreshTokenTtlSeconds: REFRESH_TTL_SECONDS,
        dummyPasswordHash,
        accessTokenPublicKeyPem: publicKeyPem,
        jwtIssuer: ISSUER,
        jwtAudience: AUDIENCE,
        legacyPasswordAuthEnabled: false,
        passwordChangesEnabled: true,
        passwordResetTtlSeconds: 900,
      },
      undefined,
      undefined,
      undefined,
      resetDelivery,
    );
    const cutoverEnvironment = parseEnvironment({
      NODE_ENV: 'test',
      DATABASE_SSL_MODE: 'disable',
      JWT_ISSUER: ISSUER,
      JWT_AUDIENCE: AUDIENCE,
      AUTH_PASSWORD_CHANGES_ENABLED: 'true',
      LEGACY_PASSWORD_AUTH_ENABLED: 'false',
      AUTH_RATE_LIMIT_MAX: '40',
      RATE_LIMIT_MAX: '100',
    });
    const cutoverApp = createApiApp({
      environment: cutoverEnvironment,
      auth: cutoverService,
      readiness: async () => ({ database: await isDatabaseReady(pool) }),
    });
    const loginForChange = await request(cutoverApp)
      .post('/api/v1/auth/login')
      .send({ identifier: 'legacy-test', password: TEST_PASSWORD });
    assert.equal(loginForChange.status, 200, 'migrated Argon2id credentials remain valid after legacy cutover');
    const changePair = loginForChange.body.data as { accessToken: string };
    const changedPassword = 'Change-password-123';
    const changeResponse = await request(cutoverApp)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${changePair.accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: changedPassword });
    assert.equal(changeResponse.status, 200, `password change failed: ${JSON.stringify(changeResponse.body)}`);
    assert.equal(
      (await request(cutoverApp).get('/api/v1/auth/me').set('Authorization', `Bearer ${changePair.accessToken}`))
        .status,
      401,
      'password change must revoke all active sessions immediately',
    );
    assert.equal(
      (
        await request(cutoverApp)
          .post('/api/v1/auth/login')
          .send({ identifier: 'legacy-test', password: TEST_PASSWORD })
      ).status,
      401,
      'the old password must stop working after local client cutover',
    );
    assert.equal(
      (
        await request(cutoverApp)
          .post('/api/v1/auth/login')
          .send({ identifier: 'legacy-test', password: changedPassword })
      ).status,
      200,
    );

    const resetResponse = await request(cutoverApp)
      .post('/api/v1/auth/password/reset')
      .send({ identifier: 'legacy-test@example.test' });
    assert.equal(resetResponse.status, 200);
    assert.ok(!JSON.stringify(resetResponse.body).includes('legacy-test@example.test'));
    assert.ok(deliveredResetToken);
    const resetToMissingAccount = await request(cutoverApp)
      .post('/api/v1/auth/password/reset')
      .send({ identifier: 'missing@example.test' });
    assert.equal(resetToMissingAccount.status, 200);
    assert.deepEqual(resetToMissingAccount.body.data, resetResponse.body.data);

    const resetPassword = 'Reset-password-456';
    const completedReset = await request(cutoverApp)
      .post('/api/v1/auth/password/reset/complete')
      .send({ token: deliveredResetToken, newPassword: resetPassword });
    assert.equal(completedReset.status, 200, `password reset failed: ${JSON.stringify(completedReset.body)}`);
    const reusedReset = await request(cutoverApp)
      .post('/api/v1/auth/password/reset/complete')
      .send({ token: deliveredResetToken, newPassword: 'Another-password-789' });
    assert.equal(reusedReset.status, 401, 'password reset tokens must be one-time use');
    assert.equal(
      (
        await request(cutoverApp)
          .post('/api/v1/auth/login')
          .send({ identifier: 'legacy-test', password: changedPassword })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(cutoverApp)
          .post('/api/v1/auth/login')
          .send({ identifier: 'legacy-test', password: resetPassword })
      ).status,
      200,
    );

    // Prepare one synthetic, non-PIN legacy credential for the real localhost server demonstration.
    await pool.query('RESET ROLE');
    await pool.query('DELETE FROM alx_api_private.api_sessions WHERE user_id = $1', ['test-legacy-user']);
    await pool.query('DELETE FROM alx_api_private.user_credentials WHERE user_id = $1', ['test-legacy-user']);
    await pool.query('DELETE FROM alx_api_private.user_security WHERE user_id = $1', ['test-legacy-user']);
    await pool.query('DELETE FROM alx_api_private.auth_events WHERE user_id = $1', ['test-legacy-user']);
    await pool.query('UPDATE public.users SET password = $2, system_pin = $3 WHERE user_id = $1', [
      'test-legacy-user',
      'Development-password-123',
      'local-only-pin-2468',
    ]);

    console.log(
      'PASS: local PostgreSQL 0002-0006 migrations/RLS/readiness; HTTP login and first-login Argon2id upgrade; live-session bearer/revocation; refresh rotation/reuse; transaction rollback/races; progressive lockout; password change/reset cutover gating; one-time reset; deny-by-default RBAC; prepared synthetic localhost legacy/PIN-separated fixture.',
    );
  } finally {
    await pool.end();
  }
}

void run().catch((error: unknown) => {
  const summary = error instanceof Error ? { name: error.name, message: error.message } : { name: 'UnknownError' };
  console.error('Isolated PostgreSQL migration and Auth integration test failed.', summary);
  process.exitCode = 1;
});
