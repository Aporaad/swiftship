/**
 * EntryDetailsModal — نافذة تفاصيل القيد والطباعة الكاملة
 * Full Entry Details & Printing Modal
 *
 * الميزات المحدثة:
 * 1. واجهة موسعة (max-w-5xl) بتصميم فاخر يستعرض كل التفاصيل والأطراف الفعلية.
 * 2. إظهار مبالغ عملة الرأس ومبالغ عملة الحساب وأسعار الصرف وتفاصيل الدفع.
 * 3. فتح كشف حساب منبثق عند الضغط على اسم الحساب.
 * 4. زر طباعة رسمي يستولد مستند قيد/سند مالي أنيق جاهز للطباعة والتحفيظ PDF.
 */

import { useMemo, useState } from 'react';
import {
  X,
  BookOpen,
  Layers,
  ReceiptText,
  FileClock,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  Banknote,
  Calendar,
  Hash,
  Tag,
  FileText,
  CreditCard,
  Printer,
  UserCheck,
} from 'lucide-react';
import type { FinanceAccount, FinanceCurrency, FinanceEntryType, FinanceModule } from './EntryForm';
import type { FinanceEntryRow } from './EntryWorkspaceTab';

export interface EntryTransactionLine {
  id: string;
  entryId: string;
  lineNo: number;
  transType: 'Debit' | 'Credit';
  accountId: string;
  accountCurNo: number;
  amount: number;
  amountOriginal: number;
  currencyOriginalNo: number;
  paymentMethod?: string;
  description?: string;
  orderId?: string;
  shipmentId?: string;
}

interface AccountLedgerPopupProps {
  account: FinanceAccount;
  lines: EntryTransactionLine[];
  currencyById: Map<number, string>;
  onClose: () => void;
}

interface Props {
  entry: FinanceEntryRow;
  lines: EntryTransactionLine[];
  accounts: FinanceAccount[];
  currencies: FinanceCurrency[];
  modules: FinanceModule[];
  entryTypes: FinanceEntryType[];
  onClose: () => void;
}

