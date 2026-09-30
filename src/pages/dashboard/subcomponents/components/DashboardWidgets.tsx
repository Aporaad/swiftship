import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, Truck, CheckCircle2, AlertCircle, Clock, TrendingUp, Users as UsersIcon, DollarSign, Plus, UserPlus, ShieldAlert, Compass, TrendingDown, ArrowUpRight, Sliders, Check, FileText } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import type { DashboardActivity, DashboardAlert, DashboardCourierMarker, DashboardMetricConfig, DashboardOrder, DashboardStats } from '../types';

export type DashboardWidgetsProps = {
  isAr: boolean;
  navigate: ReturnType<typeof useNavigate>;
  isCustomizing: boolean;
  setIsCustomizing: React.Dispatch<React.SetStateAction<boolean>>;
  visibleMetrics: string[];
  gridColumns: number;
  metricConfigs: Record<string, DashboardMetricConfig>;
  saveDashboardSettings: (metrics: string[], cols: number) => void;
  stats: DashboardStats;
  canViewStats: boolean;
  orders: any[];
  mapCouriers: DashboardCourierMarker[];
  selectedCourierId: string | null;
  setSelectedCourierId: React.Dispatch<React.SetStateAction<string | null>>;
  recentActivities: DashboardActivity[];
  volumeChartData: Array<{ day: string; volume: number }>;
  statusChartData: Array<{ name: string; value: number; color: string }>;
  displayOrders: DashboardOrder[];
  alertsList: DashboardAlert[];
  couriersCount: number;
  expensesCount: number;
};

