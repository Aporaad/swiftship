/**
 * useAccountBalances
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook يستمع لجدول account_trans عبر Supabase real-time
 * ويعيد خريطة من accountCode → رصيد محتسب بالمعادلة المحاسبية الصحيحة:
 *
 *   أصول   (Asset)   = Σ مدين − Σ دائن  (طبيعي مدين)
 *   مصروف  (Expense) = Σ مدين − Σ دائن  (طبيعي مدين)
 *   خصوم   (Liability)= Σ دائن − Σ مدين (طبيعي دائن)
 *   إيراد  (Revenue)  = Σ دائن − Σ مدين (طبيعي دائن)
 *   ملكية  (Equity)   = Σ دائن − Σ مدين (طبيعي دائن)
 *
 * شرط جوهري:
 *   يتم استبعاد أي حركة مالية من account_trans فقط إذا كانت حالة ترحيل قيدها غير مرحّل
 *   (posting_status !== 'posted' / draft).
 *   أما القيود المؤقتة (Temp) فيتم تضمينها واحتسابها طبيعياً طالما قيدها مرحّل.
 *
 * Critical Rule:
 *   Any account_trans row is EXCLUDED only if its linked main_entry has
 *   posting_status !== 'posted' (e.g. 'draft'). Temp entries are INCLUDED.
 *
 * يتحدث تلقائياً كلما تغير أي قيد في account_trans أو main_entry أو الإعدادات أو أسعار الصرف.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { financeApiDataGateway } from '../components/financeAccounting/FinanceApiDataGateway';
import { currencyService } from '../services/currencyService';
import { asyncState, type AsyncState } from '../shared/contracts/ui.contracts';
import { isRecord, readString, toRecord, type UnknownRecord } from '../shared/contracts/unknown.contracts';

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export interface AccountBalancesMap {
  /** accountCode → computed net balance in account's native currency */
  byCode: Record<string, number>;
  /** accountId → computed net balance in account's native currency */
  byId: Record<string, number>;
  /** is the data still loading? */
  loading: boolean;
  queryState: AsyncState<{ byCode: Record<string, number>; byId: Record<string, number> }>;
  /** last update timestamp */
  updatedAt: number;
}

interface SnapshotDocument {
  id: string;
  data(): unknown;
}

interface CollectionSnapshot {
  docs: SnapshotDocument[];
}

const numericValue = (value: unknown): number => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};
const readFirstString = (record: UnknownRecord, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = readString(record[key]);
    if (value) return value;
  }
  return undefined;
};

/**
 * Universal Currency Converter (Client side helper)
 */
function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (!from || !to || from === to) return amount;

  // Convert to YER base
  let baseAmountYER = amount;
  if (from === 'YER') {
    baseAmountYER = amount;
  } else {
    const fromRate = rates[from] || 1;
    baseAmountYER = amount * fromRate;
  }

  // Convert YER to target
  if (to === 'YER') return baseAmountYER;
  const toRate = rates[to] || 1;
  return baseAmountYER / (toRate || 1);
}

/**
 * Determines the normal balance side for an account type.
 * Returns +1 if Debit increases balance (Asset/Expense)
 * Returns -1 if Credit increases balance (Liability/Equity/Revenue)
 */
export function getAccountNormalSide(type: AccountType): 1 | -1 {
  if (type === 'Asset' || type === 'Expense') return 1;
  return -1;
}

/**
 * Compute balance from debit and credit totals using the proper accounting formula.
 * @param debitTotal  - Total of all Debit entries (amount)
 * @param creditTotal - Total of all Credit entries (amount)
 * @param type        - Account type (Asset | Liability | Equity | Revenue | Expense)
 */
export function computeAccountBalance(
  debitTotal: number,
  creditTotal: number,
  type: AccountType,
): number {
  const normalSide = getAccountNormalSide(type);
  return normalSide === 1
    ? debitTotal - creditTotal
    : creditTotal - debitTotal;
}

/**
 * Guess account type from the account code prefix (first digit).
 * Used when the full type string is not available.
 */
export function guessAccountTypeFromCode(code: string): AccountType {
  const first = (code || '').trim().charAt(0);
  switch (first) {
    case '1': return 'Asset';
    case '2': return 'Liability';
    case '3': return 'Equity';
    case '4': return 'Revenue';
    case '5': return 'Expense';
    default:  return 'Asset';
  }
}

/**
 * يتحقق ما إذا كانت الحركة المالية معتمدة للإدراج في الأرصدة.
 * Checks if a transaction should be included in balance calculations.
 *
 * القاعدة / Rule:
 *   - يجب أن يكون القيد المرتبط (main_entry) مرحّلاً (posting_status = 'posted')
 *   - يستبعد فقط القيود التي حالة ترحيلها draft أو غير مرحّلة.
 *   - القيود المؤقتة (Temp) يُتم تضمينها واحتسابها فور مرحلتها.
 *
 * @param tx          - سطر الحركة من account_trans
 * @param entryMap    - خريطة رؤوس القيود من main_entry (id → data)
 */
