import { describe, expect, it, vi } from 'vitest';
import { testLogisticsConnection } from './testLogisticsConnection';
import type { LogisticsSettings } from '../types';

const settings: LogisticsSettings = {
  enabled: true,
  provider: 'aftership',
  apiKey: 'test-token',
  defaultDestinationCountry: 'Yemen',
};

describe('testLogisticsConnection', () => {
  it('posts the current settings and returns a successful result', async () => {
    const response = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, message: 'Connected' }),
    } as unknown as Response;
    const fetcher = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

    await expect(testLogisticsConnection(settings, fetcher)).resolves.toEqual({ success: true, message: 'Connected' });
    expect(fetcher).toHaveBeenCalledWith('/api/tracking/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  });

  it('returns the server error message for an unsuccessful response', async () => {
    const response = {
      ok: false,
      json: vi.fn().mockResolvedValue({ success: true, error: 'Unavailable' }),
    } as unknown as Response;
    const fetcher = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

    await expect(testLogisticsConnection(settings, fetcher)).resolves.toEqual({ success: false, error: 'Unavailable' });
  });

  it('uses the legacy fallback when the server omits an error message', async () => {
    const response = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: false }),
    } as unknown as Response;
    const fetcher = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

    await expect(testLogisticsConnection(settings, fetcher)).resolves.toEqual({ success: false, error: 'Connection failed' });
  });
});
