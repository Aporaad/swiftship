import { describe, expect, it } from 'vitest';
import { buildDefaultAutomaticVoucherRules } from './financialAccountVoucherRules';

describe('buildDefaultAutomaticVoucherRules', () => {
  it('يحافظ على قواعد القيود المعروفة والحالات الافتراضية', () => {
    const rules = buildDefaultAutomaticVoucherRules();
    const byId = new Map(rules.map((rule) => [rule.id, rule]));

    expect(byId.has('order_charge')).toBe(true);
    expect(byId.has('order_down_payment')).toBe(true);
    expect(byId.has('courier_commission')).toBe(true);
    expect(byId.get('order_charge')?.isActive).toBe(false);
    expect(byId.get('order_down_payment')?.isActive).toBe(true);
    expect(byId.get('order_charge')?.debitAccount.type).toBe('dynamic');
  });

  it('يطبّع مراجع الحسابات النظامية إلى defaultKey دون كود hard-coded', () => {
    const rules = buildDefaultAutomaticVoucherRules();
    const cashRule = rules.find((rule) => rule.id === 'order_down_payment');

    expect(cashRule?.debitAccount).toMatchObject({
      id: 'sys_cash_account',
      defaultKey: 'sys_cash_account',
      code: '',
      type: 'system',
    });
    expect(cashRule?.creditAccount).toMatchObject({
      id: 'customer_linked',
      code: '1130',
      type: 'dynamic',
    });
  });
});
