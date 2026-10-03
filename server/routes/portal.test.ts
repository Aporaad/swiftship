import { describe, expect, it } from 'vitest';
import { buildPortalAnnouncementDto, buildPublicTrackingDto } from './portal';

describe('Portal HTTP DTOs', () => {
  it('projects public tracking without leaking order/customer details', () => {
    const dto = buildPublicTrackingDto({
      order_status_id: 'in_transit',
      updated_at: '2026-10-04T01:00:00.000Z',
      customer_name: 'private customer',
      phone: '+96700000000',
      history: [
        { status: 'created', timestamp: 1, notes: 'private note', address: 'private address' },
        { status: 'in_transit', timestamp: 2, notes: 'carrier checkpoint' },
      ],
    }, 'TRACK-123');

    expect(dto).toEqual({
      trackingToken: 'TRACK-123',
      status: 'in_transit',
      events: [
        { status: 'created', occurredAt: 1 },
        { status: 'in_transit', occurredAt: 2 },
      ],
      updatedAt: Date.parse('2026-10-04T01:00:00.000Z'),
    });
    expect(JSON.stringify(dto)).not.toContain('private customer');
    expect(JSON.stringify(dto)).not.toContain('+96700000000');
    expect(JSON.stringify(dto)).not.toContain('private address');
  });

  it('bounds tracking history to the most recent twenty public events', () => {
    const history = Array.from({ length: 25 }, (_, index) => ({ status: `status-${index}`, timestamp: index }));
    const dto = buildPublicTrackingDto({ status: 'current', history }, 'TRACK-1');

    expect(dto?.events).toHaveLength(20);
    expect(dto?.events[0]?.status).toBe('status-5');
  });

  it('rejects tracking data without a public status', () => {
    expect(buildPublicTrackingDto({ customer_name: 'private' }, 'TRACK-1')).toBeNull();
  });

  it('maps active announcement data from canonical columns and JSONB without returning unknown fields', () => {
    const dto = buildPortalAnnouncementDto('announcement-1', {
      title: 'Service update',
      priority: 'urgent',
      created_at: '2026-10-04T00:00:00.000Z',
      data: { content: 'Public maintenance notice', password: 'never-include' },
    });

    expect(dto).toEqual({
      id: 'announcement-1',
      title: 'Service update',
      content: 'Public maintenance notice',
      priority: 'urgent',
      createdAt: Date.parse('2026-10-04T00:00:00.000Z'),
    });
    expect(JSON.stringify(dto)).not.toContain('never-include');
  });
});
