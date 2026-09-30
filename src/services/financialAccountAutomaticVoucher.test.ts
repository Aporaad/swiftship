import { describe, expect, it } from 'vitest';
import { resolveAutomaticVoucherAccount } from './financialAccountAutomaticVoucher';

describe('resolveAutomaticVoucherAccount', () => {
  it('يفضّل الحساب المرتبط بالعميل ويعيد رمز الحساب المرتبط', () => {
    expect(resolveAutomaticVoucherAccount(
      { id: 'customer_linked', code: '1130' },
      {},
      {},
      { orderParty: { financialAccountId: 'customer-1', financialAccountCode: '1130-0007' } },
    )).toEqual({ id: 'customer-1', code: '1130-0007' });
  });

  it('يستخدم حساب النقدية المختار في الطلب كبديل لحساب الدفعة الديناميكي', () => {
    expect(resolveAutomaticVoucherAccount(
      { id: 'selected_payment_account', code: '1110' },
      {},
      { cashAccountId: 'cash-1', cashAccountCode: '1110-0001' },
      {},
    )).toEqual({ id: 'cash-1', code: '1110-0001' });
  });

  it('يوجه كلفة التوريد إلى حساب المندوب عند ضبط المصدر عليه', () => {
    expect(resolveAutomaticVoucherAccount(
      { id: 'sourcing_cost', code: '2120' },
      {},
      { sourcing_cost: 'courier' },
      { courier: { accountId: 'courier-1', accountCode: '2120-0002' } },
    )).toEqual({ id: 'courier-1', code: '2120-0002' });
  });

  it('يستخدم حساب كلفة الطلب الافتراضي عند غياب حساب مصدر مرتبط', () => {
    expect(resolveAutomaticVoucherAccount(
      { id: 'product_cost_source', code: '5100' },
      { sys_orders_cost: 'sys-orders-cost' },
      {},
      {},
    )).toEqual({ id: 'sys-orders-cost', code: '5100' });
  });

  it('يرفض إعداد الهدف الناقص أو الحساب المرتبط المفقود', () => {
    expect(() => resolveAutomaticVoucherAccount({}, {}, {}, {})).toThrow(
      'Automatic voucher account configuration is incomplete.',
    );
    expect(() => resolveAutomaticVoucherAccount(
      { id: 'customer_linked' }, {}, {}, {},
    )).toThrow('Unable to resolve linked account');
  });
});
