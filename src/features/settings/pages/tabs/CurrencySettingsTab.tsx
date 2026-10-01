import React from 'react';
import { DollarSign, RefreshCw, ShieldAlert, History, Edit3, Power, Trash2, Plus } from 'lucide-react';
import type { Settings } from '../../../../context/SettingsContext';
import type { TranslationKey } from '../../../../translations';
import type { Currency } from '../../../../services/currencyService';
import { SectionCard, FieldLabel, FieldInput, ToggleSwitch } from './settingsHelpers';

export interface NewCurrencyFormValues {
  code: string;
  main_nameAR: string;
  sup_nameAR: string;
  main_nameEn: string;
  sup_nameEn: string;
  symbol: string;
  flag: string;
  initialRate: number;
  isActive: boolean;
}

interface CurrencySettingsTabProps {
  isAr: boolean;
  localSettings: Settings;
  setLocalSettings: React.Dispatch<React.SetStateAction<Settings>>;
  t: (key: TranslationKey) => string;
  canEditRates: boolean;
  dbCurrencies: Currency[];
  handleUpdateExchangeRatePrice: (currencyId: number, code: string, newRate: number) => void | Promise<void>;
  handleViewHistory: (currency: Currency) => void | Promise<void>;
  handleOpenEditDbCurrencyModal: (currency: Currency) => void;
  handleToggleCurrencyActive: (currencyId: number, code: string, currentActive: boolean) => void | Promise<void>;
  handleDeleteCurrency: (currencyId: number, code: string) => void | Promise<void>;
  showAddCurrency: boolean;
  setShowAddCurrency: React.Dispatch<React.SetStateAction<boolean>>;
  newCurrency: NewCurrencyFormValues;
  setNewCurrency: React.Dispatch<React.SetStateAction<NewCurrencyFormValues>>;
  handleAddCurrency: () => void | Promise<void>;
  fetchExchangeRates: () => void | Promise<void>;
  apiLoading: boolean;
  apiError: string | null;
}

