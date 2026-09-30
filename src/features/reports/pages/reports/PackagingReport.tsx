/**
 * @file PackagingReport.tsx
 * @description تقرير رسوم التغليف وتكاليف الشحن المحلي
 * Packaging fees and local shipping costs report
 */

import React from 'react';
import { format } from 'date-fns';

interface PackagingReportProps {
  isAr: boolean;
  filteredData: { orders: any[]; expenses: any[] };
  accounts: any[];
  accountTransactions: any[];
  selectedPackagingAccountIds: string[];
  setSelectedPackagingAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleSaveAccountSelection: (type: string) => void;
  convertCurrency: (amount: number, from: string, to: string) => number;
  convertToYER: (amount: number, currency: string) => number;
  MultiAccountSelectorComponent: React.ComponentType<any>;
}

// ─── PackagingReport Component ──────────────────────────────────────────────
const PackagingReport: React.FC<PackagingReportProps> = ({
  isAr,
  filteredData,
  accounts,
  accountTransactions,
  selectedPackagingAccountIds,
  setSelectedPackagingAccountIds,
  handleSaveAccountSelection,
  convertCurrency,
  convertToYER,
  MultiAccountSelectorComponent
}) => {
  return (
      <div>
                <div className="space-y-6">
                  {(() => {
                    const selectedAccounts = accounts.filter(a => selectedPackagingAccountIds.includes(a.id));
                    const displayAccounts = selectedAccounts.length > 0 ? selectedAccounts : (accounts.find(a => a.entityId === 'sys_packaging_fees') ? [accounts.find(a => a.entityId === 'sys_packaging_fees')!] : []);

                    const displayCurrency = displayAccounts[0]?.currency || 'SAR';
                    const alternativeCurrency = displayCurrency === 'SAR' ? 'YER' : 'SAR';

                    const totalConsolidatedBalance = displayAccounts.reduce((sum, a) => sum + convertCurrency(parseFloat(a.balance as any) || 0, a.currency || 'SAR', displayCurrency), 0);

                    // 1. Calculate Income (Credit - Collected fees from orders)
                    // We sum up active orders packaging fees in SAR and convert to displayCurrency
                    const totalOrderPackagingFees = filteredData.orders
                      .filter(o => o.orderStatus !== 'Cancelled')
                      .reduce((sum, o) => sum + (parseFloat(o.packagingFee as any) || 0), 0);
                    const totalOrderPackagingFeesInDisplay = convertCurrency(totalOrderPackagingFees, 'SAR', displayCurrency);

                    // We sum up credit transactions on any of the selected Accounts
                    const selectedAccountIds = displayAccounts.map(a => a.id);
                    const pkgTxs = accountTransactions.filter(tx => selectedAccountIds.includes(tx.accountId) || selectedAccountIds.includes(tx.entityId));

                    const totalCreditTxs = pkgTxs
                      .filter(tx => tx.type === 'Credit')
                      .reduce((sum, tx) => {
                        const txAcc = accounts.find(a => a.id === tx.accountId);
                        const txCurrency = txAcc?.currency || tx.currency || 'SAR';
                        return sum + convertCurrency(parseFloat(tx.amount) || 0, txCurrency, displayCurrency);
                      }, 0);

                    const packagingIncome = totalCreditTxs > 0 ? totalCreditTxs : totalOrderPackagingFeesInDisplay;

                    // 2. Calculate Expenses (Debit - direct expenses or manual adjustments)
                    const directPackagingExpenses = filteredData.expenses
                      .filter(e => e.category === 'PACKAGING' || e.notes?.toLowerCase().includes('تغليف'))
                      .reduce((sum, e) => sum + convertCurrency(parseFloat(e.amount) || 0, e.currency || 'YER', displayCurrency), 0);

                    const totalDebitTxs = pkgTxs
                      .filter(tx => tx.type === 'Debit')
                      .reduce((sum, tx) => {
                        const txAcc = accounts.find(a => a.id === tx.accountId);
                        const txCurrency = txAcc?.currency || tx.currency || 'SAR';
                        return sum + convertCurrency(parseFloat(tx.amount) || 0, txCurrency, displayCurrency);
                      }, 0);

                    const packagingOutgoings = totalDebitTxs > 0 ? totalDebitTxs : directPackagingExpenses;

                    // 3. Difference
                    const packagingMargin = packagingIncome - packagingOutgoings;

                    const packagingIncomeAlternative = convertCurrency(packagingIncome, displayCurrency, alternativeCurrency);
                    const packagingOutgoingsAlternative = convertCurrency(packagingOutgoings, displayCurrency, alternativeCurrency);
                    const packagingMarginAlternative = convertCurrency(packagingMargin, displayCurrency, alternativeCurrency);

                    return (
                      <div className="space-y-6">
                        <MultiAccountSelectorComponent
                          selectedIds={selectedPackagingAccountIds}
                          setSelectedIds={setSelectedPackagingAccountIds}
                          labelAr="اختر حسابات رسوم التغليف والتكاليف المرتبطة لتضمينها في هذا التقرير وتوليد كشف مالي موحد تلقائياً"
                          labelEn="Select packaging fees and associated accounts to compile in this report"
                          accounts={accounts}
                          isAr={isAr}
                          onSave={() => handleSaveAccountSelection('packaging')}
                        />

                        {/* Financial Header linked to Chart of Accounts */}
                        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden space-y-4">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full blur-2xl pointer-events-none" />
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="space-y-1">
                              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider block w-fit">
                                {isAr ? 'الحسابات المالية المحددة من شجرة الحسابات' : 'Selected Chart of Accounts Nodes'}
                              </span>
                              <div className="flex flex-wrap gap-2 pt-1">
                                {displayAccounts.map(acc => (
                                  <span key={acc.id} className="bg-slate-950/80 border border-slate-850 px-3 py-1 rounded-xl text-xs font-black text-white flex items-center gap-1.5">
                                    <span className="text-[#d4af37]">[{acc.accountCode}]</span>
                                    {acc.entityName || acc.name}
                                    <span className="text-slate-500 text-[10px] font-mono">({(acc.balance || 0).toLocaleString()} {acc.currency})</span>
                                  </span>
                                ))}
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xl">
                                {isAr
                                  ? 'يتم دمج ومطابقة بيانات جميع هذه الحسابات المحددة تلقائياً في التقرير وكشف الحركة ومجموع المصروفات والواردات.'
                                  : 'This report aggregates and matches data from all selected accounts, including ledger balances, credits, and debits.'}
                              </p>
                            </div>
                            <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-xl text-end self-stretch md:self-auto min-w-[160px]">
                              <span className="text-[10px] text-slate-550 block font-bold mb-0.5 font-sans">
                                {isAr ? 'الرصيد التراكمي المدمج:' : 'Consolidated Balance:'}
                              </span>
                              <span className={`text-md font-mono font-black ${totalConsolidatedBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {totalConsolidatedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Income / Expense / Difference Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl">
                            <span className="text-[10px] text-emerald-400 font-bold block mb-1">
                              {isAr ? 'الوارد / الدخل من الرسوم المجمعة (+)' : 'Packaging Income (Credit)'}
                            </span>
                            <span className="text-lg font-mono font-black text-emerald-400">
                              {packagingIncome.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] font-sans">{displayCurrency}</span>
                            </span>
                            <p className="text-[10px] font-mono text-slate-400 font-bold mt-0.5">
                              ≈ {packagingIncomeAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                            </p>
                            <p className="text-[9px] text-slate-500 mt-1 font-bold">
                              {isAr
                                ? `مجموع قيم المبيعات المخصصة للتغليف بالفترة (${totalOrderPackagingFees.toLocaleString()} SAR)`
                                : `Sum of wrapping fees collected from shipments during this range.`}
                            </p>
                          </div>

                          <div className="p-4 bg-rose-500/5 border border-rose-500/15 rounded-2xl">
                            <span className="text-[10px] text-rose-400 font-bold block mb-1">
                              {isAr ? 'الخرج / النفقات ومشتريات الكرتون (-)' : 'Packaging OpEx (Debit)'}
                            </span>
                            <span className="text-lg font-mono font-black text-rose-400">
                              {packagingOutgoings.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] font-sans">{displayCurrency}</span>
                            </span>
                            <p className="text-[10px] font-mono text-slate-400 font-bold mt-0.5">
                              ≈ {packagingOutgoingsAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                            </p>
                            <p className="text-[9px] text-slate-500 mt-1 font-bold">
                              {isAr
                                ? 'تكلفة المواد المشتراة أو الحركات المدينة المصروفة للتغليف'
                                : 'Direct OpEx spent on bubble wrap, tape and cardboard supplies.'}
                            </p>
                          </div>

                          <div className={`p-4 rounded-2xl border ${packagingMargin >= 0 ? 'bg-[#d4af37]/5 border-[#d4af37]/20' : 'bg-rose-500/5 border-rose-500/15'}`}>
                            <span className="text-[10px] text-[#d4af37] font-bold block mb-1">
                              {isAr ? 'صافي الفارق والوفرة المالية (الفارق)' : 'Net Operating Variance'}
                            </span>
                            <span className={`text-lg font-mono font-black ${packagingMargin >= 0 ? 'text-[#d4af37]' : 'text-rose-400'}`}>
                              {packagingMargin.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] font-sans">{displayCurrency}</span>
                            </span>
                            <p className="text-[10px] font-mono text-slate-400 font-bold mt-0.5">
                              ≈ {packagingMarginAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                            </p>
                            <p className="text-[9px] text-slate-550 mt-1 font-bold">
                              {isAr
                                ? 'الفائض التشغيلي لقسم التعبئة والتغليف (الدخل - المصاريف)'
                                : 'Actual net yields of the packaging department (Revenue - Expense).'}
                            </p>
                          </div>
                        </div>

                        {/* Dual Tables for Inflow & Outflow */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-2">

                          {/* 1. Collected Fees orders Table (الدخل) */}
                          <div className="space-y-3 bg-slate-900/10 p-5 border border-slate-850/50 rounded-2xl">
                            <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                              <span className="text-xs font-black text-emerald-400">
                                {isAr ? '🟢 الدخل (حصيلة رسوم التغليف من الشحنات)' : 'Revenue logs (Orders Packaging Fees)'}
                              </span>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-black font-mono">
                                {totalOrderPackagingFees.toLocaleString()} SAR
                              </span>
                            </div>

                            <div className="overflow-x-auto w-full max-w-full pb-2">
                              <table className="w-full text-xs text-start border-separate border-spacing-y-1 min-w-[350px]">
                                <thead>
                                  <tr className="text-slate-550 font-black">
                                    <th className="py-1 px-2 text-start">{isAr ? 'الطلب' : 'Order'}</th>
                                    <th className="py-1 px-2 text-start">{isAr ? 'اسم العميل' : 'Customer'}</th>
                                    <th className="py-1 px-2 text-right">{isAr ? 'رسوم التغليف' : 'Packaging fee'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredData.orders.filter(o => o.orderStatus !== 'Cancelled' && (parseFloat(o.packagingFee) || 0) > 0).length === 0 ? (
                                    <tr>
                                      <td colSpan={3} className="text-center py-6 text-slate-600 font-bold italic">
                                        {isAr ? 'لا توجد شحنات مسجلة برسوم تغليف في هذه الفترة' : 'No shipments with wrapping charges.'}
                                      </td>
                                    </tr>
                                  ) : (
                                    filteredData.orders.filter(o => o.orderStatus !== 'Cancelled' && (parseFloat(o.packagingFee) || 0) > 0).slice(0, 100).map((o, idx) => (
                                      <tr key={`${o.id}-${idx}`} className="bg-slate-900/20 hover:bg-slate-900/40 rounded-lg">
                                        <td className="py-2.5 px-2 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                                        <td className="py-2.5 px-2 text-slate-300 font-bold max-w-[120px] truncate" title={o.customerName}>
                                          {o.customerName}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono text-emerald-400 font-extrabold">
                                          {(parseFloat(o.packagingFee) || 0).toLocaleString()} SAR
                                        </td>
                                      </tr>
                                    ))
                                      )}
                                  </tbody>
                              </table>
                            </div>
                          </div>

                          {/* 2. Direct Packaging Expenses Table (الخرج) */}
                          <div className="space-y-3 bg-slate-900/10 p-5 border border-slate-850/50 rounded-2xl">
                            <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                              <span className="text-xs font-black text-rose-400">
                                {isAr ? '🔴 الخرج والمصاريف (سندات الصرف والمشتريات)' : 'OpEx Outflow (Packaging Expenses)'}
                              </span>
                              <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-black">
                                {directPackagingExpenses.toLocaleString()} YER
                              </span>
                            </div>

                            <div className="overflow-x-auto w-full max-w-full pb-2">
                              <table className="w-full text-xs text-start border-separate border-spacing-y-1 min-w-[350px]">
                                <thead>
                                  <tr className="text-slate-550 font-black">
                                    <th className="py-1 px-2 text-start">{isAr ? 'رقم السند' : 'ID'}</th>
                                    <th className="py-1 px-2 text-start">{isAr ? 'البيان الوصفي' : 'Statement'}</th>
                                    <th className="py-1 px-2 text-right">{isAr ? 'المقدار' : 'Amount'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredData.expenses.filter(e => e.category === 'PACKAGING').length === 0 ? (
                                    <tr>
                                      <td colSpan={3} className="text-center py-6 text-slate-600 font-bold italic">
                                        {isAr ? 'لم تسجل أي فواتير لشراء مواد تغليف كرتون كرتونية بالفترة' : 'No packaging expenses logged.'}
                                      </td>
                                    </tr>
                                  ) : (
                                    filteredData.expenses.filter(e => e.category === 'PACKAGING').map((e, idx) => (
                                      <tr key={`${e.id}-${idx}`} className="bg-slate-900/20 hover:bg-slate-900/40 rounded-lg">
                                        <td className="py-2.5 px-2 font-mono font-black text-[#d4af37]">{e.expenseNumber}</td>
                                        <td className="py-2.5 px-2 text-slate-300 max-w-[120px] truncate" title={e.notes || e.recipientName}>
                                          {e.notes || e.recipientName}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono text-rose-400 font-bold">
                                          {e.amount?.toLocaleString()} {e.currency}
                                        </td>
                                      </tr>
                                    ))
                                      )}
                                  </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* 3. Ledger Entries Table (قيود الحساب) */}
                        <div className="space-y-3 bg-slate-900/10 p-5 border border-slate-850/50 rounded-2xl">
                          <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                            <span className="text-xs font-black text-white">
                              {isAr ? 'سجل القيود المحاسبية التفصيلية (حساب التغليف)' : 'Packaging Account Detailed Ledger'}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-black">
                              {pkgTxs.length} {isAr ? 'حركات' : 'Entries'}
                            </span>
                          </div>

                          <div className="overflow-x-auto w-full max-w-full pb-2">
                            <table className="w-full text-xs text-start border-separate border-spacing-y-1 min-w-[600px]">
                              <thead>
                                <tr className="text-slate-550 font-black">
                                  <th className="py-1 px-2 text-start">{isAr ? 'رقم القيد' : 'Ref No'}</th>
                                  <th className="py-1 px-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                                  <th className="py-1 px-2 text-start">{isAr ? 'البيان والتفاصيل' : 'Description'}</th>
                                  <th className="py-1 px-2 text-right">{isAr ? 'مدين (Debit)' : 'Debit'}</th>
                                  <th className="py-1 px-2 text-right">{isAr ? 'دائن (Credit)' : 'Credit'}</th>
                                  <th className="py-1 px-2 text-right">{isAr ? 'رصيد القيد' : 'Balance'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pkgTxs.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="text-center py-6 text-slate-600 font-bold italic">
                                      {isAr ? 'لا توجد قيود مالية مسجلة في دفتر حساب التغليف لهذه الفترة' : 'No ledger entries recorded for packaging account in this period.'}
                                    </td>
                                  </tr>
                                ) : (
                                  pkgTxs.map((tx, idx) => (
                                    <tr key={`${tx.id}-${idx}`} className="bg-slate-900/20 hover:bg-slate-900/40 rounded-lg">
                                      <td className="py-2.5 px-2 font-mono font-black text-slate-400">{tx.refNumber || '-'}</td>
                                      <td className="py-2.5 px-2 text-slate-400 font-mono">{tx.createdAt ? format(new Date(tx.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                      <td className="py-2.5 px-2 text-slate-300 font-bold max-w-[200px] truncate" title={tx.description}>
                                        {tx.description}
                                      </td>
                                      <td className="py-2.5 px-2 text-right font-mono font-bold text-rose-400">
                                        {tx.type === 'Debit' ? `${(parseFloat(tx.amount) || 0).toLocaleString()} ${accounts.find(a => a.id === tx.accountId)?.currency || 'SAR'}` : '-'}
                                      </td>
                                      <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-400">
                                        {tx.type === 'Credit' ? `${(parseFloat(tx.amount) || 0).toLocaleString()} ${accounts.find(a => a.id === tx.accountId)?.currency || 'SAR'}` : '-'}
                                      </td>
                                      <td className="py-2.5 px-2 text-right font-mono font-black text-[#d4af37]">
                                        {tx.balanceAfter ? `${(parseFloat(tx.balanceAfter as any) || 0).toLocaleString()}` : '-'}
                                      </td>
                                    </tr>
                                  ))
                                      )}
                                  </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
      </div>
  );
};

export default PackagingReport;

