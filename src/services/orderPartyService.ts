export type OrderPartyType = 'customer' | 'employee' | 'courier';

export type OrderParty = {
  id: string;
  type: OrderPartyType;
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  financialAccountId?: string;
  financialAccountCode?: string;
  raw: any;
};

const normalized = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase();

function toParty(raw: any, type: OrderPartyType): OrderParty {
  return {
    id: String(raw.id),
    type,
    name: raw.fullName || raw.name || raw.username || raw.email || String(raw.id),
    phone: raw.phone || raw.mobile || '',
    address: raw.address || raw.location || '',
    email: raw.email || '',
    financialAccountId: raw.financialAccountId || raw.accountId || raw.account_id || '',
    financialAccountCode: raw.financialAccountCode || raw.accountCode || '',
    raw,
  };
}

export function buildOrderParties(customers: any[] = [], employees: any[] = [], couriers: any[] = []): OrderParty[] {
  return [
    ...customers.map((entry) => toParty(entry, 'customer')),
    ...employees.map((entry) => toParty(entry, 'employee')),
    ...couriers.map((entry) => toParty(entry, 'courier')),
  ];
}

export function filterOrderParties(parties: OrderParty[], queryText = '', staffOnly = false): OrderParty[] {
  const query = normalized(queryText);
  return parties.filter((party) => {
    if (staffOnly ? party.type === 'customer' : party.type !== 'customer') return false;
    if (!query) return true;
    return [party.name, party.phone, party.email, party.id, party.financialAccountCode]
      .some((value) => normalized(value).includes(query));
  });
}

export function findOrderParty(order: any, customers: any[] = [], employees: any[] = [], couriers: any[] = []): OrderParty | null {
  const partyType = (order?.orderPartyType || order?.customerType || (order?.isStaffOrder ? 'employee' : 'customer')) as OrderPartyType;
  const partyId = order?.customerId || order?.customer_id || order?.orderPartyId;
  if (!partyId) return null;
  const collection = partyType === 'employee' ? employees : partyType === 'courier' ? couriers : customers;
  const match = collection.find((entry) => String(entry.id) === String(partyId));
  return match ? toParty(match, partyType) : null;
}

export function toOrderPartyPayload(party: OrderParty) {
  return {
    customerId: party.id,
    customerName: party.name,
    customerPhone: party.phone || '',
    customerAddress: party.address || '',
    orderPartyId: party.id,
    orderPartyType: party.type,
    isStaffOrder: party.type !== 'customer',
    customerAccountId: party.financialAccountId || '',
    customerAccountCode: party.financialAccountCode || '',
    employeeId: party.type === 'employee' ? party.id : '',
    courierId: party.type === 'courier' ? party.id : '',
  };
}

export function getOrderPartyLabel(type: OrderPartyType, isAr = true): string {
  if (type === 'employee') return isAr ? 'موظف' : 'Employee';
  if (type === 'courier') return isAr ? 'مندوب' : 'Courier';
  return isAr ? 'عميل' : 'Customer';
}