export function isTransactionPostable(tx: UnknownRecord, entryMap: Map<string, UnknownRecord>): boolean {
  const entryId = readFirstString(tx, 'entryId', 'entry_id');

  // إذا لم يوجد entry_id: تُدرج الحركة (حركات تاريخية غير مرتبطة)
  // If no entry_id: include the transaction (legacy unlinked transactions)
  if (!entryId) return true;

  const entry = entryMap.get(entryId);

  // إذا لم يُوجد القيد في main_entry: نستبعد الحركة لتفادي أرصدة خاطئة
  // If entry not found in main_entry: exclude to avoid corrupted balances
  if (!entry) return false;

  // التحقق من حالة الترحيل: يجب أن تكون 'posted' (استبعاد 'draft')
  // Check posting status: must be 'posted' (exclude 'draft')
  const postingStatus = readFirstString(entry, 'postingStatus', 'posting_status') ?? '';
  if (postingStatus !== 'posted') return false;

  return true;
}

// ── Singleton state shared across all hook consumers ──────────────────────────
// Subscriptions are created once and shared; no duplicate listeners per component.
let _singleton: AccountBalancesMap = {
  byCode: {},
  byId: {},
  loading: true,
  queryState: asyncState.loading(),
  updatedAt: 0,
};
const _subscribers = new Set<() => void>();
let _initialized = false;

function _notifySubscribers() {
  _subscribers.forEach(cb => cb());
}

