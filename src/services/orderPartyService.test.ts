import { describe, expect, it } from 'vitest';
import { buildOrderParties, filterOrderParties, findOrderParty, toOrderPartyPayload } from './orderPartyService';

const customers = [{ id: 'cus-1', fullName: 'عميل الاختبار', phone: '700000001', financialAccountId: 'acc_1130-0001' }];
const employees = [{ id: 'emp-1', fullName: 'موظف الاختبار', email: 'employee@example.test', financialAccountId: 'acc_2130-0001' }];
const couriers = [{ id: 'cou-1', fullName: 'مندوب الاختبار', phone: '700000003', financialAccountId: 'acc_2120-0001' }];

describe('order party service', () => {
  it('builds one searchable list across customers, employees and couriers', () => {
    const parties = buildOrderParties(customers, employees, couriers);
    expect(parties.map((party) => party.type)).toEqual(['customer', 'employee', 'courier']);
    expect(filterOrderParties(parties, 'موظف')).toHaveLength(1);
    expect(filterOrderParties(parties, '', true).map((party) => party.type)).toEqual(['employee', 'courier']);
  });

  it('retains customerId while recording the correct staff party metadata and linked account', () => {
    const party = findOrderParty({ customerId: 'cou-1', orderPartyType: 'courier' }, customers, employees, couriers);
    expect(party).toMatchObject({ id: 'cou-1', type: 'courier', financialAccountId: 'acc_2120-0001' });
    expect(toOrderPartyPayload(party!)).toMatchObject({
      customerId: 'cou-1', orderPartyType: 'courier', isStaffOrder: true,
      courierId: 'cou-1', customerAccountId: 'acc_2120-0001', employeeId: '',
    });
  });

  it('resolves an employee order to the employee ledger account without treating it as a customer', () => {
    const party = findOrderParty({ customerId: 'emp-1', orderPartyType: 'employee', isStaffOrder: true }, customers, employees, couriers);
    expect(party).toMatchObject({ id: 'emp-1', type: 'employee', financialAccountId: 'acc_2130-0001' });
    expect(toOrderPartyPayload(party!)).toMatchObject({
      customerId: 'emp-1',
      orderPartyId: 'emp-1',
      orderPartyType: 'employee',
      employeeId: 'emp-1',
      courierId: '',
      customerAccountId: 'acc_2130-0001',
    });
  });
});
