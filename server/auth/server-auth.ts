import type { RequestHandler } from 'express';
import { doc, getDoc } from '../current-db/client';

export interface ServerPrincipal {
  id: string;
  email?: string | null;
  roles: string[];
  sessionId: string;
}

export type TokenVerifier = (token: string) => Promise<ServerPrincipal | null>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

function rolesFromUser(user: Record<string, unknown>, session: Record<string, unknown>): string[] {
  const role = asString(user.role) ?? asString(session.role);
  const roles = new Set<string>();
  if (role) roles.add(role);
  if (role === 'Admin' || role === 'admin' || asBoolean(user.is_root) || asBoolean(user.isRoot)) {
    roles.add('customers:read');
    roles.add('couriers:read');
  }
  return [...roles];
}

function lastSeenMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function parseBearerToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

export function createLocalSessionVerifier(db: unknown): TokenVerifier | null {
  if (!db) return null;
  return async (sessionId) => {
    try {
      const sessionSnapshot = await getDoc(doc(db, 'sessions', sessionId));
      if (!sessionSnapshot.exists()) return null;
      const session = asRecord(sessionSnapshot.data());
      if (asBoolean(session.force_logout) || asBoolean(session.forceLogout)) return null;

      const userId = asString(session.user_id) ?? asString(session.userId);
      if (!userId) return null;
      const userSnapshot = await getDoc(doc(db, 'users', userId));
      if (!userSnapshot.exists()) return null;
      const user = asRecord(userSnapshot.data());
      if (asBoolean(user.disabled)) return null;

      const seenAt = lastSeenMs(session.last_seen ?? session.lastSeen);
      if (seenAt !== null && Date.now() - seenAt > 24 * 60 * 60 * 1000) return null;

      return {
        id: userId,
        email: asString(user.email) ?? asString(session.email),
        roles: rolesFromUser(user, session),
        sessionId,
      };
    } catch {
      return null;
    }
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
          message: 'Local session authentication is not configured.',
          requestId: res.locals.requestId,
        },
      });
    }

    const token = parseBearerToken(req.header('authorization')) ?? req.header('x-session-id') ?? null;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'A local session identifier is required.',
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
          message: 'The local session is invalid, expired, disabled, or terminated.',
          requestId: res.locals.requestId,
        },
      });
    }

    res.locals.principal = principal;
    return next();
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
          message: 'The authenticated local user lacks the required permission.',
          requestId: res.locals.requestId,
        },
      });
    }
    return next();
  };
}
