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
import { supabase } from '../lib/supabase-firebase-adapter';
import { currencyService, Currency, ExchangeRates, DEFAULT_RATES } from '../services/currencyService';

// ── Singleton State ───────────────────────────────────────────────────────────

interface ExchangeRatesState {
  rates: ExchangeRates;
  currencies: Currency[];
  activeCurrencies: Currency[];
  loading: boolean;
  updatedAt: number;
}

let _state: ExchangeRatesState = {
  // الحالة الأولية: خريطة فارغة — ستُملأ من DB فور الاتصال
  // DEFAULT_RATES تُستخدم فقط كـ emergency fallback في currencyService
  rates: {},
  currencies: [],
  activeCurrencies: [],
  loading: true,
  updatedAt: 0,
};

const _subscribers = new Set<() => void>();
let _initialized = false;
let _channelCurrency: any = null;
let _channelCurPrice: any = null;

function _notify() {
  _subscribers.forEach(cb => cb());
}

async function _refresh() {
  try {
    const [rates, allCurrencies] = await Promise.all([
      currencyService.getLatestExchangeRates(),
      currencyService.getAllCurrencies(false),
    ]);

    _state = {
      rates,
      currencies: allCurrencies,
      activeCurrencies: allCurrencies.filter(c => c.isActive),
      loading: false,
      updatedAt: Date.now(),
    };
  } catch (e) {
    console.error('[useExchangeRates] refresh error:', e);
    _state = { ..._state, loading: false, updatedAt: Date.now() };
  }
  _notify();
}

function _initSingleton() {
  if (_initialized) return;
  _initialized = true;

  // Initial load
  _refresh();

  // Real-time: subscribe to currency table changes
  _channelCurrency = (supabase as any)
    .channel('currency_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'currency' }, () => {
      _refresh();
    })
    .subscribe();

  // Real-time: subscribe to cur_price table changes
  _channelCurPrice = (supabase as any)
    .channel('cur_price_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cur_price' }, () => {
      _refresh();
    })
    .subscribe();
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
