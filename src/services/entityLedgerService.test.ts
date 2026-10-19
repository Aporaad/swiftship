import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readAllFinanceRows: vi.fn(),
  readFinanceRecord: vi.fn(),
  getAllCurrencies: vi.fn(),
  getAccountByEntityId: vi.fn(),
}));

vi.mock('./financeApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./financeApi')>();
  return { ...actual, readAllFinanceRows: mocks.readAllFinanceRows, readFinanceRecord: mocks.readFinanceRecord };
});

vi.mock('./currencyService', () => ({
  currencyService: { getAllCurrencies: mocks.getAllCurrencies },
}));

vi.mock('./financialAccountService', () => ({
  financialAccountService: { getAccountByEntityId: mocks.getAccountByEntityId },
}));

import { entityLedgerService, type LedgerLine } from './entityLedgerService';

const MOVEMENTS_PATH = '/api/v1/finance/account-movements';
const ORDERS_PATH = '/api/v1/orders';

/** حركة بالقوائم التي يعيدها alx_api بعد ترحيل الأسماء — movement row as aliased by the API. */
const movement = (overrides: Record<string, unknown> = {}) => {
  const amount = (overrides.amount as number) ?? 100;
  return {
    transactionId: 'trx_1',
    entryId: 'je_1',
    entryNumber: 'JE-0001',
    module: 'General',
    moduleCode: 'ACCOUNTING',
    entryTypeCode: 'ADJUSTMENT',
    transType: 'Debit',
    amount,
    // القيمة الأصلية تساوي المسندة افتراضيًا حتى لا تُقرأ حركة بعملة غير عملتها في الاختبارات.
    amountOriginal: (overrides.amountOriginal as number) ?? amount,
    currencyOriginalNo: 1,
    entity_id: 'cust_1',
    orderId: '',
    description: '',
    createdAt: '2026-01-05T10:00:00.000Z',
    ...overrides,
  };
};

const order = (overrides: Record<string, unknown> = {}) => ({
  orderId: 'ord_1',
  orderNumber: 'ALX-1001',
  amountPaid: '300',
  amountRemaining: '700',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  ...overrides,
});

const routeRows: Record<string, unknown[]> = {};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAllCurrencies.mockResolvedValue([
    { cur_id: 1, code: 'YER' },
    { cur_id: 2, code: 'SAR' },
  ]);
  mocks.readFinanceRecord.mockResolvedValue({ courierId: 'cou_1', customerId: 'cust_1', fullName: 'عميل اختبار', phone: null });
  mocks.getAccountByEntityId.mockResolvedValue({ id: 'acc_1101', balance: 2500 });
  Object.keys(routeRows).forEach((key) => delete routeRows[key]);
  mocks.readAllFinanceRows.mockImplementation((path: string) => Promise.resolve(routeRows[path] ?? []));
});

const fillRows = (movements: unknown[], orders: unknown[] = []) => {
  routeRows[MOVEMENTS_PATH] = movements;
  routeRows[ORDERS_PATH] = orders;
};

