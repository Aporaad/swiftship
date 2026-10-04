import { z } from 'zod';

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    DATABASE_URL: z.string().url().optional().or(z.literal('')),
    DATABASE_SSL_MODE: z.enum(['disable', 'require', 'verify-full']).default('require'),
    DATABASE_RUNTIME_ROLE: z.enum(['alx_api_runtime']).optional(),
    DATABASE_SSL_CA_PEM: z.string().max(16_384).optional().or(z.literal('')),
    CORS_ORIGINS: z.string().default('http://localhost:5174,http://localhost:5173'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    JSON_BODY_LIMIT: z.string().min(1).default('1mb'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    ARGON2_MEMORY_KIB: z.coerce.number().int().min(8_192).max(262_144).default(65_536),
    ARGON2_TIME_COST: z.coerce.number().int().min(1).max(10).default(3),
    ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(8).default(1),
    JWT_PRIVATE_KEY_PEM: z.string().max(16_384).optional().or(z.literal('')),
    JWT_PUBLIC_KEY_PEM: z.string().max(16_384).optional().or(z.literal('')),
    AUTH_DUMMY_PASSWORD_HASH: z.string().max(1_024).optional().or(z.literal('')),
    JWT_ISSUER: z.string().trim().min(1).max(200).default('swiftship-api'),
    JWT_AUDIENCE: z.string().trim().min(1).max(200).default('swiftship-client'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(900).default(600),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(600).max(7_776_000).default(2_592_000),
    LEGACY_PASSWORD_AUTH_ENABLED: z.enum(['true', 'false']).default('true'),
    AUTH_PASSWORD_CHANGES_ENABLED: z.enum(['true', 'false']).default('false'),
    PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().min(300).max(3_600).default(900),
  })
  .superRefine((environment, context) => {
    if (environment.DATABASE_SSL_MODE === 'verify-full' && !environment.DATABASE_SSL_CA_PEM) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_SSL_CA_PEM'],
        message: 'A trusted database CA certificate is required for verify-full.',
      });
    }
    if (environment.NODE_ENV === 'production' && environment.DATABASE_SSL_MODE !== 'verify-full') {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_SSL_MODE'],
        message: 'Production requires database TLS verify-full.',
      });
    }
    if (environment.NODE_ENV === 'production' && environment.DATABASE_RUNTIME_ROLE) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_RUNTIME_ROLE'],
        message: 'Production must authenticate directly as the database runtime role.',
      });
    }
    if (environment.NODE_ENV === 'production' && environment.DATABASE_SSL_MODE === 'disable') {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_SSL_MODE'],
        message: 'Production database TLS cannot be disabled.',
      });
    }
    if (environment.AUTH_PASSWORD_CHANGES_ENABLED === 'true' && environment.LEGACY_PASSWORD_AUTH_ENABLED === 'true') {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_PASSWORD_CHANGES_ENABLED'],
        message: 'Password changes/reset are unavailable until legacy authentication is disabled for cutover.',
      });
    }
  });

export interface ApiEnvironment {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string | undefined;
  databaseSslMode: 'disable' | 'require' | 'verify-full';
  databaseRuntimeRole: 'alx_api_runtime' | undefined;
  databaseSslCaPem: string | undefined;
  corsOrigins: ReadonlySet<string>;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  jsonBodyLimit: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  authRateLimitMax: number;
  argon2MemoryKiB: number;
  argon2TimeCost: number;
  argon2Parallelism: number;
  jwtPrivateKeyPem: string | undefined;
  jwtPublicKeyPem: string | undefined;
  authDummyPasswordHash: string | undefined;
  jwtIssuer: string;
  jwtAudience: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  legacyPasswordAuthEnabled: boolean;
  passwordChangesEnabled: boolean;
  passwordResetTtlSeconds: number;
}

export function parseEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  const parsed = environmentSchema.parse(source);
  const origins = parsed.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL || undefined,
    databaseSslMode: parsed.DATABASE_SSL_MODE,
    databaseRuntimeRole: parsed.DATABASE_RUNTIME_ROLE,
    databaseSslCaPem: parsed.DATABASE_SSL_CA_PEM ? parsed.DATABASE_SSL_CA_PEM.replace(/\\n/g, '\n') : undefined,
    corsOrigins: new Set(origins),
    logLevel: parsed.LOG_LEVEL,
    jsonBodyLimit: parsed.JSON_BODY_LIMIT,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    authRateLimitMax: parsed.AUTH_RATE_LIMIT_MAX,
    argon2MemoryKiB: parsed.ARGON2_MEMORY_KIB,
    argon2TimeCost: parsed.ARGON2_TIME_COST,
    argon2Parallelism: parsed.ARGON2_PARALLELISM,
    jwtPrivateKeyPem: parsed.JWT_PRIVATE_KEY_PEM || undefined,
    jwtPublicKeyPem: parsed.JWT_PUBLIC_KEY_PEM || undefined,
    authDummyPasswordHash: parsed.AUTH_DUMMY_PASSWORD_HASH || undefined,
    jwtIssuer: parsed.JWT_ISSUER,
    jwtAudience: parsed.JWT_AUDIENCE,
    accessTokenTtlSeconds: parsed.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: parsed.REFRESH_TOKEN_TTL_SECONDS,
    legacyPasswordAuthEnabled: parsed.LEGACY_PASSWORD_AUTH_ENABLED === 'true',
    passwordChangesEnabled: parsed.AUTH_PASSWORD_CHANGES_ENABLED === 'true',
    passwordResetTtlSeconds: parsed.PASSWORD_RESET_TTL_SECONDS,
  };
}
