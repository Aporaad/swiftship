import React from 'react';
import { ArrowDownUp, Calendar, RotateCcw, Search, X } from 'lucide-react';
import { RETURN_CONDITION_LIST, RETURN_STATUS_LIST, RETURN_TYPE_LIST } from '../../../../../services/returnedProductService';
import { RETURN_INPUT_CLASS_NAME } from './constants';

export interface ReturnedProductsFiltersProps {
  isAr: boolean;
  inp?: string;
  searchQuery: string; setSearchQuery: (value: string) => void;
  statusFilter: string; setStatusFilter: (value: string) => void;
  typeFilter: string; setTypeFilter: (value: string) => void;
  conditionFilter: string; setConditionFilter: (value: string) => void;
  dateFrom: string; setDateFrom: (value: string) => void;
  dateTo: string; setDateTo: (value: string) => void;
  setSortBy: React.Dispatch<React.SetStateAction<'newest' | 'oldest' | 'amount'>>;
  hasActiveFilters: boolean | string; clearFilters: () => void;
  canManage: boolean; canAdd: boolean; openAddForm: () => void;
  filteredCount: number; totalCount: number;
}

export function ReturnedProductsFilters({ inp = RETURN_INPUT_CLASS_NAME, canAdd, ...props }: ReturnedProductsFiltersProps) {
  const { isAr, searchQuery, setSearchQuery, statusFilter, setStatusFilter, typeFilter, setTypeFilter, conditionFilter, setConditionFilter, dateFrom, setDateFrom, dateTo, setDateTo, setSortBy, hasActiveFilters, clearFilters, canManage, openAddForm, filteredCount, totalCount } = props;
  return (
      <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2 flex-1 items-center">

            {/* بحث نصي - Text search */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
              <input
                id="returns-search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'ابحث باسم العميل أو المنتج أو الطلب…' : 'Search by customer, product or order…'}
                className={`${inp} pr-9`}
              />
            </div>

            {/* فلتر الحالة - Status filter */}
            <select
              id="returns-status-filter"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={inp + ' max-w-[150px]'}
            >
              <option value="all">{isAr ? 'كل الحالات' : 'All statuses'}</option>
              {RETURN_STATUS_LIST.map((s, idx) => <option key={`ret-status-filter-${idx}`} value={s}>{s}</option>)}
            </select>

            {/* فلتر النوع - Type filter */}
            <select
              id="returns-type-filter"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className={inp + ' max-w-[140px]'}
            >
              <option value="all">{isAr ? 'كل الأنواع' : 'All types'}</option>
              {RETURN_TYPE_LIST.map((t, idx) => <option key={`ret-type-filter-${idx}`} value={t}>{t}</option>)}
            </select>

            {/* فلتر الحالة الفيزيائية - Condition filter */}
            <select
              id="returns-condition-filter"
              value={conditionFilter}
              onChange={e => setConditionFilter(e.target.value)}
              className={inp + ' max-w-[140px]'}
            >
              <option value="all">{isAr ? 'كل الحالات' : 'All conditions'}</option>
              {RETURN_CONDITION_LIST.map((c, idx) => <option key={`ret-cond-filter-${idx}`} value={c}>{c}</option>)}
            </select>

            {/* زر تغيير الترتيب - Sort button */}
            <button
              id="returns-sort-toggle"
              onClick={() => setSortBy(s => s === 'newest' ? 'oldest' : s === 'oldest' ? 'amount' : 'newest')}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[#d4af37] hover:bg-slate-800 transition"
              title={isAr ? 'تغيير الترتيب' : 'Change sort'}
            >
              <ArrowDownUp className="w-4 h-4" />
            </button>

            {/* مسح الفلاتر - Clear filters */}
            {hasActiveFilters && (
              <button
                id="returns-clear-filters"
                onClick={clearFilters}
                className="p-2 rounded-xl bg-rose-900/20 border border-rose-800/30 text-rose-400 hover:bg-rose-900 transition text-[10px] font-bold flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                {isAr ? 'مسح' : 'Clear'}
              </button>
            )}
          </div>

          {/* زر الإضافة - Add button */}
          {(canManage || canAdd) && (
            <button
              id="returns-add-btn"
              onClick={openAddForm}
              className="bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white rounded-2xl px-5 py-2.5 text-xs font-black flex items-center gap-2 cursor-pointer transition shadow-lg shadow-rose-900/20"
            >
              <RotateCcw className="w-4 h-4" />
              {isAr ? 'إضافة مرتجع' : 'Add Return'}
            </button>
          )}
        </div>

        {/* فلاتر التاريخ - Date range filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-500 font-bold">{isAr ? 'من:' : 'From:'}</span>
            <input
              id="returns-date-from"
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className={inp + ' max-w-[160px]'}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-bold">{isAr ? 'إلى:' : 'To:'}</span>
            <input
              id="returns-date-to"
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className={inp + ' max-w-[160px]'}
            />
          </div>
          <span className="text-[10px] text-slate-500 font-bold ml-auto">
            {isAr
              ? `إجمالي الظاهر: ${filteredCount} من ${totalCount}`
              : `Showing: ${filteredCount} of ${totalCount}`}
          </span>
        </div>
      </div>
  );
}
