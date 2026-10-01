import type { ReportAccount, ReportOrder, ReportShippingCompany, ReportTransaction } from '../../report-row-types';
/**
 * @file ShippingCompaniesReport.tsx
 * @description تقرير شركات الشحن والعمولات
 * Shipping companies report with commissions and settlements
 */

import React from 'react';
import { format } from 'date-fns';

interface ShippingCompaniesReportProps {
  isAr: boolean;
  filteredData: { orders: any[]; shippingCompanies: any[] };
  accounts: any[];
  accountTransactions: any[];
  selectedShippingCompaniesAccountIds: string[];
  setSelectedShippingCompaniesAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  handleSaveAccountSelection: (type: string) => void;
  convertCurrency: (amount: number, from: string, to: string) => number;
  convertToYER: (amount: number, currency: string) => number;
  searchMatchList: (list: any[], key: string) => any[];
  MultiAccountSelectorComponent: React.ComponentType<any>;
}

// ─── ShippingCompaniesReport Component ─────────────────────────────────────
const ShippingCompaniesReport: React.FC<ShippingCompaniesReportProps> = ({
  isAr,
  filteredData,
  accounts,
  accountTransactions,
  selectedShippingCompaniesAccountIds,
  setSelectedShippingCompaniesAccountIds,
  selectedCompanyId,
  setSelectedCompanyId,
  handleSaveAccountSelection,
  convertCurrency,
  convertToYER,
  searchMatchList,
  MultiAccountSelectorComponent
}) => {
  return (
      <div>
                <div className="space-y-6">
                  {(() => {
                    const shippingCompanies = (filteredData as any).shippingCompanies || [];
                    const displayAccounts = accounts.filter(a => selectedShippingCompaniesAccountIds.includes(a.id));
                    const displayCurrency = displayAccounts[0]?.currency || 'SAR';
                    const alternativeCurrency = displayCurrency === 'SAR' ? 'YER' : 'SAR';

                    const totalConsolidatedBalance = displayAccounts.reduce(
                      (sum, a) => sum + convertCurrency(parseFloat(a.balance as any) || 0, a.currency || 'SAR', displayCurrency),
                      0
                    );

                    const totalConsolidatedBalanceAlternative = convertCurrency(totalConsolidatedBalance, displayCurrency, alternativeCurrency);

                    return (
                      <div className="space-y-6">
                        <MultiAccountSelectorComponent
                          selectedIds={selectedShippingCompaniesAccountIds}
                          setSelectedIds={setSelectedShippingCompaniesAccountIds}
                          labelAr="حدد حسابات شركات الشحن والعمولات والذمم الدائنة/المدينة المرتبطة من شجرة الحسابات لعرض تفاصيلها"
                          labelEn="Select shipping companies, commissions, and payables accounts from the chart of accounts"
                          accounts={accounts}
                          isAr={isAr}
                          onSave={() => handleSaveAccountSelection('shipping_companies')}
                        />

                        {/* Interactive Financial Card Header */}
                        {displayAccounts.length > 0 && (
                          <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden space-y-4">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full blur-2xl pointer-events-none" />
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div className="space-y-1">
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider block w-fit">
                                  {isAr ? 'الحسابات المالية المحددة لشركات الشحن والعمولات والذمم' : 'Selected Shipping Accounts'}
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
                                  {isAr ? 'الرصيد المدمج (الذمم المستحقة):' : 'Consolidated Payables Balance:'}
                                </span>
                                <span className={`text-md font-mono font-black ${totalConsolidatedBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {totalConsolidatedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                                </span>
                                <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                                  ≈ {totalConsolidatedBalanceAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedCompanyId === null ? (

                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-black text-white">{isAr ? 'شركات الشحن والعمولات اللوجستية' : 'Partner Shipping Companies & Commissions'}</h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? 'اضغط على تظليل أي شركة شحن لعرض الشحنات المرتبطة والتكاليف المفصلة كليا' : 'Click on any shipping partner to display linked orders, cost schedules, and ledger transits.'}</p>
                            </div>

                            <div className="overflow-x-auto w-full max-w-full pb-2">
                              <table className="w-full text-xs text-start border-separate border-spacing-y-1 min-w-[650px]">
                                <thead>
                                  <tr className="text-slate-550 font-black">
                                    <th className="py-2 px-3 text-start">{isAr ? 'اسم الشركة الناقلة' : 'Shipping Co'}</th>
                                    <th className="py-2 px-3 text-center">{isAr ? 'نوع خط الشحن' : 'Shipline Route'}</th>
                                    <th className="py-2 px-3">{isAr ? 'هاتف الاتصال' : 'Phone'}</th>
                                    <th className="py-2 px-3 text-right">{isAr ? 'الرصيد والذمة المستحقة' : 'Outstanding Balance'}</th>
                                    <th className="py-2 px-3 text-center">{isAr ? 'الإجراء' : 'Action'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {searchMatchList(filteredData.shippingCompanies, 'name').map((sc) => (
                                    <tr key={sc.id} className="bg-slate-900/10 hover:bg-slate-900/30 rounded-xl cursor-pointer transition" onClick={() => setSelectedCompanyId(sc.name || sc.id)}>
                                      <td className="py-3 px-3 font-bold text-white text-start">{sc.name}</td>
                                      <td className="py-3 px-3 text-center">
                                        <span className="bg-slate-950 border border-slate-800 text-[#d4af37] px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">{sc.type || 'INTERNATIONAL'}</span>
                                      </td>
                                      <td className="py-3 px-3 text-slate-400 font-mono">{sc.phone || '-'}</td>
                                      <td className="py-3 px-3 text-right font-mono font-black text-rose-400">-{sc.dueAmount?.toLocaleString() || 0} YER</td>
                                      <td className="py-3 px-3 text-center">
                                        <button className="p-1 px-2.5 bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 rounded-md text-[10px] font-bold">
                                          {isAr ? 'عرض الحساب' : 'View Ledger'}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          // SHIPPING CO DETAIL BLOCK DISPLAY
                          <div className="space-y-6">
                            {(() => {
                              const sc = shippingCompanies.find((c: ReportShippingCompany) => c.name === selectedCompanyId || c.id === selectedCompanyId) || { name: selectedCompanyId, type: 'INTERNATIONAL', phone: '-', dueAmount: 0 };
                              const coOrders = filteredData.orders.filter((o: ReportOrder) => o.shippingCompany === sc.name || o.shippingCompanyId === sc.id);
                              const totalSum = coOrders.reduce((sum: number, o: ReportOrder) => sum + convertCurrency(parseFloat(String(o.totalPrice ?? 0)) || 0, o.currency || 'YER', 'YER'), 0);
                              const paidSum = coOrders.reduce((sum: number, o: ReportOrder) => sum + convertCurrency(parseFloat(String(o.amountPaid ?? 0)) || 0, o.currency || 'YER', 'YER'), 0);
                              const linkedTxs = accountTransactions.filter(tx => tx.description?.toLowerCase().includes((sc?.name || '').toLowerCase()) || tx.description?.includes(sc?.name || ''));

                              const scDueInDisplay = convertCurrency(sc.dueAmount || 0, 'YER', displayCurrency);
                              const totalSumInDisplay = convertCurrency(totalSum, 'YER', displayCurrency);
                              const paidSumInDisplay = convertCurrency(paidSum, 'YER', displayCurrency);

                              const scDueAlternative = convertCurrency(sc.dueAmount || 0, 'YER', alternativeCurrency);
                              const totalSumAlternative = convertCurrency(totalSum, 'YER', alternativeCurrency);
                              const paidSumAlternative = convertCurrency(paidSum, 'YER', alternativeCurrency);

                              return (
                                <div className="space-y-6">
                                  <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => setSelectedCompanyId(null)}
                                        className="p-1.5 px-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black transition"
                                      >
                                        {isAr ? '← تراجع' : '← Back'}
                                      </button>
                                      <div>
                                        <span className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/25 px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">{sc.type}</span>
                                        <h4 className="text-sm font-black text-white mt-1">
                                          {isAr ? `كشف أداء وحساب شحن: ${sc.name}` : `Performance & Statement: ${sc.name}`}
                                        </h4>
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-mono font-black text-slate-500">CARRIER SUB-DECK</span>
                                  </div>

                                  {/* stats widgets */}
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                      <span className="text-[10.5px] text-slate-500 font-bold block mb-1">{isAr ? 'المستحق الحسابي (الذمة للشركة)' : 'Outstanding Carrier due'}</span>
                                      <span className="text-md font-mono font-black text-rose-400">
                                        {scDueInDisplay.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                                      </span>
                                      <p className="text-[9px] font-mono text-slate-500 mt-1">
                                        ≈ {scDueAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                                      </p>
                                    </div>
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                      <span className="text-[10.5px] text-slate-500 font-bold block mb-1">{isAr ? 'حجم المبيعات الكلي' : 'Gross Volume'}</span>
                                      <span className="text-md font-mono font-black text-white">
                                        {totalSumInDisplay.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                                      </span>
                                      <p className="text-[9px] font-mono text-slate-500 mt-1">
                                        ≈ {totalSumAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                                      </p>
                                    </div>
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                      <span className="text-[10.5px] text-slate-500 font-bold block mb-1">{isAr ? 'المسدد فعليا' : 'Paid / Settled'}</span>
                                      <span className="text-md font-mono font-black text-emerald-400">
                                        {paidSumInDisplay.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                                      </span>
                                      <p className="text-[9px] font-mono text-slate-500 mt-1">
                                        ≈ {paidSumAlternative.toLocaleString(undefined, { maximumFractionDigits: 0 })} {alternativeCurrency}
                                      </p>
                                    </div>
                                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                                      <span className="text-[10.5px] text-slate-500 font-bold block mb-1">{isAr ? 'إجمالي الطلبات المنقولة' : 'Shipped orders count'}</span>
                                      <span className="text-md font-mono font-black text-[#d4af37]">{coOrders.length} <span className="text-xs font-sans text-slate-500">{isAr ? 'شحنة' : 'shumes'}</span></span>
                                    </div>
                                  </div>

                                  {/* company orders list */}
                                  <div className="space-y-3">
                                    <span className="text-xs font-black text-white block">{isAr ? 'الشحنات المستندة لهذا الناقل' : 'Linked orders on this carrier'}</span>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs text-start border-collapse">
                                        <thead>
                                          <tr className="text-slate-550 border-b border-slate-850 pb-2 font-bold uppercase">
                                            <th className="py-2 px-3 text-start">{isAr ? 'كود الطلب' : 'Order ID'}</th>
                                            <th className="py-2 px-3">{isAr ? 'تاريخ المعاملة' : 'Date'}</th>
                                            <th className="py-2 px-3">{isAr ? 'العميل المستلم' : 'Receiver'}</th>
                                            <th className="py-2 px-3 text-right">{isAr ? 'مجموع القيمة' : 'Gross aggregate'}</th>
                                            <th className="py-2 px-3 text-center">{isAr ? 'حالة الطلب' : 'Status'}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-850/30">
                                          {coOrders.length === 0 ? (
                                            <tr>
                                              <td colSpan={5} className="text-center py-6 text-slate-600 font-bold italic">
                                                {isAr ? 'لا توجد شحنات مسجلة على هذه الشركة بعد' : 'No shippings linked to this company.'}
                                              </td>
                                            </tr>
                                          ) : (
                                            coOrders.map(o => (
                                              <tr key={o.id} className="hover:bg-slate-950/20 font-medium">
                                                <td className="py-2.5 px-3 font-mono text-[#d4af37] font-black">{o.orderNumber || o.id}</td>
                                                <td className="py-2.5 px-3 text-slate-500">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                                <td className="py-2.5 px-3 text-white font-bold">{o.customerName}</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-black">{o.totalPrice?.toLocaleString()} YER</td>
                                                <td className="py-2.5 px-3 text-center">
                                                  <span className="text-[9.5px] px-2 py-0.5 bg-slate-950 text-slate-400 border border-slate-850 rounded-lg">{o.orderStatus}</span>
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

export default ShippingCompaniesReport;

