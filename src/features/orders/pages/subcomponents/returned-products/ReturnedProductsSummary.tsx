import React from 'react';
import { AlertCircle, CheckCircle2, PackageX, TrendingDown } from 'lucide-react';
import type { ReturnStats } from './types';

export interface ReturnedProductsSummaryProps {
  isAr: boolean;
  stats: ReturnStats;
  money: (amount: unknown, currency?: string) => string;
}

export function ReturnedProductsSummary({ isAr, stats, money }: ReturnedProductsSummaryProps) {
  return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* إجمالي المرتجعات */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">
              {isAr ? 'إجمالي المرتجعات' : 'Total Returns'}
            </span>
            <span className="text-xl font-black text-white font-mono mt-0.5 block">{stats.total}</span>
          </div>
          <div className="p-2.5 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-xl text-[#d4af37]">
            <PackageX className="w-4 h-4" />
          </div>
        </div>

        {/* معلق */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">
              {isAr ? 'معلق' : 'Pending'}
            </span>
            <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">{stats.pending}</span>
          </div>
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>

        {/* مقبول */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">
              {isAr ? 'مقبول' : 'Accepted'}
            </span>
            <span className="text-xl font-black text-cyan-400 font-mono mt-0.5 block">{stats.accepted}</span>
          </div>
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* مكتمل */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">
              {isAr ? 'مكتمل' : 'Completed'}
            </span>
            <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">{stats.completed}</span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* إجمالي الاسترداد */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">
              {isAr ? 'إجمالي الاسترداد' : 'Total Refunds'}
            </span>
            <span className="text-sm font-black text-rose-400 font-mono mt-0.5 block">
              {money(stats.total_refund_amount)}
            </span>
          </div>
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
      </div>
  );
}
