import React from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowUpLeft, Coins, Crown, MapPin,
  Package, Printer, Search, ShieldAlert, User, X,
} from 'lucide-react';
import { printContent } from '../../../lib/printUtils';
import type { ExchangeRates } from '../../../services/currencyService';
import type { AccountBalancesMap } from '../../../hooks/useAccountBalances';
import type {
  CourierCustodyStats,
  CourierDetailsRecord,
  CourierFinancialAccountRecord,
  CourierLedgerEntry,
  CourierLedgerModuleFilter,
  CourierOrderPartyStats,
  CourierOrderRecord,
  CourierDetailTab,
} from '../types';

interface CourierDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  selectedCourier: CourierDetailsRecord | null;
  courierOrders: CourierOrderRecord[];
  ordersLoading: boolean;
  detailTab: CourierDetailTab;
  setDetailTab: React.Dispatch<React.SetStateAction<CourierDetailTab>>;
  finSearch: string;
  setFinSearch: React.Dispatch<React.SetStateAction<string>>;
  finModuleFilter: CourierLedgerModuleFilter;
  setFinModuleFilter: React.Dispatch<React.SetStateAction<CourierLedgerModuleFilter>>;
  accounts: CourierFinancialAccountRecord[];
  liveBalances: AccountBalancesMap;
  dbRates: ExchangeRates;
  activeStats: CourierCustodyStats | null;
  totalDelivered: number;
  totalInTransit: number;
  totalCollectedFromCustomersInCourierCurrency: number;
  totalAdvancesReceived: number;
  totalRemittedToBox: number;
  remainingCustodyInHand: number;
  formatDetailCurrency: (amount: number) => string;
  getCourierOrderPartyStats: (courierId: string) => CourierOrderPartyStats;
  getCourierUnifiedLedger: () => CourierLedgerEntry[];
}

