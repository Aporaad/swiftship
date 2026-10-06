import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  portalChangePasswordInputSchema,
  portalLoginInputSchema,
  portalRefreshInputSchema,
} from '../src/modules/portal/portal-auth.schemas';

describe('Portal Auth contracts', () => {
  it('accepts only the strict login payload', () => {
    expect(portalLoginInputSchema.safeParse({ identifier: 'user@example.test', password: 'correct horse battery staple' }).success).toBe(true);
    expect(portalLoginInputSchema.safeParse({ identifier: 'user@example.test', password: 'secret', role: 'admin' }).success).toBe(false);
  });

  it('requires a strong changed password and rejects reuse', () => {
    expect(portalChangePasswordInputSchema.safeParse({ currentPassword: 'old-password', newPassword: 'new-password-123' }).success).toBe(true);
    expect(portalChangePasswordInputSchema.safeParse({ currentPassword: 'same-password', newPassword: 'same-password' }).success).toBe(false);
    expect(portalChangePasswordInputSchema.safeParse({ currentPassword: 'old', newPassword: 'short' }).success).toBe(false);
  });

  it('accepts refresh token only and keeps password fields out of its contract', () => {
    expect(portalRefreshInputSchema.safeParse({ refreshToken: 'a'.repeat(64) }).success).toBe(true);
    expect(portalRefreshInputSchema.safeParse({ refreshToken: 'a'.repeat(64), password: 'secret' }).success).toBe(false);
  });

  it('keeps Portal credentials and sessions in the private schema', () => {
    const migration = readFileSync(resolve(process.cwd(), 'src/db/migrations/0013_portal_auth_private_storage.sql'), 'utf8');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS alx_api_private.portal_credentials');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS alx_api_private.portal_sessions');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS alx_api_private.portal_refresh_tokens');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS alx_api_private.portal_auth_events');
    expect(migration).toContain('password_hash LIKE \'$argon2id$v=19$%\'');
    expect(migration).not.toContain('GRANT SELECT ON alx_api_private.portal_credentials TO anon');
  });
});
