import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { registerBrowserProxyRoute } from './route';

function createResponse() {
  const response = {
    headers: new Map<string, string>(),
    body: undefined as unknown,
    statusCode: 200,
    setHeader: vi.fn((key: string, value: string) => {
      response.headers.set(key, value);
    }),
    status: vi.fn((statusCode: number) => {
      response.statusCode = statusCode;
      return response;
    }),
    send: vi.fn((body: unknown) => {
      response.body = body;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      response.body = body;
      return response;
    }),
    end: vi.fn(() => response),
  };
  return response;
}

describe('Browser Proxy route', () => {
  it('preserves HTML response status, CORS headers and client interceptor injection', async () => {
    const all = vi.fn<(path: string, handler: RequestHandler) => void>();
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(
      '<html><head></head><body>remote</body></html>',
      { status: 202, headers: { 'content-type': 'text/html; charset=utf-8' } },
    ));
    const response = createResponse();

    registerBrowserProxyRoute({ all } as unknown as Express, fetchImpl);
    const handler = all.mock.calls[0][1];
    await handler(
      {
        method: 'GET',
        query: { url: 'https://example.test/page' },
        body: {},
        headers: { accept: 'text/html' },
      } as unknown as Request,
      response as unknown as Response,
      vi.fn() as NextFunction,
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/page',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(response.body).toContain('<base href="https://example.test/">');
    expect(response.body).toContain('__swiftship_proxy_script');
  });

  it('forwards non-HTML payloads as buffers with the upstream status', async () => {
    const all = vi.fn<(path: string, handler: RequestHandler) => void>();
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(
      'binary-payload',
      { status: 206, headers: { 'content-type': 'application/octet-stream' } },
    ));
    const response = createResponse();

    registerBrowserProxyRoute({ all } as unknown as Express, fetchImpl);
    const handler = all.mock.calls[0][1];
    await handler(
      {
        method: 'GET',
        query: { url: 'https://example.test/file.bin' },
        body: {},
        headers: {},
      } as unknown as Request,
      response as unknown as Response,
      vi.fn() as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(206);
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect((response.body as Buffer).toString()).toBe('binary-payload');
  });
});
