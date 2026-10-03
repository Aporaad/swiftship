import type { Express } from 'express';
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type DbClient,
} from '../current-db/client';
import { errorEnvelope, requestIdFrom, successEnvelope } from './api-foundation';

type JsonRecord = Record<string, unknown>;
type PublicTrackingEventDto = { status: string; occurredAt: number | null };
type PublicTrackingDto = {
  trackingToken: string;
  status: string;
  events: ReadonlyArray<PublicTrackingEventDto>;
  updatedAt: number | null;
};
type PortalAnnouncementDto = {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'high' | 'urgent';
  createdAt: number;
};

const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : null;

function nonEmptyText(...values: unknown[]): string | null {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() ?? null;
}

function epoch(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const date = Date.parse(value);
    return Number.isFinite(date) ? date : null;
  }
  return null;
}

export function buildPublicTrackingDto(value: unknown, trackingToken: string): PublicTrackingDto | null {
  const row = asRecord(value);
  if (!row) return null;
  const nested = asRecord(row.data) ?? {};
  const status = nonEmptyText(row.status, row.order_status_id, row.order_status1, nested.status, nested.orderStatus);
  if (!status) return null;

  const rawHistory = Array.isArray(row.history) ? row.history : Array.isArray(nested.history) ? nested.history : [];
  const events = rawHistory
    .slice(-20)
    .map((item): PublicTrackingEventDto | null => {
      const event = asRecord(item);
      if (!event) return null;
      const eventStatus = nonEmptyText(event.status, event.order_status_id);
      if (!eventStatus) return null;
      return { status: eventStatus, occurredAt: epoch(event.occurredAt ?? event.timestamp ?? event.created_at) };
    })
    .filter((event): event is PublicTrackingEventDto => event !== null);

  const updatedAt = epoch(row.updated_at ?? row.updatedAt ?? nested.updatedAt);
  return { trackingToken, status, events, updatedAt };
}

export function buildPortalAnnouncementDto(id: string, value: unknown): PortalAnnouncementDto | null {
  const row = asRecord(value);
  if (!row) return null;
  const nested = asRecord(row.data) ?? {};
  const title = nonEmptyText(row.title, nested.title);
  const content = nonEmptyText(row.content, nested.content, nested.description, nested.message);
  if (!title || !content) return null;
  const priorityValue = nonEmptyText(row.priority, nested.priority);
  const priority = priorityValue === 'urgent' || priorityValue === 'high' ? priorityValue : 'normal';
  const createdAt = epoch(row.created_at ?? row.createdAt ?? nested.createdAt) ?? 0;
  return { id, title, content, priority, createdAt };
}

export function registerPortalRoutes(app: Express, db: DbClient['db'] | null): void {
  app.get('/api/v1/portal/tracking/:trackingToken', async (request, response) => {
    const requestId = requestIdFrom(request);
    const trackingToken = request.params.trackingToken?.trim() ?? '';
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(trackingToken)) {
      response.status(400).json(errorEnvelope('PUBLIC_TRACKING_INVALID', requestId));
      return;
    }
    if (!db) {
      response.status(503).json(errorEnvelope('PORTAL_API_UNAVAILABLE', requestId));
      return;
    }

    try {
      const snapshot = await getDocs(query(
        collection(db, 'orders'),
        where('tracking_number', '==', trackingToken),
        limit(1),
      ));
      const document = snapshot.docs[0];
      const dto = document ? buildPublicTrackingDto(document.data(), trackingToken) : null;
      if (!dto) {
        response.status(404).json(errorEnvelope('PUBLIC_TRACKING_NOT_FOUND', requestId));
        return;
      }
      response.json(successEnvelope(dto, requestId));
    } catch {
      response.status(503).json(errorEnvelope('PORTAL_API_UNAVAILABLE', requestId));
    }
  });

  app.get('/api/v1/portal/announcements', async (request, response) => {
    const requestId = requestIdFrom(request);
    if (!db) {
      response.status(503).json(errorEnvelope('PORTAL_API_UNAVAILABLE', requestId));
      return;
    }

    try {
      const snapshot = await getDocs(query(
        collection(db, 'announcements'),
        where('is_active', '==', true),
        limit(50),
      ));
      const announcements = snapshot.docs
        .map((document) => buildPortalAnnouncementDto(document.id, document.data()))
        .filter((announcement): announcement is PortalAnnouncementDto => announcement !== null);
      response.json(successEnvelope(announcements, requestId));
    } catch {
      response.status(503).json(errorEnvelope('PORTAL_API_UNAVAILABLE', requestId));
    }
  });
}
