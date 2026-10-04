import { existsSync } from 'node:fs';
import { writeFile, chmod } from 'node:fs/promises';
import { generateKeyPairSync } from 'node:crypto';
import { userInfo } from 'node:os';
import { resolve } from 'node:path';
import { hashPassword } from '../src/modules/auth/password-hasher';

const envPath = resolve('.env.development.local');
const databaseUrl =
  process.env.LOCAL_DEV_DATABASE_URL ??
  `postgresql://${encodeURIComponent(userInfo().username)}@localhost/alx_api_test?host=%2Fvar%2Frun%2Fpostgresql`;

function assertDisposableLocalDatabase(connectionString: string): void {
  const url = new URL(connectionString);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  const socketHost = url.searchParams.get('host');
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname) || socketHost === '/var/run/postgresql';
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !isLoopback || databaseName !== 'alx_api_test') {
    throw new Error('Refusing local env setup unless DATABASE_URL is a loopback connection to alx_api_test.');
  }
}

async function main(): Promise<void> {
  if (existsSync(envPath)) {
    throw new Error('.env.development.local already exists; refusing to overwrite local key material.');
  }
  assertDisposableLocalDatabase(databaseUrl);

  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trimEnd();
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString().trimEnd();
  const dummyPasswordHash = await hashPassword('local-only-dummy-password-not-for-login');

  const contents = [
    'NODE_ENV=development',
    'HOST=127.0.0.1',
    'PORT=3001',
    `DATABASE_URL=${databaseUrl}`,
    'DATABASE_SSL_MODE=disable',
    'DATABASE_RUNTIME_ROLE=alx_api_runtime',
    'CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173',
    'LOG_LEVEL=warn',
    'ARGON2_MEMORY_KIB=65536',
    'ARGON2_TIME_COST=3',
    'ARGON2_PARALLELISM=1',
    `JWT_PRIVATE_KEY_PEM="${privateKeyPem}"`,
    `JWT_PUBLIC_KEY_PEM="${publicKeyPem}"`,
    `AUTH_DUMMY_PASSWORD_HASH=${dummyPasswordHash}`,
    'JWT_ISSUER=swiftship-api-local',
    'JWT_AUDIENCE=swiftship-client-local',
    'ACCESS_TOKEN_TTL_SECONDS=600',
    'REFRESH_TOKEN_TTL_SECONDS=2592000',
    'LEGACY_PASSWORD_AUTH_ENABLED=true',
    'AUTH_PASSWORD_CHANGES_ENABLED=false',
    'PASSWORD_RESET_TTL_SECONDS=900',
    '',
  ].join('\n');

  await writeFile(envPath, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await chmod(envPath, 0o600);
  console.log(
    'Created ignored local API settings for loopback PostgreSQL alx_api_test; key material is not displayed.',
  );
}

void main().catch((error: unknown) => {
  const summary = error instanceof Error ? error.message : 'Unknown local environment setup failure.';
  console.error(summary);
  process.exitCode = 1;
});
