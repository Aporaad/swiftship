/**
 * @file AccountLedgerReport.tsx
 * @description تقرير تفصيلي لأي حساب (شجرة الحسابات)
 * Detailed account ledger report with running balance calculation
 */

import React from 'react';
import { format } from 'date-fns';
import { Layers, AlertCircle } from 'lucide-react';
import { MoneyDisplay } from '../../../../components/common/MoneyDisplay';

interface AccountLedgerReportProps {
  isAr: boolean;
  accounts?: any[];
  filters?: any;
  accountTransactions?: any[];
  ledgerMetrics?: any | null;
  handleExportExcel?: () => void;
  triggerNativePrint?: () => void;
  isPreviewModalOpen?: boolean;
  setIsPreviewModalOpen?: (open: boolean) => void;
}

export const AccountLedgerReport: React.FC<AccountLedgerReportProps> = ({
  isAr,
  ledgerMetrics,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {ledgerMetrics === null || !ledgerMetrics?.selectedAccount ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 text-slate-500 rounded-full">
            <Layers className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black text-white">
              {isAr ? 'لم يتم تحديد حساب مالي بعد' : 'No account selected'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm">
              {isAr
                ? 'يرجى اختيار الحساب المطلوب من القائمة المنسدلة في شريط الفلترة بالأعلى لعرض كشف الحركة التفصيلي ومطابقة الأرصدة.'
                : 'Please select a financial account from the filter dropdown above to load dynamic ledger sheets.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Account Summary header */}
          <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <span className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/25 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider block w-fit">
                  {isAr ? 'كشف الحساب المالي المحدد' : 'Selected Ledger Account Profile'}
                </span>
                <h3 className="text-md font-black text-white pt-1">
                  [{ledgerMetrics.selectedAccount.accountCode}] — {ledgerMetrics.selectedAccount.entityName || ledgerMetrics.selectedAccount.name}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isAr
                    ? `حالة الحساب: نشط • طبيعة الحساب: ${ledgerMetrics.debitNormal ? 'مدين (الأصول/المصاريف)' : 'دائن (الالتزامات/الإيرادات/الملكية)'}`
                    : `Account status: Active • Type: ${ledgerMetrics.debitNormal ? 'Debit-Normal (Asset/Expense)' : 'Credit-Normal (Liability/Equity/Revenue)'}`}
                </p>
              </div>

              <div className="p-4 bg-slate-955 border border-slate-850 rounded-xl text-end self-stretch md:self-auto min-w-[180px]">
                <span className="text-[10px] text-slate-500 block font-bold mb-0.5">
                  {isAr ? 'رصيد الحساب المالي الإجمالي:' : 'Current Book Balance:'}
                </span>
                <span className={`text-md font-mono font-black ${(ledgerMetrics.selectedAccount.balance || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <MoneyDisplay amount={ledgerMetrics.selectedAccount.balance || 0} currency={ledgerMetrics.selectedAccount.currency || 'YER'} />
                </span>
              </div>
            </div>
          </div>

          {/* Period balances dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl text-start">
              <span className="text-[10px] text-slate-500 font-bold block mb-1">
                {isAr ? 'الرصيد الافتتاحي (بداية المدة)' : 'Opening Balance'}
              </span>
              <span className={`text-base font-mono font-black ${(ledgerMetrics.openingBalance || 0) >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
                <MoneyDisplay amount={ledgerMetrics.openingBalance || 0} currency={ledgerMetrics.selectedAccount.currency} currencyClassName="text-[10px] font-sans text-slate-500" />
              </span>
            </div>

            <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl text-start">
              <span className="text-[10px] text-emerald-400 font-bold block mb-1">
                {isAr ? 'إجمالي الحركات المدينة (+)' : 'Total Period Debits'}
              </span>
              <span className="text-base font-mono font-black text-emerald-400">
                <MoneyDisplay prefix="+" amount={ledgerMetrics.periodDebits || 0} currency={ledgerMetrics.selectedAccount.currency} currencyClassName="text-[10px] font-sans text-slate-500" />
              </span>
            </div>

            <div className="p-4 bg-rose-500/5 border border-rose-500/15 rounded-2xl text-start">
              <span className="text-[10px] text-rose-400 font-bold block mb-1">
                {isAr ? 'إجمالي الحركات الدائنة (-)' : 'Total Period Credits'}
              </span>
              <span className="text-base font-mono font-black text-rose-400">
                <MoneyDisplay prefix="-" amount={ledgerMetrics.periodCredits || 0} currency={ledgerMetrics.selectedAccount.currency} currencyClassName="text-[10px] font-sans text-slate-500" />
              </span>
            </div>

            <div className="p-4 bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-2xl text-start">
              <span className="text-[10px] text-[#d4af37] font-bold block mb-1">
                {isAr ? 'الرصيد الختامي (نهاية المدة)' : 'Closing Balance'}
              </span>
              <span className={`text-base font-mono font-black ${(ledgerMetrics.closingBalance || 0) >= 0 ? 'text-[#d4af37]' : 'text-rose-400'}`}>
                <MoneyDisplay amount={ledgerMetrics.closingBalance || 0} currency={ledgerMetrics.selectedAccount.currency} currencyClassName="text-[10px] font-sans text-slate-500" />
              </span>
            </div>
          </div>

          {/* Ledger rows table */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-black text-white block">
              {isAr ? 'حركات القيود والدفاتر التفصيلية خلال الفترة' : 'Statement Period Postings'}
            </span>
            <div className="overflow-x-auto w-full max-w-full pb-2">
              <table className="w-full text-xs text-start border-separate border-spacing-y-1.5 min-w-[750px]">
                <thead>
                  <tr className="text-slate-550 uppercase font-black">
                    <th className="py-2 px-3 text-start">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                    <th className="py-2 px-3">{isAr ? 'الرقم المرجعي للقيد' : 'Voucher Ref'}</th>
                    <th className="py-2 px-3">{isAr ? 'البيان التفصيلي والشرح' : 'Description / Narration'}</th>
                    <th className="py-2 px-3 text-right">{isAr ? 'مدين (Debit)' : 'Debit'}</th>
                    <th className="py-2 px-3 text-right">{isAr ? 'دائن (Credit)' : 'Credit'}</th>
                    <th className="py-2 px-3 text-right">{isAr ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                  </tr>
                </thead>
                <tbody>
                  {!ledgerMetrics.displayRows || ledgerMetrics.displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-500 font-bold italic">
                        {isAr ? 'لا توجد حركات قيود مسجلة لهذا الحساب بالفترة المحددة' : 'No transactions recorded for this account in the specified period.'}
                      </td>
                    </tr>
                  ) : (
                    ledgerMetrics.displayRows.map((tx: any) => {
                      const amt = parseFloat(tx.amount) || 0;
                      return (
                        <tr key={tx.id || Math.random()} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl transition-all">
                          <td className="py-3 px-3 text-slate-500 font-mono">
                            {tx.createdAt ? format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm') : '—'}
                          </td>
                          <td className="py-3 px-3 font-mono font-black text-slate-350">
                            {tx.entry_id || '-'}
                          </td>
                          <td className="py-3 px-3 font-bold text-white truncate max-w-xs" title={tx.description}>
                            {tx.description}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">
                            {tx.type === 'Debit' ? <MoneyDisplay prefix="+" amount={amt} /> : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-rose-400">
                            {tx.type === 'Credit' ? <MoneyDisplay prefix="-" amount={amt} /> : '-'}
                          </td>
                          <td className={`py-3 px-3 text-right font-mono font-black ${(tx.runningBalance || 0) >= 0 ? 'text-[#d4af37]' : 'text-rose-400'}`}>
                            <MoneyDisplay amount={tx.runningBalance || 0} currency={ledgerMetrics.selectedAccount.currency} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Advice panel */}
          <div className="bg-[#121215] border border-[#d4af37]/25 p-5 rounded-3xl flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-[#d4af37] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-1">
                {isAr ? 'ملاحظة بخصوص جودة طباعة وتصدير التقارير العربية' : 'Pristine Vector Printing & PDF Export Guide'}
              </h4>
              <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
                {isAr
                  ? 'لتجنب تشوه الخطوط العربية وظهور الرموز العشوائية في ملفات PDF الناتجة بصورة تقليدية، نقوم بتطبيق نظام الطباعة المعياري عالي الكفاءة. اضغط على زر "معاينة وطباعة القالب" ثم اختر "حفظ بتنسيق PDF" من نافذة طباعة النظام المتطورة.'
                  : 'To ensure 100% accurate Arabic rendering without encoding corruption, we highly recommend utilizing the browser Standard Printing dialog.'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountLedgerReport;
