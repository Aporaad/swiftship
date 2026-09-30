import React from 'react';
import { 
  X, Phone, Mail, MapPin, Truck, DollarSign, Calendar, FileText, CheckCircle2, User, Lock, Globe, Shield, RefreshCw, Key,
  Crown, ShieldAlert, AlertTriangle, Package, Coins, ArrowDownRight, ArrowUpLeft, Search, Printer
} from 'lucide-react';

export function CourierDetailsModal({
  isOpen,
  onClose,
  isAr,
  selectedCourier,
  courierOrders = [],
  courierExpenses = [],
  courierTransactions = [],
  detailTab = 'logistics',
  setDetailTab,
  finSearch = '',
  setFinSearch,
  finModuleFilter = 'all',
  setFinModuleFilter,
  accounts = []
}: any) {
  if (!isOpen || !selectedCourier) return null;

  const totalDelivered = courierOrders.filter((o: any) => (o.order_status || o.orderStatus) === "تم التسليم").length;
  const totalInTransit = courierOrders.filter((o: any) => (o.order_status || o.orderStatus) !== "تم التسليم" && (o.order_status || o.orderStatus) !== "ملغي").length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-[#0c0c0f] border border-[#d4af37]/25 rounded-3xl shadow-2xl max-w-5xl w-full h-[90vh] overflow-hidden flex flex-col font-sans text-start">
        {/* Header */}
        <div className="bg-black/40 p-5 border-b border-slate-850/80 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
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
                <span className="text-[10px] bg-slate-900 border border-slate-800 text-[#d4af37] px-2 py-0.5 rounded-md font-mono">ID: {selectedCourier.courierCustomId || selectedCourier.id}</span>
                <span className="text-[10px] bg-purple-950/20 border border-purple-950/50 text-purple-400 px-2 py-0.5 rounded-md">عمولة: {selectedCourier.commissionRate || 0}%</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="bg-slate-900 hover:bg-slate-850 p-2 rounded-xl text-slate-500 hover:text-white border border-slate-800 transition-all active:scale-95"><X className="w-5 h-5" /></button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0a0a0c]">
          {/* Tab Selector */}
          <div className="flex bg-black/35 border border-slate-850/50 p-1 rounded-2xl gap-2 font-sans">
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

          {/* Performance summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-3">{isAr ? 'أداء وكفاءة التوصيل' : 'Transit KPI'}</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-[#d4af37]">{totalDelivered}</span>
                <span className="text-[10px] font-bold text-slate-500">{isAr ? 'مسلم ناجح' : 'Delivered success'}</span>
              </div>
              <div className="text-[9px] text-amber-500 font-bold mt-1">
                {totalInTransit} {isAr ? 'قيد التوصيل حالياً' : 'Current Handover'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-3">{isAr ? 'إجمالي الطلبات الموكلة' : 'Total Assigned Orders'}</span>
              <div className="text-base font-mono font-black text-amber-400">{courierOrders.length}</div>
              <span className="text-[9px] text-slate-500 font-bold block mt-1">{isAr ? 'جميع الشحنات الموكلة للمندوب' : 'All assigned shipments'}</span>
            </div>

            <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-3">{isAr ? 'المصروفات والعهد' : 'Expenses & Advances'}</span>
              <div className="text-base font-mono font-black text-emerald-400">{courierExpenses.length}</div>
              <span className="text-[9px] text-slate-500 font-bold block mt-1">{isAr ? 'حركات العهد والمصروفات' : 'Custody & expense records'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/40 border-t border-slate-850 flex justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700">
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