function _initSingleton() {
  if (_initialized) return;
  _initialized = true;

  let exchangeRates: Record<string, number> = { YER: 1, SAR: 140, USD: 535 };
  let accountRegistry: Record<string, { currency: string; type: AccountType }> = {};
  let txDocs: UnknownRecord[] = [];
  // خريطة رؤوس القيود: entryId → بيانات القيد (posting_status)
  // Map of main entry headers: entryId → entry data (posting_status)
  let entryMap = new Map<string, UnknownRecord>();
  let initialLoaded = { settings: false, accounts: false, txs: false, entries: false };
  const sourceErrors: Partial<Record<keyof typeof initialLoaded, unknown>> = {};

  const setSourceError = (source: keyof typeof initialLoaded, error?: unknown) => {
    sourceErrors[source] = error;
  };

  const checkAndCompute = () => {
    const debitByCode: Record<string, number> = {};
    const creditByCode: Record<string, number> = {};
    const debitById: Record<string, number> = {};
    const creditById: Record<string, number> = {};

    txDocs.forEach((tx) => {
      // ──────────────────────────────────────────────────────────────────────
      // شرط أساسي: استبعاد الحركات التي لم يُرحَّل قيدها (posting_status !== 'posted')
      // Critical filter: exclude transactions from non-posted entries only
      // ──────────────────────────────────────────────────────────────────────
      if (!isTransactionPostable(tx, entryMap)) return;

      // استخراج كود الحساب والمعرف والنوع من أسطر جدول account_trans الجديد
      // Extract account code, ID, and transaction type from account_trans table
      const code = readFirstString(tx, 'accountCode', 'account_code') ?? '';
      const id = readFirstString(tx, 'accountId', 'account_id') ?? '';
      const type = readFirstString(tx, 'transType', 'trans_type', 'type') ?? '';
      const txCurrency = readFirstString(tx, 'currency') ?? 'YER';
      const accountCurrency = accountRegistry[code]?.currency || accountRegistry[id]?.currency || 'YER';

      let amt = numericValue(tx.amount);
      if (txCurrency !== accountCurrency) {
        const origAmt = numericValue(tx.amountOriginal ?? tx.amount_original) || amt;
        const origCurr = readFirstString(tx, 'currencyOriginal', 'currency_original') || txCurrency;
        amt = convertCurrency(origAmt, origCurr, accountCurrency, exchangeRates);
      }

      if (type === 'Debit') {
        if (code) debitByCode[code] = (debitByCode[code] || 0) + amt;
        if (id)   debitById[id]     = (debitById[id]   || 0) + amt;
      } else if (type === 'Credit') {
        if (code) creditByCode[code] = (creditByCode[code] || 0) + amt;
        if (id)   creditById[id]     = (creditById[id]   || 0) + amt;
      }
    });

    const byCode: Record<string, number> = {};
    const byId:   Record<string, number> = {};

    const allCodes = new Set([...Object.keys(debitByCode), ...Object.keys(creditByCode)]);
    allCodes.forEach(code => {
      const type = accountRegistry[code]?.type ?? guessAccountTypeFromCode(code);
      byCode[code] = computeAccountBalance(debitByCode[code] || 0, creditByCode[code] || 0, type);
    });

    const allIds = new Set([...Object.keys(debitById), ...Object.keys(creditById)]);
    allIds.forEach(id => {
      const type = accountRegistry[id]?.type ?? 'Asset';
      byId[id] = computeAccountBalance(debitById[id] || 0, creditById[id] || 0, type);
    });

    const loading = !(initialLoaded.settings && initialLoaded.accounts && initialLoaded.txs && initialLoaded.entries);
    const firstError = Object.values(sourceErrors).find((error) => error !== undefined);
    const hasBalances = Object.keys(byCode).length > 0 || Object.keys(byId).length > 0;
    const queryState = loading
      ? asyncState.loading<{ byCode: Record<string, number>; byId: Record<string, number> }>()
      : firstError !== undefined
        ? asyncState.error<{ byCode: Record<string, number>; byId: Record<string, number> }>(firstError, 'ACCOUNT_BALANCES_LOAD_FAILED')
        : hasBalances
          ? asyncState.success({ byCode, byId })
          : asyncState.empty<{ byCode: Record<string, number>; byId: Record<string, number> }>();
    _singleton = {
      byCode: queryState.status === 'error' ? {} : byCode,
      byId: queryState.status === 'error' ? {} : byId,
      loading,
      queryState,
      updatedAt: Date.now(),
    };
    _notifySubscribers();
  };

  // 1. Subscribe to exchange rates from cur_price (single global listener)
  const fetchRates = async () => {
    try {
      const latest = await currencyService.getLatestExchangeRates();
      exchangeRates = { ...latest };
      setSourceError('settings');
    } catch (error: unknown) {
      setSourceError('settings', error);
    }
    initialLoaded.settings = true;
    checkAndCompute();
  };
  fetchRates();

  // 2. Subscribe to accounts to build type & currency registry
  financeApiDataGateway.subscribeCollection('accounts', (rows: Record<string, unknown>[]) => {
    const reg: Record<string, { currency: string; type: AccountType }> = {};
    rows.forEach((account) => {
      const code = readFirstString(account, 'accountCode', 'code');
      const id = readFirstString(account, 'id', 'accountId') || code || '';
      const currency = readFirstString(account, 'currency', 'currency_code') || 'YER';
      let typeValue = readFirstString(account, 'type') || (code ? guessAccountTypeFromCode(code) : 'Asset');
      if (typeValue === 'REV') typeValue = 'Revenue';
      if (typeValue === 'EXP') typeValue = 'Expense';
      if (typeValue === 'AST') typeValue = 'Asset';
      const type: AccountType = typeValue === 'Asset' || typeValue === 'Liability' || typeValue === 'Equity' || typeValue === 'Revenue' || typeValue === 'Expense'
        ? typeValue
        : (code ? guessAccountTypeFromCode(code) : 'Asset');
      if (code) reg[code] = { currency, type };
      if (id)   reg[id]   = { currency, type };
    });
    accountRegistry = reg;
    setSourceError('accounts');
    initialLoaded.accounts = true;
    checkAndCompute();
  }, (error: unknown) => { setSourceError('accounts', error); initialLoaded.accounts = true; checkAndCompute(); });

  // 3. Subscribe to main_entry to build posting-status map
  financeApiDataGateway.subscribeCollection('main_entry', (rows: Record<string, unknown>[]) => {
    const newMap = new Map<string, UnknownRecord>();
    rows.forEach((item) => {
      const data = toRecord(item);
      const id = readFirstString(data, 'id', 'entryId', 'mainEntryId') || '';
      if (id) newMap.set(id, data);
    });
    entryMap = newMap;
    setSourceError('entries');
    initialLoaded.entries = true;
    checkAndCompute();
  }, (err: unknown) => {
    console.warn('[useAccountBalances] main_entry subscription warning:', err);
    setSourceError('entries', err);
    initialLoaded.entries = true;
    checkAndCompute();
  });

  // 4. Subscribe to transactions in account_trans
  financeApiDataGateway.subscribeCollection('account_trans', (rows: Record<string, unknown>[]) => {
    txDocs = rows.map((item) => ({ _docId: readFirstString(item, 'id', 'transactionId') || '', ...toRecord(item) }));
    setSourceError('txs');
    initialLoaded.txs = true;
    checkAndCompute();
  }, (error: unknown) => {
    console.error('[useAccountBalances] Snapshot error:', error);
    setSourceError('txs', error);
    initialLoaded.txs = true;
    checkAndCompute();
  });
}

/**
 * useAccountBalances
 * Singleton pattern: all components share a single set of Supabase listeners.
 * No duplicate subscriptions regardless of how many components use this hook.
 */
export function useAccountBalances(
  _accountTypesMap?: Record<string, AccountType>,
): AccountBalancesMap {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    // Initialize singleton listeners on first use
    _initSingleton();

    // Subscribe this component to singleton updates
    const cb = () => forceUpdate(n => n + 1);
    _subscribers.add(cb);
    return () => { _subscribers.delete(cb); };
  }, []);

  return _singleton;
}

export default useAccountBalances;
