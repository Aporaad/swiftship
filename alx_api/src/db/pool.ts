import { Pool, type PoolConfig } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface DatabaseConnection {
  pool: Pool;
  db: NodePgDatabase;
}

export interface DatabasePoolOptions {
  connectionString: string;
  nodeEnv: 'development' | 'test' | 'production';
  maxConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
}

export function createDatabaseConnection(options: DatabasePoolOptions): DatabaseConnection {
  const config: PoolConfig = {
    connectionString: options.connectionString,
    max: options.maxConnections ?? 10,
    connectionTimeoutMillis: options.connectionTimeoutMs ?? 5_000,
    idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
    ...(options.nodeEnv === 'production' ? { ssl: { rejectUnauthorized: true } } : {}),
  };
  const pool = new Pool(config);
  pool.on('error', (error: Error) => {
    // Never log the connection string or query values.
    console.error('[alx_api] idle PostgreSQL client error', { name: error.name });
  });

  return { pool, db: drizzle(pool) };
}
