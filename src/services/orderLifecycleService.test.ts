import { describe, expect, it } from 'vitest';
import { getProcessedStatusIds, planOrderStatusTransition } from './orderLifecycleService';

const statuses = [
  { id: 1, nameAr: 'معلق', nameEn: 'Pending', isFirst: true, isLast: false, code: 'pending' },
  { id: 2, nameAr: 'تم التسجيل', nameEn: 'Registered', isFirst: false, isLast: false, code: 'registered' },
  { id: 3, nameAr: 'وصل المستودع', nameEn: 'Warehouse', isFirst: false, isLast: false, code: 'warehouse' },
  { id: 4, nameAr: 'تم التسليم', nameEn: 'Delivered', isFirst: false, isLast: true, code: 'delivered' },
  { id: 9, nameAr: 'ملغي', nameEn: 'Cancelled', isFirst: false, isLast: false, code: 'cancelled' },
];

describe('orderLifecycleService', () => {
  it('يخطط المراحل المتجاوزة بالترتيب لتشغيل قيودها قبل المرحلة الهدف', () => {
    const plan = planOrderStatusTransition(statuses, 1, 4, new Set([1]));
    expect(plan.allowed).toBe(true);
    expect(plan.stagesToProcess.map(stage => stage.id)).toEqual([2, 3, 4]);
    expect(plan.skippedStages.map(stage => stage.id)).toEqual([2, 3]);
  });

  it('يمنع تحديث الحالة نفسها أو الرجوع إلى مرحلة سابقة أو إعادة مرحلة مسجلة', () => {
    expect(planOrderStatusTransition(statuses, 2, 2, new Set([1, 2])).reason).toBe('same_status');
    expect(planOrderStatusTransition(statuses, 3, 2, new Set([1, 2, 3])).reason).toBe('backward_transition');
    expect(planOrderStatusTransition(statuses, 1, 3, new Set([1, 3])).reason).toBe('status_previously_processed');
  });

  it('يتعرف على المراحل المنفذة من أحداث الإنشاء وتغيير الحالة المسجلة', () => {
    const processed = getProcessedStatusIds([
      { id: 'created', eventType: 'order.created', afterData: { order_status_id: '1' }, eventCategory: 'order', operation: 'insert', entityType: 'order' },
      { id: 'changed', eventType: 'order.status_changed', afterData: { orderStatusId: 3 }, eventCategory: 'order', operation: 'update', entityType: 'order' },
    ]);
    expect([...processed]).toEqual([1, 3]);
  });
});
