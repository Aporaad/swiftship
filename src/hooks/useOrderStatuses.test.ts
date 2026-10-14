import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }));

vi.mock('../data/http/api-client', () => ({
  ApiClient: vi.fn(() => ({ get: mocks.get, post: mocks.post, delete: mocks.del })),
  ApiClientError: class ApiClientError extends Error {},
}));

import { fetchOrderStatuses, saveOrderStatus, removeOrderStatus } from './useOrderStatuses';

describe('useOrderStatuses API layer', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.del.mockReset();
  });

  it('reads order statuses from the operations API and maps rows', async () => {
    mocks.get.mockResolvedValueOnce({
      success: true,
      data: [
        { statusId: '1', nameAr: 'معلق', nameEn: 'Pending', isFirst: true, isLast: false, sortOrder: 1, color: 'amber', code: 'pending' },
        { statusId: '11', nameAr: 'مرتجع', isLast: true, sortOrder: 11 },
        { statusId: 'bad', nameAr: '' },
      ],
    });

    const statuses = await fetchOrderStatuses();

    expect(mocks.get).toHaveBeenCalledWith('/api/v1/operations/order-statuses');
    expect(statuses.map((status) => status.id)).toEqual([1, 11]);
    expect(statuses[1]).toMatchObject({ nameAr: 'مرتجع', nameEn: 'مرتجع', isFirst: false, isLast: true });
  });

  it('saves a status through the upsert endpoint', async () => {
    mocks.post.mockResolvedValueOnce({ success: true, data: { statusId: '11' } });

    await saveOrderStatus({ id: 11, nameAr: 'مرتجع', nameEn: 'Returned', isFirst: false, isLast: false, sortOrder: 11, color: 'rose', code: 'returned', description: '' });

    expect(mocks.post).toHaveBeenCalledWith('/api/v1/operations/order-statuses', expect.objectContaining({ statusId: 11, nameAr: 'مرتجع', color: 'rose' }));
  });

  it('deletes a status through the API', async () => {
    mocks.del.mockResolvedValueOnce({ success: true, data: { deleted: true } });

    await removeOrderStatus(11);

    expect(mocks.del).toHaveBeenCalledWith('/api/v1/operations/order-statuses/11');
  });
});
