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
  sslMode: 'require' | 'verify-full';
  sslCaPem?: string;
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
  const config: PoolConfig = {
    connectionString: connectionUrl.toString(),
    ssl: options.sslMode === 'verify-full'
      ? { ca: options.sslCaPem, rejectUnauthorized: true }
      : { rejectUnauthorized: false },
    max: options.maxConnections ?? 10,
    connectionTimeoutMillis: options.connectionTimeoutMs ?? 5_000,
    idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
  };
  const pool = new Pool(config);
  pool.on('error', (error: Error) => {
    // Never log the connection string or query values.
    console.error('[alx_api] idle PostgreSQL client error', { name: error.name });
  });

  return { pool, db: drizzle(pool, { schema }) };
}
