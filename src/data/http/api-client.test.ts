import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiClientError } from './api-client';

describe('ApiClient', () => {
  it('throws a normalized envelope and preserves the server request id', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: { code: 'ORDER_STATUS_INVALID', message: 'Invalid transition', details: [], requestId: 'req-42' },
    }), { status: 409, headers: { 'content-type': 'application/json' } }));
    const client = new ApiClient({ baseUrl: 'https://api.example.test', fetchImpl });

    await expect(client.get('/orders/1')).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'ORDER_STATUS_INVALID',
      message: 'Invalid transition',
      requestId: 'req-42',
      toEnvelope: expect.any(Function),
    });
  });

  it('uses a stable safe fallback for non-JSON HTTP failures', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('upstream secret', { status: 502 }));
    const client = new ApiClient({ baseUrl: 'https://api.example.test', fetchImpl });

    const request = client.get('/health');
    await expect(request).rejects.toBeInstanceOf(ApiClientError);
    await expect(request).rejects.toMatchObject({
      code: 'API_REQUEST_FAILED',
      message: 'API request failed with status 502.',
    });
  });

  it('sends the local session identifier as a bearer token', async () => {
    vi.stubGlobal('sessionStorage', {
      length: 1,
      key: (index: number) => index === 0 ? 'swiftship_session_id_user-1' : null,
      getItem: (key: string) => key === 'swiftship_session_id_user-1' ? 'sess-user-1' : null,
    });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
    const client = new ApiClient({ baseUrl: 'https://api.example.test', fetchImpl });

    await client.get('/api/v1/customers');

    expect(fetchImpl).toHaveBeenCalledWith(
      new URL('https://api.example.test/api/v1/customers'),
      { headers: { Accept: 'application/json', Authorization: 'Bearer sess-user-1' } },
    );
    vi.unstubAllGlobals();
  });
});
