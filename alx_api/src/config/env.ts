import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.string().url().optional().or(z.literal('')),
  CORS_ORIGINS: z.string().default('http://localhost:5174,http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  JSON_BODY_LIMIT: z.string().min(1).default('1mb'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(8_192).max(262_144).default(65_536),
  ARGON2_TIME_COST: z.coerce.number().int().min(1).max(10).default(3),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(8).default(1),
});

export interface ApiEnvironment {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string | undefined;
  corsOrigins: ReadonlySet<string>;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  jsonBodyLimit: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  authRateLimitMax: number;
  argon2MemoryKiB: number;
  argon2TimeCost: number;
  argon2Parallelism: number;
}

export function parseEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  const parsed = environmentSchema.parse(source);
  const origins = parsed.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL || undefined,
    corsOrigins: new Set(origins),
    logLevel: parsed.LOG_LEVEL,
    jsonBodyLimit: parsed.JSON_BODY_LIMIT,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    authRateLimitMax: parsed.AUTH_RATE_LIMIT_MAX,
    argon2MemoryKiB: parsed.ARGON2_MEMORY_KIB,
    argon2TimeCost: parsed.ARGON2_TIME_COST,
    argon2Parallelism: parsed.ARGON2_PARALLELISM,
  };
}
