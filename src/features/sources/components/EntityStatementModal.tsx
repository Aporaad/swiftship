/**
 * EntityStatementModal.tsx
 * كشف حساب المصدر/شركة الشحن — تبويبتان: سجل الحركة (الطلبات التي تمت عبره) وكشف الحساب (القيود المالية المرحةّلة).
 * Source / carrier statement modal with two tabs: the order log (orders that flowed through this entity) and the
 * financial statement (posted ledger lines). All aggregation lives in entityLedgerService; this file renders only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpLeft, Boxes, Coins, Printer, Receipt, X } from 'lucide-react';
import { useSettings } from '../../../context/SettingsContext';
import { printContent } from '../../../lib/printUtils';
import {
  entityLedgerService,
  type EntityLedger,
  type EntityOrderLog,
  type OrderLogEntityType,
} from '../../../services/entityLedgerService';

type StatementTab = 'order_log' | 'ledger';

interface EntityStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: OrderLogEntityType;
  entityId: string;
  entityName: string;
}

const money = (value: number) => (Number.isFinite(value) ? value : 0).toLocaleString();

/** تاريخ مختصر بالعربية/الإنجليزية للسطر الواحد. */
function formatDate(value: number, isAr: boolean): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(isAr ? 'ar-YE' : 'en-US', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EntityStatementModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
}: EntityStatementModalProps) {
  const { settings } = useSettings();
  const isAr = settings.language === 'ar';

  const [activeTab, setActiveTab] = useState<StatementTab>('order_log');
  const [orderLog, setOrderLog] = useState<EntityOrderLog | null>(null);
  const [ledger, setLedger] = useState<EntityLedger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entityLabel = entityType === 'source'
    ? (isAr ? 'المصدر' : 'source')
    : (isAr ? 'شركة الشحن' : 'carrier');

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      // التبويبان من مصدرين مختلفين (الطلبات والقيود) ويُفتحان معًا حتى لا ينتظر المستخدم نقرة ثانية.
      // Both tabs come from different reads (orders vs. posted entries) and load together so no second click waits.
      const [nextOrderLog, nextLedger] = await Promise.all([
        entityLedgerService.loadOrderLog(entityType, entityId),
        entityLedgerService.loadLedger(entityType, entityId, entityName),
      ]);
      setOrderLog(nextOrderLog);
      setLedger(nextLedger);
    } catch (loadError) {
      setError(
        loadError instanceof Error && loadError.message
          ? loadError.message
          : isAr
            ? 'تعذر تحميل كشف الحساب.'
            : 'Unable to load the statement.',
      );
      setOrderLog(null);
      setLedger(null);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityName, entityType, isAr]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('order_log');
    void load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const currency = ledger?.party?.currency || settings.currency || 'YER';
  const orderLines = orderLog?.lines ?? [];
  const ledgerLines = ledger?.lines ?? [];
  const hasAccount = Boolean(ledger?.party?.accountId);

  const tabButton = (tab: StatementTab, label: string, Icon: React.ElementType) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all duration-300 flex items-center gap-2 ${
        activeTab === tab ? 'border-[#d4af37] text-white bg-[#d4af37]/5' : 'border-transparent text-slate-500 hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      <div className="bg-[#0b0b0d] border border-[#d4af37]/25 rounded-3xl shadow-2xl max-w-5xl w-full h-[88vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-black/40 p-5 border-b border-slate-850/80 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-[#d4af37]/20 text-[#d4af37] flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="text-start">
              <h2 className="text-sm font-black text-white uppercase tracking-wider leading-none">
                {ledger?.party?.name || entityName}
              </h2>
              <p className="text-[10px] text-[#d4af37] font-bold font-mono mt-1" dir="ltr">
                {isAr
                  ? `كشف ${entityLabel} • ${ledger?.party?.accountCode || entityId}`
                  : `${entityLabel === 'source' ? 'Source' : 'Carrier'} statement • ${ledger?.party?.accountCode || entityId}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 p-2 rounded-xl text-slate-500 hover:text-white border border-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800 px-4 shrink-0 bg-black/20">
          {tabButton('order_log', isAr ? 'سجل الحركة' : 'Order Log', Boxes)}
          {tabButton('ledger', isAr ? 'كشف الحساب' : 'Financial Statement', Coins)}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5" id="entity-statement-content">
          {error && (
            <div className="flex items-start gap-2 p-4 bg-rose-950/30 border border-rose-900/40 rounded-2xl text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-[11px] font-bold">{error}</span>
            </div>
          )}

          {loading && (
            <div className="p-16 text-center text-slate-500 font-bold font-mono uppercase tracking-wider animate-pulse">
              [ {isAr ? 'جاري جلب البيانات من الواجهة البرمجية...' : 'fetching from the api...'} ]
            </div>
          )}

          {!loading && activeTab === 'order_log' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {[
                  { label: isAr ? 'عدد الطلبات' : 'Orders', value: money(orderLog?.totals.orders ?? 0), tone: 'text-white' },
                  { label: isAr ? 'إجمالي القيم' : 'Gross value', value: money(orderLog?.totals.total ?? 0), tone: 'text-[#d4af37]' },
                  { label: isAr ? 'المسدد' : 'Paid', value: money(orderLog?.totals.paid ?? 0), tone: 'text-emerald-400' },
                  { label: isAr ? 'المتبقي' : 'Outstanding', value: money(orderLog?.totals.remaining ?? 0), tone: 'text-rose-400' },
                ].map((metric) => (
                  <div key={metric.label} className="bg-[#121215] border border-slate-850 rounded-2xl p-4 text-start">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{metric.label}</span>
                    <div className={`font-mono font-black text-base mt-1 ${metric.tone}`}>
                      {metric.value} <span className="text-[10px]">{currency}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-black/30 text-[9px] text-slate-500 uppercase tracking-widest font-black border-b border-slate-850">
                      <tr>
                        <th className="p-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                        <th className="p-3 text-start">{isAr ? 'رقم الطلب' : 'Order'}</th>
                        <th className="p-3 text-start">{isAr ? 'التتبع' : 'Tracking'}</th>
                        <th className="p-3 text-start">{isAr ? 'العميل' : 'Customer'}</th>
                        <th className="p-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                        <th className="p-3 text-start">{isAr ? 'الإجمالي' : 'Total'}</th>
                        <th className="p-3 text-start">{isAr ? 'المسدد' : 'Paid'}</th>
                        <th className="p-3 text-left">{isAr ? 'المتبقي' : 'Outstanding'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 bg-[#08080a]/20">
                      {orderLines.map((line) => (
                        <tr key={line.id} className="hover:bg-slate-950/40 transition-colors">
                          <td className="p-3 font-mono font-bold text-[10px] text-slate-400 text-start" dir="ltr">
                            {formatDate(line.date, isAr)}
                          </td>
                          <td className="p-3 font-mono text-[10px] text-[#d4af37] font-black text-start">{line.orderNumber || '—'}</td>
                          <td className="p-3 font-mono text-[10px] text-slate-400 text-start" dir="ltr">{line.trackingNumber || '—'}</td>
                          <td className="p-3 font-bold text-white text-start">{line.customerName || '—'}</td>
                          <td className="p-3 text-start">
                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-950/40 text-indigo-400 border border-indigo-900/20">
                              {isAr
                                ? line.statusNameAr || line.statusNameEn || line.status || '—'
                                : line.statusNameEn || line.statusNameAr || line.status || '—'}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-white text-start">
                            {money(line.total)} <span className="text-[9px] text-slate-500">{line.currency}</span>
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-400 text-start">{money(line.paid)}</td>
                          <td className="p-3 font-mono font-black text-rose-400 text-left">{money(line.remaining)}</td>
                        </tr>
                      ))}
                      {orderLines.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-16 text-center text-slate-500 italic font-bold">
                            {isAr
                              ? '[ لا توجد طلبات مسجلة عبر هذا العنصر ]'
                              : '[ NO ORDERS RECORDED THROUGH THIS ENTITY ]'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'ledger' && (
            <div className="space-y-4">
              {!hasAccount && (
                <div className="flex items-start gap-2 p-4 bg-amber-950/25 border border-amber-900/40 rounded-2xl text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-bold">
                    {isAr ? 'لا يملك هذا العنصر حسابًا ماليًا بعد — الكشف يظهر بعد إنشاء الحساب.' : 'This entity has no financial account yet — the statement appears once the account exists.'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-[#02130a] to-[#041a10] border border-emerald-500/20 rounded-2xl p-4 text-start">
                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">{isAr ? 'رصيد الحساب' : 'Account balance'}</span>
                  <div className="font-mono font-black text-emerald-400 text-base mt-1">
                    {money(ledger?.party?.balance ?? 0)} {currency}
                  </div>
                  <span className="text-[8.5px] text-slate-500 mt-1 block">
                    {ledger?.party?.accountCode || (isAr ? 'بدون رمز حساب' : 'No account code')}
                  </span>
                </div>
                <div className="bg-[#121215] border border-slate-850 rounded-2xl p-4 text-start">
                  <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    {isAr ? 'مجموع المدين' : 'Total debits'}
                  </span>
                  <div className="font-mono font-black text-rose-400 text-base mt-1">
                    {money(ledger?.totals.debits ?? 0)} {currency}
                  </div>
                </div>
                <div className="bg-[#121215] border border-slate-850 rounded-2xl p-4 text-start">
                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                    <ArrowUpLeft className="w-3.5 h-3.5" />
                    {isAr ? 'مجموع الدائن' : 'Total credits'}
                  </span>
                  <div className="font-mono font-black text-emerald-400 text-base mt-1">
                    {money(ledger?.totals.credits ?? 0)} {currency}
                  </div>
                </div>
              </div>

              <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center text-start">
                  <h4 className="font-black text-xs text-emerald-400 uppercase tracking-wider">
                    {isAr ? 'القيود المرحّلة على حساب العنصر' : 'Posted entries on this account'}
                  </h4>
                  <span className="text-[10px] bg-emerald-950/25 text-emerald-400 border border-emerald-900/40 px-3 py-1 rounded-lg font-bold font-mono">
                    {isAr ? 'المرحّل فقط' : 'POSTED ONLY'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-black/30 text-[9px] text-slate-500 uppercase tracking-widest font-black border-b border-slate-850">
                      <tr>
                        <th className="p-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                        <th className="p-3 text-start">{isAr ? 'البيان' : 'Narrative'}</th>
                        <th className="p-3 text-start">{isAr ? 'رقم القيد' : 'Reference'}</th>
                        <th className="p-3 text-start">{isAr ? 'النوع' : 'Type'}</th>
                        <th className="p-3 text-start">{isAr ? 'المبلغ' : 'Amount'}</th>
                        <th className="p-3 text-left">{isAr ? 'الرصيد التراكمي' : 'Running balance'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 bg-[#08080a]/20">
                      {ledgerLines.map((line) => {
                        const isCredit = line.type === 'Credit';
                        return (
                          <tr key={line.id} className="hover:bg-slate-950/40 transition-colors">
                            <td className="p-3 font-mono font-bold text-[10px] text-slate-400 text-start" dir="ltr">
                              {formatDate(line.date, isAr)}
                            </td>
                            <td className="p-3 font-bold text-white text-start">
                              <div className="text-xs">{line.note || (isCredit ? (isAr ? 'إيداع للحساب' : 'Account deposit') : (isAr ? 'سحب من الحساب' : 'Account withdrawal'))}</div>
                              <div className="text-[9px] text-slate-500 mt-0.5">{isAr ? 'قيد مركزي' : 'Main entry'}</div>
                            </td>
                            <td className="p-3 font-mono text-[10px] text-[#d4af37] font-black text-start">{line.ref || '—'}</td>
                            <td className="p-3 text-start">
                              <span className={`text-[9px] px-2.5 py-0.5 rounded-xl font-black border ${
                                isCredit
                                  ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30'
                                  : 'bg-rose-950/20 text-rose-400 border-rose-900/30'
                              }`}>
                                {isCredit ? (isAr ? 'دائن (+)' : 'Credit (+)') : (isAr ? 'مدين (-)' : 'Debit (-)')}
                              </span>
                            </td>
                            <td className={`p-3 font-mono font-black text-xs text-start ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isCredit ? '+' : '-'}{money(line.amount)} {currency}
                            </td>
                            <td className={`p-3 text-left font-mono font-black text-xs ${line.runningBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {money(line.runningBalance)} {currency}
                            </td>
                          </tr>
                        );
                      })}
                      {ledgerLines.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-16 text-center text-slate-500 italic font-bold">
                            {isAr
                              ? '[ لا توجد قيود مرحّلة على هذا الحساب ]'
                              : '[ NO POSTED ENTRIES ON THIS ACCOUNT ]'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/40 border-t border-slate-850 flex justify-between items-center shrink-0">
          <div className="text-[9px] font-mono text-slate-500 uppercase select-none">
            {isAr ? 'بيانات مباشرة من واجهة برمجة التطبيق' : 'LIVE DATA FROM THE APPLICATION API'}
          </div>
          <button
            onClick={() => printContent(isAr ? `كشف ${entityLabel} - ${entityName}` : `${entityLabel} statement`, 'entity-statement-content', isAr)}
            className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black rounded-xl font-black text-xs transition-all flex items-center gap-2 active:scale-95"
          >
            <Printer className="w-4 h-4" />
            {isAr ? 'طباعة' : 'Print'}
          </button>
        </div>
      </div>
    </div>
  );
}
