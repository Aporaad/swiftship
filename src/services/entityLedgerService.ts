/**
 * entityLedgerService.ts
 * خدمة كشف حساب الكيان (عميل أو مندوب أو مصدر أو شركة شحن) — API-only عبر alx_api: منطق تجميع السطور والرصيد التراكمي هنا وليس في الواجهة.
 * Entity ledger service (customer / courier / source / shipping company) — API-only through alx_api. Ledger line
 * building and the running balance live here so the modal stays presentation only.
 */
import { readAllFinanceRows, readFinanceRecord } from './financeApi';
import { currencyService } from './currencyService';
import { financialAccountService } from './financialAccountService';

export type LedgerEntityType = 'customer' | 'courier' | 'source' | 'shipping_company';

/** كيانات سجل الطلبات: الطلبات تمر عبر مصدر شراء أو شركة شحن، لا عبر عميل. */
/** Order-log parties: orders flow through a supply source or a carrier, never through a customer. */
export type OrderLogEntityType = Extract<LedgerEntityType, 'source' | 'shipping_company'>;

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
  /** معرّف ورمز الحساب المالي المرتبط بالكيان؛ فارغ حين لم يُنشأ حساب بعد. */
  accountId: string;
  accountCode: string;
  currency: string;
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

/** سطر سجل الحركة: ملخص طلب تم عبر المصدر أو شركة الشحن. */
/** One order-log row: a summary of an order that flowed through the source or carrier. */
export interface EntityOrderLogLine {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  customerName: string;
  status: string;
  statusNameAr: string;
  statusNameEn: string;
  date: number;
  total: number;
  paid: number;
  remaining: number;
  currency: string;
}

export interface EntityOrderLog {
  lines: EntityOrderLogLine[];
  totals: { orders: number; total: number; paid: number; remaining: number };
}

const MOVEMENTS_PATH = '/api/v1/finance/account-movements';
const ORDERS_PATH = '/api/v1/orders';
/**
 * مسار السجل الواحد موجود في alx_api للعميل والمندوب فقط؛ المصدر وشركة الشحن تُعرض قائمةً بلا GET/:id،
 * لذلك يُجلب اسمهما من صف القائمة نفسه بدل استدعاء مسار غير موجود يعيد ROUTE_NOT_FOUND.
 * Only customers and couriers own a single-record route in alx_api; sources and carriers are list-only,
 * so their display name comes from the list row instead of a call that would answer ROUTE_NOT_FOUND.
 */
