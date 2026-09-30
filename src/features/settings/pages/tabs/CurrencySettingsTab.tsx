import React from 'react';
import { DollarSign, RefreshCw, ShieldAlert, History, Edit3, Power, Trash2, Plus } from 'lucide-react';
import { SectionCard, FieldLabel, FieldInput } from './settingsHelpers';

export function CurrencySettingsTab({
  isAr,
  settings,
  setSettings,
  canEditRates,
  dbCurrencies = [],
  handleUpdateExchangeRatePrice,
  handleViewHistory,
  handleOpenEditDbCurrencyModal,
  handleToggleCurrencyActive,
  handleDeleteCurrency,
  showAddCurrency,
  setShowAddCurrency,
  newCurrency,
  setNewCurrency,
  t
}: any) {
  return (
    <div className="space-y-5 animate-fade-slide-in">
      {/* Main Currency */}
      <SectionCard title={isAr ? 'العملة الرئيسية للنظام' : 'Main System Currency'} icon={DollarSign}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2">
            <FieldLabel locked={!canEditRates}>{t ? t('mainCurrency') : (isAr ? 'العملة الرئيسية' : 'Main Currency')}</FieldLabel>
            <select disabled={!canEditRates} value={settings?.currency || 'YER'}
              onChange={e => {
                const selected = dbCurrencies.find((c: any) => c.code === e.target.value);
                setSettings({ ...settings, currency: e.target.value, currencySymbol: selected?.symbol || settings?.currencySymbol });
              }}
              className="w-full bg-black/50 border border-slate-800 text-white rounded-xl p-3.5 text-xs font-bold outline-none focus:border-[#d4af37]/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dbCurrencies.filter((c: any) => c.isActive).map((c: any) => (
                <option key={c.cur_id} value={c.code}>{c.flag} {c.main_nameAR} ({c.code})</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel locked={!canEditRates}>{t ? t('currencySymbol') : (isAr ? 'رمز العملة' : 'Symbol')}</FieldLabel>
            <FieldInput type="text" disabled={!canEditRates} value={settings?.currencySymbol || ''} onChange={(e: any) => setSettings({ ...settings, currencySymbol: e.target.value })} className="text-center font-mono" maxLength={5} />
          </div>
        </div>
      </SectionCard>

      {/* Exchange Rates Quick View & DB Sync */}
      <SectionCard title={isAr ? 'أسعار الصرف الحية  ' : 'Core Live Exchange Rates'} icon={RefreshCw}>
        {!canEditRates && (
          <div className="flex items-center gap-2 text-amber-400 bg-amber-950/20 border border-amber-900/30 p-3 rounded-xl mb-4 text-xs font-bold">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            {isAr ? 'أسعار الصرف للعرض فقط - تعديلها مخصص للمدير أو المحاسب' : 'View-only. Admin/Accountant can edit.'}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {dbCurrencies.filter((c: any) => c.code !== 'YER').map((cur: any) => (
            <div key={cur.cur_id} className="bg-black/30 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-2">
                  <span>{cur.flag || '🌍'}</span>
                  <span>{cur.main_nameAR} ({cur.code})</span>
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cur.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                  {cur.isActive ? (isAr ? 'نشطة' : 'Active') : (isAr ? 'معطلة' : 'Disabled')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="any"
                    disabled={!canEditRates || !cur.isActive}
                    defaultValue={cur.currentPrice || 0}
                    key={`${cur.cur_id}_${cur.currentPrice}`}
                    onBlur={e => {
                      const val = parseFloat(e.target.value);
                      if (val > 0 && val !== cur.currentPrice) {
                        handleUpdateExchangeRatePrice(cur.cur_id, cur.code, val);
                      }
                    }}
                    className="w-full bg-black/60 border border-slate-800 rounded-xl p-3 text-xs font-mono font-bold text-white focus:border-[#d4af37]/60 outline-none dir-ltr pr-20 disabled:opacity-40"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#d4af37] bg-[#d4af37]/10 px-1.5 py-0.5 rounded">
                    {cur.code}→YER
                  </span>
                </div>
                {handleViewHistory && (
                  <button
                    type="button"
                    onClick={() => handleViewHistory(cur)}
                    className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[#d4af37] rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                    title={isAr ? 'سجل أسعار الصرف التاريخي' : 'Rate History'}
                  >
                    <History className="w-4 h-4" />
                    <span className="hidden sm:inline">{isAr ? 'السجل' : 'History'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
