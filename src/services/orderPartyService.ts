export type OrderPartyType = 'customer' | 'employee' | 'courier';

export type OrderParty = {
  id: string;
  type: OrderPartyType;
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  /** Canonical financial relation. */
  accountId?: string;
  financialAccountCode?: string;
  raw: Record<string, unknown>;
};

const normalized = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPartyText(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function toParty(value: unknown, type: OrderPartyType): OrderParty | null {
  if (!isRecord(value)) return null;
  const id = readPartyText(value, 'id');
  if (!id) return null;
  return {
    id,
    type,
    name: readPartyText(value, 'fullName', 'name', 'username', 'email') || id,
    phone: readPartyText(value, 'phone', 'mobile'),
    address: readPartyText(value, 'address', 'location'),
    email: readPartyText(value, 'email'),
    accountId: readPartyText(value, 'accountId', 'account_id', 'financialAccountId'),
    financialAccountCode: readPartyText(value, 'financialAccountCode', 'accountCode'),
    raw: value,
  };
}

export function buildOrderParties(customers: readonly unknown[] = [], employees: readonly unknown[] = [], couriers: readonly unknown[] = []): OrderParty[] {
  return [
    ...customers.map((entry) => toParty(entry, 'customer')),
    ...employees.map((entry) => toParty(entry, 'employee')),
    ...couriers.map((entry) => toParty(entry, 'courier')),
  ].filter((party): party is OrderParty => party !== null);
}

export function filterOrderParties(parties: OrderParty[], queryText = '', staffOnly = false): OrderParty[] {
  const query = normalized(queryText);
  return parties.filter((party) => {
    // staffOnly=true: عرض الموظفين والمناديب فقط | staffOnly=false: عرض العملاء فقط
    // staffOnly=true: show employees & couriers only | staffOnly=false: show customers only
    if (staffOnly && party.type === 'customer') return false;
    if (!staffOnly && party.type !== 'customer') return false;
    if (!query) return true;
    return [party.name, party.phone, party.email, party.id, party.financialAccountCode]
      .some((value) => normalized(value).includes(query));
  });
}

export function findOrderParty(order: unknown, customers: readonly unknown[] = [], employees: readonly unknown[] = [], couriers: readonly unknown[] = []): OrderParty | null {
  if (!isRecord(order)) return null;
  const requestedType = order.customerType ?? order.orderPartyType;
  const partyType: OrderPartyType = requestedType === 'employee'
    ? 'employee'
    : requestedType === 'courier'
      ? 'courier'
      : order.isStaffOrder === true ? 'employee' : 'customer';
  const partyId = partyType === 'employee'
    ? (order.employeeId || order.employee_id || order.orderPartyId)
    : partyType === 'courier'
      ? (order.courierId || order.courier_id || order.orderPartyId)
      : (order.customerId || order.customer_id || order.orderPartyId);
  if (!partyId) return null;
  const collection = partyType === 'employee' ? employees : partyType === 'courier' ? couriers : customers;
  const match = collection.find((entry) => isRecord(entry) && String(entry.id) === String(partyId));
  return match ? toParty(match, partyType) : null;
}

export function toOrderPartyPayload(party: OrderParty) {
  return {
    // عميل: يُعيَّن customer_id | موظف/مندوب: customer_id فارغ
    // customer: set customer_id | employee/courier: customer_id empty
    customerId: party.type === 'customer' ? party.id : '',
    // اسم الطرف للعرض في الواجهة (لا يُخزَّن في DB)
    // party display name for UI (not stored in DB)
    customerName: party.name || '',
    customerPhone: party.phone || '',
    customerAddress: party.address || '',
    orderPartyId: party.id,
    orderPartyType: party.type,
    isStaffOrder: party.type !== 'customer',
    orderPartyAccountId: party.accountId || '',
    employeeId: party.type === 'employee' ? party.id : '',
    courierId: party.type === 'courier' ? party.id : '',
  };
}

export function getOrderPartyLabel(type: OrderPartyType, isAr = true): string {
  if (type === 'employee') return isAr ? 'موظف' : 'Employee';
  if (type === 'courier') return isAr ? 'مندوب' : 'Courier';
  return isAr ? 'عميل' : 'Customer';
}