describe('entityLedgerService — كشف الحساب عبر alx_api فقط', () => {
  it('يرفض معرّفًا فارغًا بدل إرسال طلب بلا معنى', async () => {
    await expect(entityLedgerService.loadLedger('customer', '  ')).rejects.toThrow(/Entity id is required/);
    expect(mocks.readAllFinanceRows).not.toHaveBeenCalled();
  });

  it('يبني ملف الكيان ورصيده من مساري الحساب والكيان', async () => {
    fillRows([]);
    const ledger = await entityLedgerService.loadLedger('courier', 'cou_1');

    expect(mocks.readFinanceRecord).toHaveBeenCalledWith('/api/v1/operations/couriers/cou_1');
    expect(mocks.getAccountByEntityId).toHaveBeenCalledWith('cou_1', 'courier');
    expect(ledger.party).toEqual({
      id: 'cou_1',
      name: 'عميل اختبار',
      phone: '',
      accountId: 'acc_1101',
      accountCode: '',
      currency: 'YER',
      balance: 2500,
    });
  });

  it('يقرأ حركات الكيان فقط عبر معامل entityId ويحل كود العملة رقميًا', async () => {
    fillRows([movement({ currencyOriginalNo: 2, amountOriginal: 40 })]);
    const ledger = await entityLedgerService.loadLedger('customer', 'cust_1');

    expect(mocks.readAllFinanceRows).toHaveBeenCalledWith(MOVEMENTS_PATH, { entityId: 'cust_1' });
    expect(ledger.lines[0].currencyOriginal).toBe('SAR');
    expect(ledger.lines[0].amountOriginal).toBe(40);
  });

  it('يمنع تكرار قيمة الطلب: سطر الدين من الطلب وحركة ORDERS مستبعدة', async () => {
    fillRows([movement({ transactionId: 'trx_order', moduleCode: 'ORDERS', entryTypeCode: 'ORDER_VALUE', amount: 1000 })], [order()]);

    const ledger = await entityLedgerService.loadLedger('customer', 'cust_1');
    const charges = ledger.lines.filter((line: LedgerLine) => line.category === 'order');

    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({ kind: 'order_charge', type: 'Debit', amount: 1000, ref: 'ALX-1001' });
  });

  it('يحسب الدفعة غير المقيدة كفرق بين المدفوع والمقيد بحركة ORDER_PAYMENT للطلب نفسه', async () => {
    fillRows(
      [
        movement({ transactionId: 'trx_pay', moduleCode: 'ORDERS', entryTypeCode: 'ORDER_PAYMENT', transType: 'Credit', amount: 200, orderId: 'ord_1' }),
        movement({ transactionId: 'trx_receipt', moduleCode: 'RECEIPTS', entryTypeCode: 'RECEIPT_VOUCHER', transType: 'Credit', amount: 100, orderId: 'ord_1' }),
      ],
      [order({ amountPaid: '600' })],
    );

    const ledger = await entityLedgerService.loadLedger('customer', 'cust_1');
    const unrecorded = ledger.lines.find((line: LedgerLine) => line.kind === 'unrecorded_payment');

    // المدفوع 600 ناقص المقيد 300 (دفعة طلب + سند قبض) = 300 غير مقيدة.
    expect(unrecorded).toMatchObject({ type: 'Credit', amount: 300, category: 'payment' });
    expect(ledger.lines.filter((line: LedgerLine) => line.category === 'payment')).toHaveLength(3);
  });

  it('يسقط سطر الدفعة غير المقيدة عندما تكون كل المدفوعات مقيدة', async () => {
    fillRows(
      [movement({ moduleCode: 'ORDERS', entryTypeCode: 'ORDER_PAYMENT', transType: 'Credit', amount: 300, orderId: 'ord_1' })],
      [order()],
    );

    const ledger = await entityLedgerService.loadLedger('customer', 'cust_1');
    expect(ledger.lines.some((line: LedgerLine) => line.kind === 'unrecorded_payment')).toBe(false);
  });

  it('يصنّف حركات المندوب تشغيليًا ويفرض اتجاه السطر عند الحاجة', async () => {
    fillRows([
      movement({ transactionId: 't1', moduleCode: 'CUSTODY', entryTypeCode: 'CUSTODY_ADVANCE', description: 'تسوية عهدة المندوب', transType: 'Debit', amount: 500 }),
      movement({ transactionId: 't2', moduleCode: 'CUSTODY', entryTypeCode: 'CUSTODY_ADVANCE', description: 'تسليم عهدة', transType: 'Credit', amount: 800 }),
      movement({ transactionId: 't3', moduleCode: 'ORDERS', entryTypeCode: 'ORDER_VALUE', transType: 'Debit', amount: 1200 }),
      movement({ transactionId: 't4', moduleCode: 'ORDERS', entryTypeCode: 'ORDER_VALUE', transType: 'Credit', amount: 90 }),
      movement({ transactionId: 't5', moduleCode: 'EXPENSES', entryTypeCode: 'PAYMENT_VOUCHER', transType: 'Debit', amount: 70 }),
      movement({ transactionId: 't6', moduleCode: 'SALARIES', entryTypeCode: 'SALARY_PAYMENT', transType: 'Debit', amount: 1500 }),
      movement({ transactionId: 't7', moduleCode: 'ACCOUNTING', entryTypeCode: 'ADJUSTMENT', transType: 'Credit', amount: 25 }),
    ]);

    const ledger = await entityLedgerService.loadLedger('courier', 'cou_1');
    const byId = new Map(ledger.lines.map((line: LedgerLine) => [line.id, line]));

    expect(byId.get('t1')).toMatchObject({ kind: 'custody_settlement', type: 'Credit' });
    expect(byId.get('t2')).toMatchObject({ kind: 'custody_handover', type: 'Debit' });
    expect(byId.get('t3')).toMatchObject({ kind: 'order_collected', category: 'order', type: 'Debit' });
    expect(byId.get('t4')).toMatchObject({ kind: 'order_commission', type: 'Credit' });
    expect(byId.get('t5')).toMatchObject({ kind: 'expense_disbursed', category: 'expense', type: 'Credit' });
    expect(byId.get('t6')).toMatchObject({ kind: 'wage_paid', category: 'wage', type: 'Credit' });
    expect(byId.get('t7')).toMatchObject({ kind: 'generic', category: 'transaction', type: 'Credit' });
  });

  it('يرتب الأحدث أولًا ويحسب الرصيد التراكمي (مدين +/دائن −) والإجماليات', async () => {
    fillRows([
      movement({ transactionId: 'old', createdAt: '2026-01-01T00:00:00.000Z', amount: 400, transType: 'Debit' }),
      movement({ transactionId: 'new', createdAt: '2026-02-01T00:00:00.000Z', amount: 150, transType: 'Credit' }),
    ]);

    const ledger = await entityLedgerService.loadLedger('courier', 'cou_1');

    expect(ledger.lines.map((line: LedgerLine) => line.id)).toEqual(['new', 'old']);
    expect(ledger.lines[1].runningBalance).toBe(400);
    expect(ledger.lines[0].runningBalance).toBe(250);
    expect(ledger.totals).toEqual({ debits: 400, credits: 150 });
  });

  it('لا يقرأ الطلبات لكشف المندوب لأن حركاته تكفي', async () => {
    fillRows([movement()], [order()]);
    await entityLedgerService.loadLedger('courier', 'cou_1');

    expect(mocks.readAllFinanceRows).not.toHaveBeenCalledWith(ORDERS_PATH, expect.anything());
  });
});

