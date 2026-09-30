/**
 * @file CustomersReport.tsx
 * @description تقرير كشف العملاء والذمم والمديونيات
 * Customers ledger and balances report
 */

import React from 'react';
import { format } from 'date-fns';

interface CustomersReportProps {
  isAr: boolean;
  filteredData: { customers: any[]; orders: any[] };
  accounts: any[];
  accountTransactions: any[];
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  searchMatchList: (list: any[], key: string) => any[];
  convertToYER: (amount: number, currency: string) => number;
  convertCurrency: (amount: number, from: string, to: string) => number;
}

// ─── CustomersReport Component ──────────────────────────────────────────────
const CustomersReport: React.FC<CustomersReportProps> = ({
  isAr,
  filteredData,
  accounts,
  accountTransactions,
  selectedCustomerId,
  setSelectedCustomerId,
  searchMatchList,
  convertToYER,
  convertCurrency
}) => {
  const customers = (filteredData as any).customers || [];
  return (
      <div>
                <div className="space-y-6">
                  {selectedCustomerId === null ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-white">{isAr ? 'كشف العملاء والذمم والمديونيات' : 'Customers Ledger & Dues Report'}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? 'اختر أي عميل من الجدول لإنشاء بيان ذمم تفصيلي وكشف كلي للشحنات والمدفوعات والمستندات' : 'Select any client to extract account statement, transactions and outstanding balances.'}</p>
                      </div>

                      <div className="overflow-x-auto w-full max-w-full pb-2">
                        <table className="w-full text-xs text-start border-separate border-spacing-y-1.5 min-w-[680px]">
                          <thead>
                            <tr className="text-slate-550 font-black">
                              <th className="py-2 px-3 text-start">{isAr ? 'اسم العميل' : 'Customer Name'}</th>
                              <th className="py-2 px-3">{isAr ? 'الهاتف التواصل' : 'Contact Phone'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'العملة الأساسية' : 'Currency'}</th>
                              <th className="py-2 px-3 text-right">{isAr ? 'الرصيد الختامي' : 'Terminal Balance'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'الإجراء' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {searchMatchList(filteredData.customers, 'fullName').map((c) => {
                              const acc = accounts.find(a => a.entityType === 'customer' && a.entityId === c.id);
                              const bal = acc ? acc.balance : (c.financialBalance || 0);
                              const cur = acc ? acc.currency : (c.financialCurrency || 'SAR');
                              return (
                                <tr key={c.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl cursor-pointer transition animate-fade-in" onClick={() => setSelectedCustomerId(c.id)}>
                                  <td className="py-3 px-3 font-bold text-white text-start">{c.fullName}</td>
                                  <td className="py-3 px-3 text-slate-450 font-mono font-bold">{c.phone || '-'}</td>
                                  <td className="py-3 px-3 text-[10px] text-center font-black text-slate-400 uppercase">{cur}</td>
                                  <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">{bal.toLocaleString()} {cur}</td>
                                  <td className="py-3 px-3 text-center">
                                    <button className="p-1 px-2.5 bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 rounded-md text-[10px] font-black">
                                      {isAr ? 'كشف حساب' : 'Extract'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    // CUSTOMER DRILLDOWN DETAIL STATEMENT WINDOW
                    <div className="space-y-6 animate-fade-in">
                      {(() => {
                        const cust = customers.find(c => c.id === selectedCustomerId);
                        if (!cust) return <p className="text-slate-500">Customer not found.</p>;

                        const custAcc = accounts.find(a => a.entityType === 'customer' && a.entityId === cust.id);
                        const custOrders = filteredData.orders.filter(o => o.customerId === cust.id || o.customerName === cust.fullName || o.customerPhone === cust.phone);
                        const grossSum = custOrders.reduce((sum, o) => sum + convertCurrency(parseFloat(o.totalPrice) || 0, o.currency || 'YER', 'YER'), 0);
                        const paidSum = custOrders.reduce((sum, o) => sum + convertCurrency(parseFloat(o.amountPaid) || 0, o.currency || 'YER', 'YER'), 0);
                        const remainDebt = custOrders.reduce((sum, o) => sum + convertCurrency(parseFloat(o.amountRemaining) || 0, o.currency || 'YER', 'YER'), 0);
                        const statementsTxs = accountTransactions.filter(tx =>
                          (custAcc && tx.accountId === custAcc.id) ||
                          tx.entityId === cust.id ||
                          tx.description?.includes(cust.fullName) ||
                          (cust.phone && tx.description?.includes(cust.phone))
                        );

                        const custBalance = custAcc ? custAcc.balance : (cust.financialBalance || 0);
                        const custCurrency = custAcc ? custAcc.currency : (cust.financialCurrency || 'SAR');

                        return (
                          <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setSelectedCustomerId(null)}
                                  className="p-1.5 px-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black transition"
                                >
                                  {isAr ? '← تراجع' : '← Back'}
                                </button>
                                <div>
                                  <span className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/25 px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">ACCOUNT CARD</span>
                                  <h4 className="text-sm font-black text-white mt-1">
                                    {isAr ? `كشف حساب العقد والذمة: ${cust.fullName}` : `Statement Log: ${cust.fullName}`}
                                  </h4>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-black text-slate-550 uppercase">RTL ACCOUNT STANDARDS</span>
                            </div>

                            {/* stats cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'الرصيد الدفتري الحالي' : 'Book Account Balance'}</span>
                                <span className="text-lg font-mono font-black text-emerald-400">{custBalance.toLocaleString()} {custCurrency}</span>
                                <p className="text-[9px] text-slate-550 mt-1">{isAr ? 'أرصدة جارية نشطة في الدفتر المركزي' : 'Active currency credit weight'}</p>
                              </div>
                              <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'إجمالي فواتير المشتريات' : 'Gross Purchases Volume'}</span>
                                <span className="text-lg font-mono font-black text-white">{grossSum.toLocaleString()} YER</span>
                                <p className="text-[9px] text-slate-550 mt-1">{isAr ? 'مجموع أسعار الشحنات النقدية الكلية' : 'Total pricing sum from shipping logs'}</p>
                              </div>
                              <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'المسدد الفعلي من العميل' : 'Total settled by customer'}</span>
                                <span className="text-lg font-mono font-black text-teal-400">{paidSum.toLocaleString()} YER</span>
                              </div>
                              <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl text-start">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'المديونية المتبقية (ذمة معلقة)' : 'Pending cargo unpaid debt'}</span>
                                <span className="text-lg font-mono font-black text-rose-450">{remainDebt.toLocaleString()} YER</span>
                              </div>
                            </div>

                            {/* related client transactions/orders */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <span className="text-xs font-black text-white block">{isAr ? 'سجل فواتير شحنات العميل التفصيلية' : 'Comprehensive order history statement'}</span>
                                <div className="overflow-x-auto bg-slate-900/10 rounded-2xl border border-slate-850/50">
                                  <table className="w-full text-xs text-start border-separate border-spacing-y-1 p-2">
                                    <thead>
                                      <tr className="text-slate-550 font-bold border-b border-slate-800 pb-1.5 uppercase">
                                        <th className="py-2 px-3 text-start">{isAr ? 'رقم الشحنة' : 'Order ID'}</th>
                                        <th className="py-2 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                                        <th className="py-2 px-3 text-right">{isAr ? 'القيمة' : 'Cost'}</th>
                                        <th className="py-2 px-3 text-right">{isAr ? 'المسدد' : 'Paid'}</th>
                                        <th className="py-2 px-3 text-right">{isAr ? 'المتبقي' : 'Bal'}</th>
                                        <th className="py-2 px-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {custOrders.length === 0 ? (
                                        <tr>
                                          <td colSpan={6} className="text-center py-6 text-slate-650 italic font-bold">
                                            {isAr ? 'لا توجد أي شحنات مسجلة لهذا العميل في قواعد البيانات' : 'No order logs recorded for this client.'}
                                          </td>
                                        </tr>
                                      ) : (
                                        custOrders.map(o => (
                                          <tr key={o.id} className="bg-slate-900/20 hover:bg-slate-900/50 rounded-xl">
                                            <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                                            <td className="py-3 px-3 text-slate-500 font-mono">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                            <td className="py-3 px-3 text-right font-mono font-bold text-white">{o.totalPrice?.toLocaleString()} YER</td>
                                            <td className="py-3 px-3 text-right font-mono text-emerald-400 font-bold">{(o.amountPaid || 0).toLocaleString()} YER</td>
                                            <td className="py-3 px-3 text-right font-mono text-rose-400 font-bold">{(o.amountRemaining || 0).toLocaleString()} YER</td>
                                            <td className="py-3 px-3 text-center">
                                              <span className="px-2 py-0.5 rounded text-[9.5px] bg-slate-950 text-slate-400 border border-slate-850 font-bold truncate max-w-[80px] inline-block">{o.orderStatus}</span>
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                  </tbody>
                                  </table>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <span className="text-xs font-black text-white block">{isAr ? 'سجل الحركات والقيود المحاسبية للعميل' : 'Customer Accounting Ledger'}</span>
                                <div className="overflow-x-auto bg-slate-900/10 rounded-2xl border border-slate-850/50">
                                  <table className="w-full text-xs text-start border-separate border-spacing-y-1 p-2">
                                    <thead>
                                      <tr className="text-slate-550 font-bold border-b border-slate-800 pb-1.5 uppercase">
                                        <th className="py-2 px-3 text-start">{isAr ? 'رقم القيد' : 'Ref'}</th>
                                        <th className="py-2 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                                        <th className="py-2 px-3">{isAr ? 'الشرح' : 'Description'}</th>
                                        <th className="py-2 px-3 text-right">{isAr ? 'القيمة' : 'Amount'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {statementsTxs.length === 0 ? (
                                        <tr>
                                          <td colSpan={4} className="text-center py-6 text-slate-650 italic font-bold">
                                            {isAr ? 'لا توجد قيود مالية مسجلة' : 'No financial ledger entries found.'}
                                          </td>
                                        </tr>
                                      ) : (
                                        statementsTxs.map(tx => (
                                          <tr key={tx.id} className="bg-slate-900/20 hover:bg-slate-900/50 rounded-xl">
                                            <td className="py-3 px-3 font-mono text-slate-400">{tx.refNumber || '-'}</td>
                                            <td className="py-3 px-3 text-slate-500 font-mono">{tx.createdAt ? format(new Date(tx.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                            <td className="py-3 px-3 text-slate-300 max-w-[150px] truncate">{tx.description}</td>
                                            <td className={`py-3 px-3 text-right font-mono font-bold ${tx.type === 'Debit' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                              {tx.type === 'Debit' ? '+' : '-'}{(parseFloat(tx.amount) || 0).toLocaleString()} {tx.currencyOriginal || 'SAR'}
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                  </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
      </div>
  );
};

export default CustomersReport;
