import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  apiAuthEvents,
  apiPasswordResetTokens,
  apiRefreshTokens,
  apiSessions,
  apiUserCredentials,
  apiUserSecurity,
  publicRoles,
  publicSessions,
  publicUsers,
} from '../../../src/db/schema';

describe('ALX API database schema', () => {
  it('maps the documented legacy identity tables without renaming them', () => {
    expect(getTableName(publicUsers)).toBe('users');
    expect(getTableName(publicRoles)).toBe('roles');
    expect(getTableName(publicSessions)).toBe('sessions');
  });

  it('keeps API-owned credential and token tables in the private schema', () => {
    expect(getTableName(apiUserCredentials)).toBe('user_credentials');
    expect(getTableName(apiUserSecurity)).toBe('user_security');
    expect(getTableName(apiSessions)).toBe('api_sessions');
    expect(getTableName(apiRefreshTokens)).toBe('api_refresh_tokens');
    expect(getTableName(apiPasswordResetTokens)).toBe('password_reset_tokens');
    expect(getTableName(apiAuthEvents)).toBe('auth_events');
    for (const table of [
      apiUserCredentials,
      apiUserSecurity,
      apiSessions,
      apiRefreshTokens,
      apiPasswordResetTokens,
      apiAuthEvents,
    ]) {
      expect(getTableConfig(table).schema).toBe('alx_api_private');
    }
  });
});