export function CourierDetailsModal({
  isOpen,
  onClose,
  isAr,
  selectedCourier,
  courierOrders,
  ordersLoading,
  detailTab,
  setDetailTab,
  finSearch,
  setFinSearch,
  finModuleFilter,
  setFinModuleFilter,
  accounts,
  liveBalances,
  dbRates,
  activeStats,
  totalDelivered,
  totalInTransit,
  totalCollectedFromCustomersInCourierCurrency,
  totalAdvancesReceived,
  totalRemittedToBox,
  remainingCustodyInHand,
  formatDetailCurrency,
  getCourierOrderPartyStats,
  getCourierUnifiedLedger,
}: CourierDetailsModalProps) {
  if (!isOpen || !selectedCourier) return null;

  return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c0c0f] border border-[#d4af37]/25 rounded-3xl shadow-2xl max-w-5xl w-full h-[90vh] overflow-hidden flex flex-col font-sans">

            {/* Header portion */}
            <div className="bg-black/40 p-5 border-b border-slate-850/80 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4 text-start">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-[#d4af37]/25 text-[#d4af37] flex items-center justify-center font-black text-xl shadow-lg shadow-black/40">
                  {selectedCourier.fullName?.substring(0, 2)}
                </div>
                <div>
                  <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2 mb-1">
                    {selectedCourier.fullName}
                    <Crown className="w-4 h-4 text-[#d4af37]" />
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-slate-500 font-bold">
                    <span className="text-[10px] font-mono" dir="ltr">{selectedCourier.email}</span>
                    <span className="w-1.5 h-1.5 bg-slate-805 rounded-full"></span>
                    <span className="text-[10px] font-mono" dir="ltr">{selectedCourier.phone}</span>
                    <span className="w-1.5 h-1.5 bg-slate-805 rounded-full"></span>
                    <span className="text-[10px] bg-slate-900 border border-slate-800 text-[#d4af37] px-2 py-0.5 rounded-md font-mono">ID: {selectedCourier.courierCustomId}</span>
                    <span className="text-[10px] bg-purple-950/20 border border-purple-950/50 text-purple-400 px-2 py-0.5 rounded-md">عمولة: {selectedCourier.commissionRate}%</span>
                  </div>
                  {selectedCourier.address && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>{selectedCourier.address}</span>
                      {selectedCourier.gpsLocation && (
                        <a href={selectedCourier.gpsLocation.startsWith('http') ? selectedCourier.gpsLocation : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedCourier.gpsLocation)}`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1 ml-2">
                          (الموقع GPS)
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="bg-slate-900 hover:bg-slate-850 p-2 rounded-xl text-slate-500 hover:text-white border border-slate-800 transition-all active:scale-95"><X className="w-5 h-5" /></button>
            </div>

            {/* Scrollable Content inside Details portal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0a0a0c]" id="courier-ledger-content">

              {selectedCourier.notes && (
                <div className="bg-amber-950/10 border border-amber-950/40 p-4 rounded-xl text-start">
                  <h5 className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">⚠️ ملاحظات تشغيلية سرية</h5>
                  <p className="text-slate-350 leading-relaxed font-bold text-xs">{selectedCourier.notes}</p>
                </div>
              )}

              {/* Smart Unremitted Custody Alert Warning */}
              {remainingCustodyInHand > 0 && (
                <div className="bg-rose-955/15 border border-rose-500/35 p-5 rounded-2xl text-start flex items-start gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-450 shrink-0">
                    <ShieldAlert className="w-5 h-5 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 animate-spin-slow" />
                      {isAr ? 'تنبيه عهد وقيم معلقة تحت التحصيل غير موردة!' : 'ALERT: ACTIVE UNREMITTED COURIER CUSTODY'}
                    </h4>
                    <p className="text-slate-300 text-[11px] font-bold leading-relaxed">
                      {isAr
                        ? `يحمل المندوب حالياً مبالغ مالية متبقية بعهدة ذمته بقيمة (${formatDetailCurrency(remainingCustodyInHand)}) مستحقة لخزينة الشركة ولم يوردها بعد. يرجى مراجعة وتصفية كافة مستحقات الشحن والعهد المفتوحة لتجنب التراكم.`
                        : `This courier is currently holding an outstanding unremitted custody of (${formatDetailCurrency(remainingCustodyInHand)}) due to the company cash box. Please initiate box remittance with the audited staff immediately.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab Selector for Courier */}
              <div className="flex bg-black/35 border border-slate-850/50 p-1 rounded-2xl gap-2 mt-4 shrink-0 font-sans">
                <button
                  type="button"
                  onClick={() => setDetailTab('logistics')}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1.5 ${detailTab === 'logistics'
                    ? 'bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37]'
                    : 'border border-transparent text-slate-500 hover:text-slate-350'
                    }`}
                >
                  <Package className="w-4 h-4" />
                  {isAr ? 'بيانات الأداء الميداني والعهد' : 'Field Performance & Custody'}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('financial')}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1.5 ${detailTab === 'financial'
                    ? 'bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37]'
                    : 'border border-transparent text-slate-500 hover:text-slate-350'
                    }`}
                >
                  <Coins className="w-4 h-4" />
                  {isAr ? 'كشف الحساب المالي للمندوب' : 'Courier Financial Statement'}
                </button>
              </div>

              {detailTab === 'logistics' && (
                <>
                  {getCourierOrderPartyStats(selectedCourier.id).totalOrders > 0 && (
                    <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4 text-start">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-black text-violet-300">{isAr ? 'طلبات مرتبطة بالمندوب كطرف للطلب' : 'Orders linked to courier as order party'}</h4>
                          <p className="mt-0.5 text-[10px] font-bold text-slate-500">{isAr ? 'مستقلة عن الشحنات والعهد الميدانية.' : 'Separate from delivery assignments and operational custody.'}</p>
                        </div>
                        <span className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[10px] font-black text-violet-200">{getCourierOrderPartyStats(selectedCourier.id).totalOrders}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div><span className="block text-[9px] font-black text-slate-500">{isAr ? 'إجمالي قيمة الطلبات' : 'Order value'}</span><span className="font-mono text-sm font-black text-white">{formatDetailCurrency(getCourierOrderPartyStats(selectedCourier.id).totalValue)}</span></div>
                        <div><span className="block text-[9px] font-black text-slate-500">{isAr ? 'المدفوع' : 'Paid'}</span><span className="font-mono text-sm font-black text-emerald-400">{formatDetailCurrency(getCourierOrderPartyStats(selectedCourier.id).paid)}</span></div>
                        <div><span className="block text-[9px] font-black text-slate-500">{isAr ? 'المتبقي' : 'Outstanding'}</span><span className="font-mono text-sm font-black text-amber-300">{formatDetailCurrency(getCourierOrderPartyStats(selectedCourier.id).outstanding)}</span></div>
                      </div>
                    </div>
                  )}
                  {/* Courier Performance Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-3 text-start">{isAr ? 'أداء وكفاءة التوصيل' : 'Transit KPI'}</span>
                      <div className="flex items-baseline gap-1.5 text-start">
                        <span className="text-xl font-black text-[#d4af37]">{totalDelivered}</span>
                        <span className="text-[10px] font-bold text-slate-500">{isAr ? 'مسلم ناجح' : 'Delivered success'}</span>
                      </div>
                      <div className="text-[9px] text-amber-500 font-bold mt-1 text-start">
                        {totalInTransit} {isAr ? 'قيد التوصيل حالياً' : 'Current Handover'}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md text-start">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-3">{isAr ? 'المبالغ التي استلمها المندوب' : 'Total Custody Received'}</span>
                      <div className="text-base font-mono font-black text-amber-400">{formatDetailCurrency(totalCollectedFromCustomersInCourierCurrency + totalAdvancesReceived)}</div>
                      <span className="text-[9px] text-slate-500 font-bold block mt-1">{isAr ? 'يشمل نقد الشحنات والعهد والسلف' : 'Includes COD cash, custody & advances'}</span>
                    </div>

                    <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md text-start">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-3">{isAr ? 'المبالغ الموردة للصندوق' : 'Remitted To Fund'}</span>
                      <div className="text-base font-mono font-black text-emerald-450">{formatDetailCurrency(totalRemittedToBox)}</div>
                      <span className="text-[9px] text-slate-500 font-bold block mt-1">{isAr ? 'عهد مسواة وموردة رسمياً' : 'Cleared / discharged custody'}</span>
                    </div>

                    <div className={`p-4 rounded-2xl border text-start ${remainingCustodyInHand > 0 ? 'bg-rose-950/10 border-rose-950/40' : 'bg-[#121215] border-slate-850'}`}>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-3">
                        {remainingCustodyInHand > 0 ? '⚠️ المبالغ المتبقية بعهدته' : '✅ العهدة مصفاة بالكامل'}
                      </span>
                      <div className={`text-base font-mono font-black mb-1 ${remainingCustodyInHand > 0 ? 'text-rose-450' : 'text-emerald-450'}`}>
                        {formatDetailCurrency(remainingCustodyInHand)}
                      </div>
                      <span className="text-[9px] text-slate-500 font-bold block">{isAr ? 'عهد وذمم متبقية بذمة المندوب' : 'Outstanding client-side balance'}</span>
                    </div>
                  </div>

                  {/* Logistics Performance Analytics Sheet */}
                  <div className="bg-[#121215] p-5 rounded-2xl border border-slate-850 text-start space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-xs text-[#d4af37] uppercase tracking-wider mb-1">
                          {isAr ? '📈 تقارير ومعدلات أداء المندوب الذكية' : '📈 COURIER PERFORMANCE REPORT & KPI OUTLOOK'}
                        </h4>
                        <p className="text-[10px] text-slate-550 font-bold">{isAr ? 'تنقيب وتحليل فترات الشحن، والتسوية، والكفاءة العامة لنظام العهد' : 'Monitor delivery success rates, handover ratios, and physical turnovers'}</p>
                      </div>
                      <div className="bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] text-xs px-3 py-1 rounded-xl font-mono font-black">
                        {activeStats ? `${activeStats.deliverySuccessRate}%` : '0%'}
                      </div>
                    </div>

                    {/* Progress bar visual indicator */}
                    <div className="w-full bg-slate-900 border border-slate-855 rounded-full h-3 overflow-hidden shadow-inner">
                      <div
                        className="bg-gradient-to-r from-yellow-600 to-[#d4af37] h-3 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(212,175,55,0.3)]"
                        style={{ width: `${activeStats ? activeStats.deliverySuccessRate : 0}%` }}
                      ></div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                      <div className="p-3.5 bg-black/40 border border-slate-850 rounded-xl">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1.5 font-bold">{isAr ? 'مجموع الشحنات الموكلة' : 'Total Assigned'}</span>
                        <span className="text-base font-black text-white font-mono">{activeStats?.totalOrdersCount || 0}</span>
                      </div>
                      <div className="p-3.5 bg-black/40 border border-slate-850 rounded-xl">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1.5 font-bold">{isAr ? 'تم تسليمها للعميل' : 'Delivered Status'}</span>
                        <span className="text-base font-black text-emerald-450 font-mono">{activeStats?.totalDelivered || 0}</span>
                      </div>
                      <div className="p-3.5 bg-black/40 border border-slate-850 rounded-xl">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1.5 font-bold">{isAr ? 'قيد النقل والتوصيل' : 'In Hand / Shipped'}</span>
                        <span className="text-base font-black text-cyan-400 font-mono">{activeStats?.totalInTransit || 0}</span>
                      </div>
                      <div className="p-3.5 bg-black/40 border border-slate-850 rounded-xl">
                        <span className="text-[9px] text-[#d4af37]/80 uppercase tracking-widest block mb-1.5 font-bold">{isAr ? 'مجموع فاعلية التسليم' : 'Fulfillment %'}</span>
                        <span className="text-base font-black text-[#d4af37] font-mono">{activeStats?.deliverySuccessRate || 0}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery History Log */}
                  <div className="space-y-3 text-start">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-xs text-[#d4af37] uppercase tracking-wider">{isAr ? 'سجل التسليمات والشحنات الموكلة للمندوب' : 'Operational Delivery Log'}</h4>
                      <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-500 px-3 py-1 rounded-lg font-bold font-mono">LIVE SYNC</span>
                    </div>

                    {ordersLoading ? (
                      <div className="p-12 text-center text-slate-500 font-bold font-mono uppercase tracking-widest">[ extracting_ledger_traces ]</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {courierOrders.map(order => {
                          const isDelivered = (order.order_status || order.orderStatus) === "تم التسليم";
                          return (
                            <div key={order.id} className="bg-[#121215] p-4 rounded-2xl border border-slate-850 flex items-start gap-4 hover:border-[#d4af37]/30 transition-all group">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner ${isDelivered ? "bg-emerald-950/20 text-emerald-400 border-emerald-950/50" : "bg-blue-950/20 text-blue-400 border-blue-950/50"}`}>
                                <Package className="w-5 h-5 animate-hover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-mono font-black text-white text-xs truncate">
                                    {order.orderNumber || 'ALX-XXXX-XXXX'}
                                    {order.trackingNumber && <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Track: {order.trackingNumber}</span>}
                                  </span>
                                  <span className={`text-[8px] font-black px-2 py-0.5 rounded tracking-tighter ${isDelivered ? "bg-emerald-950/30 text-emerald-400" : "bg-blue-950/30 text-blue-450"}`}>
                                    {order.orderStatus || order.order_status || 'معلق'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 mb-2">
                                  {order.shippingCourierId === selectedCourier.id && (
                                    <span className="text-[8px] font-bold bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">مندوب شحن</span>
                                  )}
                                  {order.deliveryCourierId === selectedCourier.id && (
                                    <span className="text-[8px] font-black bg-purple-950/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-950/30">مندوب توصيل</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mb-2">
                                  <span className="flex items-center gap-1 text-slate-300"><User className="w-3 h-3 text-[#d4af37]" /> {order.receiverName || order.receiver_name || 'مستلم مجهول'}</span>
                                  <span className="flex items-center gap-1 text-slate-300"><MapPin className="w-3 h-3 text-[#d4af37]" /> {order.receiverCity || order.receiver_city || '—'}</span>
                                </div>
                                <div className="bg-black/40 p-2 rounded-xl border border-slate-850 flex items-center justify-between">
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                    <span>إجمالي الرسوم: <span className="text-white font-mono">{((parseFloat(String(order.amountPaid)) || 0) + (parseFloat(String(order.amountRemaining)) || 0)).toLocaleString()} YER</span></span>
                                  </div>
                                  <div className="text-[9px] font-mono font-bold text-slate-500">
                                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ar-YE') : ''}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {courierOrders.length === 0 && (
                          <div className="lg:col-span-2 p-16 text-center text-slate-600 font-bold font-mono text-[9px] capitalize select-none">
                            [ no_operational_handover_records_linked_to_this_account ]
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {detailTab === 'financial' && (() => {
                const account = accounts.find(a => a.id === selectedCourier.accountId || a.id === selectedCourier.financialAccountId || a.entityId === selectedCourier.id);
                const ledgerData = getCourierUnifiedLedger();
                const debits = ledgerData.filter(i => i.type === 'Debit').reduce((sum, i) => sum + i.amountFCurrency, 0);
                const credits = ledgerData.filter(i => i.type === 'Credit').reduce((sum, i) => sum + i.amountFCurrency, 0);
                // ── Live balance from account_trans (preferred over stored account.balance) ──
                const liveByCode = account?.accountCode ? liveBalances.byCode[account.accountCode] : undefined;
                const liveById = account?.id ? liveBalances.byId[account.id] : undefined;
                const netBalance = liveByCode ?? liveById ?? account?.balance ?? 0;
                const fCurrency = account?.currency || selectedCourier.financialCurrency || 'YER';
                const exchangeRateSAR = dbRates.SAR || 1;

                const filteredLedger = ledgerData.filter(item => {
                  const q = finSearch.toLowerCase();
                  const matchesSearch = !q ||
                    (item.title || '').toLowerCase().includes(q) ||
                    (item.description || '').toLowerCase().includes(q) ||
                    (item.ref || '').toLowerCase().includes(q);
                  const matchesModule = finModuleFilter === 'all' || item.module === finModuleFilter;
                  return matchesSearch && matchesModule;
                });

                return (
                  <div className="space-y-6">
                    {/* Financial Summary Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Unified Account Balance card */}
                      <div className="bg-gradient-to-br from-[#02130a] to-[#041a10] border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between text-start shadow">
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5" />
                          {isAr ? 'رصيد الحساب الموحد' : 'Consolidated Balance'}
                        </span>
                        <div className={`font-mono font-black text-base ${netBalance >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                          {netBalance.toLocaleString()} {fCurrency}
                          {fCurrency === 'SAR' && (
                            <span className="block text-[11px] text-slate-400 font-normal mt-0.5" dir="ltr">
                              (≈ {(netBalance * exchangeRateSAR).toLocaleString()} YER)
                            </span>
                          )}
                        </div>
                        <span className="text-[8.5px] text-slate-500 font-sans mt-1">
                          {isAr ? 'مستحق كسب (دائن) أو ذمة (مدين)' : 'Live calculated balanced path'}
                        </span>
                      </div>

                      {/* Debits */}
                      <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between text-start shadow">
                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          {isAr ? 'إجمالي المدينات (المستقطع -)' : 'Total Debits (-)'}
                        </span>
                        <div className="font-mono font-black text-rose-400 text-base">
                          {debits.toLocaleString()} {fCurrency}
                          {fCurrency === 'SAR' && (
                            <span className="block text-[11px] text-slate-400 font-normal mt-0.5" dir="ltr">
                              (≈ {(debits * exchangeRateSAR).toLocaleString()} YER)
                            </span>
                          )}
                        </div>
                        <span className="text-[8.5px] text-slate-500 font-sans mt-1">
                          {isAr ? 'العهد المستلمة والمبيعات المحصلة' : 'Obligations, COD cash & custodies'}
                        </span>
                      </div>

                      {/* Credits */}
                      <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between text-start shadow">
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <ArrowUpLeft className="w-3.5 h-3.5" />
                          {isAr ? 'إجمالي المودعات (المضاف +)' : 'Total Credits (+)'}
                        </span>
                        <div className="font-mono font-black text-emerald-400 text-base">
                          {credits.toLocaleString()} {fCurrency}
                          {fCurrency === 'SAR' && (
                            <span className="block text-[11px] text-slate-400 font-normal mt-0.5" dir="ltr">
                              (≈ {(credits * exchangeRateSAR).toLocaleString()} YER)
                            </span>
                          )}
                        </div>
                        <span className="text-[8.5px] text-slate-500 font-sans mt-1">
                          {isAr ? 'العهد المصفاة من رواتب وأجور وتوريد' : 'Wages earned & cash box handovers'}
                        </span>
                      </div>
                    </div>

                    {/* Filter and statement block */}
                    <div className="flex flex-col sm:flex-row gap-3 p-4 bg-black/45 border border-slate-850/60 rounded-2xl">
                      <div className="relative flex-1">
                        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                          type="text"
                          placeholder={isAr ? 'البحث عن حركة برقم القيد، المرجع، أو البيان...' : 'Filter ledger details...'}
                          value={finSearch}
                          onChange={e => setFinSearch(e.target.value)}
                          className="w-full bg-black/50 border border-slate-855 rounded-xl py-2 px-9 text-xs font-bold text-white focus:border-[#d4af37]/50 outline-none text-start"
                        />
                      </div>
                      <select
                        value={finModuleFilter}
                        onChange={e => setFinModuleFilter(e.target.value as CourierLedgerModuleFilter)}
                        className="bg-[#0e0e11] border border-slate-820 rounded-xl py-2 px-3 text-xs font-black text-slate-300 outline-none focus:border-[#d4af37]/50 cursor-pointer text-start"
                      >
                        <option value="all">{isAr ? 'جميع التصنيفات' : 'All Activities'}</option>
                        <option value="order">{isAr ? 'الطرود والتحصيلات COD' : 'COD Shipments'}</option>
                        <option value="expense">{isAr ? 'العهد والمسحوبات' : 'Custody & Expenses'}</option>
                        <option value="transaction">{isAr ? 'القيود اليدوية والتسويات' : 'Settlement Entries'}</option>
                      </select>
                    </div>

                    {/* Statement Table of selected Courier */}
                    <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
                      <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center text-start">
                        <h4 className="font-black text-xs text-emerald-455 uppercase tracking-wider flex items-center gap-2">
                          <Coins className="w-4 h-4 animate-pulse animate-spin-slow" />
                          {isAr ? 'كشف الحساب المالي التفصيلي للمندوب' : 'COURIER FINANCIAL AUDIT STATEMENT'}
                        </h4>
                        <span className="text-[10px] bg-emerald-950/25 text-[#d4af37] border border-[#d4af37]/40 px-3 py-1 rounded-lg font-bold font-mono">
                          {isAr ? 'مطابق ومحدث حياً' : 'AUDITED LOG'}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-black/30 text-[9px] text-slate-500 uppercase tracking-widest font-black border-b border-slate-850">
                            <tr>
                              <th className="p-3 text-start">{isAr ? 'التاريخ' : 'Posting Date'}</th>
                              <th className="p-3 text-start">{isAr ? 'التصنيف' : 'Classification'}</th>
                              <th className="p-3 text-start">{isAr ? 'البيان والتفاصيل' : 'Description / Narrative'}</th>
                              <th className="p-3 text-start">{isAr ? 'رقم المرجع' : 'Reference Ref'}</th>
                              <th className="p-3 text-start">{isAr ? 'النوع' : 'Entry Type'}</th>
                              <th className="p-3 text-start">{isAr ? 'المبلغ (العملة الأصلية)' : 'Amount (Original)'}</th>
                              <th className="p-3 text-start">{isAr ? `الحساب المالي (${selectedCourier.financialCurrency || 'YER'})` : `Account Balance (${selectedCourier.financialCurrency || 'YER'})`}</th>
                              <th className="p-3 text-left">{isAr ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 bg-[#08080a]/20">
                            {filteredLedger.map((item, idx) => {
                              const isCredit = item.type === 'Credit';
                              return (
                                <tr key={item.id || idx} className="hover:bg-slate-950/40 transition-colors">
                                  <td className="p-3 font-mono font-bold text-[10px] text-slate-400 text-start" dir="ltr">
                                    {new Date(item.date).toLocaleString(isAr ? 'ar-YE' : 'en-US', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="p-3 text-start">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${item.module === 'order' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/20' :
                                      item.module === 'expense' ? 'bg-amber-955/20 text-amber-500 border border-amber-950/20' :
                                        'bg-purple-950/30 text-purple-400 border border-purple-950/20'
                                      }`}>
                                      {item.module === 'order' ? (isAr ? 'تحصيل شحنة' : 'Shipment COD') :
                                        item.module === 'expense' ? (isAr ? 'عهد وسلف وأجور' : 'Disbursed') :
                                          (isAr ? 'تسوية مركزية' : 'Main Entry')}
                                    </span>
                                  </td>
                                  <td className="p-3 font-bold text-white text-start">
                                    <div className="text-xs">{item.title}</div>
                                    <div className="text-[9px] text-slate-550 font-normal mt-0.5">{item.description}</div>
                                  </td>
                                  <td className="p-3 font-mono text-[10px] text-[#d4af37] font-black text-start">{item.ref}</td>
                                  <td className="p-3 text-start">
                                    {isCredit ? (
                                      <span className="text-[9px] bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 px-2.5 py-0.5 rounded-xl font-black">{isAr ? 'إيداع / دائن (+)' : 'Credit (+)'}</span>
                                    ) : (
                                      <span className="text-[9px] bg-rose-955/20 text-rose-500 border border-rose-950/30 px-2.5 py-0.5 rounded-xl font-black">{isAr ? 'خصم / مدين (-)' : 'Debit (-)'}</span>
                                    )}
                                  </td>
                                  <td className={`p-3 font-mono font-bold text-xs ${isCredit ? 'text-emerald-450' : 'text-rose-450'}`}>
                                    <span>{isCredit ? '+' : '-'}{(item.amountOriginal || item.amount || 0).toLocaleString()} {item.currencyOriginal || 'YER'}</span>
                                  </td>
                                  <td className={`p-3 font-mono font-black text-xs ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    <span>{isCredit ? '+' : '-'}{(item.amountFCurrency || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {selectedCourier.financialCurrency || 'YER'}</span>
                                    {selectedCourier.financialCurrency === 'SAR' && (
                                      <span className="block text-[9px] text-slate-500 font-normal mt-0.5" dir="ltr">
                                        ≈ {isCredit ? '+' : '-'}{(item.amount || 0).toLocaleString()} YER
                                      </span>
                                    )}
                                  </td>
                                  <td className={`p-3 text-left font-mono font-black text-xs ${item.runningAccountBal >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                                    <span>{item.runningAccountBal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {selectedCourier.financialCurrency || 'YER'}</span>
                                    {selectedCourier.financialCurrency === 'SAR' && (
                                      <span className="block text-[9px] text-slate-550 font-normal mt-0.5" dir="ltr">
                                        ≈ {Math.round(item.runningAccountBal * exchangeRateSAR).toLocaleString()} YER
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            {filteredLedger.length === 0 && (
                              <tr>
                                <td colSpan={8} className="p-16 text-center text-slate-650 italic font-bold">
                                  {isAr ? '[ لم يتم تقييد حركات مالية مسجلة لهذا المندوب ]' : '[ NO FINANCIAL TRANSACTIONS DISCOVERED ]'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal action tray */}
            <div className="p-4 bg-black/40 border-t border-slate-850 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 select-none">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] font-mono text-slate-500 uppercase">ACTIVE TRACEWAY CONNECTED</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => printContent(isAr ? `كشف حساب المندوب: ${selectedCourier.fullName}` : 'Courier Liability Statement', 'courier-ledger-content', isAr)}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-md active:scale-95"
                >
                  <Printer className="w-4 h-4" /> {isAr ? 'طباعة تقرير المصادقة اليدوية' : 'Print Statement & Incentives'}
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
