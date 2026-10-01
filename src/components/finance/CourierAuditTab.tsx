import React from 'react';
import { Printer, User, RefreshCw, Receipt, Scale } from 'lucide-react';

interface CourierAuditTabProps {
  isAr: boolean;
  couriers: any[];
  auditedCourierId: string;
  setAuditedCourierId: React.Dispatch<React.SetStateAction<string>>;
  courierAuditSheet: any | null;
  triggerPrint: (title: string, elementId: string) => void;
  formatCurrencyWithYerEquiv: (amount: number, currency: string) => string;
  handleBulkRemitCourierCash: () => void;
  cargoRemitLoading: boolean;
  handleFullCourierReconciliation: () => void;
  bulkReconciliationLoading: boolean;
  handleDirectSettleCustody: (custodyId: string, recipientName: string) => void;
  courierTransactions: any[];
  formatAmountWithEquiv: (amount: number, currency: string) => string;
  dbRates: Record<string, number>;
}

type AuditDateValue = number | string | Date | { toDate: () => Date };

interface AuditCustody {
  id: string;
  status?: string;
  expenseNumber?: string;
  notes?: string;
  createdByName?: string;
  createdAt?: AuditDateValue;
  amount?: number;
  currency?: string;
  settledAt?: AuditDateValue;
  recipientName?: string;
}

const formatAuditDate = (value?: AuditDateValue): string => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toLocaleDateString();
  }
  if (typeof value === 'number' || typeof value === 'string' || value instanceof Date) {
    return new Date(value).toLocaleDateString();
  }
  return new Date().toLocaleDateString();
};

