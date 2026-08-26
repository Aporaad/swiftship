import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EventDetails } from './OrderHistoryModal';

describe('OrderHistoryModal event details', () => {
  it('renders the change table with clear columns and previous/new values from metadata.changes', () => {
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
          metadata: {
            changes: {
              'data.orderStatus': { before: 'قيد المعالجة', after: 'تم الشحن' },
              tracking_number: { before: 'OLD-123', after: 'NEW-456' },
            },
          },
        }}
      />,
    );

    expect(html).toContain('تفاصيل التغييرات');
    expect(html).toContain('الحقل');
    expect(html).toContain('القيمة السابقة');
    expect(html).toContain('القيمة الجديدة');
    expect(html).toContain('حالة الطلب');
    expect(html).toContain('قيد المعالجة');
    expect(html).toContain('تم الشحن');
    expect(html).toContain('OLD-123');
    expect(html).toContain('NEW-456');
  });
});
