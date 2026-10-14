import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));

vi.mock('../data/http/api-client', () => ({
  ApiClient: vi.fn(() => ({ get: mocks.get, post: mocks.post, patch: mocks.patch, delete: mocks.del })),
  ApiClientError: class ApiClientError extends Error {},
}));

import {
  calculateReturnStats,
  createReturnedProduct,
  createReturnedProductFromOrderItem,
  deleteReturnedProduct,
  fetchReturnedProducts,
  updateReturnedProduct,
} from './returnedProductService';

describe('returnedProductService over alx_api HTTP', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.del.mockReset();
  });

  it('fetches returned products and maps camelCase rows to the snake_case record', async () => {
    mocks.get.mockResolvedValueOnce({
      success: true,
      data: [{
        returnId: 'ret_1',
        orderId: 'ALX-10',
        orderItemId: 'item_3',
        customerName: 'أحمد',
        productName: 'ثلاجة',
        quantity: 2,
        refundAmount: '350.5',
        isInsured: true,
        insuranceRefund: '20',
        returnStatus: 'معلق',
        returnType: 'استرداد',
        returnCondition: 'تالف',
        returnedAt: '2026-10-01T10:00:00.000Z',
        createdAt: '2026-10-01T10:00:00.000Z',
      }],
    });

    const rows = await fetchReturnedProducts({ return_status: 'معلق', order_id: 'ALX-10' });

    expect(mocks.get).toHaveBeenCalledWith('/api/v1/operations/returned-products', {
      limit: 1000,
      offset: 0,
      returnStatus: 'معلق',
      orderId: 'ALX-10',
    });
    expect(rows[0]).toMatchObject({
      return_id: 'ret_1',
      order_id: 'ALX-10',
      order_item_id: 'item_3',
      customer_name: 'أحمد',
      refund_amount: 350.5,
      insurance_refund: 20,
      is_insured: true,
      return_status: 'معلق',
    });
    expect(calculateReturnStats(rows)).toMatchObject({ total: 1, pending: 1, total_refund_amount: 370.5 });
  });

  it('creates a return with sanitized values and a camelCase payload', async () => {
    mocks.post.mockResolvedValueOnce({ success: true, data: { returnId: 'ret_x' } });

    await createReturnedProduct({
      return_id: 'ret_x',
      order_id: '  ALX-1  ',
      order_item_id: '',
      quantity: 0,
      refund_amount: -5,
      is_insured: false,
      insurance_refund: 99,
      returned_at: '2026-10-02',
      created_at: '2020-01-01T00:00:00.000Z',
      created_by: 'someone',
    } as never);

    const [path, body] = mocks.post.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe('/api/v1/operations/returned-products');
    expect(body.returnId).toBe('ret_x');
    expect(body.orderId).toBe('ALX-1');
    expect(body.orderItemId).toBe(null);
    expect(body.quantity).toBe(1);
    expect(body.refundAmount).toBe(0);
    expect(body.insuranceRefund).toBe(0);
    expect(String(body.returnedAt)).toContain('T');
    expect('createdAt' in body).toBe(false);
    expect('createdBy' in body).toBe(false);
  });

  it('passes explicit nulls on update so processed fields can be cleared', async () => {
    mocks.patch.mockResolvedValueOnce({ success: true, data: { returnId: 'ret_1' } });

    await updateReturnedProduct('ret_1', {
      return_status: 'معلق',
      processed_by: null as never,
      processed_at: null as never,
    });

    expect(mocks.patch).toHaveBeenCalledWith(
      '/api/v1/operations/returned-products/ret_1',
      expect.objectContaining({ returnStatus: 'معلق', processedBy: null, processedAt: null }),
    );
  });

  it('deletes through the encoded HTTP path', async () => {
    mocks.del.mockResolvedValueOnce({ success: true, data: { deleted: true } });

    await deleteReturnedProduct('ret/2');

    expect(mocks.del).toHaveBeenCalledWith('/api/v1/operations/returned-products/ret%2F2');
  });

  it('builds an automatic return from an order item', async () => {
    mocks.post.mockResolvedValueOnce({ success: true, data: { returnId: 'auto' } });

    await createReturnedProductFromOrderItem(
      { order_id: 'ALX-7', items_id: 'item_9', product_id: 'prod_1', quantity: 2, total_price: 120, is_insured: true, insurance_fee: 10, product_cooler: 'ثلاجة شارب' },
      { orderNumber: 'ALX-7', customerName: 'سالم', currency: 'YER' },
      undefined,
    );

    const body = mocks.post.mock.calls[0][1] as Record<string, unknown>;
    expect(body).toMatchObject({
      orderId: 'ALX-7',
      orderItemId: 'item_9',
      customerName: 'سالم',
      productName: 'ثلاجة شارب',
      refundAmount: 120,
      isInsured: true,
      insuranceRefund: 10,
      returnStatus: 'معلق',
      refundCurrency: 'YER',
    });
    expect(String(body.returnId)).toMatch(/^ret_/);
  });
});