export default function CourierAuditTab({ isAr, couriers, auditedCourierId, setAuditedCourierId, courierAuditSheet, triggerPrint, formatCurrencyWithYerEquiv, handleBulkRemitCourierCash, cargoRemitLoading, handleFullCourierReconciliation, bulkReconciliationLoading, handleDirectSettleCustody, courierTransactions, formatAmountWithEquiv, dbRates }: CourierAuditTabProps) {
  return (
        <div className="space-y-6">
          <div className="bg-[#121215] border border-slate-850 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-[#d4af37] mb-1.5 uppercase tracking-wider">{isAr ? 'اختر المندوب المراد سحب وكشف مطابقة حساباته المفتوحة' : 'Select Corporate Courier for Liability Audit'}</label>
              <select
                value={auditedCourierId}
                onChange={e => setAuditedCourierId(e.target.value)}
                className="bg-black/40 border border-slate-850 text-white rounded-xl px-4 py-3 text-xs font-extrabold outline-none focus:border-[#d4af37] cursor-pointer w-full md:max-w-md"
              >
                <option value="">{isAr ? '-- اختر مندوب التوزيع والمقاصة --' : '-- Choose Corporate Courier --'}</option>
                {couriers.map(c => (
                  <option key={c.id} value={c.id}>{c.fullName} ({c.courierCustomId})</option>
                ))}
              </select>
            </div>

            {courierAuditSheet && (
              <button
                onClick={() => triggerPrint(isAr ? `كشف حساب المندوب: ${courierAuditSheet.courier.fullName}` : 'Courier Liability Report', 'courier-print-wrapper')}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-black transition-all"
              >
                <Printer className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'طباعة كشف المندوب وعهدته' : 'Print Courier Statement'}
              </button>
            )}
          </div>

          {courierAuditSheet ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="courier-print-wrapper">

              {/* Liabilities profile & metrics */}
              <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl text-start shadow-md space-y-4 lg:col-span-1">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="bg-[#d4af37]/10 p-2.5 rounded-2xl border border-[#d4af37]/20 text-[#d4af37]">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{courierAuditSheet.courier.fullName}</h3>
                    <p className="text-[9px] text-[#d4af37] font-bold uppercase">{courierAuditSheet.courier.courierCustomId || 'Logistics Partner'}</p>
                    <p className="text-[9.5px] text-slate-500 font-mono">{courierAuditSheet.courier.phone}</p>
                  </div>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-black">{isAr ? 'العهد المالية الإجمالية المستلمة' : 'Gross Custodies Issued'}</span>
                    <span className="text-base font-mono font-black text-white">{formatCurrencyWithYerEquiv(courierAuditSheet.totalCustodyIssued, courierAuditSheet.currency)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-black">{isAr ? 'العهد المصفاة والمسلمة' : 'Reconciled & Settled'}</span>
                    <span className="text-base font-mono font-black text-emerald-450">{formatCurrencyWithYerEquiv(courierAuditSheet.totalCustodySettled, courierAuditSheet.currency)}</span>
                  </div>

                  {/* Active liability trust */}
                  <div className="bg-[#ef4444]/5 p-3 rounded-2xl border border-[#ef4444]/15">
                    <span className="text-[10px] text-rose-400 uppercase block font-black">{isAr ? 'الرصيد المالي الإجمالي المطلوب من المندوب' : 'Net Liable Ledger Balance'}</span>
                    <span className="text-lg font-mono font-black text-rose-500">{formatCurrencyWithYerEquiv(courierAuditSheet.courier.financialBalance || 0, courierAuditSheet.currency)}</span>
                    <span className="text-[8.5px] text-slate-500 block mt-1 leading-snug">{isAr ? 'الرصيد الجاري الفعلي للمندوب المطابق لشجرة الحسابات ودفتر اليومية الموحد.' : 'Actual current balance of the courier matching the chart of accounts and journal entries.'}</span>
                  </div>

                  {/* Delivery Cargo COD Cash holding - HUGE Logistics-finance highlight! */}
                  <div className="bg-cyan-500/5 p-4 rounded-3xl border border-cyan-500/15 space-y-3">
                    <div>
                      <span className="text-[10px] text-cyan-400 uppercase block font-black">{isAr ? 'التحصيلات النقدية للشحنات المسلمة بذمته' : 'Cargo Cash Held (COD)'}</span>
                      <span className="text-lg font-mono font-black text-cyan-400">{formatCurrencyWithYerEquiv(courierAuditSheet.totalUnremittedCashValueInTargetCurrency, courierAuditSheet.currency)}</span>
                      <span className="text-[8.5px] text-slate-500 block mt-1 leading-snug">
                        {isAr ? `نقدية محصلة من ${courierAuditSheet.currentUnremittedCargoCash.length} طرد مسلّم، في انتظار التوريد المالي للخزينة.` : `Direct cash collected from ${courierAuditSheet.currentUnremittedCargoCash.length} delivered items waiting transfer.`}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {courierAuditSheet.totalUnremittedCashValue > 0 && (
                        <button
                          onClick={handleBulkRemitCourierCash}
                          disabled={cargoRemitLoading}
                          className="w-full bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-black py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-950/20 disabled:opacity-50 cursor-pointer"
                        >
                          {cargoRemitLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Receipt className="w-3.5 h-3.5" />
                          )}
                          {isAr ? 'توريد النقدية وتصفير تحصيلات الطرود' : 'Deposit COD Collections Cash'}
                        </button>
                      )}

                      <button
                        onClick={handleFullCourierReconciliation}
                        disabled={bulkReconciliationLoading}
                        className="w-full bg-[#d4af37] hover:bg-[#bfa032] active:bg-[#aa8e2b] text-black py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-950/20 disabled:opacity-50 cursor-pointer"
                      >
                        {bulkReconciliationLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Scale className="w-3.5 h-3.5" />
                        )}
                        {isAr ? 'تصفير الذمة والمطابقة الكاملة' : 'Full Audit Reconciliation'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-850 flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-400">{isAr ? 'نسبة تسليم الشحنات الناجحة:' : 'Success Deliver rate:'}</span>
                    <span className="text-cyan-400 bg-cyan-950/20 px-2 py-0.5 rounded font-mono font-black">{courierAuditSheet.successRate}% ({courierAuditSheet.totalOrdersDelivered} Delivered)</span>
                  </div>
                </div>
              </div>

              {/* Transactions list & cash holding table */}
              <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl text-start shadow-md lg:col-span-2 space-y-6">

                {/* 1. Custodies Ledger section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider border-b border-slate-850 pb-2">
                    {isAr ? 'أولاً: تفاصيل العهد التشغيلية المسلمة وتصفيتها' : 'I. Office Custody Slips & Reconciliations'}
                  </h3>

                  <div className="divide-y divide-slate-850 space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {courierAuditSheet.custodies.map((cust: AuditCustody) => {
                      const isSettled = cust.status === 'Settled';
                      return (
                        <div key={cust.id} className="pt-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className={`bg-slate-900 border border-slate-800 text-[#d4af37] px-2 py-0.5 rounded text-[9px] font-mono mr-2`}>
                              {cust.expenseNumber}
                            </span>
                            <span className="text-slate-300 font-bold">{cust.notes || (isAr ? 'سند عهدة' : 'Custody Slip')}</span>
                            <span className="text-[9px] text-slate-550 block font-normal">
                              بواسطة: {cust.createdByName || 'المسؤول'} • {formatAuditDate(cust.createdAt)}
                            </span>
                          </div>

                          <div className="text-right flex items-center gap-3">
                            <div>
                              <span className="text-[#d4af37] font-mono font-black block">{formatAmountWithEquiv(cust.amount || 0, cust.currency || 'YER')}</span>
                              {isSettled ? (
                                <span className="text-[8.5px] font-black text-emerald-400 bg-emerald-950/25 px-1.5 rounded uppercase">{isAr ? `مسواة في: ${cust.settledAt ? formatAuditDate(cust.settledAt) : ''}` : 'Settled'}</span>
                              ) : (
                                <span className="text-[8.5px] font-black text-amber-500 bg-amber-950/25 px-1.5 rounded uppercase animate-pulse">{isAr ? 'علقة جارية' : 'Active Pending'}</span>
                              )}
                            </div>

                            {!isSettled && (
                              <button
                                onClick={() => handleDirectSettleCustody(cust.id, cust.recipientName ?? '')}
                                className="bg-emerald-500 hover:bg-emerald-600 text-black px-2.5 py-1 rounded-lg text-[9px] font-black transition-all"
                              >
                                {isAr ? 'تسوية عاجلة' : 'Settle'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {courierAuditSheet.custodies.length === 0 && (
                      <p className="p-12 text-center text-slate-550 font-bold font-mono text-[9px] uppercase select-none">
                        [ no_custody_vouchers_filed_for_courier ]
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. Courier Transactions Ledger section */}
                <div className="space-y-3 pt-4 border-t border-slate-850">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider pb-2 border-b border-slate-850">
                    {isAr ? 'ثانياً: المعاملات المالية والحركات المقيدة على الحساب' : 'II. Financial Transactions Sub-Ledger'}
                  </h3>

                  <div className="divide-y divide-slate-850 space-y-2 max-h-60 overflow-y-auto pr-1">
                    {courierTransactions.map((tx) => {
                      const isCredit = tx.type === 'Credit';
                      return (
                        <div key={tx.id} className="pt-2 flex items-center justify-between text-xs">
                          <div>
                            <span className="bg-slate-900 border border-slate-800 text-[#d4af37] px-2 py-0.5 rounded text-[9px] font-mono mr-2">
                              {tx.refNumber}
                            </span>
                            <span className="text-slate-305 text-slate-300 font-bold">{tx.normalizedDescription || tx.description || tx.module}</span>
                            <span className="text-[9px] text-slate-550 block font-normal">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ''}
                            </span>
                          </div>

                          <div className="text-right">
                            <div className={`font-mono font-black ${isCredit ? 'text-emerald-400' : 'text-rose-500'}`}>
                              {isCredit ? '+' : '-'}{formatAmountWithEquiv(tx.amountOriginal || tx.amount || 0, tx.currencyOriginal || 'YER')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {courierTransactions.length === 0 && (
                      <p className="p-12 text-center text-slate-550 font-bold font-mono text-[9px] uppercase select-none">
                        [ no_financial_transactions_logged_for_courier ]
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. Shipped Cargo Collections held COD */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider border-b border-slate-850 pb-2 flex justify-between">
                    <span>{isAr ? 'ثانياً: الطرود المسلمة في حوزته قيد التحصيل' : 'II. Handed Cargo Delivered COD Outstanding'}</span>
                    <span className="text-[10px] text-cyan-400 font-mono">({courierAuditSheet.currentUnremittedCargoCash.length} items)</span>
                  </h3>

                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-start text-[11px]">
                      <thead className="bg-[#0c0c0f] text-slate-550 text-[9px] font-bold uppercase border-b border-slate-850">
                        <tr>
                          <th className="p-2">{isAr ? 'رقم الطرد' : 'Order No'}</th>
                          <th className="p-2">{isAr ? 'اسم المستلم' : 'Recipient'}</th>
                          <th className="p-2">{isAr ? 'الموعد المالي' : 'Delivered Time'}</th>
                          <th className="p-2 text-left">{isAr ? 'مبلغ التحصيل لليمن' : 'Collection due'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 bg-black/5">
                        {courierAuditSheet.currentUnremittedCargoCash.map((ord: any) => (
                          <tr key={ord.id} className="hover:bg-slate-900/30">
                            <td className="p-2 font-mono font-bold text-[#d4af37]">{ord.orderNumber}</td>
                            <td className="p-2 text-slate-300 font-bold">{ord.customerName}</td>
                            <td className="p-2 text-slate-500">
                              {ord.deliveredAt?.toDate ? ord.deliveredAt.toDate().toLocaleDateString() : (ord.deliveredAt ? new Date(ord.deliveredAt).toLocaleDateString() : '—')}
                            </td>
                            <td className="p-2 text-left font-mono font-black text-cyan-400">
                              {courierAuditSheet.courier.courierType === 'sourcing' ? (
                                <div className="text-right">
                                  <span>{((parseFloat(ord.amountRemaining || 0) / (dbRates.SAR || 1))).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} SAR</span>
                                  <span className="block text-[9px] text-slate-550 font-normal">({parseFloat(ord.amountRemaining || 0).toLocaleString()} YER)</span>
                                </div>
                              ) : (
                                <span>{parseFloat(ord.amountRemaining || 0).toLocaleString()} YER</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {courierAuditSheet.currentUnremittedCargoCash.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-12 text-center text-slate-600 font-mono text-[9px] uppercase select-none">
                              [ {isAr ? 'لا توجد شحنات معلقة التحصيل بذمة المندوب' : 'no_unremitted_cargo_collections_outstanding'} ]
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="p-16 text-center text-slate-500 font-black font-mono text-[10px] uppercase border border-dashed border-slate-850 rounded-3xl">
              [ {isAr ? 'يرجى اختيار مندوب التوزيع لمراجعة حسابه المالي وعُهده' : 'select_courier_from_selector_to_render_standing_account'} ]
            </div>
          )}
        </div>
  );
}
