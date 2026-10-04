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
});
