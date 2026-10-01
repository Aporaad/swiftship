import type { Express } from 'express';
import { ApplicationError } from '../../src/shared/contracts/error.contracts';
import { collection, getDocs, limit as dbLimit, query } from '../current-db/client';
import type { GatewayPage, GatewayQuery } from '../../src/data/contracts/common.gateway';
import {
  createServerAuthMiddleware,
  createServerPermissionMiddleware,
  type TokenVerifier,
} from '../auth/server-auth';

export interface CourierApiDto {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  disabled: boolean;
}

interface CouriersGateway {
  list(query?: GatewayQuery): Promise<GatewayPage<CourierApiDto>>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mapCourier(value: unknown, fallbackId: string): CourierApiDto {
  const row = asRecord(value);
  return {
    id: asString(row.courier_id) ?? asString(row.id) ?? fallbackId,
    name: asString(row.full_name) ?? asString(row.fullName) ?? asString(row.name),
    email: asString(row.email),
    phone: asString(row.phone) ?? asString(row.phone_number),
    disabled: row.disabled === true,
  };
}

export function createCouriersGateway(db: unknown): CouriersGateway {
  return {
    async list(options = {}): Promise<GatewayPage<CourierApiDto>> {
      if (!db) {
        throw new ApplicationError({
          code: 'DATABASE_NOT_READY',
          message: 'The courier data source is not available.',
        });
      }
      const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
      const offset = Math.max(options.offset ?? 0, 0);
      const snapshot = await getDocs(query(collection(db, 'couriers'), dbLimit(limit + offset)));
      const mapped = snapshot.docs.map((document: { id: string; data: () => unknown }) =>
        mapCourier(document.data(), document.id));
      const filtered = options.search?.trim()
        ? mapped.filter((courier) => `${courier.name ?? ''} ${courier.email ?? ''} ${courier.phone ?? ''}`
          .toLowerCase().includes(options.search!.trim().toLowerCase()))
        : mapped;
      const items = filtered.slice(offset, offset + limit);
      return { items, limit, offset, hasMore: filtered.length > offset + items.length };
    },
  };
}

function numberQuery(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function registerCouriersRoutes(
  app: Express,
  gateway: CouriersGateway,
  verifyToken: TokenVerifier | null,
): void {
  const authenticate = createServerAuthMiddleware(verifyToken);
  const authorizeRead = createServerPermissionMiddleware('couriers:read');
  app.get('/api/v1/couriers', authenticate, authorizeRead, async (req, res, next) => {
    try {
      const page = await gateway.list({
        limit: numberQuery(req.query.limit, 50),
        offset: numberQuery(req.query.offset, 0),
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      });
      return res.status(200).json({
        data: page.items,
        page: { limit: page.limit, offset: page.offset, hasMore: page.hasMore },
      });
    } catch (error) {
      return next(error);
    }
  });
}
