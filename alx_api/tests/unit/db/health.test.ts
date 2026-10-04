import { isDatabaseReady } from '../../../src/db/health';

describe('isDatabaseReady', () => {
  it('returns false when no database client is configured', async () => {
    await expect(isDatabaseReady(undefined)).resolves.toBe(false);
  });

  it('checks Auth storage and legacy migration function access', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    await expect(isDatabaseReady({ query })).resolves.toBe(true);
    expect(query).toHaveBeenNthCalledWith(1, 'SELECT 1 FROM alx_api_private.api_sessions LIMIT 0');
    expect(query).toHaveBeenNthCalledWith(2, 'SELECT 1 FROM alx_api_private.api_login_users LIMIT 0');
    expect(query).toHaveBeenNthCalledWith(3, 'SELECT 1 FROM alx_api_private.user_credentials LIMIT 0');
    expect(query).toHaveBeenNthCalledWith(4, "SELECT alx_api_private.verify_legacy_password('', '') LIMIT 1");
    expect(query).toHaveBeenNthCalledWith(5, "SELECT alx_api_private.migrate_legacy_password('', '', '') LIMIT 1");
  });

  it('returns false without exposing connection errors', async () => {
    const query = jest.fn().mockRejectedValue(new Error('private connection detail'));
    await expect(isDatabaseReady({ query })).resolves.toBe(false);
  });
});
