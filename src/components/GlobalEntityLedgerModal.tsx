/**
 * GlobalEntityLedgerModal.tsx
 * نافذة كشف حساب الكيان — عرض فقط؛ كل التجميع والحساب في entityLedgerService عبر alx_api.
 * Entity ledger modal — presentation only; all aggregation and balance math lives in entityLedgerService (API-only).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import {
  entityLedgerService,
  type EntityLedger,
  type LedgerEntityType,
  type LedgerLine,
  type LedgerLineKind,
} from '../services/entityLedgerService';
import {
  X,
  Printer,
  Coins,
  Search,
  Crown,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpLeft,
} from 'lucide-react';
import { printContent } from '../lib/printUtils';

/** فلتر الواجهة يجمع تصنيفات تشغيلية متعددة (العُةدة والمصروفات والأجور تُعرض كـ«مسحوبات»). */
type ModuleFilter = 'all' | 'order' | 'payment' | 'expense' | 'transaction';

const FILTER_CATEGORIES: Record<Exclude<ModuleFilter, 'all'>, LedgerLine['category'][]> = {
  order: ['order'],
  payment: ['payment'],
  expense: ['custody', 'expense', 'wage'],
  transaction: ['transaction'],
};

/** ترجمة نصية لسطر الكشف؛ الخدمة تحسم المبلغ والاتجاه والواجهة تشرح المعنى فقط. */
function lineLabels(line: LedgerLine, isAr: boolean): { title: string; description: string } {
  const ref = line.ref || (isAr ? 'بدون مرجع' : 'NO-REF');
  const labels: Record<LedgerLineKind, { ar: [string, string]; en: [string, string] }> = {
    order_charge: {
      ar: ['قيمة مبيعات / رسوم شحن', `قيمة الشحنة الموكلة رقم: ${ref}`],
      en: ['Sales COD Charge', `Gross COD for shipment #${ref}`],
    },
    unrecorded_payment: {
      ar: ['مقبوضات شحن مبدئية / غير مقيدة', `كاش سدد مسبقاً للشحنة رقم: ${ref} ولم يُقيد بسند منفصل`],
      en: ['Initial COD Payment', `Cash paid for shipment #${ref} without a separate voucher`],
    },
    custody_handover: {
      ar: ['تسليم عهدة مالية للمندوب', `عهدة مسلمة برقم القيد: ${ref}`],
      en: ['Custody Handed Over', `Custody entry ref: ${ref}`],
    },
    custody_settlement: {
      ar: ['تسوية وسداد عهدة مالية', `تسوية عهدة برقم القيد: ${ref}`],
      en: ['Custody Settlement / Return', `Custody settled on entry ref: ${ref}`],
    },
    order_collected: {
      ar: ['تحصيل قيمة شحنة (كاش بعهدة المندوب)', `تحصيل عن الشحنة برقم القيد: ${ref}`],
      en: ['Collected COD Cargo Cash', `COD collected on entry ref: ${ref}`],
    },
    order_commission: {
      ar: ['أجور توصيل وعمولة المندوب للطلب', `عمولة مستحقة برقم القيد: ${ref}`],
      en: ['Earned Courier Delivery Commission', `Commission earned on entry ref: ${ref}`],
    },
    expense_disbursed: {
      ar: ['مصروف تشغيلي / أجور مسددة', `صرف مسدد برقم القيد: ${ref}`],
      en: ['Operating Expense / Disbursed', `Disbursement entry ref: ${ref}`],
    },
    wage_paid: {
      ar: ['صرف راتب أو مستحقات الموظف', `راتب مصروف برقم القيد: ${ref}`],
      en: ['Salary / Wages Paid', `Salary payment entry ref: ${ref}`],
    },
    generic: {
      ar: [
        line.note || (line.type === 'Credit' ? 'إيداع نقدي للحساب' : 'سحب / تسوية من الحساب'),
        `قيد مالي مركزي رقم: ${ref}`,
      ],
      en: [
        line.note || (line.type === 'Credit' ? 'Account Deposit' : 'Account Withdrawal'),
        `Main entry ref: ${ref}`,
      ],
    },
  };

  const [title, description] = labels[line.kind][isAr ? 'ar' : 'en'];
  return { title, description };
}

