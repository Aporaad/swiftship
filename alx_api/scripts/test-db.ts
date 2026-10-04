import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { isDatabaseReady } from '../src/db/health';
import { AuthService, AuthServiceError } from '../src/modules/auth/auth.use-cases';
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
    assert.equal(securedTables.rowCount, 6, 'expected exactly six API-owned Auth tables');
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
             has_table_privilege('alx_api_runtime', 'public.users', 'SELECT') AS runtime_public_users,
             has_function_privilege('alx_api_runtime', 'alx_api_private.verify_legacy_password(text,text)', 'EXECUTE') AS runtime_legacy_verify,
             has_function_privilege('alx_api_runtime', 'alx_api_private.migrate_legacy_password(text,text,text)', 'EXECUTE') AS runtime_legacy_migrate,
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
    assert.deepEqual([grantState.runtime_legacy_verify, grantState.runtime_legacy_migrate], [true, true]);
    assert.deepEqual([grantState.anon_legacy_verify, grantState.authenticated_legacy_migrate], [false, false]);

    assert.equal(await isDatabaseReady(pool), true, 'API database readiness checks should pass');
    await pool.query('BEGIN');
    try {
      await pool.query('SET LOCAL ROLE alx_api_runtime');
      const emptyLoginView = await pool.query('SELECT user_id FROM alx_api_private.api_login_users LIMIT 1');
      assert.equal(emptyLoginView.rowCount, 0, 'test database starts with no user or credential data');
    } finally {
      await pool.query('ROLLBACK');
    }

    await pool.query(
      `INSERT INTO public.users (user_id, username, email, role, disabled, password, system_pin)
       VALUES ($1, $2, $3, $4, false, $5, NULL)`,
      ['test-legacy-user', 'legacy-test', 'legacy-test@example.test', 'employee', 'test-only-old-password'],
    );

    const dummyPasswordHash = await hashPassword('test-only-dummy-password');
    const repository = new DrizzleAuthRepository(drizzle(pool, { schema }));
    const authService = new AuthService(
      repository,
      { issue: async () => 'test-only-access-token' },
      { accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 2_592_000, dummyPasswordHash },
    );
    await pool.query('SET ROLE alx_api_runtime');

    await assert.rejects(
      authService.login({ identifier: 'legacy-test', password: 'wrong-test-password' }),
      (error: unknown) => error instanceof AuthServiceError && error.code === 'AUTH_INVALID_CREDENTIALS',
    );
    const login = await authService.login({
      identifier: 'legacy-test',
      password: 'test-only-old-password',
    });
    assert.equal(login.tokenType, 'Bearer');

    const migratedCredential = await repository.findCredential('test-legacy-user');
    assert.equal(migratedCredential?.passwordAlgorithm, 'argon2id');
    assert.ok(migratedCredential?.passwordHash.startsWith('$argon2id$'));
    assert.equal(await verifyPassword('test-only-old-password', migratedCredential?.passwordHash ?? ''), true);
    assert.equal(await repository.verifyLegacyPassword('test-legacy-user', 'wrong-test-password'), false);
    assert.equal(await repository.verifyLegacyPassword('test-legacy-user', 'test-only-old-password'), true);

    console.log(
      'PASS: isolated PostgreSQL migrations, RLS/grants, readiness, rejected login, and first-login Argon2id upgrade.',
    );
  } finally {
    await pool.end();
  }
}

void run().catch((error: unknown) => {
  const summary = error instanceof Error ? { name: error.name, message: error.message } : { name: 'UnknownError' };
  console.error('Isolated PostgreSQL migration test failed.', summary);
  process.exitCode = 1;
});
