import type { ReportAccount, ReportCourier, ReportExpense, ReportOrder, ReportTransaction } from '../../report-row-types';
/**
 * @file CouriersReport.tsx
 * @description تقرير المناديب والتحصيلات والعهدة المعلقة
 * Couriers registry and outstanding custody report
 */

import React from 'react';
import { format } from 'date-fns';

interface CouriersReportProps {
  isAr: boolean;
  filteredData: { couriers: any[]; orders: any[] };
  accounts: any[];
  accountTransactions: any[];
  selectedCourierId: string | null;
  setSelectedCourierId: (id: string | null) => void;
  searchMatchList: (list: any[], key: string) => any[];
  convertToYER: (amount: number, currency: string) => number;
}

// ─── CouriersReport Component ───────────────────────────────────────────────
const CouriersReport: React.FC<CouriersReportProps> = ({
  isAr,
  filteredData,
  accounts,
  accountTransactions,
  selectedCourierId,
  setSelectedCourierId,
  searchMatchList,
  convertToYER
}) => {
  const expenses = (filteredData as any).expenses || [];
  const couriers = (filteredData as any).couriers || [];
  return (
      <div>
                <div className="space-y-6">
                  {selectedCourierId === null ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-white">{isAr ? 'تقرير تصفية عهد وأداء المندوبين' : 'Couriers Ledger & Outstanding Custodies'}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? 'اختر أي مندوب لمراجعة نسب التسليم وأرصدة العهد النقدية والشحنات الموكلة لمسؤوليته بالكامل' : 'Select a courier to drill into delivery KPIs, dynamic outstanding cassiers and cash custody journals.'}</p>
                      </div>

                      <div className="overflow-x-auto w-full max-w-full pb-2">
                        <table className="w-full text-xs text-start border-separate border-spacing-y-1.5 min-w-[700px]">
                          <thead>
                            <tr className="text-slate-550 font-black text-center">
                              <th className="py-2 px-3 text-start">{isAr ? 'اسم المندوب' : 'Courier Name'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'مسؤولية النطاق' : 'Domain Role'}</th>
                              <th className="py-2 px-3">{isAr ? 'العهد المتبقية معلقة بذمته' : 'Outstanding Custody'}</th>
                              <th className="py-2 px-3 text-right">{isAr ? 'أرصد الحساب المالي' : 'Account Balance'}</th>
                              <th className="py-2 px-3 text-center">{isAr ? 'الإجراء التفصيلي' : 'Action'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {searchMatchList(filteredData.couriers, 'fullName').map((c) => {
                              const acc = accounts.find((a: ReportAccount) => a.entityType === 'courier' && a.entityId === c.id);
                              const bal = acc ? acc.balance : (c.financialBalance || 0);
                              const cur = acc ? acc.currency : (c.financialCurrency || 'SAR');
                              const pendingCustody = expenses
                                .filter((e: ReportExpense) => e.recipientEntityId === c.id && e.type === 'Custody' && e.status === 'Pending')
                                .reduce((sum: number, e: ReportExpense) => sum + (parseFloat(String(e.amount ?? 0)) || 0), 0);
                              return (
                                <tr key={c.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl text-center cursor-pointer transition" onClick={() => setSelectedCourierId(c.id)}>
                                  <td className="py-3 px-3 font-bold text-white text-start">{c.fullName}</td>
                                  <td className="py-3 px-3 text-center">
                                    <span className="px-2 py-0.5 bg-blue-500/5 text-blue-400 border border-blue-500/20 rounded-md text-[9.5px] font-extrabold uppercase">
                                      {c.courierType === 'sourcing' ? (isAr ? 'مندوب تجميع خارجي' : 'External Sourcing') : (isAr ? 'تحديث وتوزيع داخلي' : 'Local Delivery')}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 font-mono font-black text-amber-500">
                                    {pendingCustody.toLocaleString()} {cur}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">
                                    {bal.toLocaleString()} {cur}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <button className="p-1 px-2.5 bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 rounded-md text-[10px] font-black">
                                      {isAr ? 'تحليل الأداء' : 'Stat analysis'}
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
                    // SELECTED COURIER DETAIL DISPLAY SECTION
                    <div className="space-y-6 animate-fade-in">
                      {(() => {
                        const courier = couriers.find((c: ReportCourier) => c.id === selectedCourierId);
                        if (!courier) return <p className="text-slate-500">Courier not found.</p>;

                        const coOrders = filteredData.orders.filter((o: ReportOrder) => o.shippingCourierId === courier.id || o.deliveryCourierId === courier.id || o.courierId === courier.id);
                        const totalAssigned = coOrders.length;
                        const deliveredCo = coOrders.filter((o: ReportOrder) => ['Completed', 'Delivered', 'تم التسليم'].includes(o.orderStatus ?? ''));
                        const successRate = totalAssigned > 0 ? Math.round((deliveredCo.length / totalAssigned) * 105) : 0;
                        const pendingCustody = expenses
                          .filter((e: ReportExpense) => e.recipientEntityId === courier.id && e.type === 'Custody' && e.status === 'Pending')
                          .reduce((sum: number, e: ReportExpense) => sum + (parseFloat(String(e.amount ?? 0)) || 0), 0);

                        return (
                          <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setSelectedCourierId(null)}
                                  className="p-1.5 px-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black transition"
                                >
                                  {isAr ? '← تراجع' : '← Back'}
                                </button>
                                <div>
                                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">{courier.courierType}</span>
                                  <h4 className="text-sm font-black text-white mt-1">
                                    {isAr ? `تصفية عهد وملف مندوب: ${courier.fullName}` : `Courier statement dashboard: ${courier.fullName}`}
                                  </h4>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-black text-slate-500 uppercase">COURIER SYSTEM FILE</span>
                            </div>

                            {/* stats widgets */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl">
                                <span className="text-[10px] text-amber-500 font-bold block mb-1">{isAr ? 'العهدة المالية المعلقة بذمته' : 'Pending Custody Owed'}</span>
                                <span className="text-lg font-mono font-black text-amber-500">{pendingCustody.toLocaleString()} {(() => { const acc = accounts.find((a: ReportAccount) => a.entityType === 'courier' && a.entityId === courier.id); return acc ? acc.currency : (courier.financialCurrency || 'SAR'); })()}</span>
                                <p className="text-[9px] text-slate-655 mt-1">{isAr ? 'مبالغ تحت التسوية والمحاسبة اليومية' : 'Unsettled cash from deliveries'}</p>
                              </div>
                              <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl">
                                <span className="text-[10px] text-emerald-400 font-bold block mb-1">{isAr ? 'الرصيد الجاري المستحق' : 'Aggregate Account Balance'}</span>
                                <span className="text-lg font-mono font-black text-emerald-400">{(() => {
                                  const acc = accounts.find((a: ReportAccount) => a.entityType === 'courier' && a.entityId === courier.id);
                                  const bal = acc ? acc.balance : (courier.financialBalance || 0);
                                  const cur = acc ? acc.currency : (courier.financialCurrency || 'SAR');
                                  return `${bal.toLocaleString()} ${cur}`;
                                })()}</span>
                              </div>
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'معدل نجاح الشحنات الموكلة' : 'Successful Delivery Rate'}</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-lg font-mono font-black text-[#d4af37]">{successRate > 100 ? 100 : successRate}%</span>
                                  <span className="text-[10px] text-slate-500 font-mono">({deliveredCo.length}/{totalAssigned})</span>
                                </div>
                              </div>
                              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                <span className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'عدد الشحنات الكلي المسندة' : 'Total Assigned Tasks'}</span>
                                <span className="text-lg font-mono font-black text-white">{coOrders.length} <span className="text-xs font-sans text-slate-550">{isAr ? 'شحنة' : 'orders'}</span></span>
                              </div>
                            </div>

                            {/* linked courier orders log */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <span className="text-xs font-black text-white block">{isAr ? 'سجل حركات شحنات المندوب المقترنة' : 'Assigned order manifest log'}</span>
                                <div className="overflow-x-auto bg-slate-900/10 rounded-2xl border border-slate-850/50">
                                  <table className="w-full text-xs text-start border-separate border-spacing-y-1 p-2">
                                    <thead>
                                      <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                        <th className="py-2.5 px-3 text-start">{isAr ? 'رقم الشحنة' : 'Order ID'}</th>
                                        <th className="py-2.5 px-3">{isAr ? 'المستلم' : 'Customer'}</th>
                                        <th className="py-2.5 px-3 text-right">{isAr ? 'المطلوب تحصيله' : 'Required'}</th>
                                        <th className="py-2.5 px-3 text-center">{isAr ? 'حالتها' : 'Status'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {coOrders.length === 0 ? (
                                        <tr>
                                          <td colSpan={4} className="text-center py-6 text-slate-650 italic font-bold">
                                            {isAr ? 'لا توجد شحنات مرتبطة بهذا المندوب حاليا' : 'No orders linked against this courier.'}
                                          </td>
                                        </tr>
                                      ) : (
                                        coOrders.map(o => (
                                          <tr key={o.id} className="bg-slate-900/20 hover:bg-slate-900/50 rounded-xl">
                                            <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                                            <td className="py-3 px-3 font-bold text-white max-w-[120px] truncate">{o.customerName}</td>
                                            <td className="py-3 px-3 text-right font-mono text-emerald-450 font-black">{o.totalPrice?.toLocaleString()} YER</td>
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
                                <span className="text-xs font-black text-white block">{isAr ? 'سجل الحركات والقيود المحاسبية للمندوب' : 'Courier Accounting Ledger'}</span>
                                <div className="overflow-x-auto bg-slate-900/10 rounded-2xl border border-slate-850/50">
                                  <table className="w-full text-xs text-start border-separate border-spacing-y-1 p-2">
                                    <thead>
                                      <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                        <th className="py-2.5 px-3 text-start">{isAr ? 'رقم القيد' : 'Ref'}</th>
                                        <th className="py-2.5 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                                        <th className="py-2.5 px-3">{isAr ? 'الشرح' : 'Description'}</th>
                                        <th className="py-2.5 px-3 text-right">{isAr ? 'القيمة' : 'Amount'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        const staffTxs = accountTransactions.filter(tx =>
                                          (courier.financialAccountId && tx.accountId === courier.financialAccountId) ||
                                          tx.description?.includes(courier.fullName) ||
                                          tx.description?.includes(courier.displayName || '---')
                                        );

                                        if (staffTxs.length === 0) {
                                          return (
                                            <tr>
                                              <td colSpan={4} className="text-center py-6 text-slate-650 italic font-bold">
                                                {isAr ? 'لا توجد قيود مالية مسجلة' : 'No financial ledger entries found.'}
                                              </td>
                                            </tr>
                                          );
                                        }

                                        return staffTxs.map(tx => (
                                          <tr key={tx.id} className="bg-slate-900/20 hover:bg-slate-900/50 rounded-xl">
                                            <td className="py-3 px-3 font-mono text-slate-400">{tx.refNumber || '-'}</td>
                                            <td className="py-3 px-3 text-slate-500 font-mono">{tx.createdAt ? format(new Date(tx.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                            <td className="py-3 px-3 text-slate-300 max-w-[150px] truncate">{tx.description}</td>
                                            <td className={`py-3 px-3 text-right font-mono font-bold ${tx.type === 'Debit' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                              {tx.type === 'Debit' ? '+' : '-'}{(parseFloat(tx.amount) || 0).toLocaleString()} {tx.currencyOriginal || 'SAR'}
                                            </td>
                                          </tr>
                                        ));
                                      })()}
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

export default CouriersReport;

