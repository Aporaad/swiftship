import {
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
} from '../../../src/modules/auth/auth.schemas';

describe('Auth request schemas', () => {
  it('accepts a username or email and preserves password bytes except identifier trim', () => {
    const result = loginInputSchema.parse({ identifier: '  user@example.com  ', password: ' password ' });
    expect(result).toEqual({ identifier: 'user@example.com', password: ' password ' });
  });

  it('rejects empty and oversized credential inputs and unknown keys', () => {
    expect(loginInputSchema.safeParse({ identifier: '', password: 'x' }).success).toBe(false);
    expect(loginInputSchema.safeParse({ identifier: 'user', password: 'x'.repeat(1_025) }).success).toBe(false);
    expect(loginInputSchema.safeParse({ identifier: 'user', password: 'secret', isAdmin: true }).success).toBe(false);
  });

  it('requires a bounded opaque token for refresh and logout', () => {
    const token = 't'.repeat(32);
    expect(refreshInputSchema.safeParse({ refreshToken: token }).success).toBe(true);
    expect(logoutInputSchema.safeParse({ refreshToken: token }).success).toBe(true);
    expect(refreshInputSchema.safeParse({ refreshToken: 'short' }).success).toBe(false);
  });
});
