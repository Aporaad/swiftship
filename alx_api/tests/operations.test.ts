import request from 'supertest';
import { createApiApp } from '../src/app';
import { parseEnvironment } from '../src/config/env';
import type { AuthUseCases } from '../src/modules/auth/auth.contracts';
import type { OperationsRepository } from '../src/modules/operations/operations.contracts';
const environment = parseEnvironment({ NODE_ENV: 'test', CORS_ORIGINS: 'https://portal.example.test' });
const auth = (permissions: string[]): jest.Mocked<AuthUseCases> => ({
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  authenticateAccessToken: jest.fn().mockResolvedValue({ userId: 'u1', sessionId: 's1', role: 'employee' }),
  listSessions: jest.fn(),
  revokeSession: jest.fn(),
  logoutAll: jest.fn(),
  changePassword: jest.fn(),
  requestPasswordReset: jest.fn(),
  completePasswordReset: jest.fn(),
  listPermissions: jest.fn().mockResolvedValue(permissions),
});
const repository: OperationsRepository = {
  listOrders: jest.fn().mockResolvedValue({ items: [{ orderId: 'o1' }], total: 1 }),
  getOrder: jest.fn().mockResolvedValue({ orderId: 'o1', items: [], shipments: [] }),
  listOrderHistory: jest.fn().mockResolvedValue([{ eventType: 'order.created' }]),
  listShipments: jest.fn().mockResolvedValue({ items: [{ shipmentId: 's1' }], total: 1 }),
  getShipment: jest.fn().mockResolvedValue({ shipmentId: 's1' }),
  listTracking: jest.fn().mockResolvedValue([{ eventType: 'shipment.status_changed' }]),
  listProducts: jest.fn().mockResolvedValue({ items: [{ productId: 'p1' }], total: 1 }),
  getProduct: jest.fn().mockResolvedValue({ productId: 'p1' }),
  createOrder: jest.fn(),
  updateOrderStatus: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  updateShipment: jest.fn(),
  createShipment: jest.fn(),
  createCourier: jest.fn(),
  updateCourier: jest.fn(),
  deleteCourier: jest.fn(),
  createEmployee: jest.fn(),
  updateEmployee: jest.fn(),
  deleteEmployee: jest.fn(),
};
describe('Orders, Shipments/Tracking and Products HTTP boundaries', () => {
  it('denies Orders without view_orders', async () => {
    const response = await request(createApiApp({ environment, auth: auth([]), operations: repository }))
      .get('/api/v1/orders')
      .set('Authorization', 'Bearer token');
    expect(response.status).toBe(403);
  });
  it('lists Orders and exposes history through the compatibility repository', async () => {
    const app = createApiApp({ environment, auth: auth(['view_orders']), operations: repository });
    expect((await request(app).get('/api/v1/orders').set('Authorization', 'Bearer token')).status).toBe(200);
    expect(
      (await request(app).get('/api/v1/orders/o1/history').set('Authorization', 'Bearer token')).body.data[0].eventType,
    ).toBe('order.created');
  });
  it('lists Shipments and Tracking with track_order', async () => {
    const app = createApiApp({ environment, auth: auth(['track_order']), operations: repository });
    expect(
      (await request(app).get('/api/v1/shipments').set('Authorization', 'Bearer token')).body.data[0].shipmentId,
    ).toBe('s1');
    expect((await request(app).get('/api/v1/shipments/s1/tracking').set('Authorization', 'Bearer token')).status).toBe(
      200,
    );
  });
  it('lists Products with view_products', async () => {
    const response = await request(createApiApp({ environment, auth: auth(['view_products']), operations: repository }))
      .get('/api/v1/products')
      .set('Authorization', 'Bearer token');
    expect(response.status).toBe(200);
    expect(response.body.data[0].productId).toBe('p1');
  });

  it('requires an Idempotency-Key when creating an order', async () => {
    const response = await request(createApiApp({ environment, auth: auth(['add_orders']), operations: repository }))
      .post('/api/v1/orders')
      .send({ orderNumber: 'o2', items: [] })
      .set('Authorization', 'Bearer token');
    expect(response.status).toBe(400);
    expect(repository.createOrder).not.toHaveBeenCalled();
  });

  it('accepts a validated order write and status transition', async () => {
    (repository.createOrder as jest.Mock).mockResolvedValueOnce({ orderId: 'o2' });
    (repository.updateOrderStatus as jest.Mock).mockResolvedValueOnce({ orderId: 'o2', status: 'confirmed' });
    const app = createApiApp({
      environment,
      auth: auth(['add_orders', 'update_order_status']),
      operations: repository,
    });
    const created = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', 'Bearer token')
      .set('Idempotency-Key', 'order-create-o2')
      .send({ orderNumber: 'o2', items: [{ quantity: 1, unitPrice: 10 }] });
    expect(created.status).toBe(200);
    const changed = await request(app)
      .patch('/api/v1/orders/o2/status')
      .set('Authorization', 'Bearer token')
      .send({ status: 'confirmed' });
    expect(changed.status).toBe(200);
  });

  it('enforces product write permissions', async () => {
    const response = await request(createApiApp({ environment, auth: auth(['view_products']), operations: repository }))
      .post('/api/v1/products')
      .set('Authorization', 'Bearer token')
      .send({ productId: 'p2', unitPrice: 5 });
    expect(response.status).toBe(403);
  });

  it('uses order-edit permission for shipment and courier assignment', async () => {
    (repository.updateShipment as jest.Mock).mockResolvedValueOnce({
      shipmentId: 's1',
      orderId: 'o1',
      courierId: 'c1',
    });
    const response = await request(createApiApp({ environment, auth: auth(['edit_orders']), operations: repository }))
      .patch('/api/v1/shipments/s1')
      .set('Authorization', 'Bearer token')
      .send({ courierId: 'c1' });
    expect(response.status).toBe(200);
    expect(repository.updateShipment).toHaveBeenCalledWith(
      expect.objectContaining({ shipmentId: 's1', courierId: 'c1' }),
    );
  });
});
