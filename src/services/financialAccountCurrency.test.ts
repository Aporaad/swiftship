import { describe, expect, it } from 'vitest';
import { convertToTargetCurrency } from './financialAccountCurrency';

describe('convertToTargetCurrency', () => {
  it('يحوّل عبر العملة الأساسية باستخدام أسعارها الموثقة', () => {
    expect(convertToTargetCurrency(100, 'USD', 'SAR', { USD: 250, SAR: 65 })).toBeCloseTo(100 * 250 / 65);
  });

  it('يعيد المبلغ كما هو عند تطابق العملة أو غياب رمز المصدر/الهدف', () => {
    expect(convertToTargetCurrency(42, 'USD', 'USD', { USD: 250 })).toBe(42);
    expect(convertToTargetCurrency(42, '', 'SAR', { SAR: 65 })).toBe(42);
    expect(convertToTargetCurrency(42, 'USD', '', { USD: 250 })).toBe(42);
  });

  it('يحافظ على معدل 1 الاحتياطي للعملات ذات المعدل المفقود أو غير الصالح', () => {
    expect(convertToTargetCurrency(2, 'USD', 'YER', { USD: 250 })).toBe(500);
    expect(convertToTargetCurrency(2, 'USD', 'SAR', { USD: 0, SAR: -5 })).toBe(2);
  });
});
