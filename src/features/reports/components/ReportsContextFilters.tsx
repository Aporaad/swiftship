import React from 'react';
import {
  Bookmark,
  Calendar,
  Download as DownloadIcon,
  Filter,
  Printer,
  RefreshCw,
  Save,
  Search,
} from 'lucide-react';
import type { ReportFilter } from '../types/reports.types';

type FilterEntity = {
  id: string;
  accountCode?: string;
  entityName?: string;
  name?: string;
  currency?: string;
  fullName?: string;
  displayName?: string;
  email?: string;
};

type ExpenseCategoryOption = {
  id: string;
  labelAr: string;
  labelEn: string;
};

interface ReportsContextFiltersProps {
  isAr: boolean;
  activeReport: string;
  filters: ReportFilter;
  onFilterChange: (field: keyof ReportFilter, value: string) => void;
  expenseCategories: ExpenseCategoryOption[];
  accounts: FilterEntity[];
  customers: FilterEntity[];
  couriers: FilterEntity[];
  users: FilterEntity[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  showSaveTemplateForm: boolean;
  onToggleSaveTemplateForm: () => void;
  onCloseSaveTemplateForm: () => void;
  newTemplateName: string;
  onTemplateNameChange: (value: string) => void;
  onSaveFilterTemplate: () => void;
  isSavingFilterTemplate: boolean;
  onOpenPrintSettings: () => void;
  onExportExcel: () => void;
  sortBy: string;
  onSortByChange: (value: 'date' | 'amount') => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderToggle: () => void;
}

export default function ReportsContextFilters({
  isAr,
  activeReport,
  filters,
  onFilterChange,
  expenseCategories,
  accounts,
  customers,
  couriers,
  users,
  searchTerm,
  onSearchTermChange,
  showSaveTemplateForm,
  onToggleSaveTemplateForm,
  onCloseSaveTemplateForm,
  newTemplateName,
  onTemplateNameChange,
  onSaveFilterTemplate,
  isSavingFilterTemplate,
  onOpenPrintSettings,
  onExportExcel,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderToggle,
}: ReportsContextFiltersProps) {
  return (
    <div className="bg-[#111114] border border-slate-850 p-5 rounded-3xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs font-black text-[#d4af37] uppercase flex items-center gap-2">
          <Filter className="w-4 h-4" />
          {isAr ? 'مصفاة البيانات الاحترافية' : 'Professional Filter Deck'}
        </span>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onToggleSaveTemplateForm}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${showSaveTemplateForm
              ? 'bg-rose-500/10 border-rose-500/35 text-rose-400'
              : 'bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400'
              }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            {isAr ? 'حفظ الفلترة الحالية كقالب' : 'Save Preset'}
          </button>
          <button
            onClick={onOpenPrintSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/35 text-[#d4af37] rounded-xl text-xs font-black transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            {isAr ? 'معاينة وطباعة القالب' : 'Paper Config'}
          </button>
          <button
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 text-emerald-400 rounded-xl text-xs font-black transition-all"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            {isAr ? 'تصدير Excel' : 'Excel'}
          </button>
        </div>
      </div>

      {showSaveTemplateForm && (
        <div className="bg-slate-950/60 border border-[#d4af37]/25 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center gap-3 animate-fade-slide-in">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-black text-[#d4af37] uppercase block">{isAr ? 'اسم القالب المخصص للطلب الحالي' : 'Custom Template Name'}</label>
            <input
              type="text"
              placeholder={isAr ? 'مثال: تقرير مبيعات الربع الأول للمندوب رائد' : 'e.g. Q1 Sales Report for Courier Raed'}
              value={newTemplateName}
              onChange={event => onTemplateNameChange(event.target.value)}
              className="w-full bg-[#111114] border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]"
            />
          </div>
          <div className="flex items-end gap-2 shrink-0 self-end md:self-auto pt-3 md:pt-0">
            <button
              onClick={onSaveFilterTemplate}
              disabled={isSavingFilterTemplate}
              className="px-4 py-2 bg-[#d4af37] hover:bg-yellow-600 disabled:opacity-50 text-black text-xs font-black rounded-xl transition flex items-center gap-1.5"
            >
              {isSavingFilterTemplate ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isAr ? 'حفظ بـ Cloud' : 'Save to Cloud'}
            </button>
            <button
              onClick={onCloseSaveTemplateForm}
              className="px-4 py-2 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 px-1 uppercase block">{isAr ? 'تاريخ البدء' : 'Date range start'}</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={filters.startDate}
              onChange={event => onFilterChange('startDate', event.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-550 px-1 uppercase block">{isAr ? 'تاريخ نهاية المدى' : 'Date range end'}</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={filters.endDate}
              onChange={event => onFilterChange('endDate', event.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
            />
          </div>
        </div>

        {activeReport === 'expenses' ? (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 px-1 uppercase block">{isAr ? 'التصنيف المحاسبي' : 'Accounting Class'}</label>
            <select
              value={filters.type}
              onChange={event => onFilterChange('type', event.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
            >
              <option value="all">{isAr ? 'جميع التصنيفات' : 'All Categories'}</option>
              {expenseCategories.map(category => (
                <option key={category.id} value={category.id}>{isAr ? category.labelAr : category.labelEn}</option>
              ))}
            </select>
          </div>
        ) : activeReport === 'account_ledger' ? (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-550 px-1 uppercase block">{isAr ? 'تحديد الحساب المالي المباشر' : 'Select Chart Ledger'}</label>
            <select
              value={filters.accountId || ''}
              onChange={event => onFilterChange('accountId', event.target.value)}
              className="w-full bg-rose-500/10 border border-rose-500/20 text-[#d4af37] rounded-xl px-3 py-2 text-xs font-black outline-none focus:border-[#d4af37]/40"
            >
              <option value="" className="text-black">-- {isAr ? 'اختر حساب للتدقيق' : 'Select Ledger Account'} --</option>
              {accounts
                .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
                .map(account => (
                  <option key={account.id} value={account.id} className="text-black">
                    [{account.accountCode}] - {account.entityName || account.name} ({account.currency || 'SAR'})
                  </option>
                ))
              }
            </select>
          </div>
        ) : ['customers', 'couriers', 'users'].includes(activeReport) ? (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-550 px-1 uppercase block">
              {activeReport === 'customers' ? (isAr ? 'فلترة حسب العميل المحدد' : 'Filter by Customer') :
                activeReport === 'couriers' ? (isAr ? 'فلترة حسب المندوب المحدد' : 'Filter by Courier') :
                  (isAr ? 'فلترة حسب الموظف' : 'Filter by User')}
            </label>
            <select
              value={filters.entityId || ''}
              onChange={event => onFilterChange('entityId', event.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
            >
              <option value="">{isAr ? 'جميع الجهات السجلية (الكل)' : 'Show All'}</option>
              {(activeReport === 'customers' ? customers : activeReport === 'couriers' ? couriers : users).map(entity => (
                <option key={entity.id} value={entity.id} className="text-black">
                  {entity.fullName || entity.displayName || entity.email}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-550 px-1 uppercase block">{isAr ? 'بحث سريع وعام' : 'Global searching match'}</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={isAr ? 'ابحث هنا الاسم، رقم الهاتف، البيان' : 'Search keyword...'}
                value={searchTerm}
                onChange={event => onSearchTermChange(event.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-white outline-none focus:border-[#d4af37]/45"
              />
            </div>
          </div>
        )}
      </div>

      {!['account_ledger'].includes(activeReport) && (
        <div className="flex items-center gap-3 pt-2 text-xs text-slate-400">
          <span>{isAr ? 'ترتيب النتائج حسب:' : 'Sort results by:'}</span>
          <button
            onClick={() => onSortByChange('date')}
            className={`px-3 py-1 rounded-lg border transition-all ${sortBy === 'date' ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/35 font-bold' : 'border-slate-850 hover:text-white'}`}
          >
            {isAr ? 'التاريخ الفعلي' : 'Submission Date'}
          </button>
          <button
            onClick={() => onSortByChange('amount')}
            className={`px-3 py-1 rounded-lg border transition-all ${sortBy === 'amount' ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/35 font-bold' : 'border-slate-850 hover:text-white'}`}
          >
            {isAr ? 'المقدار / السعر' : 'Monetary Value'}
          </button>
          <span className="text-slate-700">|</span>
          <button
            onClick={onSortOrderToggle}
            className="hover:text-white border border-slate-850 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1"
          >
            {sortOrder === 'desc' ? (isAr ? 'تنازلي (الأحدث/الأعلى)' : 'Descending') : (isAr ? 'تصاعدي (الأقدم/الأقل)' : 'Ascending')}
          </button>
        </div>
      )}
    </div>
  );
}
