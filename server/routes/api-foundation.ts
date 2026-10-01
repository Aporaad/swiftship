import type { Express, NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type DbClient,
} from '../current-db/client';

type JsonRecord = Record<string, unknown>;
type Principal = {
  userId: string;
  role: string;
  email: string | null;
  fullName: string | null;
  permissions: ReadonlySet<string>;
};

type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details: ReadonlyArray<unknown>;
    requestId: string;
  };
};

const safeMessage = 'تعذر تنفيذ الطلب حالياً.';
const asRecord = (value: unknown): JsonRecord => value !== null && typeof value === 'object' ? value as JsonRecord : {};
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const bool = (value: unknown, fallback = false): boolean => typeof value === 'boolean' ? value : fallback;
const numberValue = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

export function requestIdFrom(req: Pick<Request, 'header'>): string {
  const supplied = req.header('x-request-id')?.trim();
  return supplied && supplied.length <= 128 ? supplied : randomUUID();
}

export function errorEnvelope(code: string, requestId: string, message = safeMessage, details: ReadonlyArray<unknown> = []): ErrorEnvelope {
  return { success: false, error: { code, message, details, requestId } };
}

export function publicCustomerDto(id: string, raw: unknown): JsonRecord {
  const row = asRecord(raw);
  const data = asRecord(row.data);
  return {
    customerId: id,
    fullName: text(row.full_name) ?? text(data.fullName),
    nameAr: text(row.name_ar) ?? text(data.name_ar),
    nameEn: text(row.name_en) ?? text(data.name_en),
    accountId: text(row.account_id),
    isActive: bool(row.is_active, true),
    customerLevel: text(row.customer_level),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export function publicCourierDto(id: string, raw: unknown): JsonRecord {
  const row = asRecord(raw);
  return {
    courierId: id,
    fullName: text(row.full_name),
    nameAr: text(row.name_ar),
    nameEn: text(row.name_en),
    accountId: text(row.account_id),
    currency: text(row.currency),
    isActive: bool(row.is_active, true),
    type: text(row.courier_type),
    level: text(row.courier_level),
    commissionRate: numberValue(row.commission_rate),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export function hasPermission(principal: Pick<Principal, 'role' | 'permissions'>, permission: string): boolean {
  return principal.role.toLowerCase() === 'admin' || principal.permissions.has(permission);
}

function bearerToken(req: Request): string | null {
  const value = req.header('authorization');
  if (!value?.startsWith('Bearer ')) return null;
  const token = value.slice(7).trim();
  return token || null;
}

async function resolvePrincipal(db: DbClient['db'], req: Request): Promise<Principal | null> {
  const sessionId = bearerToken(req);
  if (!sessionId) return null;
  const sessions = await getDocs(query(collection(db, 'sessions'), where('id', '==', sessionId), limit(1)));
  if (sessions.empty) return null;
  const session = asRecord(sessions.docs[0].data());
  if (bool(session.force_logout) || bool(session.forceLogout)) return null;
  const userId = text(session.user_id) ?? text(session.userId);
  if (!userId) return null;
  const users = await getDocs(query(collection(db, 'users'), where('id', '==', userId), limit(1)));
  if (users.empty) return null;
  const user = asRecord(users.docs[0].data());
  if (bool(user.disabled)) return null;
  const permissionValues = Array.isArray(user.permissions) ? user.permissions.filter((item): item is string => typeof item === 'string') : [];
  return {
    userId,
    role: text(user.role) ?? text(session.role) ?? 'Staff',
    email: text(user.email),
    fullName: text(user.fullName) ?? text(user.full_name),
    permissions: new Set(permissionValues),
  };
}

function requirePermission(db: DbClient['db'], permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = requestIdFrom(req);
    res.setHeader('x-request-id', requestId);
    try {
      const principal = await resolvePrincipal(db, req);
      if (!principal) {
        res.status(401).json(errorEnvelope('AUTH_REQUIRED', requestId));
        return;
      }
      if (!hasPermission(principal, permission)) {
        res.status(403).json(errorEnvelope('PERMISSION_DENIED', requestId));
        return;
      }
      res.locals.principal = principal;
      res.locals.requestId = requestId;
      next();
    } catch {
      res.status(503).json(errorEnvelope('AUTH_UNAVAILABLE', requestId));
    }
  };
}

export function registerApiFoundationRoutes(app: Express, db: DbClient['db'] | null): void {
  app.use('/api/v1', (req, res, next) => {
    res.setHeader('x-request-id', requestIdFrom(req));
    next();
  });

  app.get('/api/v1/contract', (_req, res) => {
    res.json({ version: '1', routes: [
      { method: 'GET', path: '/api/v1/contract', auth: 'public' },
      { method: 'GET', path: '/api/v1/customers', auth: 'local-session', permission: 'customers:read' },
      { method: 'GET', path: '/api/v1/couriers', auth: 'local-session', permission: 'couriers:read' },
    ] });
  });

  if (!db) return;

  app.get('/api/v1/customers', requirePermission(db, 'customers:read'), async (req, res) => {
    const requestId = String(res.getHeader('x-request-id'));
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
      const snapshot = await getDocs(query(collection(db, 'customers'), limit(page * pageSize)));
      const rows = snapshot.docs.slice((page - 1) * pageSize).map((item) => publicCustomerDto(item.id, item.data()));
      res.json({ success: true, data: rows, meta: { page, pageSize, totalItems: snapshot.size, totalPages: Math.max(1, Math.ceil(snapshot.size / pageSize)) }, requestId });
    } catch {
      res.status(500).json(errorEnvelope('CUSTOMERS_READ_FAILED', requestId));
    }
  });

  app.get('/api/v1/couriers', requirePermission(db, 'couriers:read'), async (req, res) => {
    const requestId = String(res.getHeader('x-request-id'));
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
      const snapshot = await getDocs(query(collection(db, 'couriers'), limit(page * pageSize)));
      const rows = snapshot.docs.slice((page - 1) * pageSize).map((item) => publicCourierDto(item.id, item.data()));
      res.json({ success: true, data: rows, meta: { page, pageSize, totalItems: snapshot.size, totalPages: Math.max(1, Math.ceil(snapshot.size / pageSize)) }, requestId });
    } catch {
      res.status(500).json(errorEnvelope('COURIERS_READ_FAILED', requestId));
    }
  });
}
