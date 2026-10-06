import type { Pool, PoolClient } from 'pg';
import { createPortalAuthRepository } from '../src/modules/portal/portal-auth.repository';

describe('PortalAuthRepository transaction boundaries', () => {
  it('revokes refresh tokens and their sessions in one checked-out PostgreSQL transaction', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const client = {
      query,
      release: jest.fn(),
    } as unknown as PoolClient;
    const pool = {
      connect: jest.fn().mockResolvedValue(client),
      query: jest.fn(),
    } as unknown as Pool;
    const repository = createPortalAuthRepository(pool);
    const revokedAt = new Date('2026-10-06T19:56:00.000Z');

    await repository.revokeRefreshTokenFamily('family-1', revokedAt);

    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      'BEGIN',
      expect.stringContaining('UPDATE alx_api_private.portal_refresh_tokens'),
      expect.stringContaining('UPDATE alx_api_private.portal_sessions'),
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
