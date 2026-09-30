/**
 * @file OrdersCostReport.tsx
 * @description تقرير تكاليف الطلبات والشحنات
 * Orders cost analysis report
 */

import React from 'react';
import { format } from 'date-fns';
import { Layers } from 'lucide-react';

interface OrdersCostReportProps {
  isAr: boolean;
  filteredData: { orders: any[] };
  accounts: any[];
  accountTransactions: any[];
  selectedOrdersCostAccountIds: string[];
  setSelectedOrdersCostAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  handleSaveAccountSelection: (type: string) => void;
  convertCurrency: (amount: number, from: string, to: string) => number;
  convertToYER: (amount: number, currency: string) => number;
  searchMatchList: (list: any[], key: string) => any[];
  MultiAccountSelectorComponent: React.ComponentType<any>;
}

// ─── OrdersCostReport Component ─────────────────────────────────────────────
const OrdersCostReport: React.FC<OrdersCostReportProps> = ({
  isAr,
  filteredData,
  accounts,
  accountTransactions,
  selectedOrdersCostAccountIds,
  setSelectedOrdersCostAccountIds,
  selectedOrderId,
  setSelectedOrderId,
  handleSaveAccountSelection,
  convertCurrency,
  convertToYER,
  searchMatchList,
  MultiAccountSelectorComponent
}) => {
  const orders = (filteredData as any).orders || [];
  const couriers = (filteredData as any).couriers || [];
  return (
      <div>
                <div className="space-y-6">
                  {(() => {
                    const displayAccounts = accounts.filter(a => selectedOrdersCostAccountIds.includes(a.id));
                    const displayCurrency = displayAccounts[0]?.currency || 'SAR';
                    const alternativeCurrency = displayCurrency === 'SAR' ? 'YER' : 'SAR';

                    const totalConsolidatedBalance = displayAccounts.reduce(
                      (sum, a) => sum + convertCurrency(parseFloat(a.balance as any) || 0, a.currency || 'SAR', displayCurrency),
                      0
                    );

                    // Aggregation from active orders
                    const totalDirectShippingCostSAR = filteredData.orders
                      .filter(o => o.orderStatus !== 'Cancelled')
                      .reduce((sum, o) => sum + (parseFloat(o.shippingCostSAR as any) || 0), 0);
                    const totalDirectShippingCostDisplay = convertCurrency(totalDirectShippingCostSAR, 'SAR', displayCurrency);

                    const totalDirectPackagingFeeSAR = filteredData.orders
                      .filter(o => o.orderStatus !== 'Cancelled')
                      .reduce((sum, o) => sum + (parseFloat(o.packagingFee as any) || 0), 0);
                    const totalDirectPackagingFeeDisplay = convertCurrency(totalDirectPackagingFeeSAR, 'SAR', displayCurrency);

                    // Transactions on selected cost accounts
                    const costAccountIds = displayAccounts.map(a => a.id);
                    const costTxs = accountTransactions.filter(tx => costAccountIds.includes(tx.accountId) || costAccountIds.includes(tx.entityId));

                    const totalCostDebit = costTxs
                      .filter(tx => tx.type === 'Debit')
                      .reduce((sum, tx) => {
                        const txAcc = accounts.find(a => a.id === tx.accountId);
                        const txCurrency = txAcc?.currency || tx.currency || 'SAR';
                        return sum + convertCurrency(parseFloat(tx.amount) || 0, txCurrency, displayCurrency);
                      }, 0);

                    const totalCostCredit = costTxs
                      .filter(tx => tx.type === 'Credit')
                      .reduce((sum, tx) => {
                        const txAcc = accounts.find(a => a.id === tx.accountId);
                        const txCurrency = txAcc?.currency || tx.currency || 'SAR';
                        return sum + convertCurrency(parseFloat(tx.amount) || 0, txCurrency, displayCurrency);
                      }, 0);

                    const netCostFromLedger = totalCostDebit - totalCostCredit;

                    const totalDirectShippingCostAlternative = convertCurrency(totalDirectShippingCostDisplay, displayCurrency, alternativeCurrency);
                    const netCostFromLedgerAlternative = convertCurrency(netCostFromLedger, displayCurrency, alternativeCurrency);
                    const totalConsolidatedBalanceAlternative = convertCurrency(totalConsolidatedBalance, displayCurrency, alternativeCurrency);

                    return (
                      <div className="space-y-6">
                        <MultiAccountSelectorComponent
                          selectedIds={selectedOrdersCostAccountIds}
                          setSelectedIds={setSelectedOrdersCostAccountIds}
                          labelAr="حدد حسابات تكاليف الطلبات والشحن من شجرة الحسابات لعرض تفاصيلها والعمليات المرتبطة بها تلقائياً"
                          labelEn="Select orders and shipping costs accounts from the chart of accounts"
                          accounts={accounts}
                          isAr={isAr}
                          onSave={() => handleSaveAccountSelection('orders_cost')}
                        />

                        {/* Interactive Financial Card Header */}
                        {displayAccounts.length > 0 && (
                          <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden space-y-4">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full blur-2xl pointer-events-none" />
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div className="space-y-1">
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider block w-fit">
                                  {isAr ? 'الحسابات المالية المحددة لتكاليف الطلبات والشحن' : 'Selected Orders Cost Ledger Nodes'}
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
                              </div>
                              <div className="p-4 bg-slate-950/80 border border-slate-850 rounded-xl text-end self-stretch md:self-auto min-w-[160px]">
                                <span className="text-[10px] text-slate-550 block font-bold mb-0.5">
                                  {isAr ? 'الرصيد التراكمي المدمج:' : 'Consolidated Balance:'}
                                </span>
                                <span className={`text-md font-mono font-black ${totalConsolidatedBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {totalConsolidatedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                                </span>
                                <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                                  ≈ {totalConsolidatedBalanceAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                                </p>
                              </div>
                            </div>

                            {/* Stats grids for costs */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                              <div className="p-3.5 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                                <span className="text-[10px] text-rose-400 font-bold block mb-1">
                                  {isAr ? 'تكاليف الشحن من الشحنات المباشرة (SAR)' : 'Direct Shipments Shipping Cost (SAR)'}
                                </span>
                                <span className="text-md font-mono font-black text-rose-400">
                                  {totalDirectShippingCostSAR.toLocaleString()} <span className="text-[10px]">SAR</span>
                                </span>
                                <p className="text-[9px] text-slate-500 mt-1">
                                  ≈ {totalDirectShippingCostDisplay.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                                </p>
                              </div>

                              <div className="p-3.5 bg-slate-900/60 border border-slate-850 rounded-xl">
                                <span className="text-[10px] text-slate-400 font-bold block mb-1">
                                  {isAr ? 'إجمالي المدفوعات المسجلة للناقلين (Ledger Debits)' : 'Total Carrier Ledger Debits'}
                                </span>
                                <span className="text-md font-mono font-black text-white">
                                  {totalCostDebit.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px]">{displayCurrency}</span>
                                </span>
                                <p className="text-[9px] text-slate-550 mt-1">
                                  {isAr ? `تتضمن دفعات شركات الشحن والتوصيل بالفترة` : `Payments registered on transport ledgers.`}
                                </p>
                              </div>

                              <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                                <span className="text-[10px] text-amber-400 font-bold block mb-1">
                                  {isAr ? 'صافي فارق تكاليف الشحن الدفتري' : 'Net Book Shipping Variance'}
                                </span>
                                <span className="text-md font-mono font-black text-amber-400">
                                  {netCostFromLedger.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px]">{displayCurrency}</span>
                                </span>
                                <p className="text-[9px] text-slate-550 mt-1">
                                  ≈ {netCostFromLedgerAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedOrderId === null ? (

                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-black text-white">{isAr ? 'تكاليف الطلبات والشحنات اللوجستية' : 'Orders & Shipments Cost Report'}</h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? 'اختر أي شحنة للوصول الفوري لبيانات الدفاتر وحركات الذمم وسجل المندوبين المتكامل' : 'Select an order to analyze its financial journal, customers, and couriers.'}</p>
                            </div>

                            <div className="overflow-x-auto w-full max-w-full pb-2">
                              <table className="w-full text-xs text-start border-separate border-spacing-y-1 min-w-[700px]">
                                <thead>
                                  <tr className="text-slate-550 font-black">
                                    <th className="py-2 px-3">{isAr ? 'رقم الشحنة' : 'Order ID'}</th>
                                    <th className="py-2 px-3">{isAr ? 'العميل' : 'Customer'}</th>
                                    <th className="py-2 px-3">{isAr ? 'تاريخ الإنشاء' : 'Created At'}</th>
                                    <th className="py-2 px-3">{isAr ? 'حالة الشحن' : 'Status'}</th>
                                    <th className="py-2 px-3 text-right">{isAr ? 'رسوم الشحن' : 'Shipping Cost'}</th>
                                    <th className="py-2 px-3 text-right">{isAr ? 'رسوم التغليف' : 'Packaging'}</th>
                                    <th className="py-2 px-3 text-right">{isAr ? 'صافي القيمة المستحقة' : 'Net Price'}</th>
                                    <th className="py-2 px-3 text-center">{isAr ? 'الإجراء' : 'Actions'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {searchMatchList(filteredData.orders, 'customerName').map((o, idx) => (
                                    <tr key={`${o.id}-${idx}`} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl transition cursor-pointer" onClick={() => setSelectedOrderId(o.orderNumber || o.id)}>
                                      <td className="py-3 px-3 font-mono font-black text-[#d4af37]">{o.orderNumber}</td>
                                      <td className="py-3 px-3 font-bold text-white">{o.customerName}</td>
                                      <td className="py-3 px-3 text-slate-500 font-mono">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                      <td className="py-3 px-3">
                                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-slate-950 text-slate-400 border border-slate-850 font-bold">{o.orderStatus}</span>
                                      </td>
                                      <td className="py-3 px-3 text-right font-mono text-slate-500">{o.shippingCostSAR?.toLocaleString() || 0}</td>
                                      <td className="py-3 px-3 text-right font-mono text-slate-500">{o.packagingFee?.toLocaleString() || 0}</td>
                                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">{o.totalCostYER?.toLocaleString() || o.totalPrice?.toLocaleString()} YER</td>
                                      <td className="py-3 px-3 text-center">
                                        <button className="p-1 px-2.5 bg-[#d4af37]/10 border border-[#d4af37]/20 text-xs font-black text-[#d4af37] rounded-lg hover:bg-[#d4af37]/25 transition">
                                          {isAr ? 'تحليل السجل' : 'Analyze'}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          // SELECTED ORDER DRILL DOWN STATEMENT DETAIL REPORT
                          <div className="space-y-6">
                            {(() => {
                              const o = orders.find(ord => ord.id === selectedOrderId || ord.orderNumber === selectedOrderId);
                              if (!o) {
                                return (
                                  <div className="p-8 text-center text-slate-500">
                                    {isAr ? 'الشحنة غير متوفرة أو تم حذفها' : 'Order not found.'}
                                    <button onClick={() => setSelectedOrderId(null)} className="block mx-auto mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl">عودة</button>
                                  </div>
                                );
                              }

                              // Retrieve related financial transactions
                              const relatedTxs = accountTransactions.filter(tx => tx.refNumber === o.orderNumber || tx.description?.includes(o.orderNumber));
                              const shippingCourier = couriers.find(c => c.id === o.shippingCourierId);
                              const deliveryCourier = couriers.find(c => c.id === o.deliveryCourierId);

                              return (
                                <div className="space-y-6">
                                  {/* Detailed Subheader Header */}
                                  <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => setSelectedOrderId(null)}
                                        className="p-1.5 px-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black transition"
                                      >
                                        {isAr ? '← عودة للشحنات' : '← Back to List'}
                                      </button>
                                      <div>
                                        <span className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/25 px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase inline-block">{o.orderNumber}</span>
                                        <h4 className="text-sm font-black text-white mt-1">
                                          {isAr ? `التقرير الاستقصائي الموحد للشحنة والمحاسبة` : `Unified Investigation Order Report`}
                                        </h4>
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-mono font-black text-slate-550 uppercase">SWIFTSHIP AUDIT SYSTEM</span>
                                  </div>

                                  {/* Core Metadata Information */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    {/* Customer and phone */}
                                    <div className="p-5 bg-black/20 border border-slate-850 rounded-2xl space-y-2">
                                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">{isAr ? 'العميل والمستلم' : 'Customer Registry'}</span>
                                      <div className="space-y-1">
                                        <h5 className="text-xs font-black text-white">{o.customerName}</h5>
                                        <p className="text-[11px] text-slate-400 font-mono">{o.customerPhone || '-'}</p>
                                        <p className="text-[11px] text-slate-450">{isAr ? 'العنوان / الوجهة:' : 'Shipto Line:'} {o.destinationCity || o.destinationCountry || '-'}</p>
                                      </div>
                                    </div>

                                    {/* Shipping lines and couriers */}
                                    <div className="p-5 bg-black/20 border border-slate-850 rounded-2xl space-y-2">
                                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">{isAr ? 'خط الشحن واللوجستيات' : 'Shipping Partners'}</span>
                                      <div className="space-y-1 text-xs text-slate-350">
                                        <p>{isAr ? 'شركة الشحن المتعاقدة:' : 'Shipping Line:'} <strong className="text-white font-black">{o.shippingCompany || '-'}</strong></p>
                                        <p>{isAr ? 'رقم التتبع الدولي:' : 'Tracking Code:'} <strong className="text-[#d4af37] font-mono">{o.trackingNumber || '-'}</strong></p>
                                        <p className="text-[11px]">{isAr ? 'مندوب التجميع:' : 'Sourcing Courier:'} <span className="text-slate-400 font-bold">{shippingCourier?.fullName || '-'}</span></p>
                                        <p className="text-[11px]">{isAr ? 'مندوب التوصيل:' : 'Delivery Courier:'} <span className="text-slate-400 font-bold">{deliveryCourier?.fullName || '-'}</span></p>
                                      </div>
                                    </div>

                                    {/* Dates & Statuses */}
                                    <div className="p-5 bg-black/20 border border-slate-850 rounded-2xl space-y-2">
                                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">{isAr ? 'الحالات والزمن الفعلي' : 'Time stamps & statuses'}</span>
                                      <div className="space-y-1.5 text-xs">
                                        <p>{isAr ? 'تاريخ التوريد:' : 'Created Date:'} <span className="text-slate-400 font-mono font-bold">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd HH:mm') : '-'}</span></p>
                                        <p>{isAr ? 'تاريخ آخر نشاط لوجستي:' : 'Last Activity:'} <span className="text-slate-400 font-mono">{o.updatedAt ? format(new Date(o.updatedAt), 'yyyy-MM-dd HH:mm') : '-'}</span></p>
                                        <div className="flex gap-2 items-center">
                                          <span>{isAr ? 'الحالة اللوجيستية:' : 'Overall Status:'}</span>
                                          <span className="px-2 py-0.5 rounded text-[9.5px] bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 font-black">{o.orderStatus}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Financial breakdown Cards */}
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl">
                                      <span className="text-[10px] text-slate-500 font-black block uppercase mb-1">{isAr ? 'قيمة الشحنة والمبيعات' : 'Order Cargo Value'}</span>
                                      <span className="text-md font-mono font-black text-white">{((parseFloat(o.totalCostSAR) || 0) - (parseFloat(o.shippingCostSAR) || 0) - (parseFloat(o.packagingFee) || 0)).toLocaleString() || 0} <span className="text-[10px] text-slate-500">SAR</span></span>
                                      <p className="text-[9px] text-slate-550 mt-1">{isAr ? 'القيمة بدون احتساب الرسوم الإضافية' : 'Base inventory shipping value'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl">
                                      <span className="text-[10px] text-slate-500 font-black block uppercase mb-1">{isAr ? 'رسوم الشحن والتغليف المضافة' : 'Surcharges (Shipping & Pkg)'}</span>
                                      <span className="text-md font-mono font-black text-[#d4af37]">
                                        {((o.shippingCostSAR || 0) + (o.packagingFee || 0)).toLocaleString()} <span className="text-[10px]">SAR</span>
                                      </span>
                                      <p className="text-[9px] text-slate-550 mt-1">{isAr ? `شحن: ${o.shippingCostSAR || 0} / تغليف: ${o.packagingFee || 0}` : 'Aggregated surcharges sum'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl">
                                      <span className="text-[10px] text-slate-550 font-black block uppercase mb-1">{isAr ? 'مجموع المقدار المستحق الكلي' : 'Total Price (YER)'}</span>
                                      <span className="text-md font-mono font-black text-rose-400">{(o.totalCostYER || o.totalPrice)?.toLocaleString() || 0} <span className="text-[10px]">YER</span></span>
                                      <p className="text-[9px] text-slate-550 mt-1">{isAr ? 'بعد التحويل للصرف اليمني المحلي' : 'Calculated through active exchange rate.'}</p>
                                    </div>
                                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                                      <span className="text-[10px] text-emerald-400 font-black block mb-1">
                                        {isAr ? 'المدفوع من العميل والذمة المتبقية' : 'Paid vs Remaining Bal'}
                                      </span>
                                      <div className="space-y-0.5">
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-500">{isAr ? 'المدفوع:' : 'Paid:'}</span>
                                          <span className="font-mono text-emerald-400 font-bold">{(o.amountPaid || 0).toLocaleString()} YER</span>
                                        </div>
                                        <div className="flex justify-between text-xs border-t border-dashed border-slate-800 pt-0.5">
                                          <span className="text-slate-500">{isAr ? 'المتبقي:' : 'Owed:'}</span>
                                          <span className="font-mono text-rose-400 font-black">{(o.amountRemaining || 0).toLocaleString()} YER</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* ACCOUNTING JOURNAL DOUBLE ENTRY */}
                                  <div className="space-y-3 pt-2">
                                    <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                                      <span className="text-xs font-black text-[#d4af37] uppercase flex items-center gap-1.5Packed">
                                        <Layers className="w-4 h-4 text-[#d4af37]" />
                                        {isAr ? 'قيود المعاملة والسندات المالية المقيدة في شجرة الدفاتر' : 'Double Entry Journal Postings'}
                                      </span>
                                      <span className="text-[10px] text-slate-550 font-mono font-bold uppercase">{relatedTxs.length} entries registered</span>
                                    </div>

                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs text-start border-collapse">
                                        <thead>
                                          <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                            <th className="py-2.5 px-3 text-start">{isAr ? 'تاريخ المعاملة' : 'Datetime'}</th>
                                            <th className="py-2.5 px-3">{isAr ? 'الرقم المرجعي للسند' : 'Journal ID'}</th>
                                            <th className="py-2.5 px-3 text-center">{isAr ? 'الفئة المحاسبية' : 'Class'}</th>
                                            <th className="py-2.5 px-3">{isAr ? 'الشرح التفصيلي' : 'Narration'}</th>
                                            <th className="py-2.5 px-3 text-right">{isAr ? 'الحركة المدينة (+)' : 'Debit (+)'}</th>
                                            <th className="py-2.5 px-3 text-right">{isAr ? 'الحركة الدائنة (-)' : 'Credit (-)'}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-850/30">
                                          {relatedTxs.length === 0 ? (
                                            <tr>
                                              <td colSpan={6} className="text-center py-8 text-slate-650 font-bold italic">
                                                {isAr ? 'لم تتقاطع أي حركات قيود مالية مع كود شحنة هذا الطلب بعد' : 'No automatic or manual double-entry logs map against this order.'}
                                              </td>
                                            </tr>
                                          ) : (
                                            relatedTxs.map((tx) => (
                                              <tr key={tx.id} className="hover:bg-slate-950/15 font-medium">
                                                <td className="py-3 px-3 text-slate-550">{format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm')}</td>
                                                <td className="py-3 px-3 font-mono font-bold text-slate-350">{tx.refNumber}</td>
                                                <td className="py-3 px-3 text-center">
                                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${tx.type === 'Debit' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                    {tx.type === 'Debit' ? (isAr ? 'مدين / خرج' : 'DEBIT') : (isAr ? 'دائن / دخل' : 'CREDIT')}
                                                  </span>
                                                </td>
                                                <td className="py-3 px-3 text-white max-w-xs truncate">{tx.description}</td>
                                                <td className="py-3 px-3 text-right font-mono font-extrabold text-rose-400">
                                                  {tx.type === 'Debit' ? `${(parseFloat(tx.amount) || 0).toLocaleString()} ${tx.currencyOriginal || 'SAR'}` : '-'}
                                                </td>
                                                <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-400">
                                                  {tx.type === 'Credit' ? `${(parseFloat(tx.amount) || 0).toLocaleString()} ${tx.currencyOriginal || 'SAR'}` : '-'}
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
                        )}
                      </div>
                    );
                  })()}
                </div>
      </div>
  );
};

export default OrdersCostReport;
