/**
 * entityLedgerService.ts
 * خدمة كشف حساب الكيان (عميل أو مندوب) — API-only عبر alx_api: منطق تجميع السطور والرصيد التراكمي هنا وليس في الواجهة.
 * Entity ledger service (customer / courier) — API-only through alx_api. Ledger line building and the running
 * balance live here so the modal stays presentation only.
 */
import { readAllFinanceRows, readFinanceRecord } from './financeApi';
import { currencyService } from './currencyService';
import { financialAccountService } from './financialAccountService';

export type LedgerEntityType = 'customer' | 'courier';

/** تصنيف تشغيلي للحركة مشتق من كود وحدة القيد ونوعه — وليس من فئة القيد المحاسبية (General/Compound). */
export type LedgerCategory = 'order' | 'payment' | 'custody' | 'expense' | 'wage' | 'transaction';

/** نوع السطر الدلالي: الواجهة تترجمه إلى عربي/إنجليزي، والخدمة تحسم المبلغ والاتجاه. */
export type LedgerLineKind =
  | 'order_charge'
  | 'unrecorded_payment'
  | 'custody_handover'
  | 'custody_settlement'
  | 'order_collected'
  | 'order_commission'
  | 'expense_disbursed'
  | 'wage_paid'
  | 'generic';

export interface LedgerParty {
  id: string;
  name: string;
  phone: string;
  /** رصيد الحساب المالي المرتبط بالكيان من `accounts`؛ صفر إن لم يُربط حساب بعد. */
  balance: number;
}

export interface LedgerLine {
  id: string;
  kind: LedgerLineKind;
  category: LedgerCategory;
  date: number;
  type: 'Debit' | 'Credit';
  amount: number;
  amountOriginal: number;
  currencyOriginal: string;
  ref: string;
  note: string;
  runningBalance: number;
}

export interface EntityLedger {
  party: LedgerParty;
  lines: LedgerLine[];
  totals: { debits: number; credits: number };
}

const MOVEMENTS_PATH = '/api/v1/finance/account-movements';
const ORDERS_PATH = '/api/v1/orders';
const PROFILE_PATH: Record<LedgerEntityType, string> = {
  customer: '/api/v1/customers',
  courier: '/api/v1/operations/couriers',
};

const number = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const text = (value: unknown): string => String(value ?? '').trim();

