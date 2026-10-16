import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EventDetails } from './OrderHistoryModal';

describe('OrderHistoryModal event details', () => {
  it('renders the change table with clear columns and previous/new values from the flat change rows', () => {
    const html = renderToStaticMarkup(
      <EventDetails
        isAr
        event={{
          id: 'history-1',
          eventType: 'order.status_changed',
          eventCategory: 'order',
          operation: 'update',
          entityType: 'order',
          actorName: 'مستخدم الاختبار',
          changedFields: ['data.orderStatus', 'tracking_number'],
          changes: [
            { fieldName: 'data.orderStatus', oldValue: 'قيد المعالجة', newValue: 'تم الشحن' },
            { fieldName: 'tracking_number', oldValue: 'OLD-123', newValue: 'NEW-456' },
          ],
        }}
      />,
    );

    expect(html).toContain('تفاصيل التغييرات');
    expect(html).toContain('الحقل');
    expect(html).toContain('القيمة السابقة');
    expect(html).toContain('القيمة الجديدة');
    expect(html).toContain('حالة الطلب');
    expect(html).toContain('رقم التتبع');
    expect(html).toContain('قيد المعالجة');
    expect(html).toContain('تم الشحن');
    expect(html).toContain('OLD-123');
    expect(html).toContain('NEW-456');
  });

  it('lists declared changed fields even when their values were never diffed', () => {
    const html = renderToStaticMarkup(
      <EventDetails
        isAr
        event={{
          id: 'history-2',
          eventType: 'order.updated',
          eventCategory: 'order',
          operation: 'update',
          entityType: 'order',
          changedFields: ['weight'],
          changes: [],
        }}
      />,
    );

    expect(html).toContain('تفاصيل التغييرات');
    expect(html).toContain('الوزن');
  });

  it('shows the related activity details read from the flat activityDetails column', () => {
    const html = renderToStaticMarkup(
      <EventDetails
        isAr
        event={{
          id: 'history-3',
          eventType: 'activity.edit_order',
          eventCategory: 'activity',
          operation: 'update',
          entityType: 'order',
          changedFields: [],
          changes: [],
          activityDetails: { userName: 'سارة' },
        }}
      />,
    );

    expect(html).toContain('تفاصيل النشاط المرتبط');
    expect(html).toContain('سارة');
  });
});
