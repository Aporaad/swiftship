/**
 * useAccountBalances
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook يستمع لجدول account_transactions عبر Supabase real-time
 * ويعيد خريطة من accountCode → رصيد محتسب بالمعادلة المحاسبية الصحيحة:
 *
 *   أصول   (Asset)   = Σ مدين − Σ دائن  (طبيعي مدين)
 *   مصروف  (Expense) = Σ مدين − Σ دائن  (طبيعي مدين)
 *   خصوم   (Liability)= Σ دائن − Σ مدين (طبيعي دائن)
 *   إيراد  (Revenue)  = Σ دائن − Σ مدين (طبيعي دائن)
 *   ملكية  (Equity)   = Σ دائن − Σ مدين (طبيعي دائن)
 *
 * يتحدث تلقائياً كلما تغير أي قيد في account_transactions أو الإعدادات أو أسعار الصرف.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from '../lib/supabase-firebase-adapter';
import { db } from '../lib/supabase-firebase-adapter';
import { supabase } from '../lib/supabase-firebase-adapter';
import { DEFAULT_RATES, ExchangeRates, currencyService } from '../services/currencyService';

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export interface AccountBalancesMap {
  /** accountCode → computed net balance in account's native currency */
  byCode: Record<string, number>;
  /** accountId → computed net balance in account's native currency */
  byId: Record<string, number>;
  /** is the data still loading? */
  loading: boolean;
  /** last update timestamp */
  updatedAt: number;
}

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

// ── Singleton state shared across all hook consumers ──────────────────────────
// Subscriptions are created once and shared; no duplicate listeners per component.
let _singleton: AccountBalancesMap = {
  byCode: {},
  byId: {},
  loading: true,
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
  let txDocs: any[] = [];
  let initialLoaded = { settings: false, accounts: false, txs: false };

  const checkAndCompute = () => {
    const debitByCode: Record<string, number> = {};
    const creditByCode: Record<string, number> = {};
    const debitById: Record<string, number> = {};
    const creditById: Record<string, number> = {};

    txDocs.forEach((tx: any) => {
      const code: string = tx.accountCode || '';
      const id: string   = tx.accountId  || '';
      const txCurrency   = tx.currency   || 'YER';
      const accountCurrency = accountRegistry[code]?.currency || accountRegistry[id]?.currency || 'YER';

      let amt: number = parseFloat(tx.amount) || 0;
      if (txCurrency !== accountCurrency) {
        const origAmt = parseFloat(tx.amountOriginal) || amt;
        const origCurr = tx.currencyOriginal || txCurrency;
        amt = convertCurrency(origAmt, origCurr, accountCurrency, exchangeRates);
      }

      if (tx.type === 'Debit') {
        if (code) debitByCode[code] = (debitByCode[code] || 0) + amt;
        if (id)   debitById[id]     = (debitById[id]   || 0) + amt;
      } else if (tx.type === 'Credit') {
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

    _singleton = {
      byCode,
      byId,
      loading: !(initialLoaded.settings && initialLoaded.accounts && initialLoaded.txs),
      updatedAt: Date.now(),
    };
    _notifySubscribers();
  };

  // 1. Subscribe to exchange rates from cur_price (single global listener)
  const fetchRates = async () => {
    try {
      const latest = await currencyService.getLatestExchangeRates();
      exchangeRates = { ...latest };
    } catch (_) {}
    initialLoaded.settings = true;
    checkAndCompute();
  };
  fetchRates();

  try {
    const balChanId = `balances_rates_sync_${Math.random().toString(36).substring(2, 8)}`;
    (supabase as any)
      .channel(balChanId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cur_price' }, () => {
        fetchRates();
      })
      .subscribe();
  } catch (err) {
    console.warn('[useAccountBalances] balances_rates_sync channel warning:', err);
  }

  // 2. Subscribe to accounts to build type & currency registry (single global listener)
  onSnapshot(collection(db, 'accounts'), (snap: any) => {
    const reg: Record<string, { currency: string; type: AccountType }> = {};
    snap.docs.forEach((d: any) => {
      const acc = d.data();
      const code = acc.accountCode || acc.code;
      const id = d.id;
      const currency = acc.currency || 'YER';
      let typeStr = acc.type || guessAccountTypeFromCode(code);
      if (typeStr === 'REV') typeStr = 'Revenue';
      if (typeStr === 'EXP') typeStr = 'Expense';
      if (typeStr === 'AST') typeStr = 'Asset';
      const type = typeStr as AccountType;
      if (code) reg[code] = { currency, type };
      if (id)   reg[id]   = { currency, type };
    });
    accountRegistry = reg;
    initialLoaded.accounts = true;
    checkAndCompute();
  }, () => { initialLoaded.accounts = true; checkAndCompute(); });

  // 3. Subscribe to transactions (single global listener — this is the heavy one)
  onSnapshot(collection(db, 'account_transactions'), (snap: any) => {
    txDocs = snap.docs.map((d: any) => d.data());
    initialLoaded.txs = true;
    checkAndCompute();
  }, (error: any) => {
    console.error('[useAccountBalances] Snapshot error:', error);
    initialLoaded.txs = true;
    _singleton = { ..._singleton, loading: false };
    _notifySubscribers();
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