export function DashboardHeaderAndCustomizer({ isAr, isCustomizing, setIsCustomizing, visibleMetrics, gridColumns, metricConfigs, saveDashboardSettings }: Pick<DashboardWidgetsProps, 'isAr' | 'isCustomizing' | 'setIsCustomizing' | 'visibleMetrics' | 'gridColumns' | 'metricConfigs' | 'saveDashboardSettings'>) {
  return (
    <>
      {/* 👑 Dashboard Customizer Controls Header Block */}
      <div className="bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg shadow-black/35 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#d4af37]" />
            {isAr ? 'لوحة القيادة والمؤشرات الرقمية' : 'Executive Intelligence Dashboard'}
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            {isAr ? 'تحسس المسارات المحاسبية • التوزيع الميداني • الرقابة والامتياز' : 'Financial pipelines • Dispatch matrix • Live logistics performance telemetry'}
          </p>
        </div>
        
        <button
          onClick={() => setIsCustomizing(!isCustomizing)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-black text-xs transition duration-300 cursor-pointer ${
            isCustomizing 
              ? 'bg-[#d4af37] text-black border-[#d4af37]' 
              : 'bg-slate-950 text-[#d4af37] border-[#d4af37]/25 hover:border-[#d4af37]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          {isAr ? 'تخصيص مؤشرات الأداء ⚙️' : 'Customize Board ⚙️'}
        </button>
      </div>

      {/* Customization Drawer / Panel */}
      {isCustomizing && (
        <div className="bg-[#121215] border border-[#d4af37]/20 p-5 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-300 text-start space-y-4">
          <div className="flex justify-between items-center border-b border-slate-900 pb-3">
            <div>
              <h3 className="font-extrabold text-[#d4af37] text-sm uppercase">{isAr ? 'تخصيص وإعادة ترتيب مؤشرات الأداء العليا' : 'CUSTOMIZE STATISTICAL METRIC CARDS'}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{isAr ? 'اختر المؤشرات المالية والأمنية واللوجستية التفضيلية لعرضها في أعلى لوحتك' : 'Toggle, reorder, and prioritize which telemetry stats you see first'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Object.keys(metricConfigs).map((key) => {
              const config = metricConfigs[key];
              const isVisible = visibleMetrics.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => {
                    let nextVisible = [...visibleMetrics];
                    if (isVisible) {
                      if (nextVisible.length > 1) {
                        nextVisible = nextVisible.filter(k => k !== key);
                      }
                    } else {
                      nextVisible.push(key);
                    }
                    saveDashboardSettings(nextVisible, gridColumns);
                  }}
                  className={`p-3 rounded-xl border text-start flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                    isVisible 
                      ? 'bg-[#d4af37]/10 border-[#d4af37] text-white shadow-lg' 
                      : 'bg-black/30 border-slate-800/40 text-slate-500 hover:border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-1">
                    <div className={`p-1 rounded-lg ${isVisible ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'bg-slate-950 text-slate-600'}`}>
                      <config.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isVisible ? 'bg-[#d4af37] border-[#d4af37] text-black' : 'border-slate-800'
                    }`}>
                      {isVisible && <Check className="w-2.5 h-2.5 stroke-[4]" />}
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold mt-2 leading-tight">
                    {isAr ? config.titleAr : config.titleEn}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-900 pt-3 flex flex-wrap gap-4 items-center">
            <span className="text-xs font-bold text-slate-400">{isAr ? 'تقسيم شبكة العرض (أعمدة):' : 'Grid Column Layout:'}</span>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map((cols) => (
                <button
                  key={cols}
                  onClick={() => {
                    saveDashboardSettings(visibleMetrics, cols);
                  }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-black border transition-all ${
                    gridColumns === cols 
                      ? 'bg-[#d4af37] text-black border-[#d4af37]' 
                      : 'bg-black/50 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {cols} {isAr ? 'أعمدة' : 'Columns'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function DashboardMetricCards({ isAr, visibleMetrics, gridColumns, metricConfigs, canViewStats }: Pick<DashboardWidgetsProps, 'isAr' | 'visibleMetrics' | 'gridColumns' | 'metricConfigs' | 'canViewStats'>) {
  const getGridColsClass = () => {
    switch (gridColumns) {
      case 2: return 'grid-cols-1 sm:grid-cols-2';
      case 3: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      case 4: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
      case 5: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5';
      default: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6';
    }
  };
  return (
    <>
      {/* 3️⃣ SECTION 1: Luxury Black Glass Stat Cards */}
      <div className={`grid gap-4 ${getGridColsClass()}`}>
        
        {visibleMetrics.map((key) => {
          const config = metricConfigs[key];
          if (!config) return null;
          // Hide financial metric cards if user doesn't have statistics permission
          const isFinancial = ['totalRevenues', 'netProfit', 'amountPaid', 'amountRemaining'].includes(key);
          if (isFinancial && !canViewStats) return null;
          return (
            <div 
              key={key}
              className="bg-gradient-to-br from-[#0d0d0f] to-[#040405] border border-[#d4af37]/15 p-4 rounded-xl relative overflow-hidden group shadow-lg shadow-black/40 hover:border-[#d4af37]/30 transition-all duration-300 text-right min-w-0"
            >
              <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-[#d4af37]/5 to-transparent rounded-full blur-2xl"></div>
              <div className="pl-12">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block mb-1 truncate">
                  {isAr ? config.titleAr : config.titleEn}
                </span>
                <div className={`text-base sm:text-lg md:text-xl font-black font-mono tracking-tight mt-1 break-words leading-none ${config.colorClass}`}>
                  {config.value}
                </div>
                <div className={`text-[10px] font-bold mt-1.5 flex items-center gap-1 leading-none ${config.isPositive ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {config.isPositive ? <ArrowUpRight className="w-3.5 h-3.5 shrink-0" /> : <Clock className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{isAr ? config.changeAr : config.changeEn}</span>
                </div>
              </div>
              <div className={`absolute top-4 left-4 p-2.5 rounded-lg ${config.bgClass} group-hover:scale-105 transition-transform duration-300`}>
                <config.icon className="w-4 h-4" />
              </div>
            </div>
          );
        })}

      </div>
    </>
  );
}

export function DashboardMapAndActivity({ isAr, navigate, mapCouriers, selectedCourierId, setSelectedCourierId, recentActivities }: Pick<DashboardWidgetsProps, 'isAr' | 'navigate' | 'mapCouriers' | 'selectedCourierId' | 'setSelectedCourierId' | 'recentActivities'>) {
  return (
    <>
      {/* 🖥️ SECTION 2: Map & Timeline Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 🗺️ Live Tracking Map Core Block */}
        <div className="lg:col-span-2 bg-[#0c0c0e] border border-[#d4af37]/15 rounded-xl p-5 flex flex-col overflow-hidden relative shadow-lg shadow-black/55 min-h-[420px]">
          {/* Glowing Top subtle bar */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent"></div>
          
          <div className="flex justify-between items-center mb-4 relative z-10">
            <div className="text-start">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#d4af37] animate-spin-slow" />
                {isAr ? 'التتبع المباشر للطلبات' : 'Live Logistics Dispatch Radar'}
              </h3>
              <p className="text-[9px] text-[#d4af37] font-bold uppercase mt-0.5 tracking-widest">{isAr ? 'مواقع المندوبين والشحنات في الوقت الحقيقي' : 'Real-time telemetry and dispatch networks'}</p>
            </div>
            
            <div className="flex gap-2">
              <span className="bg-[#d4af37]/10 text-[#d4af37] text-[9px] px-3 py-1 font-black rounded-lg border border-[#d4af37]/20 select-none">
                GPS ACTIVE_NODE
              </span>
            </div>
          </div>

          {/* Interactive Tactical Cities Map Vector Canvas Container */}
          <div className="flex-1 bg-black rounded-lg relative overflow-hidden border border-slate-900 min-h-[300px]">
            {/* Cyber City Grids and Road Networks */}
            <svg className="absolute inset-0 w-full h-full object-cover opacity-35" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(212,175,55,0.06)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* Glowing Roads & Delivery Channels */}
              <path d="M10 50 Q100 130 180 80 T300 40 T400 90" fill="none" stroke="rgba(212,175,55,0.22)" strokeWidth="2.5" strokeLinecap="round" className="animate-pulse" />
              <path d="M50 180 Q150 120 250 160 T380 180" fill="none" stroke="rgba(212,175,55,0.15)" strokeWidth="1.5" />
              <path d="M120 10 L150 190" fill="none" stroke="rgba(212,175,55,0.08)" strokeWidth="1" />
              <path d="M250 10 L280 190" fill="none" stroke="rgba(212,175,55,0.08)" strokeWidth="1" />
              
              {/* Animated Cargo Flow lines */}
              <path d="M10 50 Q100 130 180 80 T300 40 T400 90" fill="none" stroke="#d4af37" strokeWidth="1.5" strokeDasharray="10, 150" strokeDashoffset="0" className="animate-[dash_6s_linear_infinite]" />
            </svg>

            {/* Courier Markers on Map */}
            {mapCouriers.map((c) => (
              <div 
                key={c.id}
                className="absolute transition-all duration-700 cursor-pointer group"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
                onClick={() => setSelectedCourierId(selectedCourierId === c.id ? null : c.id)}
              >
                {/* Glowing Pulsing Ring */}
                <span className={`absolute -inset-2.5 rounded-full animate-ping opacity-60 ${
                  c.statusColor === 'green' ? 'bg-emerald-500/20' :
                  c.statusColor === 'blue' ? 'bg-blue-500/20' : 'bg-amber-500/20'
                }`}></span>
                
                {/* Core Pin Dot */}
                <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-black relative z-10 ${
                  c.statusColor === 'green' ? 'bg-emerald-500' :
                  c.statusColor === 'blue' ? 'bg-blue-500' : 'bg-amber-500'
                } shadow-[0_0_10px_currentColor]`}>
                  <Compass className="w-2.5 h-2.5 text-black" />
                </div>

                {/* Floating Courier Card - faithfully styled after screenshot */}
                <div className="absolute bottom-6 right-1/2 translate-x-1/2 bg-[#09090b]/95 border border-[#d4af37]/30 p-2 rounded-xl w-36 shadow-xl shadow-black/80 text-start pointer-events-none group-hover:opacity-100 opacity-90 transition-opacity whitespace-nowrap z-50">
                  <div className="flex items-center gap-2">
                    <img src={c.avatar} className="w-6 h-6 rounded-full border border-[#d4af37]/30 object-cover" referrerPolicy="no-referrer" />
                    <div>
                      <p className="text-[10px] font-black text-white leading-tight">{c.name}</p>
                      <p className="text-[9px] text-[#d4af37] font-bold leading-normal">{c.order}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1.5 border-t border-[#d4af37]/10 pt-1">
                    <span className="text-[8px] text-slate-500 font-extrabold uppercase">STATUS</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                      c.statusColor === 'green' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40' :
                      c.statusColor === 'blue' ? 'bg-blue-900/30 text-blue-400 border border-blue-800/40' :
                      'bg-amber-900/30 text-amber-400 border border-amber-800/40'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {mapCouriers.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/75 backdrop-blur-sm transition-all duration-300 z-20 text-center">
                <div className="p-4 rounded-full bg-slate-950/90 border border-[#d4af37]/30 mb-3 animate-pulse">
                  <Truck className="w-8 h-8 text-[#d4af37]" />
                </div>
                <p className="text-sm font-extrabold text-[#d4af37]">
                  {isAr ? 'خريطة التتبع الميداني خالية' : 'No Operational Field Dispatchers'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                  {isAr 
                    ? 'لا توجد مناديب توصيل نشطين حالياً في النظام اللوجستي.'
                    : 'Dispatch tracking is empty. Manage couriers to initialize navigation grids.'}
                </p>
                <button 
                  onClick={() => navigate('/couriers')}
                  className="mt-4 px-3 py-1.5 border border-[#d4af37]/35 text-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/10 text-[10px] font-black rounded-lg transition-all"
                >
                  {isAr ? 'إجراء تسجيل مندوب جديد 🚚' : 'Register Operator 🚚'}
                </button>
              </div>
            )}

            {/* Map Legend Overlay built with full responsive wrapping bounds */}
            <div className="absolute bottom-3 inset-x-3 bg-[#070708]/95 border border-[#d4af37]/15 p-2 px-3 rounded-xl flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[9px] font-black tracking-wider shadow-lg shadow-black/80 z-10 transition-all">
              <span className="text-slate-500 uppercase">{isAr ? 'الحالات:' : 'KEY:'}</span>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>{isAr ? 'تم التسليم' : 'DELIVERED'}</div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>{isAr ? 'جاهز/توصيل' : 'ON ROAD'}</div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>{isAr ? 'في الطريق' : 'PREPPED'}</div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>{isAr ? 'متأخر' : 'DELAYED'}</div>
            </div>
          </div>
        </div>

        {/* 📜 Latest Activities Panel (آخر النشاطات) */}
        <div className="bg-[#0c0c0e] border border-[#d4af37]/15 rounded-xl p-5 flex flex-col shadow-lg shadow-black/55 relative">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent"></div>
          
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-900">
            <h3 className="font-black text-white text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#d4af37]" />
              {isAr ? 'آخر النشاطات اللوجستية' : 'Live Timeline Logs'}
            </h3>
            <Link to="/orders" className="text-[9px] font-black text-[#d4af37] bg-[#d4af37]/5 px-2.5 py-1 rounded-lg border border-[#d4af37]/15 hover:bg-[#d4af37]/15 transition duration-300">
              {isAr ? 'عرض الكل' : 'View Ledger'}
            </Link>
          </div>

          {/* Activities vertical list */}
          <div className="flex-1 space-y-4 flex flex-col justify-center">
            {recentActivities.map((act) => {
              const Icon = act.icon;
              return (
                <div key={act.id} className="flex gap-3 text-start items-start group min-w-0">
                  <div className={`p-2.5 rounded-xl border ${act.iconBg} transform group-hover:scale-105 transition-all duration-300 shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-white leading-snug group-hover:text-[#d4af37] transition duration-300 truncate">{act.title}</h4>
                    <span className="font-mono text-[10px] text-[#d4af37]/80 block mt-0.5 font-bold truncate">{act.ref}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold justify-end block whitespace-nowrap pt-1 shrink-0">
                    {act.time}
                  </span>
                </div>
              );
            })}

            {recentActivities.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-500 font-sans">
                <div className="p-3 bg-slate-900/10 rounded-full border border-slate-800/40 mb-3 animate-pulse">
                  <Clock className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-xs font-black text-slate-400">{isAr ? 'لا توجد سجلات نشاط' : 'No Activities Labeled'}</p>
                <p className="text-[9px] text-slate-605 max-w-[200px] mt-1.5 leading-normal">
                  {isAr ? 'تظهر هنا أحدث العمليات والتحركات التي تتم في النظام تلقائياً وبكل دقة في الوقت الحقيقي.' : 'System ledger tracks administrative and operational events here.'}
                </p>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-[#d4af37]/5 to-[#d4af37]/0 p-3 rounded-xl border border-[#d4af37]/10 mt-6 flex justify-between items-center select-none text-start">
            <div className="leading-tight">
              <span className="text-[9px] text-slate-500 font-extrabold uppercase">ALX TELEMETRY</span>
              <p className="text-[10px] font-black text-white">{isAr ? 'تحديث الاتصالات الذاتي نشط' : 'Pulse streaming enabled'}</p>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        </div>

      </div>
    </>
  );
}

export function DashboardAnalyticsCharts({ isAr, orders, volumeChartData, statusChartData }: Pick<DashboardWidgetsProps, 'isAr' | 'orders' | 'volumeChartData' | 'statusChartData'>) {
  return (
    <>
      {/* 📊 SECTION 2.5: Interactive Analytics Charts (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Daily Shipping Volume Line/Area Chart */}
        <div className="lg:col-span-2 bg-[#0c0c0e]/95 border border-[#d4af37]/15 rounded-xl p-5 flex flex-col shadow-lg shadow-black/55 relative min-h-[360px]">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent"></div>
          
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-900/40">
            <div className="text-start">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'حجم الشحن والعمليات اليومية' : 'Daily Shipping Volume'}
              </h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5 tracking-wider">
                {isAr ? 'مؤشر الإنتاجية والتدفق العام لآخر ٧ أيام' : 'Logistics throughput & operational volume over 7 days'}
              </p>
            </div>
          </div>

          <div className="flex-1 w-full min-h-[240px] flex items-center justify-center relative">
            {orders.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/40 backdrop-blur-[1px] z-10 rounded-xl">
                <TrendingUp className="w-8 h-8 text-slate-700 mb-2 animate-pulse" />
                <p className="text-xs font-black text-slate-400">{isAr ? 'لا توجد بيانات شحن كافية للرسم البياني' : 'Insufficient Shipping Volumes'}</p>
                <p className="text-[9px] text-slate-500 mt-1 max-w-xs">{isAr ? 'عندما تبدأ في إنشاء الطلبات وجدولة الطرود، سيتم تمثيل تدفق الإيرادات اللوجستية والكميات هنا تلقائياً.' : 'Operations telemetry will render dynamically once daily orders begin streaming inside your logs.'}</p>
              </div>
            ) : null}
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={volumeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#d4af37" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 175, 55, 0.05)" />
                <XAxis 
                  dataKey="day" 
                  stroke="#566573" 
                  tick={{ fontSize: 10, fontWeight: 'bold' }} 
                />
                <YAxis 
                  stroke="#566573" 
                  tick={{ fontSize: 10, fontWeight: 'bold' }} 
                  allowDecimals={false}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#09090b]/95 border border-[#d4af37]/45 p-2.5 rounded-xl shadow-xl text-xs text-right">
                          <p className="text-[#d4af37] font-black">{payload[0].payload.day}</p>
                          <p className="text-white mt-1">
                            {isAr ? 'عدد الشحنات:' : 'Total Shipments:'}{' '}
                            <span className="font-mono font-black text-[#d4af37]">{payload[0].value}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="volume" 
                  stroke="#d4af37" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorVolume)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Distribution Pie/Donut Chart */}
        <div className="bg-[#0c0c0e]/95 border border-[#d4af37]/15 rounded-xl p-5 flex flex-col shadow-lg shadow-black/55 relative min-h-[360px]">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent"></div>
          
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-900/40">
            <div className="text-start">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'توزيع حالات الطلبات' : 'Order Status Share'}
              </h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5 tracking-wider">
                {isAr ? 'إحصاء الحصص لقطاعات التوصيل' : 'Current snapshot of dispatch status allocations'}
              </p>
            </div>
          </div>

          <div className="flex-1 w-full flex flex-col items-center justify-center relative min-h-[240px]">
            {orders.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/40 backdrop-blur-[1px] z-10 rounded-xl">
                <Package className="w-8 h-8 text-slate-700 mb-2 animate-pulse" />
                <p className="text-xs font-black text-slate-400">{isAr ? 'لا توجود حالات جدولة حالياً' : 'No Active Shipments Found'}</p>
                <p className="text-[9px] text-slate-500 mt-1 max-w-xs">{isAr ? 'يتم توزيع الحصص النسبية للحالات اللوجستية بمجرد تشغيل وجدولة الطلبات الأولى.' : 'Sector allocations will construct automatically once shipment orders begin streaming.'}</p>
              </div>
            ) : null}
            <div className="relative w-full h-[160px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height={160} minWidth={0}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#09090b]/95 border border-[#d4af37]/30 p-2 rounded-xl shadow-xl text-xs text-right">
                            <p className="font-black text-white">{payload[0].name}</p>
                            <p className="text-slate-400 mt-1">
                              {isAr ? 'العدد:' : 'Count:'}{' '}
                              <span className="font-mono font-black" style={{ color: payload[0].payload.color }}>
                                {payload[0].value}
                              </span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Abs center stats indicator */}
              <div className="absolute flex flex-col items-center justify-center mt-[-10px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">
                  {isAr ? 'إجمالي' : 'TOTAL'}
                </span>
                <span className="text-lg font-black text-white font-mono mt-0.5">
                  {statusChartData.reduce((acc, curr) => acc + curr.value, 0)}
                </span>
              </div>
            </div>

            {/* Custom Responsive Side Legend Layout */}
            <div className="w-full grid grid-cols-2 gap-2 mt-4 text-[10px] font-bold">
              {statusChartData.map((entry, index) => {
                if (entry.value === 0 && orders.length === 0) return null;
                return (
                  <div key={index} className="flex items-center gap-1.5 justify-start text-start">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-slate-400 truncate w-20">{entry.name}</span>
                    <span className="font-mono text-white shrink-0">({entry.value})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

export function DashboardOperations({ isAr, navigate, orders, canViewStats, stats, displayOrders, alertsList }: Pick<DashboardWidgetsProps, 'isAr' | 'navigate' | 'orders' | 'canViewStats' | 'stats' | 'displayOrders' | 'alertsList'>) {
  const getStatusBeadStyles = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': case 'تم التسليم': return 'bg-emerald-950/40 border border-emerald-800 text-emerald-400';
      case 'shipped': case 'in transit': case 'جاري التوصيل': case 'قيد الشحن': return 'bg-blue-950/40 border border-blue-800 text-blue-400';
      case 'processing': case 'in local warehouse': case 'في الطريق': case 'وصل المخزن': return 'bg-amber-950/40 border border-amber-800 text-amber-400';
      case 'delayed': case 'متأخر': return 'bg-rose-950/40 border border-rose-800 text-rose-400';
      default: return 'bg-slate-900 border border-slate-700 text-slate-300';
    }
  };
  const getStatusTextArabic = (status: string) => {
    switch (status) {
      case 'Delivered': return 'تم التسليم';
      case 'In Transit': return 'جاري التوصيل';
      case 'Processing': return 'في الطريق';
      case 'In Local Warehouse': return 'تم التجهيز';
      case 'Delayed': return 'متأخر';
      default: return status;
    }
  };
  return (
    <>
      {/* 📊 SECTION 3: Performance, Orders Table, Financial Status & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Widget 1: ملخص الأداء اليومي (Circular circular progress wheel) */}
        {canViewStats && (
          <div className="bg-[#0c0c0e] border border-[#d4af37]/15 rounded-xl p-5 flex flex-col items-center justify-between shadow-lg shadow-black/55 relative">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent"></div>
            
            <div className="w-full text-start mb-4 pb-3 border-b border-slate-900 flex justify-between">
              <span className="font-black text-white text-xs uppercase tracking-wider">{isAr ? 'ملخص الأداء المالي' : 'Daily Core Yield'}</span>
              <span className="text-[9px] font-bold text-slate-500 font-mono tracking-tighter">PERF v3.0</span>
            </div>

            <div className="relative flex items-center justify-center my-4 group select-none">
              {/* outer golden shadow ring */}
              <div className="absolute w-36 h-36 rounded-full bg-[#d4af37]/5 blur-lg group-hover:bg-[#d4af37]/10 transition-all duration-500"></div>
              
              <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Circle */}
                <circle cx="50" cy="50" r="40" stroke="rgba(212,175,55,0.05)" strokeWidth="8" fill="none" />
                {/* Foreground Animated Gold Circle */}
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  stroke="#d4af37" 
                  strokeWidth="8" 
                  fill="none" 
                  strokeDasharray="251.2" 
                  strokeDashoffset="32.6" // 87% filled
                  strokeLinecap="round"
                  className="transition-all duration-[2000] ease-out drop-shadow-[0_0_6px_#d4af37]"
                />
              </svg>
              
              {/* Center Text displaying status */}
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-black text-white font-mono tracking-tighter">87%</span>
                <span className="text-[10px] text-[#d4af37] font-black tracking-widest mt-0.5">{isAr ? 'مـمـتـاز' : 'OPTIMAL'}</span>
              </div>
            </div>

            {/* Performance small breakdown */}
            <div className="w-full space-y-2.5 mt-2 text-start font-sans text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">{isAr ? 'إيرادات اليوم' : 'Daily Revenue'}</span>
                <span className="font-mono font-black text-white">{stats.totalRevenues.toLocaleString()} YER</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-900 pt-2">
                <span className="text-slate-500 font-bold">{isAr ? 'المصروفات العامة' : 'Office Expenses'}</span>
                <span className="font-mono font-bold text-rose-500">58,230 YER</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-900 pt-2">
                <span className="text-slate-400 font-bold">{isAr ? 'صافي الربح اليومي' : 'Net Surplus'}</span>
                <span className="font-mono font-black text-emerald-400">{stats.netProfit.toLocaleString()} YER</span>
              </div>
            </div>

            <button onClick={() => navigate('/finance')} className="w-full bg-[#d4af37]/5 hover:bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/15 hover:border-[#d4af37]/35 py-2 rounded-xl text-[10px] font-black transition-all duration-300 tracking-wider mt-4">
              {isAr ? 'عـرض الـتـقـريـر الـمـالـي' : 'DOWNLOAD DETAILED LEDGER'}
            </button>
          </div>
        )}

        {/* Today's Transactions Table (جدول آخر الطلبات) */}
        <div className={`${canViewStats ? 'lg:col-span-2' : 'lg:col-span-3'} bg-[#0c0c0e] border border-[#d4af37]/15 rounded-xl p-5 flex flex-col justify-between shadow-lg shadow-black/55 relative overflow-hidden`}>
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent"></div>
          
          <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-3">
            <h3 className="font-black text-white text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-[#d4af37]" />
              {isAr ? 'آخر الشحنات والطلبات' : 'Today\'s Dispatch Orders'}
            </h3>
            <Link to="/orders" className="text-[9px] font-black text-[#d4af37] bg-[#d4af37]/5 px-2.5 py-1 rounded-lg border border-[#d4af37]/15 hover:bg-[#d4af37]/15 transition duration-300">
              {isAr ? 'عرض كل الطلبات' : 'All Sheets'}
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto min-h-[220px]">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-slate-500 font-extrabold uppercase border-b border-slate-900 text-[10px]">
                  <th className="pb-3 text-start">{isAr ? 'رقم الطلب' : 'ORDER'}</th>
                  <th className="pb-3 text-center">{isAr ? 'العميل' : 'CUSTOMER'}</th>
                  <th className="pb-3 text-center">{isAr ? 'الحالة' : 'STATE'}</th>
                  <th className="pb-3 text-center">{isAr ? 'المندوب' : 'DELIVERER'}</th>
                  {canViewStats && <th className="pb-3 text-end">{isAr ? 'المبلغ' : 'PAY'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/50">
                {displayOrders.map((ord, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.01] transition-colors group cursor-pointer" onClick={() => navigate('/orders')}>
                    <td className="py-3 font-mono font-black text-white text-xs text-start">
                      <span className="text-[#d4af37] leading-none block">{ord.orderNumber || 'ALX-XXXX-XXXX'}</span>
                    </td>
                    <td className="py-3 font-bold text-slate-350 text-center text-[11px]">
                      {ord.customerName}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black inline-block whitespace-nowrap ${getStatusBeadStyles(ord.orderStatus || ord.order_status)}`}>
                        {isAr ? getStatusTextArabic(ord.orderStatus || ord.order_status || 'Processing') : (ord.orderStatus || ord.order_status)}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400 font-medium text-center text-[10px]">
                      {ord.deliveryCourierName || '—'}
                    </td>
                    {canViewStats && (
                      <td className="py-3 font-mono font-black text-[#d4af37] text-end text-xs">
                        {((parseFloat(ord.amountPaid) || 0) + (parseFloat(ord.amountRemaining) || 0)).toLocaleString()} YER
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Column of Financial panels (الوضع المالي) & Alerts (التنبيهات) as requested */}
        <div className="space-y-4">
          
          {/* Dashboard Section 6: Financial Panel (الوضع المالي) */}
          {canViewStats && (
            <div className="bg-[#0c0c0e] border border-[#d4af37]/15 rounded-xl p-4 flex flex-col justify-between shadow-lg shadow-black/55 relative">
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent"></div>
              <div className="text-start border-b border-slate-900 pb-2 mb-3">
                <span className="font-black text-white text-xs uppercase tracking-wider">{isAr ? 'الحسابات والمعاملات الذكية' : 'Vault Ledger'}</span>
              </div>

              <div className="space-y-2.5">
                
                {/* Stat 1: صافي أرباح الشركة */}
                <div className="p-3 bg-gradient-to-r from-[#0d0d0f] to-transparent border-r-2 border-[#d4af37] rounded-l-lg text-start flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-[#d4af37] font-black uppercase tracking-wider block">{isAr ? 'صافي أرباح الشركة' : 'NET MARGINS'}</span>
                    <span className="font-mono text-base font-black text-white mt-1 block">
                      {`${stats.netProfit.toLocaleString()} YER`}
                    </span>
                  </div>
                  <TrendingUp className="w-6 h-6 text-[#d4af37] opacity-25" />
                </div>

                {/* Stat 2: المقبوض كاش */}
                <div className="p-3 bg-gradient-to-r from-[#0d0d0f] to-transparent border-r-2 border-emerald-500 rounded-l-lg text-start flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-emerald-400 font-black uppercase tracking-wider block">{isAr ? 'المقبوض كاش' : 'CASH COLLECTED'}</span>
                    <span className="font-mono text-base font-black text-white mt-1 block">
                      {`${stats.amountPaid.toLocaleString()} YER`}
                    </span>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-25" />
                </div>

                {/* Stat 3: المتبقي على العملاء */}
                <div className="p-3 bg-gradient-to-r from-[#0d0d0f] to-transparent border-r-2 border-rose-500 rounded-l-lg text-start flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-rose-400 font-black uppercase tracking-wider block">{isAr ? 'المتبقي على العملاء' : 'OUTSTANDING DEBT'}</span>
                    <span className="font-mono text-base font-black text-white mt-1 block">
                      {`${stats.amountRemaining.toLocaleString()} YER`}
                    </span>
                  </div>
                  <TrendingDown className="w-6 h-6 text-rose-500 opacity-25" />
                </div>

              </div>
            </div>
          )}

          {/* Smart Alerts Box (التنبيهات الذكية) */}
          <div className="bg-[#0c0c0e] border border-[#d4af37]/15 rounded-xl p-4 flex flex-col justify-between shadow-lg shadow-black/55 relative">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent"></div>
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-900">
              <span className="font-black text-white text-xs uppercase tracking-wider">{isAr ? 'التنبيهات والأمان الذكي' : 'Core Alerts'}</span>
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            </div>

            <div className="space-y-2 text-start font-sans">
              {alertsList.map((alert) => {
                const AlertIcon = alert.icon;
                return (
                  <div key={alert.id} className={`p-2.5 rounded-lg border flex items-center gap-2 ${alert.bgClass}`}>
                    <AlertIcon className={`w-4 h-4 shrink-0 ${alert.textClass}`} />
                    <div className="leading-tight min-w-0">
                      <p className="text-[10px] font-black text-white break-words">
                        {isAr ? alert.messageAr : alert.messageEn}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </>
  );
}

export function DashboardQuickActions({ isAr, navigate }: Pick<DashboardWidgetsProps, 'isAr' | 'navigate'>) {
  return (
    <>
      {/* 🚀 SECTION 4: Decorative Luxury Gold Quick Action Buttons */}
      <div className="pt-4 border-t border-[#d4af37]/10">
        <h4 className="text-[10px] text-slate-500 font-extrabold tracking-widest uppercase mb-4 text-start">
          {isAr ? 'أزرار الإجراءات السريعة للنظام' : 'CORE HUB ACTIONS'}
        </h4>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          
          <button 
            onClick={() => navigate('/orders?new=true')} 
            className="p-4 rounded-xl bg-[#09090b] border border-[#d4af37]/20 hover:border-[#d4af37] text-white hover:text-[#d4af37] transition-all duration-300 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg group"
          >
            <div className="p-2 rounded-lg bg-[#d4af37]/5 text-[#d4af37] group-hover:scale-105 transition-all">
              <Plus className="w-4 h-4" />
            </div>
            <span>{isAr ? 'إنشاء طلب جديد' : 'New Order'}</span>
          </button>

          <button 
            onClick={() => navigate('/customers')} 
            className="p-4 rounded-xl bg-[#09090b] border border-[#d4af37]/20 hover:border-[#d4af37] text-white hover:text-[#d4af37] transition-all duration-300 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg group"
          >
            <div className="p-2 rounded-lg bg-[#d4af37]/5 text-[#d4af37] group-hover:scale-105 transition-all">
              <UserPlus className="w-4 h-4" />
            </div>
            <span>{isAr ? 'إضافة عميل جديد' : 'Add Customer'}</span>
          </button>

          <button 
            onClick={() => navigate('/couriers')} 
            className="p-4 rounded-xl bg-[#09090b] border border-[#d4af37]/20 hover:border-[#d4af37] text-white hover:text-[#d4af37] transition-all duration-300 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg group"
          >
            <div className="p-2 rounded-lg bg-[#d4af37]/5 text-[#d4af37] group-hover:scale-105 transition-all">
              <Truck className="w-4 h-4" />
            </div>
            <span>{isAr ? 'إضافة مندوب للتوصيل' : 'Add Courier'}</span>
          </button>

          <button 
            onClick={() => navigate('/tracking')} 
            className="p-4 rounded-xl bg-[#09090b] border border-[#d4af37]/20 hover:border-[#d4af37] text-white hover:text-[#d4af37] transition-all duration-300 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg group"
          >
            <div className="p-2 rounded-lg bg-[#d4af37]/5 text-[#d4af37] group-hover:scale-105 transition-all">
              <Compass className="w-4 h-4" />
            </div>
            <span>{isAr ? 'تحديث شحنة دولية' : 'International Cargo'}</span>
          </button>

          <button 
            onClick={() => navigate('/finance')} 
            className="p-4 rounded-xl bg-[#09090b] border border-[#d4af37]/20 hover:border-[#d4af37] text-white hover:text-[#d4af37] transition-all duration-300 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg group"
          >
            <div className="p-2 rounded-lg bg-[#d4af37]/5 text-[#d4af37] group-hover:scale-105 transition-all">
              <DollarSign className="w-4 h-4" />
            </div>
            <span>{isAr ? 'تسجيل مصروفات / عهد' : 'Log General Cost'}</span>
          </button>

          <button 
            onClick={() => navigate('/finance')} 
            className="p-4 rounded-xl bg-[#09090b] border border-[#d4af37]/20 hover:border-[#d4af37] text-white hover:text-[#d4af37] transition-all duration-300 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg group"
          >
            <div className="p-2 rounded-lg bg-[#d4af37]/5 text-[#d4af37] group-hover:scale-105 transition-all">
              <FileText className="w-4 h-4" />
            </div>
            <span>{isAr ? 'تقارير مالية سريعة' : 'Print Quick Sheets'}</span>
          </button>

        </div>
      </div>

    </>
  );
}
