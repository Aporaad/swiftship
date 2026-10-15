import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ApplicationError, describeError, errorDetailsFromUnknown } from './error.contracts';

describe('عقد وصف أخطاء الـAPI', () => {
  it('يضمّ مشاكل التحقق الحقلي إلى نص الرسالة بدل إخفائها', () => {
    const error = new ApplicationError({
      code: 'INVALID_ORDER_INPUT',
      message: 'بيانات الطلب أو مفتاح منع التكرار غير صالح.',
      details: [
        { field: 'orderNumber', message: 'Required' },
        { field: 'items.0.unitPrice', message: 'Expected number, received null' },
      ],
    });

    expect(describeError(error)).toBe(
      'بيانات الطلب أو مفتاح منع التكرار غير صالح. (orderNumber: Required; items.0.unitPrice: Expected number, received null)',
    );
  });

  it('يبقي الرسالة الأصلية عندما لا توجد تفاصيل، ويستخدم الاحتياطي عند غيابها كلها', () => {
    expect(describeError(new ApplicationError({ code: 'E', message: 'فشل الحفظ' }))).toBe('فشل الحفظ');
    expect(describeError({ unexpected: true }, 'خطأ غير متوقع')).toBe('خطأ غير متوقع');
    expect(describeError('boom')).toBe('boom');
  });

  it('يتجاهل التفاصيل غير الموصوفة ويحدّ العرض بخمسة حقوق', () => {
    const details = Array.from({ length: 9 }, (_, index) => ({ field: `f${index}`, message: `m${index}` }));
    const described = describeError(new ApplicationError({ code: 'E', message: 'bad', details }));
    expect(described.match(/; /g)?.length).toBe(4);
    expect(described).toContain('f4: m4');
    expect(described).not.toContain('f5: m5');

    expect(describeError(new ApplicationError({ code: 'E', message: 'bad', details: [null, 7, { message: 'x' }] as unknown[] }))).toBe('bad (request: x)');
  });

  it('يقرأ تفاصيل الخطأ من غلاف الفشل كما تُرجعه alx_api', () => {
    const envelope = {
      success: false,
      error: { code: 'ORDER_STAGE_UNKNOWN', message: 'مرحلة الطلب غير مسجلة في دليل المراحل.', details: [{ field: 'orderStatusId', message: 'unknown' }] },
    };
    expect(errorDetailsFromUnknown(envelope, 'API_REQUEST_FAILED')).toEqual({
      code: 'ORDER_STAGE_UNKNOWN',
      message: 'مرحلة الطلب غير مسجلة في دليل المراحل.',
      details: [{ field: 'orderStatusId', message: 'unknown' }],
    });
  });
});

describe('عقد ثبات هوية الصلاحيات', () => {
  // hasPermission غير المثبّتة تجعل تأثيرات الجلب تعيد العمل عند كل رسم، وهو ما جمّد الواجهة.
  // An unstable hasPermission re-fires every data-fetching effect on each render; that froze the UI.
  it('يبني hasPermission ب useCallback حتى لا تعيد التأثيرات إطلاق جلب الإشعارات', () => {
    const source = readFileSync(resolve(process.cwd(), 'src', 'hooks', 'useRole.ts'), 'utf8');
    expect(source).toMatch(/const hasPermission = useCallback\(/);
    expect(source).toMatch(/\}, \[permissions\]\);/);
  });
});