const PROFILE_PATH: Partial<Record<LedgerEntityType, string>> = {
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

async function loadParty(
  entityType: LedgerEntityType,
  entityId: string,
  knownName = '',
): Promise<LedgerParty> {
  const profilePath = PROFILE_PATH[entityType];
  const [profile, account] = await Promise.all([
    profilePath ? readFinanceRecord(`${profilePath}/${encodeURIComponent(entityId)}`) : Promise.resolve(null),
    financialAccountService.getAccountByEntityId(entityId, entityType),
  ]);
  return {
    id: entityId,
    name:
      text(profile?.fullName || profile?.nameAr || profile?.nameEn || profile?.name) ||
      text(knownName) ||
      text(account?.entityName) ||
      entityId,
    // الهاتف غير مكشوف في حدود قراءة العملاء المتعمَّدة، فيبقى فارغًا بدل اختلاق قيمة.
    // Phone is intentionally outside the customers read boundary, so it stays empty rather than invented.
    phone: text(profile?.phone),
    accountId: text(account?.id),
    accountCode: text(account?.accountCode),
    currency: text(account?.currency) || 'YER',
    balance: Number(account?.balance ?? 0),
  };
}

/** توحيد صف الحركة بين مسارَي المالية: حسب الكيان أو حسب الحساب. */
/** Normalizes a movement row shared by the entity-scoped and account-scoped finance endpoints. */
function mapMovement(row: any, currencyCodes: Map<string, string>) {
  return {
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
  };
}

async function loadMovements(entityId: string, currencyCodes: Map<string, string>): Promise<any[]> {
  const rows = await readAllFinanceRows(MOVEMENTS_PATH, { entityId });
  return rows.map((row) => mapMovement(row, currencyCodes));
}

/**
 * حركة حساب المصدر/شركة الشحن تُقرأ من الحساب نفسه لا من `entity_id`: القيود التلقائية قد تحمل
 * جهة العميل فقط، بينما الحساب هو صاحب الرصيد الصحيح.
 * Source/carrier activity is read from the account itself rather than `entity_id`: automatic entries may stamp
 * only the customer party, while the account is what actually owns the balance.
 */
async function loadAccountMovements(accountId: string, currencyCodes: Map<string, string>): Promise<any[]> {
  const rows = await readAllFinanceRows(`/api/v1/finance/accounts/${encodeURIComponent(accountId)}/movements`);
  return rows.map((row) => mapMovement(row, currencyCodes));
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

/** سجل الطلبات التي تمت عبر مصدر أو شركة شحن: الفلترة على الخادم عبر `sourceId`/`shippingCompanyId`. */
/** Orders that flowed through a source or carrier; filtering is server-side via `sourceId`/`shippingCompanyId`. */
async function loadEntityOrders(entityType: OrderLogEntityType, entityId: string): Promise<EntityOrderLog> {
  const filter = entityType === 'source' ? { sourceId: entityId } : { shippingCompanyId: entityId };
  const rows = await readAllFinanceRows(ORDERS_PATH, filter);
  const lines: EntityOrderLogLine[] = rows
    .map((row) => {
      const paid = number(row.amountPaid);
      const remaining = number(row.amountRemaining);
      return {
        id: text(row.orderId),
        orderNumber: text(row.orderNumber),
        trackingNumber: text(row.trackingNumber),
        customerName: text(row.customerName),
        status: text(row.orderStatus),
        statusNameAr: text(row.orderStatusNameAr),
        statusNameEn: text(row.orderStatusNameEn),
        date: timestamp(row.createdAt),
        total: paid + remaining,
        paid,
        remaining,
        currency: text(row.currency) || 'YER',
      };
    })
    .sort((a, b) => b.date - a.date);

  const totals = lines.reduce(
    (sum, line) => {
      sum.orders += 1;
      sum.total += line.total;
      sum.paid += line.paid;
      sum.remaining += line.remaining;
      return sum;
    },
    { orders: 0, total: 0, paid: 0, remaining: 0 },
  );

  return { lines, totals };
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

/** سطور كشف المصدر/شركة الشحن: اتجاه كل حركة كما كُيّد في القيد، بلا إعادة تصنيف تشغيلية. */
/** Source/carrier ledger: each movement keeps the direction it was posted with — no operational reclassification. */
function buildAccountLines(movements: any[]): LedgerLine[] {
  return movements.map((movement) => movementLine(movement, 'generic', movement.type, movement.category));
}

export const entityLedgerService = {
  /** يكشف كشفًا كاملًا لكيان واحد: الملف + الرصيد + السطور التراكمية + الإجماليات. */
  /** الاسم معروف مسبقًا اختياري: يُستخدم للمصدر/شركة الشحن لأن قائمة العرض تملكه لا مسار سجل مفرد. */
  async loadLedger(entityType: LedgerEntityType, entityId: string, partyName = ''): Promise<EntityLedger> {
    const id = String(entityId || '').trim();
    if (!id) throw new Error('Entity id is required to build an entity ledger.');

    const [party, currencyCodes] = await Promise.all([
      loadParty(entityType, id, partyName),
      buildCurrencyCodes(),
    ]);

    if (entityType === 'customer' || entityType === 'courier') {
      const movements = await loadMovements(id, currencyCodes);
      const lines =
        entityType === 'customer'
          ? buildCustomerLines(await loadCustomerOrders(id), movements)
          : buildCourierLines(movements);
      const ordered = withRunningBalance(lines);
      return { party, lines: ordered, totals: totalsOf(ordered) };
    }

    // بدون حساب مالي لا يوجد كشف: صف فارغ صريح بدل استدعاء يعيد كل الحركات.
    // No account means no statement: an explicit empty ledger instead of an unfiltered call.
    const movements = party.accountId ? await loadAccountMovements(party.accountId, currencyCodes) : [];
    const ordered = withRunningBalance(buildAccountLines(movements));
    return { party, lines: ordered, totals: totalsOf(ordered) };
  },

  /** سجل الحركة: الطلبات التي تمت عبر المصدر أو شركة الشحن مع إجمالياتها. */
  /** Order log: the orders that flowed through a source or carrier, with their totals. */
  async loadOrderLog(entityType: OrderLogEntityType, entityId: string): Promise<EntityOrderLog> {
    const id = String(entityId || '').trim();
    if (!id) throw new Error('Entity id is required to build an order log.');
    return loadEntityOrders(entityType, id);
  },
};
