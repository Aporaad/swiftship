import type { RequestHandler } from 'express';

export interface ServerPrincipal {
  id: string;
  email?: string | null;
  roles: string[];
}

export type TokenVerifier = (token: string) => Promise<ServerPrincipal | null>;

interface SupabaseAuthClient {
  auth?: {
    getUser?: (token: string) => Promise<{
      data?: { user?: { id?: string; email?: string; user_metadata?: unknown } | null };
      error?: unknown;
    }>;
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function rolesFromUserMetadata(metadata: unknown): string[] {
  const record = asRecord(metadata);
  const role = typeof record.role === 'string' ? record.role : null;
  const roles = Array.isArray(record.roles)
    ? record.roles.filter((value): value is string => typeof value === 'string')
    : [];
  const normalized = new Set(roles);
  if (role) normalized.add(role);
  if (role === 'Admin' || role === 'admin' || record.isRoot === true) {
    normalized.add('customers:read');
    normalized.add('couriers:read');
  }
  return [...normalized];
}

export function parseBearerToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

export function createSupabaseSessionVerifier(client: unknown): TokenVerifier {
  return async (token) => {
    const authClient = client as SupabaseAuthClient;
    if (typeof authClient.auth?.getUser !== 'function') return null;
    const result = await authClient.auth.getUser(token);
    const user = result.data?.user;
    if (result.error || !user?.id) return null;
    return {
      id: user.id,
      email: user.email ?? null,
      roles: rolesFromUserMetadata(user.user_metadata),
    };
  };
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

    try {
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
    } catch {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_INVALID',
          message: 'The supplied authentication token is invalid.',
          requestId: res.locals.requestId,
        },
      });
    }
  };
}

export function createServerPermissionMiddleware(permission: string): RequestHandler {
  return (_req, res, next) => {
    const principal = res.locals.principal as ServerPrincipal | undefined;
    if (!principal?.roles.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'The authenticated principal lacks the required permission.',
          requestId: res.locals.requestId,
        },
      });
    }
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