const statusStyle: Record<string, string> = {
  posted: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  voided: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  draft:  'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};
const statusLabel: Record<string, string> = {
  posted: 'مرحّل ✓',
  voided: 'مبطل ✗',
  draft:  'مسودة (مؤقت)',
};

const categoryLabel: Record<string, string> = {
  General:  'قيد عام',
  Compound: 'قيد مركب',
  Temp:     'قيد مؤقت',
  Reversing:'قيد عكسي',
};

const paymentMethodLabel: Record<string, string> = {
  cash:     'نقدًا',
  bank:     'بنك',
  deferred: 'آجل',
  mixed:    'مختلط',
};

// ────────────────────────────────────────────────
// نافذة كشف الحساب المنبثقة المصغرة
// ────────────────────────────────────────────────

function AccountLedgerPopup({ account, lines, currencyById, onClose }: AccountLedgerPopupProps) {
  const accountLines = lines.filter((l) => l.accountId === account.id);

  const debitTotal  = accountLines.filter((l) => l.transType === 'Debit').reduce((s, l) => s + Number(l.amount), 0);
  const creditTotal = accountLines.filter((l) => l.transType === 'Credit').reduce((s, l) => s + Number(l.amount), 0);
  const balance     = debitTotal - creditTotal;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-3.5">
          <div>
            <h4 className="font-black text-white text-sm">{account.nameAr}</h4>
            <p className="text-[10px] font-mono text-slate-500">{account.id}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-right text-xs">
            <thead className="sticky top-0 bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2">البيان</th>
                <th className="px-3 py-2 text-emerald-400">مدين</th>
                <th className="px-3 py-2 text-amber-400">دائن</th>
                <th className="px-3 py-2">العملة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {accountLines.map((line) => (
                <tr key={line.id} className="text-slate-300 hover:bg-slate-800/40">
                  <td className="px-3 py-2 max-w-[160px] truncate">{line.description || '—'}</td>
                  <td className="px-3 py-2 font-mono font-black text-emerald-300">
                    {line.transType === 'Debit' ? Number(line.amount).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono font-black text-amber-300">
                    {line.transType === 'Credit' ? Number(line.amount).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{currencyById.get(line.accountCurNo) || '—'}</td>
                </tr>
              ))}
              {accountLines.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">لا توجد حركات لهذا الحساب في هذا القيد</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 border-t border-slate-800 bg-slate-950/60 px-5 py-3 text-xs font-black">
          <span className="text-emerald-300">مجموع المدين: {debitTotal.toLocaleString()}</span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-300">مجموع الدائن: {creditTotal.toLocaleString()}</span>
          <span className="text-slate-600">|</span>
          <span className={balance >= 0 ? 'text-cyan-300' : 'text-rose-300'}>
            الرصيد: {balance.toLocaleString()} {currencyById.get(account.curNo)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// المكوّن الرئيسي — EntryDetailsModal
// ────────────────────────────────────────────────

export default function EntryDetailsModal({
  entry,
  lines,
  accounts,
  currencies,
  modules,
  entryTypes,
  onClose,
}: Props) {
  const [ledgerAccount, setLedgerAccount] = useState<FinanceAccount | null>(null);

  const accountById  = useMemo(() => new Map(accounts.map((a) => [a.id, a])),        [accounts]);
  const currencyById = useMemo(() => new Map(currencies.map((c) => [c.id, c.code])), [currencies]);
  const moduleById   = useMemo(() => new Map(modules.map((m) => [m.id, m])),          [modules]);
  const typeById     = useMemo(() => new Map(entryTypes.map((t) => [t.id, t])),       [entryTypes]);

  const entryLines = useMemo(
    () => lines.filter((l) => l.entryId === entry.id).sort((a, b) => a.lineNo - b.lineNo),
    [lines, entry.id]
  );

  const debitTotal  = useMemo(() => entryLines.filter((l) => l.transType === 'Debit').reduce((s, l) => s + Number(l.amountOriginal), 0), [entryLines]);
  const creditTotal = useMemo(() => entryLines.filter((l) => l.transType === 'Credit').reduce((s, l) => s + Number(l.amountOriginal), 0), [entryLines]);

  const CategoryIcon =
    entry.entryCategory === 'Compound'  ? Layers       :
    entry.entryCategory === 'Temp'      ? FileClock    :
    entry.entryCategory === 'Reversing' ? ReceiptText  :
                                          BookOpen;

  // ────────────────────────────────────────────────
  // طباعة المستند المالي الرسمي
  // ────────────────────────────────────────────────
  const handlePrintEntry = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const entryCurrencyCode = currencyById.get(entry.currencyOriginalNo) || '';
    const moduleName = moduleById.get(entry.moduleId)?.nameAr || 'المحاسبة والمالية';
    const typeName   = typeById.get(entry.entryTypeId)?.nameAr || categoryLabel[entry.entryCategory] || 'قيد محاسبي';
    const dateFormatted = entry.effectiveAt
      ? new Date(entry.effectiveAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleDateString('ar-EG');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>مستند مالي - ${entry.entryNumber}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; margin: 0; padding: 0; direction: rtl; }
          .header { display: flex; justify-content: space-between; items-center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .logo-title { font-size: 20px; font-weight: 900; color: #0f172a; }
          .sub-title { font-size: 12px; color: #64748b; margin-top: 2px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; background: #f1f5f9; border: 1px solid #cbd5e1; }
          .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
          .info-item { display: flex; flex-direction: column; }
          .info-label { font-size: 10px; font-weight: bold; color: #64748b; margin-bottom: 2px; }
          .info-value { font-size: 12px; font-weight: bold; color: #0f172a; }
          .desc-box { background: #fff; border: 1px border border-slate-200; border-right: 4px solid #d4af37; padding: 10px 14px; margin-bottom: 16px; border-radius: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th { background: #0f172a; color: #fff; text-align: right; padding: 8px 10px; font-weight: bold; }
          td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; text-align: right; }
          tr:nth-child(even) { background: #f8fafc; }
          .amount { font-family: monospace; font-weight: bold; font-size: 12px; }
          .debit { color: #047857; }
          .credit { color: #b45309; }
          .tfoot-row td { background: #f1f5f9; font-weight: bold; border-top: 2px solid #0f172a; }
          .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 40px; text-align: center; }
          .sig-box { border-top: 1px stroke #cbd5e1; pt-2; font-size: 11px; font-weight: bold; color: #475569; }
          .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo-title">مستند محاسبي رسمي</div>
            <div class="sub-title">${moduleName} — ${typeName}</div>
          </div>
          <div style="text-align: left;">
            <div style="font-size: 16px; font-weight: 900; color: #d4af37; font-family: monospace;">${entry.entryNumber}</div>
            <div class="badge">${statusLabel[entry.postingStatus] || entry.postingStatus}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-item"><span class="info-label">رقم المستند:</span><span class="info-value" style="font-family: monospace;">${entry.entryNumber}</span></div>
          <div class="info-item"><span class="info-label">تاريخ الإصدار:</span><span class="info-value">${dateFormatted}</span></div>
          <div class="info-item"><span class="info-label">طريقة الدفع:</span><span class="info-value">${paymentMethodLabel[entry.paymentMethod || ''] || entry.paymentMethod || 'افتراضي'}</span></div>
          <div class="info-item"><span class="info-label">إجمالي القيد:</span><span class="info-value" style="color: #d4af37;">${Number(entry.amountOriginal).toLocaleString()} ${entryCurrencyCode}</span></div>
        </div>

        ${entry.description ? `<div class="desc-box"><strong>البيان العام:</strong> ${entry.description}</div>` : ''}

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>رقم الحساب واسم الحساب</th>
              <th style="width: 110px;">مدين</th>
              <th style="width: 110px;">دائن</th>
              <th style="width: 70px;">العملة</th>
              <th>البيان الفرعي</th>
            </tr>
          </thead>
          <tbody>
            ${entryLines.map((line) => {
              const acc = accountById.get(line.accountId);
              return `
                <tr>
                  <td>${line.lineNo}</td>
                  <td><strong>${acc?.nameAr || line.accountId}</strong> <br><small style="color: #64748b; font-family: monospace;">${line.accountId}</small></td>
                  <td class="amount debit">${line.transType === 'Debit' ? Number(line.amountOriginal).toLocaleString() : '—'}</td>
                  <td class="amount credit">${line.transType === 'Credit' ? Number(line.amountOriginal).toLocaleString() : '—'}</td>
                  <td>${currencyById.get(line.currencyOriginalNo) || '—'}</td>
                  <td>${line.description || '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="tfoot-row">
              <td colSpan="2">إجمالي الحركة المالية:</td>
              <td class="amount debit">${debitTotal.toLocaleString()}</td>
              <td class="amount credit">${creditTotal.toLocaleString()}</td>
              <td>${entryCurrencyCode}</td>
              <td>${Math.abs(debitTotal - creditTotal) < 0.001 ? '✓ القيد متوازن' : '⚠ قيد غير متوازن'}</td>
            </tr>
          </tfoot>
        </table>

        <div class="signatures">
          <div class="sig-box">توقيع المحاسب المختص<br><br>___________________</div>
          <div class="sig-box">توقيع المراجع والمدقق<br><br>___________________</div>
          <div class="sig-box">اعتماد المدير المالي<br><br>___________________</div>
        </div>

        <div class="footer">
          أُنشئ هذا المستند آلياً من نظام SWIFTSHIP المحاسبي بتاريخ ${new Date().toLocaleString('ar-EG')}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <>
      {/* نافذة التفاصيل موسعة (max-w-5xl) */}
      <div
        className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        dir="rtl"
      >
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md" onClick={onClose} />

        <div className="relative z-10 my-4 w-full max-w-5xl rounded-3xl border border-slate-700/80 bg-slate-950 shadow-2xl overflow-hidden ring-1 ring-slate-800">

          {/* ── رأس النافذة — Header ── */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-3 text-[#f4d870]">
                <CategoryIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">
                    تفاصيل المستند — <span className="font-mono text-[#f4d870]">{entry.entryNumber}</span>
                  </h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${statusStyle[entry.postingStatus] || statusStyle.draft}`}>
                    {statusLabel[entry.postingStatus] || entry.postingStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-400">معاينة تفاصيل المستند المحاسبي والأطراف الفعلية في النظام</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* زر طباعة المستند */}
              <button
                onClick={handlePrintEntry}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-2 text-xs font-black text-emerald-300 transition active:scale-95"
                title="طباعة القيد / السند"
              >
                <Printer className="h-4 w-4" />
                <span>طباعة المستند</span>
              </button>

              <button
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ── محتوى النافذة — Content ── */}
          <div className="p-6 space-y-6">

            {/* بطاقات البيانات الأساسية */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InfoCard icon={Hash} label="رقم المستند" value={entry.entryNumber} valueClass="font-mono text-[#f4d870]" />
              <InfoCard icon={BookOpen} label="الفئة المالية" value={categoryLabel[entry.entryCategory] || entry.entryCategory} />
              <InfoCard icon={Layers} label="النوع" value={typeById.get(entry.entryTypeId)?.nameAr || '—'} />
              <InfoCard icon={FileText} label="الوحدة المعتمدة" value={moduleById.get(entry.moduleId)?.nameAr || '—'} />
              
              <InfoCard icon={CreditCard} label="طريقة الدفع" value={paymentMethodLabel[entry.paymentMethod || ''] || entry.paymentMethod || 'افتراضي'} />
              <InfoCard
                icon={Calendar}
                label="تاريخ الإصدار"
                value={entry.effectiveAt ? new Date(entry.effectiveAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              />
              <InfoCard icon={UserCheck} label="حالة القيد" value={statusLabel[entry.postingStatus] || entry.postingStatus} valueClass="text-emerald-300" />
              
              {/* إجمالي المبلغ */}
              <div className="rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mb-1">
                  <Banknote className="h-3.5 w-3.5 text-[#f4d870]" /> المبلغ الكلي
                </div>
                <div className="font-mono font-black text-[#f4d870] text-base">
                  {Number(entry.amountOriginal).toLocaleString()}
                  <span className="mr-1 text-slate-400 text-xs">
                    {currencyById.get(entry.currencyOriginalNo)}
                  </span>
                </div>
              </div>
            </div>

            {/* البيان العام */}
            {entry.description && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-[11px] font-bold text-slate-400 mb-1">البيان العام والملاحظات</div>
                <p className="text-sm font-bold text-slate-200 leading-relaxed">{entry.description}</p>
              </div>
            )}

            {/* ── جدول أطراف القيد الفعلية ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <span>الأطراف المحاسبية الفعلية في الحركة ({entryLines.length} سطر)</span>
                </h4>
                <span className="text-xs text-slate-400">انقر على اسم أي حساب لاستعراض كشف حسابه</span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70">
                <table className="min-w-[650px] w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-3.5 py-3">#</th>
                      <th className="px-3.5 py-3">رقم واسم الحساب</th>
                      <th className="px-3.5 py-3 text-emerald-400">مدين (عملة الرأس)</th>
                      <th className="px-3.5 py-3 text-amber-400">دائن (عملة الرأس)</th>
                      <th className="px-3.5 py-3">المبلغ بعملة الحساب</th>
                      <th className="px-3.5 py-3">عملة الحساب</th>
                      <th className="px-3.5 py-3">البيان التفصيلي للسطر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {entryLines.map((line) => {
                      const account = accountById.get(line.accountId);
                      return (
                        <tr key={line.id} className="text-slate-200 hover:bg-slate-900/50 transition">
                          <td className="px-3.5 py-3 text-slate-500 font-mono font-bold">{line.lineNo}</td>
                          <td className="px-3.5 py-3">
                            <button
                              onClick={() => account && setLedgerAccount(account)}
                              className="flex items-center gap-1.5 text-right hover:text-[#f4d870] transition group"
                              title={`فتح كشف حساب: ${account?.nameAr || line.accountId}`}
                            >
                              <div>
                                <div className="font-black text-white group-hover:underline">
                                  {account?.nameAr || line.accountId}
                                </div>
                                <div className="font-mono text-[10px] text-slate-500">{line.accountId}</div>
                              </div>
                              <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-[#f4d870] shrink-0" />
                            </button>
                          </td>
                          <td className="px-3.5 py-3">
                            {line.transType === 'Debit' ? (
                              <span className="inline-flex items-center gap-1 font-mono font-black text-emerald-300">
                                <ArrowUpRight className="h-3.5 w-3.5" />
                                {Number(line.amountOriginal).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3">
                            {line.transType === 'Credit' ? (
                              <span className="inline-flex items-center gap-1 font-mono font-black text-amber-300">
                                <ArrowDownLeft className="h-3.5 w-3.5" />
                                {Number(line.amountOriginal).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 font-mono font-bold text-slate-300">
                            {Number(line.amount || line.amountOriginal).toLocaleString()}
                          </td>
                          <td className="px-3.5 py-3 text-slate-400 font-bold">
                            {currencyById.get(line.accountCurNo || line.currencyOriginalNo) || '—'}
                          </td>
                          <td className="px-3.5 py-3 max-w-[220px] truncate text-slate-400">
                            {line.description || '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {entryLines.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">لا توجد أسطر محاسبية لهذا القيد.</td>
                      </tr>
                    )}
                  </tbody>
                  {/* صف المجاميع */}
                  {entryLines.length > 0 && (
                    <tfoot className="border-t-2 border-slate-700 bg-slate-900/90 text-xs font-black">
                      <tr>
                        <td colSpan={2} className="px-3.5 py-3 text-slate-300">المجموع الكلي</td>
                        <td className="px-3.5 py-3 text-emerald-300 font-mono text-sm">
                          {debitTotal.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-3 text-amber-300 font-mono text-sm">
                          {creditTotal.toLocaleString()}
                        </td>
                        <td colSpan={2} className="px-3.5 py-3 text-slate-400">
                          العملة الأساسية: {currencyById.get(entry.currencyOriginalNo)}
                        </td>
                        <td className="px-3.5 py-3">
                          {Math.abs(debitTotal - creditTotal) < 0.001 ? (
                            <span className="text-emerald-400 text-xs">✓ القيد متوازن بالكامل</span>
                          ) : (
                            <span className="text-rose-400 text-xs">⚠ فارق: {Math.abs(debitTotal - creditTotal).toLocaleString()}</span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* ── ذيل النافذة — Footer ── */}
          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/70 px-6 py-4">
            <span className="text-xs text-slate-500 font-mono">
              {entry.createdAt ? `تاريخ الإنشاء: ${new Date(entry.createdAt).toLocaleString('ar-EG')}` : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintEntry}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-black text-white shadow-md transition active:scale-95"
              >
                <Printer className="h-4 w-4" />
                <span>طباعة القيد</span>
              </button>
              <button
                onClick={onClose}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* نافذة كشف الحساب */}
      {ledgerAccount && (
        <AccountLedgerPopup
          account={ledgerAccount}
          lines={entryLines}
          currencyById={currencyById}
          onClose={() => setLedgerAccount(null)}
        />
      )}
    </>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  valueClass = 'text-slate-200',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`text-xs font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}
