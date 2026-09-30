import React from 'react';
import { User, Printer, CreditCard } from 'lucide-react';

interface CustomerAuditTabProps {
  isAr: boolean;
  customers: any[];
  auditedCustomerId: string;
  setAuditedCustomerId: React.Dispatch<React.SetStateAction<string>>;
  customerLedgerDetails: any | null;
  triggerPrint: (title: string, elementId: string) => void;
  setIsPayModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function CustomerAuditTab({ isAr, customers, auditedCustomerId, setAuditedCustomerId, customerLedgerDetails, triggerPrint, setIsPayModalOpen }: CustomerAuditTabProps) {
  return (
        <div className="space-y-6 flex flex-col">
          <div className="bg-[#121215] border border-slate-850 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-[#d4af37] mb-1.5 uppercase tracking-wider">{isAr ? 'اختر العميل المراد فتح كشف حسابه الدفتري التفصيلي بمستحقات الشحن' : 'Select Customer Account for Sub-Ledger Audit'}</label>
              <select
                value={auditedCustomerId}
                onChange={e => setAuditedCustomerId(e.target.value)}
                className="bg-black/40 border border-slate-850 text-white rounded-xl px-4 py-3 text-xs font-extrabold outline-none focus:border-[#d4af37] cursor-pointer w-full md:max-w-md"
              >
                <option value="">{isAr ? '-- اختر العميل من قائمة الحسابات --' : '-- Choose Customer Account --'}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.fullName} ({c.phone})</option>
                ))}
              </select>
            </div>

            {customerLedgerDetails && (
              <div className="flex gap-2 w-full md:w-auto">
                {/* Print Statement Button */}
                <button
                  onClick={() => triggerPrint(isAr ? `كشف الحساب المالي لعميل: ${customerLedgerDetails.customer.fullName}` : 'Client Account Sub-Ledger', 'customer-print-wrapper')}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-black transition-all"
                >
                  <Printer className="w-4 h-4 text-[#d4af37]" />
                  {isAr ? 'طباعة كشف حساب رسمي' : 'Print Account Statement'}
                </button>

                {/* Receive Cash payment button */}
                <button
                  onClick={() => setIsPayModalOpen(true)}
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 ml-auto md:ml-0"
                >
                  <CreditCard className="w-4 h-4" />
                  {isAr ? 'توريد دفعة نقدية (السداد بـ FIFO)' : 'Receive Debt Cash Payment'}
                </button>
              </div>
            )}
          </div>

          {customerLedgerDetails ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="customer-print-wrapper">

              {/* Detailed Client ledger summary cards */}
              <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl text-start shadow-md space-y-4 lg:col-span-1">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20 text-emerald-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{customerLedgerDetails.customer.fullName}</h3>
                    <p className="text-[9px] text-[#d4af37] font-bold uppercase">{customerLedgerDetails.customer.phone || 'Corporate Customer'}</p>
                    <p className="text-[9.5px] text-slate-500 font-mono mt-0.5">{customerLedgerDetails.customer.address || (isAr ? 'اليمن' : 'Yemen')}</p>
                  </div>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-black">{isAr ? 'إجمالي قيمة تعاملات الشحن المدين' : 'Gross Purchases / Cargo Debits'}</span>
                    <span className="text-base font-mono font-black text-white">{customerLedgerDetails.grossFreightValuation.toLocaleString()} {customerLedgerDetails.customer.financialCurrency || 'YER'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-black">{isAr ? 'المبالغ المسددة والمقيدة كداين' : 'Settle Paid Revenues'}</span>
                    <span className="text-base font-mono font-black text-emerald-400">{customerLedgerDetails.netPaidRevenues.toLocaleString()} {customerLedgerDetails.customer.financialCurrency || 'YER'}</span>
                  </div>

                  {/* Cumulative Ledger Net balance */}
                  <div className="bg-amber-500/5 p-4 rounded-3xl border border-amber-500/10">
                    <span className="text-[10px] text-amber-500 uppercase block font-black">{isAr ? 'رصيد الحساب المتبقي بذمته (مطالبة مالية)' : 'Actual Outstanding Debit Balance'}</span>
                    <span className="text-xl font-mono font-black text-amber-500">{customerLedgerDetails.currentOutstandingBalance.toLocaleString()} {customerLedgerDetails.customer.financialCurrency || 'YER'}</span>
                    <span className="text-[8.5px] text-slate-500 block mt-1 leading-snug">
                      {isAr ? 'حاصل المديونية التراكمي المتبقي بذمة هذا الحساب عن شحنات الشحن والرسوم المعلقة.' : 'Cumulative balanced outstanding cargo debts waiting for collections.'}
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl text-[9.5px] font-bold flex justify-between items-center text-slate-300">
                    <span>{isAr ? 'أولوية سداد الديون:' : 'Aging / payment logic:'}</span>
                    <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded uppercase font-extrabold font-mono">FIFO Queue Settle</span>
                  </div>
                </div>
              </div>

              {/* Chronological Subsidiary sub-ledger list */}
              <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl text-start shadow-md lg:col-span-2 space-y-4 flex flex-col">
                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>{isAr ? 'السجل التفصيلي لقيود حساب العميل' : 'Customer Account Timeline Sub-Ledger'}</span>
                  <span className="text-[10px] text-[#d4af37] font-mono">({customerLedgerDetails.accountingTimeline.length} entries)</span>
                </h3>

                <div className="overflow-x-auto flex-1 max-h-96">
                  <table className="w-full text-start text-[11px]">
                    <thead className="bg-[#0b0b0e] text-slate-500 text-[9px] font-bold uppercase border-b border-slate-850">
                      <tr>
                        <th className="p-3">{isAr ? 'الحدث' : 'Date'}</th>
                        <th className="p-3">{isAr ? 'سند/مرجع' : 'Document ID'}</th>
                        <th className="p-3">{isAr ? 'البيان وتفاصيل الحركة' : 'Particulars'}</th>
                        <th className="p-3 text-right">{isAr ? 'مدين (+)' : 'Debit (+)'}</th>
                        <th className="p-3 text-right">{isAr ? 'دائن (-)' : 'Credit (-)'}</th>
                        <th className="p-3 text-left">{isAr ? 'الرصيد التراكمي' : 'Balance'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 font-semibold bg-black/5">
                      {customerLedgerDetails.accountingTimeline.map((row: any) => (
                        <tr key={row.id} className="hover:bg-slate-900/30">
                          <td className="p-3 text-slate-500 text-[10px] whitespace-nowrap">
                            {row.date.toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            <span className="bg-slate-900 text-slate-350 px-2 py-0.5 rounded font-mono text-[9px] border border-slate-800">
                              {row.ref}
                            </span>
                          </td>
                          <td className="p-3 text-slate-300 text-xs">
                            {row.description}
                          </td>
                          <td className="p-3 text-right font-mono text-rose-452 text-rose-400">
                            {row.debit > 0 ? (
                              <div className="flex flex-col items-end">
                                <span>+{(row.amountOriginal || row.debit).toLocaleString()} {row.currencyOriginal || (customerLedgerDetails.customer.financialCurrency || 'YER')}</span>
                                {row.currencyOriginal && row.currencyOriginal !== (customerLedgerDetails.customer.financialCurrency || 'YER') && (
                                  <span className="text-[8px] text-slate-500 font-normal">≈ {row.debit.toLocaleString()} {customerLedgerDetails.customer.financialCurrency || 'YER'}</span>
                                )}
                              </div>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-400">
                            {row.credit > 0 ? (
                              <div className="flex flex-col items-end">
                                <span>-{(row.amountOriginal || row.credit).toLocaleString()} {row.currencyOriginal || (customerLedgerDetails.customer.financialCurrency || 'YER')}</span>
                                {row.currencyOriginal && row.currencyOriginal !== (customerLedgerDetails.customer.financialCurrency || 'YER') && (
                                  <span className="text-[8px] text-slate-500 font-normal">≈ {row.credit.toLocaleString()} {customerLedgerDetails.customer.financialCurrency || 'YER'}</span>
                                )}
                              </div>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-left font-mono font-black text-slate-200">
                            {row.balance.toLocaleString()} {customerLedgerDetails.customer.financialCurrency || 'YER'}
                          </td>
                        </tr>
                      ))}
                      {customerLedgerDetails.accountingTimeline.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-16 text-center text-slate-500 font-bold font-mono text-[10px] uppercase select-none">
                            [ no_ledger_activities_logged_for_customer ]
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="p-16 text-center text-slate-500 font-black font-mono text-[10px] uppercase border border-dashed border-slate-850 rounded-3xl">
              [ {isAr ? 'يرجى اختيار العميل من القائمة أعلاه لسحب ومطابقة كشوفات ذمته التفصيلية' : 'select_buyer_from_selector_to_render_standing_account'} ]
            </div>
          )}
        </div>
  );
}