export function CurrencySettingsTab({
  isAr,
  localSettings,
  setLocalSettings,
  t,
  canEditRates,
  dbCurrencies,
  handleUpdateExchangeRatePrice,
  handleViewHistory,
  handleOpenEditDbCurrencyModal,
  handleToggleCurrencyActive,
  handleDeleteCurrency,
  showAddCurrency,
  setShowAddCurrency,
  newCurrency,
  setNewCurrency,
  handleAddCurrency,
  fetchExchangeRates,
  apiLoading,
  apiError,
}: CurrencySettingsTabProps) {
  return (
        <div className="space-y-5 animate-fade-slide-in">

          {/* Main Currency */}
          <SectionCard title={isAr ? 'العملة الرئيسية للنظام' : 'Main System Currency'} icon={DollarSign}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <FieldLabel locked={!canEditRates}>{t('mainCurrency')}</FieldLabel>
                <select disabled={!canEditRates} value={localSettings.currency}
                  onChange={e => {
                    const selected = dbCurrencies.find(c => c.code === e.target.value);
                    setLocalSettings({ ...localSettings, currency: e.target.value, currencySymbol: selected?.symbol || localSettings.currencySymbol });
                  }}
                  className="w-full bg-black/50 border border-slate-800 text-white rounded-xl p-3.5 text-xs font-bold outline-none focus:border-[#d4af37]/60 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {dbCurrencies.filter(c => c.isActive).map(c => (
                    <option key={c.cur_id} value={c.code}>{c.flag} {c.main_nameAR} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel locked={!canEditRates}>{t('currencySymbol')}</FieldLabel>
                <FieldInput type="text" disabled={!canEditRates} value={localSettings.currencySymbol} onChange={e => setLocalSettings({ ...localSettings, currencySymbol: e.target.value })} className="text-center font-mono" maxLength={5} />
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
              {dbCurrencies.filter(c => c.code !== 'YER').map(cur => (
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
                    <button
                      type="button"
                      onClick={() => handleViewHistory(cur)}
                      className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[#d4af37] rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                      title={isAr ? 'سجل أسعار الصرف التاريخي' : 'Rate History'}
                    >
                      <History className="w-4 h-4" />
                      <span className="hidden sm:inline">{isAr ? 'السجل (seq)' : 'History'}</span>
                    </button>
                  </div>
                  {cur.lastSeq && (
                    <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between border-t border-slate-850 pt-2">
                      <span>{isAr ? `التسلسل الحالي: seq #${cur.lastSeq}` : `Seq #${cur.lastSeq}`}</span>
                      <span>{cur.lastUpdateBy ? (isAr ? `بواسطة: ${cur.lastUpdateBy}` : `By: ${cur.lastUpdateBy}`) : ''}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── ALL CURRENCIES LIST FROM DATABASE ─────────── */}
          <SectionCard title={isAr ? 'جدول العملات' : 'Database Currency Catalog'} icon={DollarSign} badge={`${dbCurrencies.length} ${isAr ? 'عملة' : 'currencies'}`}>
            <div className="space-y-2.5 mb-4">
              {dbCurrencies.map(cur => (
                <div key={cur.cur_id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${cur.isActive ? 'border-slate-800 bg-black/40' : 'border-rose-950/30 bg-rose-950/10 opacity-75'}`}>
                  <span className="text-2xl shrink-0">{cur.flag || '🌍'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white font-mono">{cur.code}</span>
                      <span className="text-[11px] text-slate-300 font-bold truncate">{cur.main_nameAR}</span>
                      <span className="text-[9px] text-slate-500 font-mono">({cur.main_nameEn})</span>
                      {cur.isDefault && (
                        <span className="text-[9px] bg-[#d4af37]/20 text-[#d4af37] px-2 py-0.5 rounded-full font-black">
                          {isAr ? 'العملة الأساسية' : 'Default'}
                        </span>
                      )}
                      {!cur.isActive && (
                        <span className="text-[9px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full font-black">
                          {isAr ? 'معطلة (لن تنشأ بها قيود)' : 'Disabled'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px]">
                      <span className="font-mono text-[#d4af37] font-bold">{cur.symbol || cur.code}</span>
                      <span className="text-slate-400 font-mono">
                        {cur.code === 'YER' ? '1 YER (العملة المرجعية)' : `1 ${cur.code} = ${cur.currentPrice ?? '—'} YER`}
                      </span>
                      {cur.lastSeq && (
                        <span className="text-[9px] text-slate-500 font-mono">
                          (seq #{cur.lastSeq})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* View History */}
                    <button
                      type="button"
                      onClick={() => handleViewHistory(cur)}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-[#d4af37] hover:border-[#d4af37]/30 transition"
                      title={isAr ? 'عرض سجل تغيير أسعار الصرف' : 'View Price History'}
                    >
                      <History className="w-4 h-4" />
                    </button>

                    {/* Edit Currency */}
                    {canEditRates && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditDbCurrencyModal(cur)}
                        className="p-2 rounded-xl bg-blue-950/20 border border-blue-900/30 text-blue-400 hover:bg-blue-950/40 transition"
                        title={isAr ? 'تعديل كافة بيانات العملة' : 'Edit Currency Specifications'}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Toggle Active / Disabled */}
                    {canEditRates && (
                      <button
                        type="button"
                        onClick={() => handleToggleCurrencyActive(cur.cur_id, cur.code, cur.isActive ?? false)}
                        className={`p-2 rounded-xl border transition-all ${cur.isActive ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40 hover:bg-emerald-950/40' : 'bg-rose-950/30 text-rose-400 border-rose-900/50 hover:bg-rose-950/50'}`}
                        title={cur.isActive ? (isAr ? 'تعطيل العملة' : 'Disable Currency') : (isAr ? 'تفعيل العملة' : 'Enable Currency')}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    )}

                    {/* Delete Currency */}
                    {canEditRates && !['USD', 'SAR', 'YER'].includes(cur.code.toUpperCase()) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCurrency(cur.cur_id, cur.code)}
                        className="p-2 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-400 hover:bg-rose-950/40 transition"
                        title={isAr ? 'حذف العملة' : 'Delete Currency'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Currency Form */}
            {canEditRates && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAddCurrency(!showAddCurrency)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-slate-700 hover:border-[#d4af37]/50 text-slate-400 hover:text-[#d4af37] text-xs font-black transition"
                >
                  <Plus className="w-4 h-4" />
                  {isAr ? 'إضافة عملة جديدة إلى جدول currency' : 'Add New Currency to Database'}
                </button>

                {showAddCurrency && (
                  <div className="mt-4 p-5 bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-2xl space-y-4 animate-fade-slide-in">
                    <h4 className="text-xs font-black text-[#d4af37] uppercase tracking-wider">{isAr ? 'بيانات العملة الجديدة الكاملة (cur_id متسلسل تلقائياً)' : 'Full New Currency Specifications'}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <FieldLabel>{isAr ? 'كود العملة (code) *' : 'Code *'}</FieldLabel>
                        <FieldInput
                          type="text"
                          maxLength={5}
                          placeholder="EUR"
                          className="font-mono uppercase"
                          dir="ltr"
                          value={newCurrency.code}
                          onChange={e => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div>
                        <FieldLabel>{isAr ? 'الاسم الرئيسي بالعربي (main_nameAR) *' : 'Main Name AR *'}</FieldLabel>
                        <FieldInput type="text" placeholder="ريال يمني / يورو" value={newCurrency.main_nameAR} onChange={e => setNewCurrency({ ...newCurrency, main_nameAR: e.target.value })} />
                      </div>
                      <div>
                        <FieldLabel>{isAr ? 'اسم الفئة الفرعية بالعربي (sup_nameAR)' : 'Sub Name AR'}</FieldLabel>
                        <FieldInput type="text" placeholder="فلس / سنت" value={newCurrency.sup_nameAR} onChange={e => setNewCurrency({ ...newCurrency, sup_nameAR: e.target.value })} />
                      </div>
                      <div>
                        <FieldLabel>{isAr ? 'الاسم الرئيسي بالإنجليزي (main_nameEn)' : 'Main Name EN'}</FieldLabel>
                        <FieldInput type="text" placeholder="Euro / Yemeni Rial" dir="ltr" value={newCurrency.main_nameEn} onChange={e => setNewCurrency({ ...newCurrency, main_nameEn: e.target.value })} />
                      </div>
                      <div>
                        <FieldLabel>{isAr ? 'اسم الفئة الفرعية بالإنجليزي (sup_nameEn)' : 'Sub Name EN'}</FieldLabel>
                        <FieldInput type="text" placeholder="Cent / Fils" dir="ltr" value={newCurrency.sup_nameEn} onChange={e => setNewCurrency({ ...newCurrency, sup_nameEn: e.target.value })} />
                      </div>
                      <div>
                        <FieldLabel>{isAr ? 'الرمز (symbol) *' : 'Symbol *'}</FieldLabel>
                        <FieldInput type="text" placeholder="€ / ر.ي / $" maxLength={6} className="text-center font-mono" value={newCurrency.symbol} onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value })} />
                      </div>
                      <div>
                        <FieldLabel>{isAr ? 'رمز علم الدولة (flag)' : 'Flag Emoji'}</FieldLabel>
                        <FieldInput type="text" placeholder="🇪🇺 / 🇾🇪" maxLength={4} className="text-center" value={newCurrency.flag} onChange={e => setNewCurrency({ ...newCurrency, flag: e.target.value })} />
                      </div>
                      <div>
                        <FieldLabel>{isAr ? 'سعر الصرف الأولي (initialRate) *' : 'Initial Rate to YER *'}</FieldLabel>
                        <FieldInput type="number" step="any" placeholder="580" dir="ltr" className="font-mono" value={newCurrency.initialRate || ''} onChange={e => setNewCurrency({ ...newCurrency, initialRate: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-end md:col-span-4">
                        <label className="flex items-center gap-2 cursor-pointer pb-1.5">
                          <input type="checkbox" checked={newCurrency.isActive !== false} onChange={e => setNewCurrency({ ...newCurrency, isActive: e.target.checked })} className="rounded border-slate-700 bg-slate-900 text-yellow-600 focus:ring-0" />
                          <span className="text-xs font-black text-slate-300">{isAr ? 'تفعيل العملة المباشر (isActive = true)' : 'Enable Active Status Immediately'}</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={handleAddCurrency} className="flex-1 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black py-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer">
                        <Plus className="w-4 h-4" />{isAr ? 'حفظ وإضافة العملة' : 'Save Currency'}
                      </button>
                      <button onClick={() => { setShowAddCurrency(false); setNewCurrency({ code: '', main_nameAR: '', sup_nameAR: '', main_nameEn: '', sup_nameEn: '', symbol: '', flag: '', initialRate: 0, isActive: true }); }} className="px-5 bg-black/40 border border-slate-800 text-slate-400 rounded-xl font-black text-xs transition hover:text-white cursor-pointer">
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </SectionCard>

          {/* API Auto Update */}
          {canEditRates && (
            <SectionCard title={isAr ? 'التحديث التلقائي من API' : 'Auto API Update'} icon={RefreshCw}>
              <div className="space-y-4">
                <ToggleSwitch
                  checked={localSettings.autoUpdateExchangeRates || false}
                  onChange={v => setLocalSettings({ ...localSettings, autoUpdateExchangeRates: v })}
                  label={t('autoUpdateRates')}
                  description={isAr ? 'جلب تحديثات أسعار الصرف تلقائياً عند تشغيل النظام' : 'Auto-fetch exchange rates on system startup'}
                  icon={RefreshCw}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-2">
                    <FieldLabel>{t('apiUrl')}</FieldLabel>
                    <FieldInput type="text" value={localSettings.exchangeRatesApiUrl || 'https://open.er-api.com/v6/latest/USD'} onChange={e => setLocalSettings({ ...localSettings, exchangeRatesApiUrl: e.target.value })} dir="ltr" className="font-mono" />
                  </div>
                  <button type="button" onClick={fetchExchangeRates} disabled={apiLoading}
                    className="w-full bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black py-3.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 disabled:from-slate-800 disabled:to-slate-900 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${apiLoading ? 'animate-spin' : ''}`} />
                    {apiLoading ? (isAr ? 'جاري الجلب...' : 'Fetching...') : t('updateNow')}
                  </button>
                </div>
                {apiError && <div className="text-[11px] text-rose-400 font-bold bg-rose-950/20 border border-rose-900/30 p-3 rounded-xl">{apiError}</div>}
              </div>
            </SectionCard>
          )}
        </div>
  );
}
