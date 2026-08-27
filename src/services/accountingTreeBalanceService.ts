export type AccountingNature = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export interface CurrencyRateRecord {
  code?: string;
  cur_id?: number;
  curNo?: number;
  isDefault?: boolean;
  is_default?: boolean;
  currentPrice?: number;
}

export interface AccountBalancesSource {
  byId: Record<string, number>;
  byCode: Record<string, number>;
}

export interface TreeNodeBalance {
  currency: string;
  nativeBalance: number | null;
  systemBalance: number | null;
  memberCount: number;
  includesConvertedChildren: boolean;
  missingExchangeRate: boolean;
}

export interface AccountingEquationTotals {
  assets: number | null;
  liab: number | null;
  capital: number | null;
  revenues: number | null;
  expenses: number | null;
  netIncome: number | null;
  rightSide: number | null;
  gap: number | null;
  isBalanced: boolean;
  hasMissingExchangeRate: boolean;
}

export interface TreeBalanceSummary {
  defaultCurrency: string;
  ledgerBalances: Record<string, TreeNodeBalance>;
  groupBalances: Record<string, TreeNodeBalance>;
  subBalances: Record<string, TreeNodeBalance>;
  mainBalances: Record<string, TreeNodeBalance>;
  rootBalances: Record<string, TreeNodeBalance>;
  totals: AccountingEquationTotals;
}

const read = (record: any, camel: string, snake: string) => record?.[camel] ?? record?.[snake];
const accountCode = (record: any) => String(read(record, 'accountCode', 'account_code') || record?.code || record?.id || '').trim();
const finiteNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};
const hasOwn = (record: Record<string, number>, key: string) => Object.prototype.hasOwnProperty.call(record, key);

export function getDefaultCurrencyCode(currencies: CurrencyRateRecord[]): string {
  return String(currencies.find((currency) => currency.isDefault || currency.is_default)?.code || '').trim().toUpperCase();
}

export function getRecordCurrencyCode(record: any, currencies: CurrencyRateRecord[], defaultCurrency: string): string {
  const explicitCode = String(record?.currency || '').trim().toUpperCase();
  if (explicitCode) return explicitCode;
  const curNo = Number(read(record, 'curNo', 'cur_no'));
  const fromReference = currencies.find((currency) => Number(currency.cur_id ?? currency.curNo) === curNo)?.code;
  return String(fromReference || defaultCurrency || '').trim().toUpperCase();
}

/**
 * أسعار currencyService تعبّر عن: عدد وحدات العملة الافتراضية المقابلة لوحدة واحدة من العملة.
 * لا يستخدم هذا المحول أي سعر احتياطي: إذا كان السعر غير موجود يعيد null لئلا يعرض إجماليًا مضللًا.
 */
export function convertUsingDatabaseRate(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  currencies: CurrencyRateRecord[],
  defaultCurrency: string,
): number | null {
  const from = String(fromCurrency || defaultCurrency || '').trim().toUpperCase();
  const to = String(toCurrency || defaultCurrency || '').trim().toUpperCase();
  if (!from || !to) return null;
  if (from === to) return finiteNumber(amount);

  const rateFor = (code: string): number | null => {
    if (code === defaultCurrency) return 1;
    const rate = Number(currencies.find((currency) => String(currency.code || '').toUpperCase() === code)?.currentPrice);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  };

  const sourceRate = rateFor(from);
  const targetRate = rateFor(to);
  if (sourceRate === null || targetRate === null) return null;
  return finiteNumber(amount) * sourceRate / targetRate;
}