describe('entityLedgerService — كشف المصدر وشركة الشحن', () => {
  const ACCOUNT_MOVEMENTS_PATH = '/api/v1/finance/accounts/acc_2141/movements';

  it('يقرأ حركة المصدر من حسابه المالي لا من معامل entityId', async () => {
    mocks.getAccountByEntityId.mockResolvedValue({ id: 'acc_2141', accountCode: '2141-0009', currency: 'YER', balance: -500 });
    routeRows[ACCOUNT_MOVEMENTS_PATH] = [movement({ transactionId: 'src_1', transType: 'Credit', amount: 500 })];

    const ledger = await entityLedgerService.loadLedger('source', 'src_9', 'AMAZON');

    // لا يوجد مسار سجل مفرد للمصادر في alx_api: استدعاؤه يعيد ROUTE_NOT_FOUND ويُفشل الكشف.
    expect(mocks.readFinanceRecord).not.toHaveBeenCalled();
    expect(mocks.getAccountByEntityId).toHaveBeenCalledWith('src_9', 'source');
    expect(mocks.readAllFinanceRows).toHaveBeenCalledWith(ACCOUNT_MOVEMENTS_PATH);
    expect(mocks.readAllFinanceRows).not.toHaveBeenCalledWith(MOVEMENTS_PATH, expect.anything());
    expect(ledger.party.name).toBe('AMAZON');
    expect(ledger.party.accountCode).toBe('2141-0009');
    expect(ledger.lines[0]).toMatchObject({ kind: 'generic', type: 'Credit', amount: 500 });
    expect(ledger.totals).toEqual({ debits: 0, credits: 500 });
  });

  it('يعيد كشفًا فارغًا صريحًا حين لا يملك العنصر حسابًا ماليًا', async () => {
    mocks.getAccountByEntityId.mockResolvedValue(null);

    const ledger = await entityLedgerService.loadLedger('shipping_company', 'shp_1', 'Aramex');

    expect(mocks.readFinanceRecord).not.toHaveBeenCalled();
    expect(ledger.party.name).toBe('Aramex');
    expect(ledger.lines).toEqual([]);
    expect(mocks.readAllFinanceRows).not.toHaveBeenCalled();
  });

  it('يفلتر سجل الحركة خادميًا بـ sourceId للمصدر وshippingCompanyId لشركة الشحن', async () => {
    routeRows[ORDERS_PATH] = [
      order({ orderId: 'o1', amountPaid: '200', amountRemaining: '300' }),
      order({ orderId: 'o2', amountPaid: '50', amountRemaining: '0', createdAt: '2026-02-02T00:00:00.000Z' }),
    ];

    const sourceLog = await entityLedgerService.loadOrderLog('source', 'src_9');
    expect(mocks.readAllFinanceRows).toHaveBeenCalledWith(ORDERS_PATH, { sourceId: 'src_9' });
    expect(sourceLog.lines.map((line) => line.id)).toEqual(['o2', 'o1']);
    expect(sourceLog.totals).toEqual({ orders: 2, total: 550, paid: 250, remaining: 300 });

    await entityLedgerService.loadOrderLog('shipping_company', 'shp_1');
    expect(mocks.readAllFinanceRows).toHaveBeenCalledWith(ORDERS_PATH, { shippingCompanyId: 'shp_1' });
  });

  it('يرفض معرّفًا فارغًا في سجل الحركة', async () => {
    await expect(entityLedgerService.loadOrderLog('source', ' ')).rejects.toThrow(/Entity id is required/);
  });
});