export default function GlobalEntityLedgerModal() {
  const { settings } = useSettings();
  const isAr = settings.language === 'ar';

  const [isOpen, setIsOpen] = useState(false);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<LedgerEntityType | null>(null);

  const [ledger, setLedger] = useState<EntityLedger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finSearch, setFinSearch] = useState('');
  const [finModuleFilter, setFinModuleFilter] = useState<ModuleFilter>('all');

  // مستمع الفتح العام — يفرض أن يكون الكيان عميلاً أو مندوباً فقط.
  // Global open listener — only customers and couriers own a statement here.
  useEffect(() => {
    const handleOpen = (event: Event) => {
      const { entityId: id, entityType: type } = (event as CustomEvent).detail || {};
      if (!id || (type !== 'customer' && type !== 'courier')) return;
      setEntityId(String(id));
      setEntityType(type);
      setLedger(null);
      setError(null);
      setFinSearch('');
      setFinModuleFilter('all');
      setIsOpen(true);
    };

    window.addEventListener('open-entity-ledger', handleOpen);
    return () => window.removeEventListener('open-entity-ledger', handleOpen);
  }, []);

  const loadLedger = useCallback(
    async (type: LedgerEntityType, id: string) => {
      setLoading(true);
      setError(null);
      try {
        setLedger(await entityLedgerService.loadLedger(type, id));
      } catch (loadError) {
        // الفشل يُعرض للمستخدم بدل إخفائه بكشف فارغ يوحي بصحة البيانات.
        // Surface failures instead of showing an empty statement that looks correct.
        setError(
          loadError instanceof Error && loadError.message
            ? loadError.message
            : isAr
              ? 'تعذر تحميل كشف الحساب.'
              : 'Unable to load the statement.',
        );
        setLedger(null);
      } finally {
        setLoading(false);
      }
    },
    [isAr],
  );

  useEffect(() => {
    if (!isOpen || !entityId || !entityType) return;
    loadLedger(entityType, entityId);
  }, [isOpen, entityId, entityType, loadLedger]);

  if (!isOpen || !entityType || !entityId) return null;

  const party = ledger?.party;
  const lines = ledger?.lines ?? [];
  const debits = ledger?.totals.debits ?? 0;
  const credits = ledger?.totals.credits ?? 0;
  const currency = settings.currency || 'YER';

  const visibleLines = lines.filter((line) => {
    const query = finSearch.trim().toLowerCase();
    const labels = lineLabels(line, isAr);
    const matchesSearch =
      !query ||
      labels.title.toLowerCase().includes(query) ||
      labels.description.toLowerCase().includes(query) ||
      line.note.toLowerCase().includes(query) ||
      line.ref.toLowerCase().includes(query);
    const matchesModule =
      finModuleFilter === 'all' || FILTER_CATEGORIES[finModuleFilter].includes(line.category);
    return matchesSearch && matchesModule;
  });

  const classificationLabel = (category: LedgerLine['category']) =>
    category === 'order'
      ? isAr
        ? 'شحنة/توصيل'
        : 'Shipment COD'
      : category === 'custody'
        ? isAr
          ? 'عهدة'
          : 'Custody'
        : category === 'expense'
          ? isAr
            ? 'مصروف/أجور'
            : 'Disbursed'
          : category === 'wage'
            ? isAr
              ? 'رواتب'
              : 'Salaries'
            : category === 'payment'
              ? isAr
                ? 'كاش مسدد'
                : 'COD Settled'
              : isAr
                ? 'تسوية مركزية'
                : 'Main Entry';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      <div className="bg-[#0b0b0d] border border-[#d4af37]/25 rounded-3xl shadow-2xl max-w-4xl w-full h-[88vh] overflow-hidden flex flex-col relative">
        {/* Modal Header */}
        <div className="bg-black/40 p-5 border-b border-slate-850/80 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-[#d4af37]/20 text-[#d4af37] flex items-center justify-center font-black text-base shadow-inner">
              {party?.name ? party.name.substring(0, 2) : '?'}
            </div>
            <div className="text-start">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5 leading-none">
                {party?.name || (isAr ? 'حساب مالي معلق' : 'Loading Entity...')}
                <Crown className="w-4 h-4 text-[#d4af37] animate-pulse" />
              </h2>
              <p className="text-[10px] text-[#d4af37] font-bold font-mono mt-0.5" dir="ltr">
                {entityType === 'customer'
                  ? isAr
                    ? `كشف حساب عميل • ${party?.phone || entityId}`
                    : `Customer Statement • ${party?.phone || entityId}`
                  : isAr
                    ? `كشف حساب مندوب • ${party?.phone || entityId}`
                    : `Courier Statement • ${party?.phone || entityId}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="bg-slate-900 hover:bg-slate-850 p-2 rounded-xl text-slate-500 hover:text-white border border-slate-800 transition duration-200"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6" id="global-ledger-content">
          {error && (
            <div className="flex items-start gap-2 p-4 bg-rose-950/30 border border-rose-900/40 rounded-2xl text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-[11px] font-bold">{error}</span>
            </div>
          )}

          {/* Quick Metrics Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#02130a] to-[#041a10] border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between text-start shadow">
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                {isAr ? 'رصيد الحساب الموحد' : 'Consolidated Account Balance'}
              </span>
              <div className="font-mono font-black text-emerald-400 text-base">
                {(party?.balance ?? 0).toLocaleString()} {currency}
              </div>
              <span className="text-[8.5px] text-slate-500 font-sans mt-1">
                {isAr ? 'رصيد الحساب المالي من النظام المركزي' : 'Balance from the central accounting account'}
              </span>
            </div>

            <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between text-start shadow">
              <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5" />
                {isAr ? 'كل الحركات المدنية (-)' : 'Total Debits / Obligations'}
              </span>
              <div className="font-mono font-black text-rose-400 text-base">
                {debits.toLocaleString()} {currency}
              </div>
              <span className="text-[8.5px] text-slate-500 font-sans mt-1">
                {entityType === 'customer'
                  ? isAr
                    ? 'يشمل مبيعات ورسوم شحن معلقة'
                    : 'Includes shipments COD billed'
                  : isAr
                    ? 'يشمل عهد مستلمة وتحصيلات ميدانية'
                    : 'Includes custody received and collected COD'}
              </span>
            </div>

            <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between text-start shadow">
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <ArrowUpLeft className="w-3.5 h-3.5" />
                {isAr ? 'كل التوريدات الدائنية (+)' : 'Total Credits / Inflows'}
              </span>
              <div className="font-mono font-black text-emerald-400 text-base">
                {credits.toLocaleString()} {currency}
              </div>
              <span className="text-[8.5px] text-slate-500 font-sans mt-1">
                {entityType === 'customer'
                  ? isAr
                    ? 'خصومات ومدفوعات كاش موردة'
                    : 'Payments, adjustments & deposits'
                  : isAr
                    ? 'تصفية عهد وأجور توصيل مكتسبة'
                    : 'Wages earned and physical handovers'}
              </span>
            </div>
          </div>

          {/* Table Filters Panel */}
          <div className="flex flex-col sm:flex-row gap-3 p-4 bg-black/45 border border-slate-850/60 rounded-2xl">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                type="text"
                placeholder={isAr ? 'البحث عن حركة برقم السند أو المرجع أو البيان...' : 'Filter ledger details...'}
                value={finSearch}
                onChange={(event) => setFinSearch(event.target.value)}
                className="w-full bg-black/50 border border-slate-855 rounded-xl py-2 px-9 text-xs font-bold text-white focus:border-[#d4af37]/50 outline-none text-start"
              />
            </div>

            <select
              value={finModuleFilter}
              onChange={(event) => setFinModuleFilter(event.target.value as ModuleFilter)}
              className="bg-[#0e0e11] border border-slate-820 rounded-xl py-2 px-3 text-xs font-black text-slate-300 outline-none focus:border-[#d4af37]/50 cursor-pointer text-start"
            >
              <option value="all">{isAr ? 'جميع المسببات التشغيلية' : 'All Activities'}</option>
              <option value="order">{isAr ? 'الطرود والشحنات' : 'Shipment COD Charges'}</option>
              {entityType === 'courier' && (
                <option value="expense">{isAr ? 'العهد والمسحوبات والمصاريف' : 'Custody & Expenses'}</option>
              )}
              {entityType === 'customer' && (
                <option value="payment">{isAr ? 'مدفوعات التسوية' : 'Cash Payments'}</option>
              )}
              <option value="transaction">{isAr ? 'القيود اليدوية والتسويات' : 'Settlement Entries'}</option>
            </select>
          </div>

          {/* Main Statement Table */}
          <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center text-start">
              <h4 className="font-black text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400 animate-pulse" />
                {isAr ? 'تفاصيل كشف الحركة المالي التراكمي' : 'CHRONOLOGICAL FINANCIAL AUDIT STATEMENT'}
              </h4>
              <span className="text-[10px] bg-emerald-950/25 text-emerald-400 border border-emerald-900/40 px-3 py-1 rounded-lg font-bold font-mono">
                {isAr ? 'القيود المرحّلة فقط' : 'POSTED ENTRIES ONLY'}
              </span>
            </div>

            {loading ? (
              <div className="p-16 text-center text-slate-500 font-bold font-mono uppercase tracking-wider animate-pulse">
                [ {isAr ? 'جاري تجميع حركات الموديولات المترابطة بالتاريخ...' : 'generating_live_tracelines...'} ]
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-black/30 text-[9px] text-slate-500 uppercase tracking-widest font-black border-b border-slate-850">
                    <tr>
                      <th className="p-3 text-start">{isAr ? 'تاريخ الحركة' : 'Posting Date'}</th>
                      <th className="p-3 text-start">{isAr ? 'التصنيف' : 'Classification'}</th>
                      <th className="p-3 text-start">{isAr ? 'البيان وشرح الحركة' : 'Description / Narrative'}</th>
                      <th className="p-3 text-start">{isAr ? 'رقم المرجع' : 'Reference Ref'}</th>
                      <th className="p-3 text-start">{isAr ? 'النوع' : 'Entry Type'}</th>
                      <th className="p-3 text-start">{isAr ? 'المبلغ (العملة الأصلية)' : 'Amount (Original Currency)'}</th>
                      <th className="p-3 text-start">{isAr ? `المبلغ (${currency})` : `Amount (${currency})`}</th>
                      <th className="p-3 text-left">{isAr ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 bg-[#08080a]/20">
                    {visibleLines.map((line, idx) => {
                      const isCredit = line.type === 'Credit';
                      const labels = lineLabels(line, isAr);
                      return (
                        <tr key={line.id || idx} className="hover:bg-slate-950/40 transition-colors">
                          <td className="p-3 font-mono font-bold text-[10px] text-slate-400 text-start" dir="ltr">
                            {new Date(line.date).toLocaleString(isAr ? 'ar-YE' : 'en-US', {
                              year: '2-digit',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-3 text-start">
                            <span
                              className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                line.category === 'order'
                                  ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/20'
                                  : line.category === 'expense' || line.category === 'wage' || line.category === 'custody'
                                    ? 'bg-amber-955/20 text-amber-500 border border-amber-950/20'
                                    : line.category === 'payment'
                                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20'
                                      : 'bg-purple-950/30 text-purple-400 border border-purple-950/20'
                              }`}
                            >
                              {classificationLabel(line.category)}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-white text-start">
                            <div className="text-xs">{labels.title}</div>
                            <div className="text-[9px] text-slate-550 font-normal mt-0.5">{labels.description}</div>
                          </td>
                          <td className="p-3 font-mono text-[10px] text-[#d4af37] font-black text-start">{line.ref}</td>
                          <td className="p-3 text-start">
                            {isCredit ? (
                              <span className="text-[9px] bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 px-2.5 py-0.5 rounded-xl font-black">
                                {isAr ? 'إيداع / دائن (+)' : 'Credit (+)'}
                              </span>
                            ) : (
                              <span className="text-[9px] bg-rose-955/20 text-rose-500 border border-rose-950/30 px-2.5 py-0.5 rounded-xl font-black">
                                {isAr ? 'خصم / مدين (-)' : 'Debit (-)'}
                              </span>
                            )}
                          </td>
                          <td className={`p-3 font-mono font-bold text-xs ${isCredit ? 'text-emerald-450' : 'text-rose-450'}`}>
                            <span>
                              {isCredit ? '+' : '-'}
                              {(line.amountOriginal || line.amount || 0).toLocaleString()} {line.currencyOriginal || 'YER'}
                            </span>
                          </td>
                          <td className={`p-3 font-mono font-black text-xs ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            <span>
                              {isCredit ? '+' : '-'}
                              {(line.amount || 0).toLocaleString()} {currency}
                            </span>
                          </td>
                          <td
                            className={`p-3 text-left font-mono font-black text-xs ${
                              line.runningBalance >= 0 ? 'text-emerald-400' : 'text-rose-450'
                            }`}
                          >
                            {line.runningBalance.toLocaleString()} {currency}
                          </td>
                        </tr>
                      );
                    })}
                    {visibleLines.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-16 text-center text-slate-650 italic font-bold">
                          {loading || error
                            ? ''
                            : isAr
                              ? '[ لم يتم تقييد حركات مالية مسجلة بالتاريخ لهذا الحساب ]'
                              : '[ NO FINANCIAL TRANSACTIONS DISCOVERED FOR THIS ACCOUNT ]'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer with stamp and print button */}
        <div className="p-4 bg-black/40 border-t border-slate-850 flex justify-between items-center shrink-0">
          <div className="text-[9px] font-mono text-slate-500 pr-2 uppercase select-none">
            {isAr
              ? 'فرز مالي معتمد كشف حركي بالتاريخ • طبع تلقائي'
              : 'SECURE RECONCILIATION STAMP • GENERATED VIA FINANCIAL MODULE'}
          </div>
          <button
            onClick={() =>
              printContent(isAr ? `كشف حساب مالي - ${party?.name || entityId}` : 'Financial Statement', 'global-ledger-content', isAr)
            }
            className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-md active:scale-95"
          >
            <Printer className="w-4 h-4" />
            {isAr ? 'طباعة كشف الحساب المصغر' : 'Print Statement'}
          </button>
        </div>
      </div>
    </div>
  );
}