const timestamp = (value: unknown): number => {
  if (value == null || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * وحدة القيد (entry_module.code) ونوعه (entry_type.code) هما المرجع الصحيح للتصنيف التشغيلي؛
 * `module` القادم من alx_api هو فئة القيد المحاسبية (General/Compound/Temp/Reversing) ولا يصلح للتصنيف.
 * The entry module/type codes carry the operational meaning; the `module` alias is the accounting category.
 */
function categoryOf(row: any): LedgerCategory {
  const moduleCode = text(row?.moduleCode).toUpperCase();
  const typeCode = text(row?.entryTypeCode).toUpperCase();
  if (moduleCode === 'CUSTODY') return 'custody';
  if (moduleCode === 'SALARIES' || typeCode === 'SALARY_PAYMENT') return 'wage';
  if (moduleCode === 'EXPENSES' || typeCode === 'PAYMENT_VOUCHER') return 'expense';
  if (moduleCode === 'ORDERS') return typeCode === 'ORDER_PAYMENT' ? 'payment' : 'order';
  if (moduleCode === 'RECEIPTS' || typeCode === 'RECEIPT_VOUCHER') return 'payment';
  return 'transaction';
}

/** خرائط أكواد العملات تُبنى مرة واحدة لكل كشف: `currency_original_no` رقمي ولا يملك الواجهة تحويله محليًا. */
async function buildCurrencyCodes(): Promise<Map<string, string>> {
  const currencies = await currencyService.getAllCurrencies(false);
  return new Map(currencies.map((currency) => [String(currency.cur_id), String(currency.code || 'YER')]));
}

async function loadParty(entityType: LedgerEntityType, entityId: string): Promise<LedgerParty> {
  const profile = await readFinanceRecord(`${PROFILE_PATH[entityType]}/${encodeURIComponent(entityId)}`);
  const account = await financialAccountService.getAccountByEntityId(entityId, entityType);
  return {
    id: entityId,
    name: text(profile?.fullName || profile?.nameAr || profile?.nameEn) || entityId,
    // الهاتف غير مكشوف في حدود قراءة العملاء المتعمَّدة، فيبقى فارغًا بدل اختلاق قيمة.
    // Phone is intentionally outside the customers read boundary, so it stays empty rather than invented.
    phone: text(profile?.phone),
    balance: Number(account?.balance ?? 0),
  };
}

async function loadMovements(entityId: string, currencyCodes: Map<string, string>): Promise<any[]> {
  const rows = await readAllFinanceRows(MOVEMENTS_PATH, { entityId });
  return rows.map((row) => ({
    id: text(row.transactionId) || text(row.id),
    entryId: text(row.entryId),
    ref: text(row.entryNumber),
    date: timestamp(row.createdAt),
    type: text(row.transType) === 'Credit' ? 'Credit' : 'Debit',
    amount: number(row.amount),
    amountOriginal: number(row.amountOriginal ?? row.amount),
    currencyOriginal: currencyCodes.get(text(row.currencyOriginalNo)) || 'YER',
    category: categoryOf(row),
    description: text(row.description),
    orderId: text(row.orderId),
  }));
}

async function loadCustomerOrders(customerId: string): Promise<any[]> {
  const rows = await readAllFinanceRows(ORDERS_PATH, { customerId });
  return rows.map((row) => ({
    id: text(row.orderId),
    orderNumber: text(row.orderNumber),
    total: number(row.amountPaid) + number(row.amountRemaining),
    paid: number(row.amountPaid),
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt || row.createdAt),
  }));
}

function movementLine(movement: any, kind: LedgerLineKind, type: string, category: LedgerCategory): LedgerLine {
  return {
    id: movement.id,
    kind,
    category,
    date: movement.date,
    type: type === 'Credit' ? 'Credit' : 'Debit',
    amount: movement.amount,
    amountOriginal: movement.amountOriginal,
    currencyOriginal: movement.currencyOriginal,
    ref: movement.ref,
    note: movement.description,
    runningBalance: 0,
  };
}

function isSettlementDescription(description: string): boolean {
  return description.includes('تسوية') || description.includes('سداد') || description.toLowerCase().includes('settle');
}

/** سطور كشف العميل: رسوم الطلبات من الطلبات نفسها، والمدفوعات غير المقيدة كفرق، ثم بقية القيود المرحّلة. */
function buildCustomerLines(orders: any[], movements: any[]): LedgerLine[] {
  const lines: LedgerLine[] = [];

  for (const order of orders) {
    if (order.total > 0) {
      lines.push({
        id: `order-charge-${order.id}`,
        kind: 'order_charge',
        category: 'order',
        date: order.createdAt,
        type: 'Debit',
        amount: order.total,
        amountOriginal: order.total,
        currencyOriginal: 'YER',
        ref: order.orderNumber || order.id,
        note: '',
        runningBalance: 0,
      });
    }

    const recorded = movements
      .filter((movement) => movement.category === 'payment' && movement.orderId === order.id)
      .reduce((sum, movement) => sum + (movement.amountOriginal || movement.amount), 0);
    const unrecorded = order.paid - recorded;
    if (unrecorded > 0.01) {
      lines.push({
        id: `order-pay-${order.id}`,
        kind: 'unrecorded_payment',
        category: 'payment',
        date: order.updatedAt + 1,
        type: 'Credit',
        amount: unrecorded,
        amountOriginal: unrecorded,
        currencyOriginal: 'YER',
        ref: order.orderNumber || order.id,
        note: '',
        runningBalance: 0,
      });
    }
  }

  // سطر قيمة الطلب يُبنى من الطلب نفسه، لذلك تُستبعد حركات category 'order' حتى لا يتكرر المبلغ.
  // The order-charge debit already comes from the order row, so order-category movements are skipped.
  for (const movement of movements) {
    if (movement.category === 'order') continue;
    lines.push(movementLine(movement, 'generic', movement.type, movement.category));
  }

  return lines;
}

/** سطور كشف المندوب: كل حركة تُصنَّف تشغيليًا ويُفرض اتجاهها عند الحاجة (العُهدة والمصروفات والأجور). */
function buildCourierLines(movements: any[]): LedgerLine[] {
  return movements.map((movement) => {
    if (movement.category === 'custody') {
      return isSettlementDescription(movement.description)
        ? movementLine(movement, 'custody_settlement', 'Credit', 'custody')
        : movementLine(movement, 'custody_handover', 'Debit', 'custody');
    }
    if (movement.category === 'order') {
      return movement.type === 'Debit'
        ? movementLine(movement, 'order_collected', 'Debit', 'order')
        : movementLine(movement, 'order_commission', 'Credit', 'order');
    }
    if (movement.category === 'expense') return movementLine(movement, 'expense_disbursed', 'Credit', 'expense');
    if (movement.category === 'wage') return movementLine(movement, 'wage_paid', 'Credit', 'wage');
    return movementLine(movement, 'generic', movement.type, movement.category);
  });
}

/** يرتب السطور زمنيًا ثم يضيف الرصيد التراكمي (المدين +/الدائن −) ويعيدها الأحدث أولًا. */
function withRunningBalance(lines: LedgerLine[]): LedgerLine[] {
  let balance = 0;
  return [...lines]
    .sort((a, b) => a.date - b.date)
    .map((line) => {
      balance = line.type === 'Debit' ? balance + line.amount : balance - line.amount;
      return { ...line, runningBalance: balance };
    })
    .reverse();
}

function totalsOf(lines: LedgerLine[]): { debits: number; credits: number } {
  return lines.reduce(
    (totals, line) => {
      if (line.type === 'Debit') totals.debits += line.amount;
      else totals.credits += line.amount;
      return totals;
    },
    { debits: 0, credits: 0 },
  );
}

export const entityLedgerService = {
  /** يكشف كشفًا كاملًا لكيان واحد: الملف + الرصيد + السطور التراكمية + الإجماليات. */
  async loadLedger(entityType: LedgerEntityType, entityId: string): Promise<EntityLedger> {
    const id = String(entityId || '').trim();
    if (!id) throw new Error('Entity id is required to build an entity ledger.');

    const [party, currencyCodes] = await Promise.all([
      loadParty(entityType, id),
      buildCurrencyCodes(),
    ]);
    const movements = await loadMovements(id, currencyCodes);
    const lines =
      entityType === 'customer'
        ? buildCustomerLines(await loadCustomerOrders(id), movements)
        : buildCourierLines(movements);
    const ordered = withRunningBalance(lines);

    return { party, lines: ordered, totals: totalsOf(ordered) };
  },
};
