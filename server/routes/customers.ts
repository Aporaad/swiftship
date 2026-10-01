import type { Express, RequestHandler } from 'express';
import { ApplicationError } from '../../src/shared/contracts/error.contracts';
import {
  collection,
  getDocs,
  limit as dbLimit,
  query,
} from '../current-db/client';
import type { GatewayPage, GatewayQuery } from '../../src/data/contracts/common.gateway';
import { createServerAuthMiddleware, type TokenVerifier } from '../auth/server-auth';

export interface CustomerApiDto {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  disabled: boolean;
}

interface CustomersGateway {
  list(query?: GatewayQuery): Promise<GatewayPage<CustomerApiDto>>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mapCustomer(value: unknown, fallbackId: string): CustomerApiDto {
  const row = asRecord(value);
  return {
    id: asString(row.customer_id) ?? asString(row.id) ?? fallbackId,
    name: asString(row.name) ?? asString(row.full_name) ?? asString(row.fullName),
    email: asString(row.email),
    phone: asString(row.phone) ?? asString(row.phone_number),
    disabled: row.disabled === true,
  };
}

export function createCustomersGateway(db: unknown): CustomersGateway {
  return {
    async list(options = {}): Promise<GatewayPage<CustomerApiDto>> {
      if (!db) {
        throw new ApplicationError({
          code: 'DATABASE_NOT_READY',
          message: 'The customer data source is not available.',
        });
      }

      const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
      const offset = Math.max(options.offset ?? 0, 0);
      const snapshot = await getDocs(query(collection(db, 'customers'), dbLimit(limit + offset)));
      const mapped = snapshot.docs.map((document: { id: string; data: () => unknown }) =>
        mapCustomer(document.data(), document.id));
      const filtered = options.search?.trim()
        ? mapped.filter((customer) => `${customer.name ?? ''} ${customer.email ?? ''} ${customer.phone ?? ''}`
          .toLowerCase().includes(options.search!.trim().toLowerCase()))
        : mapped;
      const items = filtered.slice(offset, offset + limit);
      return {
        items,
        limit,
        offset,
        hasMore: filtered.length > offset + items.length,
      };
    },
  };
}

function numberQuery(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function registerCustomersRoutes(
  app: Express,
  gateway: CustomersGateway,
  verifyToken: TokenVerifier | null,
): void {
  const authenticate = createServerAuthMiddleware(verifyToken);
  app.get('/api/v1/customers', authenticate, async (req, res, next) => {
    try {
      const page = await gateway.list({
        limit: numberQuery(req.query.limit, 50),
        offset: numberQuery(req.query.offset, 0),
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      });
      return res.status(200).json({ data: page.items, page: {
        limit: page.limit,
        offset: page.offset,
        hasMore: page.hasMore,
      } });
    } catch (error) {
      return next(error);
    }
  });
}
