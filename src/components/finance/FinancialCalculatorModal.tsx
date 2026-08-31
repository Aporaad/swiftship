/**
 * FinancialCalculatorModal.tsx — نافذة الآلة الحاسبة والمصارفة التفاعلية
 * Interactive Financial Calculator & Currency Exchange Modal
 *
 * تتضمن تبويبتين:
 * 1. حاسبة (Calculator): عمليات حسابية أساسية (+, -, ×, ÷, %, ±, C, CE) مع دعم لوحة المفاتيح والنسخ.
 * 2. مصارفة (Currency Exchange): تحويل مبالغ بين جميع عملات النظام المتاحة بناءً على أسعار الصرف المعتمدة.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator,
  ArrowRightLeft,
  X,
  Copy,
  Check,
  Percent,
  Plus,
  Minus,
  Divide,
  RotateCcw,
  Banknote,
  Sparkles,
} from 'lucide-react';
import { currencyService, type ExchangeRates } from '../../services/currencyService';

export interface FinanceCurrencyOption {
  id: number;
  code: string;
  isDefault?: boolean;
}

interface FinancialCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencies?: FinanceCurrencyOption[];
  initialTab?: 'calc' | 'exchange';
}

export default function FinancialCalculatorModal({
  isOpen,
  onClose,
  currencies = [],
  initialTab = 'calc',
}: FinancialCalculatorModalProps) {
  const [activeTab, setActiveTab] = useState<'calc' | 'exchange'>(initialTab);

  // ─────────────────────────────────────────────────────────
  // حالة الحاسبة (Tab 1: Calculator State)
  // ─────────────────────────────────────────────────────────
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcEquation, setCalcEquation] = useState('');
  const [prevVal, setPrevVal] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const [copiedCalc, setCopiedCalc] = useState(false);

  // ─────────────────────────────────────────────────────────
  // حالة المصارفة (Tab 2: Exchange State)
  // ─────────────────────────────────────────────────────────
  const [exchangeAmount, setExchangeAmount] = useState('1000');
  const [fromCurrencyCode, setFromCurrencyCode] = useState<string>('USD');
  const [toCurrencyCode, setToCurrencyCode] = useState<string>('YER');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({});
  const [loadingRates, setLoadingRates] = useState(false);
  const [copiedExchange, setCopiedExchange] = useState(false);

  // ─────────────────────────────────────────────────────────
  // جلب أسعار الصرف الديناميكية
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    const fetchRates = async () => {
      setLoadingRates(true);
      try {
        const rates = await currencyService.getLatestExchangeRates();
        if (mounted) {
          setExchangeRates(rates);
          // ضبط العملات الافتراضية إن وجدت
          const codes = Object.keys(rates);
          if (codes.length >= 2) {
            if (!codes.includes(fromCurrencyCode)) setFromCurrencyCode(codes[0]);
            if (!codes.includes(toCurrencyCode)) setToCurrencyCode(codes[1] || codes[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load exchange rates in calculator:', err);
      } finally {
        if (mounted) setLoadingRates(false);
      }
    };
    fetchRates();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // ─────────────────────────────────────────────────────────
  // منطق الحاسبة
  // ─────────────────────────────────────────────────────────
  const handleDigit = useCallback((digit: string) => {
    setCalcDisplay((prev) => {
      if (waitingForNext) {
        setWaitingForNext(false);
        return digit === '.' ? '0.' : digit;
      }
      if (digit === '.') {
        if (prev.includes('.')) return prev;
        return prev + '.';
      }
      if (prev === '0') return digit;
      if (prev.length >= 15) return prev; // حد أقصى للأرقام
      return prev + digit;
    });
  }, [waitingForNext]);

  const executeOperation = (prev: number, current: number, op: string): number => {
    switch (op) {
      case '+': return prev + current;
      case '-': return prev - current;
      case '×': return prev * current;
      case '÷': return current !== 0 ? prev / current : 0;
      default: return current;
    }
  };

  const handleOp = useCallback((op: string) => {
    const currentNum = parseFloat(calcDisplay);
    if (prevVal === null) {
      setPrevVal(currentNum);
      setCalcEquation(`${currentNum} ${op}`);
    } else if (operation && !waitingForNext) {
      const result = executeOperation(prevVal, currentNum, operation);
      setPrevVal(result);
      setCalcDisplay(String(result));
      setCalcEquation(`${result} ${op}`);
    } else {
      setCalcEquation(`${prevVal} ${op}`);
    }
    setOperation(op);
    setWaitingForNext(true);
  }, [calcDisplay, prevVal, operation, waitingForNext]);

  const handleEquals = useCallback(() => {
    if (prevVal === null || !operation) return;
    const currentNum = parseFloat(calcDisplay);
    const result = executeOperation(prevVal, currentNum, operation);
    
    // تنسيق النتيجة لمنع أخطاء الكسور المفرطة
    const formattedResult = Number(result.toFixed(6));
    setCalcDisplay(String(formattedResult));
    setCalcEquation(`${prevVal} ${operation} ${currentNum} =`);
    setPrevVal(null);
    setOperation(null);
    setWaitingForNext(true);
  }, [calcDisplay, prevVal, operation]);

  const handleClearAll = useCallback(() => {
    setCalcDisplay('0');
    setCalcEquation('');
    setPrevVal(null);
    setOperation(null);
    setWaitingForNext(false);
  }, []);

  const handleClearEntry = useCallback(() => {
    setCalcDisplay('0');
  }, []);

  const handleBackspace = useCallback(() => {
    if (waitingForNext) return;
    setCalcDisplay((prev) => {
      if (prev.length <= 1 || (prev.length === 2 && prev.startsWith('-'))) return '0';
      return prev.slice(0, -1);
    });
  }, [waitingForNext]);

  const handleToggleSign = useCallback(() => {
    setCalcDisplay((prev) => {
      const num = parseFloat(prev);
      return String(-num);
    });
  }, []);

  const handlePercent = useCallback(() => {
    setCalcDisplay((prev) => {
      const num = parseFloat(prev);
      return String(num / 100);
    });
  }, []);

  // دعم لوحة المفاتيح
  useEffect(() => {
    if (!isOpen || activeTab !== 'calc') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === '.') {
        handleDigit('.');
      } else if (e.key === '+') {
        handleOp('+');
      } else if (e.key === '-') {
        handleOp('-');
      } else if (e.key === '*') {
        handleOp('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOp('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, handleDigit, handleOp, handleEquals, handleBackspace, onClose]);

  const copyToClipboard = (text: string, type: 'calc' | 'exchange') => {
    navigator.clipboard.writeText(text);
    if (type === 'calc') {
      setCopiedCalc(true);
      setTimeout(() => setCopiedCalc(false), 2000);
    } else {
      setCopiedExchange(true);
      setTimeout(() => setCopiedExchange(false), 2000);
    }
  };

  // ─────────────────────────────────────────────────────────
  // منطق المصارفة
  // ─────────────────────────────────────────────────────────
  const handleSwapCurrencies = () => {
    const temp = fromCurrencyCode;
    setFromCurrencyCode(toCurrencyCode);
    setToCurrencyCode(temp);
  };

  if (!isOpen) return null;

  const getAvailableCurrencyCodes = (): string[] => {
    const fromRates = Object.keys(exchangeRates || {});
    if (fromRates.length > 0) return fromRates;
    if (Array.isArray(currencies) && currencies.length > 0) {
      return currencies.map((c) => c?.code).filter(Boolean) as string[];
    }
    return ['YER', 'SAR', 'USD'];
  };

  const availableCodes = getAvailableCurrencyCodes();

  // كم وحدة أساس تساوي 1 وحدة من العملة
  const rateFromBase = exchangeRates[fromCurrencyCode] ?? 1;
  const rateToBase = exchangeRates[toCurrencyCode] ?? 1;

  const parsedAmount = parseFloat(exchangeAmount) || 0;
  // المعادلة: النتيجة = المبلغ * سعر العملة الأولى / سعر العملة الثانية
  const convertedResult =
    rateToBase > 0
      ? (parsedAmount * rateFromBase) / rateToBase
      : 0;

  const formattedConvertedResult = Number(convertedResult.toFixed(4)).toLocaleString('ar-EG', {
    maximumFractionDigits: 4,
  });

  const directRate = rateToBase > 0 ? rateFromBase / rateToBase : 0;
  const formattedDirectRate = Number(directRate.toFixed(6));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      {/* خلفية معتّمة بدقة عالية */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* المودال */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-950 shadow-2xl transition-all duration-300 ring-1 ring-slate-800">
        {/* رأس المودال مع التبويبات */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('calc')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${
                activeTab === 'calc'
                  ? 'bg-[#d4af37] text-slate-950 shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Calculator className="h-4 w-4" />
              <span>الحاسبة</span>
            </button>

            <button
              onClick={() => setActiveTab('exchange')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${
                activeTab === 'exchange'
                  ? 'bg-[#d4af37] text-slate-950 shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span>المصارفة وتحويل العملات</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* محتوى التبويبة الأولى: الحاسبة */}
        {activeTab === 'calc' && (
          <div className="p-5 space-y-4">
            {/* شاشة العرض */}
            <div className="relative rounded-2xl border border-slate-800 bg-slate-900/90 p-4 text-left shadow-inner">
              <div className="min-h-5 text-xs font-mono text-slate-400 truncate dir-ltr">
                {calcEquation || '\u00A0'}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 dir-ltr">
                <button
                  onClick={() => copyToClipboard(calcDisplay, 'calc')}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-[#f4d870] transition shrink-0"
                  title="نسخ النتيجة"
                >
                  {copiedCalc ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
                <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-wider truncate">
                  {calcDisplay}
                </div>
              </div>
            </div>

            {/* لوحة الأزرار */}
            <div className="grid grid-cols-4 gap-2 text-sm font-bold">
              {/* الصف الأول */}
              <button
                onClick={handleClearAll}
                className="rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 p-3.5 transition active:scale-95"
              >
                C
              </button>
              <button
                onClick={handleClearEntry}
                className="rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 p-3.5 transition active:scale-95"
              >
                CE
              </button>
              <button
                onClick={handlePercent}
                className="rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 p-3.5 flex items-center justify-center transition active:scale-95"
              >
                <Percent className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleOp('÷')}
                className={`rounded-xl p-3.5 flex items-center justify-center transition active:scale-95 ${
                  operation === '÷' ? 'bg-[#d4af37] text-slate-950' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                }`}
              >
                <Divide className="h-4 w-4" />
              </button>

              {/* الصف الثاني */}
              <button
                onClick={() => handleDigit('7')}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 p-3.5 font-mono text-lg transition active:scale-95"
              >
                7
              </button>
              <button
                onClick={() => handleDigit('8')}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 p-3.5 font-mono text-lg transition active:scale-95"
              >
                8
              </button>
              <button
                onClick={() => handleDigit('9')}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 p-3.5 font-mono text-lg transition active:scale-95"
              >
                9
              </button>
              <button
                onClick={() => handleOp('×')}
                className={`rounded-xl p-3.5 flex items-center justify-center transition active:scale-95 ${
                  operation === '×' ? 'bg-[#d4af37] text-slate-950' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                }`}
              >
                ×
              </button>

              {/* الصف الثالث */}
              <button
                onClick={() => handleDigit('4')}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 p-3.5 font-mono text-lg transition active:scale-95"
              >
                4
              </button>
              <button
                onClick={() => handleDigit('5')}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 p-3.5 font-mono text-lg transition active:scale-95"
              >
                5
              </button>
              <button
                onClick={() => handleDigit('6')}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 p-3.5 font-mono text-lg transition active:scale-95"
              >
                6
              </button>
              <button
                onClick={() => handleOp('-')}
                className={`rounded-xl p-3.5 flex items-center justify-center transition active:scale-95 ${
                  operation === '-' ? 'bg-[#d4af37] text-slate-950' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                }`}
              >
                <Minus className="h-4 w-4" />
              </button>

              {/* الصف الرابع */}
              <button
                onClick={() => handleDigit('1')}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 p-3.5 font-mono text-lg transition active:scale-95"
              >
                1
              </button>
              <button
                onClick={() => handleDigit('2')}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 p-3.5 font-mono text-lg transition active:scale-95"
              >
                2
              </button>
              <button
                onClick={() => handleDigit('3')}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 p-3.5 font-mono text-lg transition active:scale-95"
              >
                3
              </button>
              <button
                onClick={() => handleOp('+')}
                className={`rounded-xl p-3.5 flex items-center justify-center transition active:scale-95 ${
                  operation === '+' ? 'bg-[#d4af37] text-slate-950' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                }`}
              >
                <Plus className="h-4 w-4" />
              </button>

              {/* الصف الخامس */}
              <button
                onClick={handleToggleSign}
                className="rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 p-3.5 transition active:scale-95"
              >
                ±
              </button>
              <button
                onClick={() => handleDigit('0')}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 p-3.5 font-mono text-lg transition active:scale-95"
              >
                0
              </button>
              <button
                onClick={() => handleDigit('.')}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 p-3.5 font-mono text-lg transition active:scale-95"
              >
                .
              </button>
              <button
                onClick={handleEquals}
                className="rounded-xl bg-[#d4af37] hover:bg-[#f4d870] text-slate-950 p-3.5 font-black text-xl flex items-center justify-center shadow-lg transition active:scale-95"
              >
                =
              </button>
            </div>
          </div>
        )}

        {/* محتوى التبويبة الثانية: المصارفة وتحويل العملات */}
        {activeTab === 'exchange' && (
          <div className="p-5 space-y-5">
            {/* إدخال المبلغ */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400">
                المبلغ المراد تحويله
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={exchangeAmount}
                  onChange={(e) => setExchangeAmount(e.target.value)}
                  placeholder="أدخل المبلغ..."
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 py-3 pr-4 pl-10 text-base font-black font-mono text-white focus:border-[#d4af37]/60 focus:outline-none"
                />
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              </div>
            </div>

            {/* اختيار العملات والتبديل */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              {/* العملة من */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400">
                  من عملة
                </label>
                <select
                  value={fromCurrencyCode}
                  onChange={(e) => setFromCurrencyCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs font-black text-white focus:border-[#d4af37]/60 focus:outline-none"
                >
                  {availableCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>

              {/* زر التبديل ⇄ */}
              <div className="pt-6">
                <button
                  type="button"
                  onClick={handleSwapCurrencies}
                  className="rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-slate-300 hover:bg-slate-700 hover:text-[#f4d870] transition active:scale-95"
                  title="تبديل الاتجاه"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </button>
              </div>

              {/* العملة إلى */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400">
                  إلى عملة
                </label>
                <select
                  value={toCurrencyCode}
                  onChange={(e) => setToCurrencyCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs font-black text-white focus:border-[#d4af37]/60 focus:outline-none"
                >
                  {availableCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* نتيجة التحويل والمصارفة */}
            <div className="rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-4 space-y-2 text-center">
              <div className="text-xs font-bold text-slate-400">
                النتيجة المحولة
              </div>

              <div className="flex items-center justify-center gap-2">
                <div className="text-2xl sm:text-3xl font-black font-mono text-[#f4d870]">
                  {formattedConvertedResult}
                </div>
                <div className="text-xs font-black text-white bg-slate-900/60 px-2.5 py-1 rounded-lg border border-[#d4af37]/20">
                  {toCurrencyCode}
                </div>

                <button
                  onClick={() => copyToClipboard(String(convertedResult), 'exchange')}
                  className="mr-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-[#f4d870] transition"
                  title="نسخ المبلغ المحول"
                >
                  {copiedExchange ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* تفاصيل سعر الصرف المعتمد */}
              <div className="pt-2 border-t border-[#d4af37]/20 text-[11px] text-slate-300 font-mono flex items-center justify-between">
                <span>سعر الصرف المعتمد:</span>
                <span className="font-bold text-[#f4d870]">
                  1 {fromCurrencyCode} = {formattedDirectRate} {toCurrencyCode}
                </span>
              </div>
            </div>

            {loadingRates && (
              <div className="text-center text-xs font-bold text-slate-500">
                جارٍ تحديث أسعار الصرف الرسمية من النظام...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
