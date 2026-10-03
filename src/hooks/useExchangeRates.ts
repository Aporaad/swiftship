/**
 * useExchangeRates
 * ─────────────────────────────────────────────────────────────────────────────
 * Singleton Real-time hook that subscribes to `currency` and `cur_price`
 * Supabase tables and exposes:
 *   - `rates`      — خريطة أسعار الصرف الديناميكية من DB
 *                    { [currencyCode]: priceVsBase }
 *                    العملة ذات isDefault=true لها قيمة = 1
 *                    لا توجد أسعار مثبّتة في الكود
 *   - `currencies` — full enriched currency list (all, including inactive)
 *   - `activeCurrencies` — only isActive=true currencies
 *   - `loading`    — true while initial fetch is in progress
 *
 * Uses a singleton pattern so all components share a single subscription.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { supabase } from '../data/legacy/legacy-compat.ts';
import { currencyService, Currency, ExchangeRates, DEFAULT_RATES } from '../services/currencyService';
import { asyncState, runQuery, type AsyncState } from '../shared/contracts/ui.contracts';

// ── Singleton State ───────────────────────────────────────────────────────────

interface ExchangeRatesState {
  rates: ExchangeRates;
  currencies: Currency[];
  activeCurrencies: Currency[];
  loading: boolean;
  queryState: AsyncState<ExchangeRatesData>;
  updatedAt: number;
}

interface ExchangeRatesData {
  rates: ExchangeRates;
  currencies: Currency[];
  activeCurrencies: Currency[];
}

interface RealtimeChannel {
  on(event: 'postgres_changes', filter: { event: string; schema: string; table: string }, listener: () => void): RealtimeChannel;
  subscribe(): RealtimeChannel;
}

interface RealtimeClient {
  channel(name: string): RealtimeChannel;
  removeChannel(channel: RealtimeChannel): Promise<unknown>;
}

const realtimeClient = supabase as unknown as RealtimeClient;

let _state: ExchangeRatesState = {
  // الحالة الأولية: خريطة فارغة — ستُملأ من DB فور الاتصال
  // DEFAULT_RATES تُستخدم فقط كـ emergency fallback في currencyService
  rates: {},
  currencies: [],
  activeCurrencies: [],
  loading: true,
  queryState: asyncState.loading(),
  updatedAt: 0,
};

const _subscribers = new Set<() => void>();
let _initialized = false;
let _channelCurrency: RealtimeChannel | null = null;
let _channelCurPrice: RealtimeChannel | null = null;

function _notify() {
  _subscribers.forEach(cb => cb());
}

async function _refresh() {
  const result = await runQuery<ExchangeRatesData>(async () => {
    const [rates, currencies] = await Promise.all([
      currencyService.getLatestExchangeRates(),
      currencyService.getAllCurrencies(false),
    ]);
    return { rates, currencies, activeCurrencies: currencies.filter((currency) => currency.isActive) };
  }, (queryState) => {
    if (queryState.status === 'loading') _state = { ..._state, loading: true, queryState };
  }, (data) => Object.keys(data.rates).length === 0 && data.currencies.length === 0);

  if (result.status === 'success') {
    _state = { ...result.data, loading: false, queryState: result, updatedAt: Date.now() };
  } else if (result.status === 'empty') {
    _state = { rates: {}, currencies: [], activeCurrencies: [], loading: false, queryState: result, updatedAt: Date.now() };
  } else if (result.status === 'error') {
    _state = { ..._state, loading: false, queryState: result, updatedAt: Date.now() };
  }
  _notify();
}

function _initSingleton() {
  if (_initialized) return;
  _initialized = true;

  // Initial load
  _refresh();

  // Safely remove any existing channel instances (e.g. from HMR reloads)
  if (_channelCurrency) {
    try { void realtimeClient.removeChannel(_channelCurrency); } catch (_) { }
    _channelCurrency = null;
  }
  if (_channelCurPrice) {
    try { void realtimeClient.removeChannel(_channelCurPrice); } catch (_) { }
    _channelCurPrice = null;
  }

  // Real-time: subscribe to currency table changes
  try {
    const currencyChannelId = `currency_realtime_${Math.random().toString(36).substring(2, 8)}`;
    _channelCurrency = realtimeClient
      .channel(currencyChannelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'currency' }, () => {
        _refresh();
      })
      .subscribe();
  } catch (err) {
    console.warn('[useExchangeRates] currency channel subscription warning:', err);
  }

  // Real-time: subscribe to cur_price table changes
  try {
    const curPriceChannelId = `cur_price_realtime_${Math.random().toString(36).substring(2, 8)}`;
    _channelCurPrice = realtimeClient
      .channel(curPriceChannelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cur_price' }, () => {
        _refresh();
      })
      .subscribe();
  } catch (err) {
    console.warn('[useExchangeRates] cur_price channel subscription warning:', err);
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useExchangeRates() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    _initSingleton();

    const cb = () => forceUpdate(n => n + 1);
    _subscribers.add(cb);
    return () => {
      _subscribers.delete(cb);
    };
  }, []);

  return _state;
}

/**
 * Convenience: returns only the rates map synchronously from the singleton.
 * Use inside non-reactive code that already called useExchangeRates() higher up.
 */
export function getLatestRatesSync(): ExchangeRates {
  return _state.rates;
}

export type { ExchangeRates, Currency };
export default useExchangeRates;
