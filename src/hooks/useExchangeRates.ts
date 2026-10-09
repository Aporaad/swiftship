/**
 * useExchangeRates
 * ─────────────────────────────────────────────────────────────────────────────
 * Singleton hook يُجلب أسعار الصرف والعملات من API بدلاً من Supabase realtime.
 *
 * يُعيد:
 *   - `rates`            — خريطة أسعار الصرف: { [code]: priceVsBase }
 *   - `currencies`       — قائمة العملات الكاملة (نشطة وغير نشطة)
 *   - `activeCurrencies` — العملات النشطة فقط
 *   - `loading`          — true أثناء التحميل الأولي
 *
 * Singleton hook that fetches exchange rates and currencies from API.
 * No Supabase realtime — uses polling instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { currencyService } from '../services/currencyService';
import type { Currency, ExchangeRates } from '../services/currencyService';
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

// فترة إعادة التحميل بالمللي ثانية (3 دقائق)
// Polling interval: 3 minutes
const POLL_INTERVAL_MS = 3 * 60 * 1000;

let _state: ExchangeRatesState = {
  // الحالة الأولية: خريطة فارغة — ستُملأ من API فور الاتصال
  // Initial state: empty map — will be filled from API on first call
  rates: {},
  currencies: [],
  activeCurrencies: [],
  loading: true,
  queryState: asyncState.loading(),
  updatedAt: 0,
};

const _subscribers = new Set<() => void>();
let _initialized = false;
let _pollTimer: ReturnType<typeof setInterval> | null = null;

function _notify() {
  _subscribers.forEach(cb => cb());
}

async function _refresh() {
  const result = await runQuery<ExchangeRatesData>(
    async () => {
      const [rates, currencies] = await Promise.all([
        currencyService.getLatestExchangeRates(),
        currencyService.getAllCurrencies(false),
      ]);
      return {
        rates,
        currencies,
        activeCurrencies: currencies.filter(c => c.isActive || c.is_active),
      };
    },
    (queryState) => {
      if (queryState.status === 'loading') _state = { ..._state, loading: true, queryState };
    },
    (data) => Object.keys(data.rates).length === 0 && data.currencies.length === 0
  );

  if (result.status === 'success') {
    _state = { ...result.data, loading: false, queryState: result, updatedAt: Date.now() };
  } else if (result.status === 'empty') {
    _state = { rates: {}, currencies: [], activeCurrencies: [], loading: false, queryState: result, updatedAt: Date.now() };
  } else if (result.status === 'error') {
    _state = { ..._state, loading: false, queryState: result, updatedAt: Date.now() };
  }
  _notify();
}

/**
 * تهيئة Singleton: التحميل الأولي وإعداد polling بدلاً من Supabase realtime
 * Initialize singleton: initial load + polling instead of Supabase realtime
 */
function _initSingleton() {
  if (_initialized) return;
  _initialized = true;

  // التحميل الأولي / Initial load
  void _refresh();

  // إعداد polling دوري / Setup periodic polling
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(() => void _refresh(), POLL_INTERVAL_MS);
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
 * دالة مساعدة: تُعيد خريطة الأسعار الحالية بشكل متزامن.
 * Convenience: returns current rates map synchronously from singleton.
 */
export function getLatestRatesSync(): ExchangeRates {
  return _state.rates;
}

export type { ExchangeRates, Currency };
export default useExchangeRates;
