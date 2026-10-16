import { describe, expect, it } from 'vitest';
import { toOrderHistoryEvent, type OrderHistoryEvent } from './orderHistoryService';
import {
  readOrderTrackingRow,
  readTrackingProfileRow,
  trackingMilestonesFromHistoryRows,
  trackingProfileWritePayload,
} from './trackingProfileService';

const historyRow = {
  historyId: 'hist_1',
  eventType: 'order.status_changed',
  eventCategory: 'order',
  operation: 'update',
  entityType: 'order',
  actorName: 'سارة',
  summary: 'تم تغيير حالة الطلب.',
  changedFields: ['status'],
  changes: [
    { fieldName: 'status', oldValue: 'قيد الطلب', newValue: 'تم الشحن' },
    { fieldName: 'locationYemen', oldValue: null, newValue: 'منفذ الوديعة' },
    { fieldName: 'note', oldValue: null, newValue: 'تم تحميل الحاوية' },
  ],
  occurredAt: '2026-08-22T09:00:00.000Z',
};

const olderHistoryRow = {
  historyId: 'hist_0',
  eventType: 'order.created',
  eventCategory: 'order',
  operation: 'insert',
  entityType: 'order',
  summary: 'تم إنشاء الطلب.',
  changedFields: [],
  changes: [{ fieldName: 'status', oldValue: null, newValue: 'قيد الطلب' }],
  occurredAt: '2026-08-20T09:00:00.000Z',
};

const asEvent = (row: Record<string, unknown>): OrderHistoryEvent => toOrderHistoryEvent(row);

describe('trackingProfileService', () => {
  it('يقرأ ملف التتبع العام من الأعمدة المسطّحة بلا حمولة data', () => {
    const profile = readTrackingProfileRow({
      trackingId: 'SHN-1',
      orderNumber: 'ALX-1',
      status: 'تم الشحن',
      locationYemen: 'مستودع صنعاء',
      customerName: 'أحمد',
      customerPhone: '777123456',
      weight: '12.5',
      cbm: 0.4,
      amountPaid: 1000,
      amountRemaining: 500,
      totalCostYER: 1500,
      currency: 'YER',
      products: [{ productName: 'سماعة', quantity: 2 }],
      history: [historyRow],
    }, 'SHN-1');

    expect(profile.trackingNumber).toBe('SHN-1');
    expect(profile.status).toBe('تم الشحن');
    expect(profile.customerName).toBe('أحمد');
    expect(profile.weight).toBe(12.5);
    expect(profile.amountRemaining).toBe(500);
    expect(profile.products).toHaveLength(1);
    // عنصر الخط الزمني مشتق من صفوف السجل المسطّحة لا من مصفوفة داخل الحمولة.
    // The timeline entry is derived from the flat history rows, not an array inside a payload.
    expect(profile.history[0]).toMatchObject({
      status: 'تم الشحن',
      location: 'منفذ الوديعة',
      notes: 'تم تحميل الحاوية',
      createdBy: 'سارة',
      timestamp: new Date('2026-08-22T09:00:00.000Z').getTime(),
    });
  });

  it('يقرأ طلبًا داخليًا من أعمدته ويجمع الوزن والحجم من عناصر الطلب', () => {
    const profile = readOrderTrackingRow({
      orderId: 'ord_1',
      orderNumber: 'ALX-1',
      trackingNumber: 'SHN-9',
      orderStatus: 'تم التسليم',
      customerName: 'خالد',
      recipientAddress: 'صنعاء، شارع خولان',
      currency: 'SAR',
      locationYemen: 'مركز التوزيع',
      items: [
        { productName: 'حقيبة', quantity: 1, totalWeight: '4', totalCbm: '0.2' },
        { productName: 'ساعة', quantity: 2, totalWeight: 3, totalCbm: 0.1 },
      ],
    }, 'SHN-9', [asEvent(historyRow), asEvent(olderHistoryRow)]);

    expect(profile.trackingNumber).toBe('SHN-9');
    expect(profile.status).toBe('تم التسليم');
    expect(profile.customerAddress).toBe('صنعاء، شارع خولان');
    expect(profile.weight).toBe(7);
    expect(profile.cbm).toBeCloseTo(0.3);
    expect(profile.products).toHaveLength(2);
    // الخط الزمني من الأقدم إلى الأحدث حتى وإن جاءت الأحداث معكوسة.
    // The timeline is oldest-first even when the events arrive newest-first.
    expect(profile.history.map((milestone) => milestone.status)).toEqual(['قيد الطلب', 'تم الشحن']);
  });

  it('يرسل مفاتيح مسطّحة فقط عند النشر ولا يبني حمولة data', () => {
    const payload = trackingProfileWritePayload(readTrackingProfileRow({
      trackingId: 'SHN-1',
      status: 'تم الشحن',
      locationYemen: 'مستودع صنعاء',
      products: [{ productName: 'سماعة' }],
      history: [historyRow],
    }, 'SHN-1'));

    expect(Object.keys(payload).sort()).toEqual([
      'amountPaid', 'amountRemaining', 'cbm', 'currency', 'customerAddress', 'customerName', 'customerPhone',
      'isPublished', 'locationYemen', 'orderNumber', 'shippingCompany', 'status', 'totalCostYER', 'weight',
    ]);
    expect(payload).not.toHaveProperty('data');
    expect(payload.locationYemen).toBe('مستودع صنعاء');
  });

  it('يتجاهل صفوف السجل غير المرتبطة عند بناء الخط الزمني', () => {
    expect(trackingMilestonesFromHistoryRows([null, 'text', { historyId: '', eventType: 'order.created' }])).toHaveLength(1);
  });
});
