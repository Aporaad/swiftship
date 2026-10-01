import type { RequestHandler } from 'express';

export interface ServerPrincipal {
  id: string;
  email?: string | null;
  roles: string[];
}

export type TokenVerifier = (token: string) => Promise<ServerPrincipal | null>;

export function parseBearerToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

export function createServerAuthMiddleware(
  verifyToken: TokenVerifier | null,
): RequestHandler {
  return async (req, res, next) => {
    if (!verifyToken) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Server authentication is not configured.',
          requestId: res.locals.requestId,
        },
      });
    }

    const token = parseBearerToken(req.header('authorization'));
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'A Bearer token is required.',
          requestId: res.locals.requestId,
        },
      });
    }

    const principal = await verifyToken(token);
    if (!principal) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_INVALID',
          message: 'The supplied authentication token is invalid.',
          requestId: res.locals.requestId,
        },
      });
    }

    res.locals.principal = principal;
    return next();
  };
}

export function createStaticTokenVerifier(
  expectedToken: string | undefined,
  principal: ServerPrincipal,
): TokenVerifier | null {
  if (!expectedToken?.trim()) return null;
  return async (token) => token === expectedToken ? principal : null;
}