export function calculateAccountingTreeBalances(input: {
  roots: any[];
  mains: any[];
  subs: any[];
  groups: any[];
  accounts: any[];
  currencies: CurrencyRateRecord[];
  liveBalances: AccountBalancesSource;
}): TreeBalanceSummary {
  const { roots, mains, subs, groups, accounts, currencies, liveBalances } = input;
  const defaultCurrency = getDefaultCurrencyCode(currencies);
  const convert = (amount: number, from: string, to: string) => convertUsingDatabaseRate(amount, from, to, currencies, defaultCurrency);
  const makeLedger = (account: any): TreeNodeBalance => {
    const id = String(account?.id || '');
    const code = accountCode(account);
    const nativeBalance = hasOwn(liveBalances.byId, id)
      ? finiteNumber(liveBalances.byId[id])
      : hasOwn(liveBalances.byCode, code)
        ? finiteNumber(liveBalances.byCode[code])
        : finiteNumber(account?.balance);
    const currency = getRecordCurrencyCode(account, currencies, defaultCurrency);
    const systemBalance = convert(nativeBalance, currency, defaultCurrency);
    return {
      currency,
      nativeBalance,
      systemBalance,
      memberCount: 1,
      includesConvertedChildren: currency !== defaultCurrency,
      missingExchangeRate: systemBalance === null,
    };
  };
  const mergeChildren = (parent: any, children: TreeNodeBalance[]): TreeNodeBalance => {
    const currency = getRecordCurrencyCode(parent, currencies, defaultCurrency);
    const hasMissingExchangeRate = children.some((child) => child.missingExchangeRate);
    const nativeValues = children.map((child) => child.nativeBalance === null ? null : convert(child.nativeBalance, child.currency, currency));
    const systemValues = children.map((child) => child.systemBalance);
    const nativeBalance = hasMissingExchangeRate || nativeValues.some((value) => value === null)
      ? null
      : nativeValues.reduce((sum, value) => sum + Number(value), 0);
    const systemBalance = hasMissingExchangeRate || systemValues.some((value) => value === null)
      ? null
      : systemValues.reduce((sum, value) => sum + Number(value), 0);
    return {
      currency,
      nativeBalance,
      systemBalance,
      memberCount: children.reduce((sum, child) => sum + child.memberCount, 0),
      includesConvertedChildren: children.some((child) => child.includesConvertedChildren || child.currency !== currency),
      missingExchangeRate: hasMissingExchangeRate || nativeValues.some((value) => value === null),
    };
  };

  const ledgerBalances = Object.fromEntries(accounts.map((account) => [String(account.id), makeLedger(account)]));
  const groupBalances = Object.fromEntries(groups.map((group) => [String(group.id), mergeChildren(group, accounts
    .filter((account) => read(account, 'groupId', 'group_id') === group.id)
    .map((account) => ledgerBalances[String(account.id)]))]));
  const subBalances = Object.fromEntries(subs.map((sub) => {
    const grouped = groups
      .filter((group) => read(group, 'accSubId', 'acc_sub_id') === sub.id)
      .map((group) => groupBalances[String(group.id)]);
    const direct = accounts
      .filter((account) => !read(account, 'groupId', 'group_id') && read(account, 'accSubId', 'acc_sub_id') === sub.id)
      .map((account) => ledgerBalances[String(account.id)]);
    return [String(sub.id), mergeChildren(sub, [...grouped, ...direct])];
  }));
  const mainBalances = Object.fromEntries(mains.map((main) => [String(main.id), mergeChildren(main, subs
    .filter((sub) => read(sub, 'accMainId', 'acc_main_id') === main.id)
    .map((sub) => subBalances[String(sub.id)]))]));
  const rootBalances = Object.fromEntries(roots.map((root) => [String(root.id), mergeChildren(root, mains
    .filter((main) => read(main, 'accountId', 'account_id') === root.id)
    .map((main) => mainBalances[String(main.id)]))]));

  const sumByNature = (nature: AccountingNature): number | null => {
    const matched = roots
      .filter((root) => String(read(root, 'accountType', 'account_type') || '') === nature)
      .map((root) => rootBalances[String(root.id)]?.systemBalance ?? null);
    return matched.some((value) => value === null) ? null : matched.reduce((sum, value) => sum + Number(value), 0);
  };
  const assets = sumByNature('Asset');
  const liab = sumByNature('Liability');
  const capital = sumByNature('Equity');
  const revenues = sumByNature('Revenue');
  const expenses = sumByNature('Expense');
  const netIncome = revenues === null || expenses === null ? null : revenues - expenses;
  const rightSide = liab === null || capital === null || netIncome === null ? null : liab + capital + netIncome;
  const gap = assets === null || rightSide === null ? null : Math.abs(assets - rightSide);
  const hasMissingExchangeRate = Object.values({ ...ledgerBalances, ...groupBalances, ...subBalances, ...mainBalances, ...rootBalances })
    .some((balance) => balance.missingExchangeRate);

  return {
    defaultCurrency,
    ledgerBalances,
    groupBalances,
    subBalances,
    mainBalances,
    rootBalances,
    totals: {
      assets, liab, capital, revenues, expenses, netIncome, rightSide, gap,
      isBalanced: gap !== null && gap < 0.01 && !hasMissingExchangeRate,
      hasMissingExchangeRate,
    },
  };
}
