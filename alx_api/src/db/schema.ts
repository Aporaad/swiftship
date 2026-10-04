import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/**
 * Legacy shapes follow DATABASE_SCHEMA.md where verified; confirmed drift is
 * recorded in docs/pre-api. API-owned tables and the login view are deployed in
 * alx_api_private with forced RLS and a least-privilege runtime role.
 */
export const publicUsers = pgTable('users', {
  userId: text('user_id').primaryKey(),
  role: text('role').notNull().default('Employee'),
  username: text('username'),
  email: text('email'),
  disabled: boolean('disabled').notNull().default(false),
  fullName: text('full_name'),
  isRoot: boolean('is_root').default(false),
  password: text('password'),
  systemPin: text('system_pin'),
});

export const publicRoles = pgTable('roles', {
  roleId: text('role_id').primaryKey(),
  title: text('title'),
  code: text('code'),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  permissions: jsonb('permissions')
    .$type<readonly string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
});

/** Existing public.sessions stays untouched; the API uses its own normalized sessions. */
export const publicSessions = pgTable('sessions', {
  sessionId: text('session_id').primaryKey(),
  userId: text('user_id'),
  forceLogout: boolean('force_logout').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
});

const apiPrivate = pgSchema('alx_api_private');

export const apiLoginUsers = apiPrivate
  .view('api_login_users', {
    userId: text('user_id').notNull(),
    username: text('username'),
    email: text('email'),
    role: text('role').notNull(),
    disabled: boolean('disabled').notNull(),
  })
  .existing();

export const apiUserCredentials = apiPrivate.table(
  'user_credentials',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => publicUsers.userId, { onDelete: 'cascade' }),
    passwordHash: text('password_hash').notNull(),
    passwordAlgorithm: text('password_algorithm').notNull().default('argon2id'),
    passwordVersion: integer('password_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    check('user_credentials_algorithm_check', sql`${table.passwordAlgorithm} = 'argon2id'`),
    check('user_credentials_password_version_check', sql`${table.passwordVersion} >= 1`),
    check('user_credentials_argon2id_hash_check', sql`${table.passwordHash} LIKE '$argon2id$%'`),
  ],
);

export const apiUserSecurity = apiPrivate.table(
  'user_security',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => publicUsers.userId, { onDelete: 'cascade' }),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true, mode: 'date' }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
    lastPasswordChangeAt: timestamp('last_password_change_at', { withTimezone: true, mode: 'date' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [check('user_security_failed_attempts_check', sql`${table.failedLoginAttempts} >= 0`)],
);

export const apiSessions = apiPrivate.table(
  'api_sessions',
  {
    sessionId: uuid('session_id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => publicUsers.userId, { onDelete: 'cascade' }),
    deviceName: text('device_name'),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    revokeReason: text('revoke_reason'),
  },
  (table) => [
    index('api_sessions_user_expiry_idx').on(table.userId, table.expiresAt),
    check('api_sessions_expiry_check', sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

export const apiRefreshTokens = apiPrivate.table(
  'api_refresh_tokens',
  {
    tokenId: uuid('token_id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => apiSessions.sessionId, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => publicUsers.userId, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    parentTokenId: uuid('parent_token_id').references((): AnyPgColumn => apiRefreshTokens.tokenId, {
      onDelete: 'set null',
    }),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    replacedByTokenId: uuid('replaced_by_token_id').references((): AnyPgColumn => apiRefreshTokens.tokenId, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    uniqueIndex('api_refresh_tokens_hash_uidx').on(table.tokenHash),
    index('api_refresh_tokens_family_idx').on(table.familyId),
    index('api_refresh_tokens_session_idx').on(table.sessionId, table.createdAt),
    check('api_refresh_tokens_hash_check', sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`),
    check('api_refresh_tokens_expiry_check', sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

export const apiPasswordResetTokens = apiPrivate.table(
  'password_reset_tokens',
  {
    tokenId: uuid('token_id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => publicUsers.userId, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('api_password_reset_tokens_hash_uidx').on(table.tokenHash),
    index('api_password_reset_tokens_user_idx').on(table.userId, table.expiresAt),
    check('api_password_reset_tokens_hash_check', sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`),
    check('api_password_reset_tokens_expiry_check', sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

export const apiAuthEvents = apiPrivate.table(
  'auth_events',
  {
    eventId: uuid('event_id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => publicUsers.userId, { onDelete: 'set null' }),
    eventType: text('event_type').notNull(),
    success: boolean('success').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('api_auth_events_user_time_idx').on(table.userId, table.createdAt),
    check('auth_events_metadata_object_check', sql`jsonb_typeof(${table.metadata}) = 'object'`),
  ],
);

export const apiRbacRoles = apiPrivate.table(
  'roles',
  {
    roleId: uuid('role_id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    isSystemRole: boolean('is_system_role').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('api_roles_code_uidx').on(table.code),
    check('api_roles_code_check', sql`${table.code} ~ '^[a-z][a-z0-9_-]{1,63}$'`),
  ],
);

export const apiPermissions = apiPrivate.table(
  'permissions',
  {
    permissionId: uuid('permission_id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('api_permissions_code_uidx').on(table.code),
    uniqueIndex('api_permissions_resource_action_uidx').on(table.resource, table.action),
    check('api_permissions_code_check', sql`${table.code} ~ '^[a-z][a-z0-9_.:-]{1,127}$'`),
    check('api_permissions_resource_check', sql`${table.resource} ~ '^[a-z][a-z0-9_-]{1,63}$'`),
    check('api_permissions_action_check', sql`${table.action} ~ '^[a-z][a-z0-9_-]{1,63}$'`),
  ],
);

export const apiUserRoles = apiPrivate.table(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => publicUsers.userId, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => apiRbacRoles.roleId, { onDelete: 'restrict' }),
    assignedBy: text('assigned_by').references(() => publicUsers.userId, { onDelete: 'set null' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    primaryKey({ name: 'api_user_roles_pkey', columns: [table.userId, table.roleId] }),
    index('api_user_roles_active_idx').on(table.userId, table.expiresAt),
    check('api_user_roles_expiry_check', sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.assignedAt}`),
  ],
);

export const apiRolePermissions = apiPrivate.table(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => apiRbacRoles.roleId, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => apiPermissions.permissionId, { onDelete: 'cascade' }),
    assignedBy: text('assigned_by').references(() => publicUsers.userId, { onDelete: 'set null' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ name: 'api_role_permissions_pkey', columns: [table.roleId, table.permissionId] })],
);

export const apiSchema = {
  publicUsers,
  publicRoles,
  publicSessions,
  apiLoginUsers,
  apiUserCredentials,
  apiUserSecurity,
  apiSessions,
  apiRefreshTokens,
  apiPasswordResetTokens,
  apiAuthEvents,
  apiRbacRoles,
  apiPermissions,
  apiUserRoles,
  apiRolePermissions,
};
