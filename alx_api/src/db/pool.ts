import { Pool, type PoolConfig } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export interface DatabaseConnection {
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
}

export interface DatabasePoolOptions {
  connectionString: string;
  nodeEnv: 'development' | 'test' | 'production';
  sslMode: 'disable' | 'require' | 'verify-full';
  sslCaPem?: string;
  runtimeRole?: 'alx_api_runtime';
  maxConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
}

export function createDatabaseConnection(options: DatabasePoolOptions): DatabaseConnection {
  const connectionUrl = new URL(options.connectionString);
  connectionUrl.searchParams.delete('sslmode');
  connectionUrl.searchParams.delete('sslrootcert');
  if (options.sslMode === 'verify-full' && !options.sslCaPem) {
    throw new Error('DATABASE_SSL_CA_REQUIRED');
  }
  if (options.runtimeRole && options.nodeEnv === 'production') {
    throw new Error('DATABASE_RUNTIME_ROLE_OVERRIDE_NOT_ALLOWED_IN_PRODUCTION');
  }
  const config: PoolConfig = {
    connectionString: connectionUrl.toString(),
    ssl:
      options.sslMode === 'disable'
        ? undefined
        : options.sslMode === 'verify-full'
          ? { ca: options.sslCaPem, rejectUnauthorized: true }
          : { rejectUnauthorized: false },
    ...(options.runtimeRole ? { options: '-c role=alx_api_runtime' } : {}),
    max: options.maxConnections ?? 10,
    connectionTimeoutMillis: options.connectionTimeoutMs ?? 15_000,
    idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
  };
  const pool = new Pool(config);
  pool.on('error', (error: Error) => {
    // Never log the connection string or query values.
    console.error('[alx_api] idle PostgreSQL client error', { name: error.name });
  });

  return { pool, db: drizzle(pool, { schema }) };
}
