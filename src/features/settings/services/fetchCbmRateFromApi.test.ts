import { describe, expect, it, vi } from 'vitest';
import { CbmRateNotFoundError, fetchCbmRateFromApi } from './fetchCbmRateFromApi';

describe('fetchCbmRateFromApi', () => {
  it('returns the first available supported rate field', async () => {
    const response = {
      ok: true,
      json: vi.fn().mockResolvedValue({ cbm_rate: 0, rate: '1425.5', price: 1600 }),
    } as unknown as Response;
    const fetcher = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

    await expect(fetchCbmRateFromApi('https://rates.example.test/cbm', fetcher)).resolves.toBe(1425.5);
    expect(fetcher).toHaveBeenCalledWith('https://rates.example.test/cbm');
  });

  it('rejects when the response has no usable rate', async () => {
    const response = {
      ok: true,
      json: vi.fn().mockResolvedValue({ cbm_rate: 'invalid' }),
    } as unknown as Response;
    const fetcher = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

    await expect(fetchCbmRateFromApi('https://rates.example.test/cbm', fetcher)).rejects.toBeInstanceOf(CbmRateNotFoundError);
  });

  it('rejects unsuccessful HTTP responses', async () => {
    const response = { ok: false, json: vi.fn() } as unknown as Response;
    const fetcher = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

    await expect(fetchCbmRateFromApi('https://rates.example.test/cbm', fetcher)).rejects.toThrow('API request failed');
    expect(response.json).not.toHaveBeenCalled();
  });
});
