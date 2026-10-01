import React from 'react';
import {
  Package, Clock, RefreshCw, FileText, Image, Upload, ShieldAlert, Shield,
  HardDrive, Archive, Calendar, History, ChevronUp, ChevronDown, Download, X,
  Trash2,
} from 'lucide-react';
import type { Settings } from '../../../../context/SettingsContext';
import type { TranslationKey } from '../../../../translations';
import type { Currency } from '../../../../services/currencyService';
import { CurrencySelect } from '../../../../components/common/CurrencySelect';
import type { BackupRecord, SettingsConfirmConfig, SettingsExportFormat } from '../../types';
import { SectionCard, FieldLabel, FieldInput, FieldTextarea, ToggleSwitch } from './settingsHelpers';

interface AdminSecuritySettingsTabProps {
  isAr: boolean;
  localSettings: Settings;
  setLocalSettings: React.Dispatch<React.SetStateAction<Settings>>;
  t: (key: TranslationKey) => string;
  canViewOrderDefaults: boolean;
  canEditOrderDefaults: boolean;
  canManageBackup: boolean;
  activeCurrencies: Currency[];
  dbCurrencies: Currency[];
  invoiceLogoInputRef: React.RefObject<HTMLInputElement | null>;
  exportSelections: Record<string, boolean>;
  setExportSelections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  exportFormat: SettingsExportFormat;
  setExportFormat: React.Dispatch<React.SetStateAction<SettingsExportFormat>>;
  backupLoading: boolean;
  importLoading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  runBackup: (type?: 'manual' | 'auto') => void | Promise<void>;
  showBackupHistory: boolean;
  setShowBackupHistory: React.Dispatch<React.SetStateAction<boolean>>;
  backupHistoryLoading: boolean;
  backupHistory: BackupRecord[];
  formatBytes: (bytes: number) => string;
  setConfirmConfig: React.Dispatch<React.SetStateAction<SettingsConfirmConfig>>;
  restoreFromSupabase: (backupId: string) => void | Promise<void>;
  deleteBackupRecord: (backupId: string) => void | Promise<void>;
  onFetchCbmRate: () => void | Promise<void>;
  onClearCache: () => void;
}

export function AdminSecuritySettingsTab({
  isAr,
  localSettings,
  setLocalSettings,
  t,
  canViewOrderDefaults,
  canEditOrderDefaults,
  canManageBackup,
  activeCurrencies,
  dbCurrencies,
  invoiceLogoInputRef,
  exportSelections,
  setExportSelections,
  exportFormat,
  setExportFormat,
  backupLoading,
  importLoading,
  fileInputRef,
  runBackup,
  showBackupHistory,
  setShowBackupHistory,
  backupHistoryLoading,
  backupHistory,
  formatBytes,
  setConfirmConfig,
  restoreFromSupabase,
  deleteBackupRecord,
  onFetchCbmRate,
  onClearCache,
}: AdminSecuritySettingsTabProps) {
  return (
        <div className="space-y-5 animate-fade-slide-in">

          {/* Order Defaults */}
          {canViewOrderDefaults && (
            <SectionCard title={t('orderDefaults')} icon={Package}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  { key: 'defaultPackagingFee', label: t('defaultPackagingFee'), unit: isAr ? 'ر.س' : 'SAR' },
                  { key: 'defaultBankCommissionRate', label: t('defaultBankCommission'), unit: '%' },
                  { key: 'defaultCompanyProfitRate', label: t('defaultCompanyProfit'), unit: '%' },
                  { key: 'defaultDeliveryFee', label: t('defaultDeliveryFee'), unit: 'YER' },
                  { key: 'defaultCourierCommissionRate', label: t('defaultCourierCommission'), unit: '%' },
                ].map(f => (
                  <div key={f.key}>
                    <FieldLabel locked={!canEditOrderDefaults}>{f.label}</FieldLabel>
                    <div className="relative">
                      <FieldInput
                        type="number"
                        step="any"
                        value={(localSettings as any)[f.key] ?? 0}
                        onChange={e => canEditOrderDefaults && setLocalSettings({ ...localSettings, [f.key]: parseFloat(e.target.value) || 0 })}
                        disabled={!canEditOrderDefaults}
                        className="font-mono pr-12"
                        dir="ltr"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#d4af37] bg-[#d4af37]/10 px-1.5 py-0.5 rounded">{f.unit}</span>
                    </div>
                  </div>
                ))}

                {/* العملة الافتراضية المعتمدة لأسعار الطلبات */}
                <div>
                  <FieldLabel locked={!canEditOrderDefaults}>
                    {isAr ? 'العملة الافتراضية للطلب (من جدول العملات currency)' : 'Default Order Currency (from currency table)'}
                  </FieldLabel>
                  <CurrencySelect
                    isAr={isAr}
                    currencies={(activeCurrencies && activeCurrencies.length > 0 ? activeCurrencies : dbCurrencies).map(c => ({ id: c.cur_id || c.code, code: c.code, nameAr: c.main_nameAR, nameEn: c.main_nameEn, symbol: c.symbol, flag: c.flag }))}
                    disabled={!canEditOrderDefaults}
                    value={localSettings.defaultOrderCurrency || 'SAR'}
                    onChange={value => canEditOrderDefaults && setLocalSettings({ ...localSettings, defaultOrderCurrency: value })}
                    data-testid="default-order-currency"
                  />
                </div>

                {/* رسوم تامين المنتجات */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 bg-black/30 p-3 rounded-2xl border border-slate-800">
                  <div>
                    <FieldLabel locked={!canEditOrderDefaults}>
                      {isAr ? 'رسوم تامين المنتجات' : 'Product Insurance Fee'}
                    </FieldLabel>
                    <div className="relative">
                      <FieldInput
                        type="number"
                        step="any"
                        value={localSettings.defaultProductInsuranceFee ?? 0}
                        onChange={e => canEditOrderDefaults && setLocalSettings({ ...localSettings, defaultProductInsuranceFee: parseFloat(e.target.value) || 0 })}
                        disabled={!canEditOrderDefaults}
                        className="font-mono pr-12"
                        dir="ltr"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#d4af37] bg-[#d4af37]/10 px-1.5 py-0.5 rounded">
                        {localSettings.defaultProductInsuranceType === 'percentage' ? '%' : (localSettings.defaultOrderCurrency || 'SAR')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <FieldLabel locked={!canEditOrderDefaults}>
                      {isAr ? 'طريقة احتساب رسوم التأمين' : 'Insurance Calculation Mode'}
                    </FieldLabel>
                    <select
                      disabled={!canEditOrderDefaults}
                      value={localSettings.defaultProductInsuranceType || 'fixed'}
                      onChange={e => canEditOrderDefaults && setLocalSettings({ ...localSettings, defaultProductInsuranceType: e.target.value as 'fixed' | 'percentage' })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-[#d4af37] disabled:opacity-65 cursor-pointer"
                    >
                      <option value="fixed">{isAr ? 'سعر ثابت (بعملة الطلب الافتراضية)' : 'Fixed Price (Base Currency)'}</option>
                      <option value="percentage">{isAr ? 'نسبة مئوية من سعر المنتج (%)' : 'Percentage of Product Price (%)'}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-[#d4af37]/5 border border-[#d4af37]/15 rounded-xl text-[10px] text-slate-400 font-bold">
                💡 {isAr ? 'هذه القيم ستُملأ تلقائياً عند إنشاء أي طلب جديد.' : 'These defaults auto-fill when creating new orders.'}
              </div>
              {!canEditOrderDefaults && (
                <div className="mt-3 p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl text-[10px] text-amber-400 font-bold flex items-center gap-2">
                  🔒 {isAr ? 'لديك صلاحية العرض فقط. تواصل مع المدير لتعديل هذه الإعدادات.' : 'You have view-only access. Contact an admin to modify these settings.'}
                </div>
              )}
            </SectionCard>
          )}

          {/* Default Shipping Durations */}
          {canViewOrderDefaults && (
            <SectionCard title={isAr ? 'مدد الشحن الافتراضية للطلبات (أيام)' : 'Default Order Shipping Durations (Days)'} icon={Clock}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
                {[
                  { key: 'defaultSheinDuration', label: isAr ? 'مدة شي ان' : 'SHEIN Duration' },
                  { key: 'defaultAppDuration', label: isAr ? 'مدة التطبيقات' : 'Apps Duration' },
                  { key: 'defaultFactoryDuration', label: isAr ? 'مدة المصانع' : 'Factory Duration' },
                  { key: 'defaultYemenDeliveryDuration', label: isAr ? 'مدة التوصيل لليمن' : 'Yemen Delivery Duration' },
                  { key: 'defaultShippingDuration', label: isAr ? 'مدة الشحن الافتراضية للطلبات' : 'Default Order Duration' },
                ].map(f => (
                  <div key={f.key}>
                    <FieldLabel locked={!canEditOrderDefaults}>{f.label}</FieldLabel>
                    <div className="relative">
                      <FieldInput
                        type="number"
                        value={(localSettings as any)[f.key] ?? 0}
                        onChange={e => canEditOrderDefaults && setLocalSettings({ ...localSettings, [f.key]: parseInt(e.target.value) || 0 })}
                        disabled={!canEditOrderDefaults}
                        className="font-mono pr-16"
                        dir="ltr"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#d4af37] bg-[#d4af37]/10 px-1.5 py-0.5 rounded">{isAr ? 'يوم' : 'Days'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Factory / Manufacturer Order Defaults */}
          {canViewOrderDefaults && (
            <SectionCard
              title={isAr ? 'إعدادات طلبات المصنع والمورد الدولي' : 'Factory & International Supplier Defaults'}
              icon={Package}
              badge={isAr ? 'شحن بالحجم' : 'CBM Freight'}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Profit per KG */}
                <div>
                  <FieldLabel locked={!canEditOrderDefaults}>
                    {isAr ? 'نسبة الربح للكيلو (SAR/كجم)' : 'Profit Rate per KG (SAR/kg)'}
                  </FieldLabel>
                  <div className="relative">
                    <FieldInput
                      type="number"
                      step="any"
                      disabled={!canEditOrderDefaults}
                      value={localSettings.defaultProfitPerKg ?? 19}
                      onChange={e => canEditOrderDefaults && setLocalSettings({ ...localSettings, defaultProfitPerKg: parseFloat(e.target.value) || 0 })}
                      className="font-mono pr-16"
                      dir="ltr"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-400 bg-amber-950/30 px-1.5 py-0.5 rounded">SAR/kg</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 font-bold">
                    {isAr ? 'أرباح الشركة = إجمالي الوزن (كج) × هذه النسبة' : 'Company profit = Total weight (kg) × this rate'}
                  </p>
                </div>

                {/* CBM Shipping Rate */}
                <div>
                  <FieldLabel locked={!canEditOrderDefaults}>
                    {isAr ? 'سعر شحن الـ CBM الحالي (دولار USD/m³)' : 'Current CBM Shipping Rate (USD/m³)'}
                  </FieldLabel>
                  <div className="relative">
                    <FieldInput
                      type="number"
                      step="any"
                      disabled={!canEditOrderDefaults}
                      value={localSettings.defaultCbmShippingRate ?? 1400}
                      onChange={e => canEditOrderDefaults && setLocalSettings({ ...localSettings, defaultCbmShippingRate: parseFloat(e.target.value) || 0 })}
                      className="font-mono pr-20"
                      dir="ltr"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400 bg-blue-950/30 px-1.5 py-0.5 rounded">SAR/m³</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 font-bold">
                    {isAr ? 'تكلفة الشحن = إجمالي CBM × هذا السعر' : 'Shipping cost = Total CBM × this rate'}
                  </p>
                </div>

                {/* CBM Rate API URL */}
                {canEditOrderDefaults && (
                  <div className="md:col-span-2">
                    <FieldLabel>
                      {isAr ? 'رابط API لتحديث سعر الـ CBM تلقائياً (اختياري)' : 'API URL for auto-updating CBM rate (optional)'}
                    </FieldLabel>
                    <div className="flex gap-3">
                      <FieldInput
                        type="text"
                        value={localSettings.cbmShippingRateApiUrl || ''}
                        onChange={e => canEditOrderDefaults && setLocalSettings({ ...localSettings, cbmShippingRateApiUrl: e.target.value })}
                        placeholder="https://api.example.com/cbm-rate"
                        dir="ltr"
                        className="font-mono flex-1"
                      />
                      {localSettings.cbmShippingRateApiUrl && (
                        <button
                          type="button"
                          onClick={onFetchCbmRate}
                          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2 px-4 rounded-xl font-black text-xs transition flex items-center gap-2 whitespace-nowrap"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          {isAr ? 'جلب السعر' : 'Fetch Rate'}
                        </button>
                      )}
                    </div>
                    {localSettings.lastCbmRateUpdate && (
                      <p className="text-[10px] text-slate-500 mt-1.5 font-bold">
                        {isAr ? `آخر تحديث: ${localSettings.lastCbmRateUpdate} بواسطة ${localSettings.lastCbmRateUpdatedBy}` : `Last updated: ${localSettings.lastCbmRateUpdate} by ${localSettings.lastCbmRateUpdatedBy}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4 p-3 bg-blue-950/20 border border-blue-900/30 rounded-xl text-[10px] text-blue-400 font-bold">
                🏭 {isAr ? 'تُستخدم هذه الإعدادات لطلبات المصنع والمورد الدولي فقط.' : 'These settings apply to Factory & International Supplier order types only.'}
              </div>
            </SectionCard>
          )}

          {/* Invoice Settings */}
          {canEditOrderDefaults && (
            <SectionCard title={t('invoiceSettings')} icon={FileText}>
              <div className="space-y-5">
                <div>
                  <FieldLabel>{t('invoiceLogo')}</FieldLabel>
                  <div className="flex items-center gap-4">
                    {localSettings.invoiceLogo ? (
                      <div className="relative group">
                        <img src={localSettings.invoiceLogo} alt="Invoice Logo" className="w-20 h-20 object-contain rounded-xl border border-slate-800 bg-black/50 p-2" />
                        <button onClick={() => setLocalSettings({ ...localSettings, invoiceLogo: '' })} className="absolute -top-2 -right-2 w-5 h-5 bg-rose-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><X className="w-3 h-3 text-white" /></button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl border border-slate-800 bg-black/50 flex items-center justify-center text-slate-600"><Image className="w-7 h-7" /></div>
                    )}
                    <button type="button" onClick={() => invoiceLogoInputRef.current?.click()} className="flex-1 bg-black/40 border border-slate-800 hover:border-[#d4af37]/40 text-slate-300 hover:text-white py-3 px-4 rounded-xl text-xs font-black transition flex items-center gap-2 justify-center"><Upload className="w-4 h-4" />{isAr ? 'رفع شعار الفاتورة' : 'Upload Invoice Logo'}</button>
                  </div>
                </div>
                <div>
                  <FieldLabel>{t('invoiceNotes')}</FieldLabel>
                  <FieldTextarea rows={3} value={localSettings.invoiceNotes || ''} onChange={e => setLocalSettings({ ...localSettings, invoiceNotes: e.target.value })} />
                </div>
              </div>
            </SectionCard>
          )}

          {/* Security */}
          {canManageBackup && (
            <SectionCard title={t('securitySettings')} icon={Shield}>
              <div className="space-y-4">
                <ToggleSwitch checked={localSettings.protectSensitiveOrderDelete || false} onChange={v => setLocalSettings({ ...localSettings, protectSensitiveOrderDelete: v })} label={t('protectOrderDelete')} description={isAr ? 'منع حذف الطلبات ذات المدفوعات إلا بعد إدخال رمز PIN' : 'Prevent deletion of orders with payments without PIN'} icon={Shield} />

                <div className="pt-2">
                  <FieldLabel>{isAr ? 'مهلة جلسة المستخدم (بالدقائق - 0 للتعطيل)' : 'User Session Timeout (Minutes - 0 to disable)'}</FieldLabel>
                  <FieldInput
                    type="number"
                    min="0"
                    placeholder="30"
                    value={localSettings.userSessionTimeout !== undefined ? localSettings.userSessionTimeout : ''}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      setLocalSettings({ ...localSettings, userSessionTimeout: isNaN(val) ? 0 : val });
                    }}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {isAr
                      ? 'عند تفعيل الخيار، سيتم تسجيل خروج الموظف تلقائياً في حال عدم لمس النظام أو القيام بأي نشاط طوال هذه المدة.'
                      : 'When enabled, the user will be automatically logged out after this period of inactivity/idleness.'}
                  </p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ══════════════════════════════════ */}
          {/* ADVANCED BACKUP SYSTEM            */}
          {/* ══════════════════════════════════ */}
          {canManageBackup && (
            <SectionCard title={isAr ? 'نظام النسخ الاحتياطي المتقدم' : 'Advanced Backup System'} icon={HardDrive}>

              {/* Backup Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { icon: Archive, label: isAr ? 'إجمالي النسخ' : 'Total Backups', value: localSettings.backupCount || 0, color: 'text-[#d4af37]' },
                  { icon: Clock, label: isAr ? 'آخر نسخة' : 'Last Backup', value: localSettings.lastBackup ? (localSettings.lastBackup.split(' ')[0] || '—') : '—', color: 'text-emerald-400' },
                  { icon: Calendar, label: isAr ? 'الجدولة' : 'Schedule', value: localSettings.backupSchedule === 'daily' ? (isAr ? 'يومي' : 'Daily') : localSettings.backupSchedule === 'weekly' ? (isAr ? 'أسبوعي' : 'Weekly') : localSettings.backupSchedule === 'monthly' ? (isAr ? 'شهري' : 'Monthly') : (isAr ? 'يدوي' : 'Manual'), color: 'text-blue-400' },
                  { icon: HardDrive, label: isAr ? 'الاحتفاظ' : 'Retention', value: `${localSettings.backupRetentionDays || 30} ${isAr ? 'يوم' : 'days'}`, color: 'text-purple-400' },
                ].map((stat, idx) => (
                  <div key={idx} className="bg-black/40 border border-slate-800/50 rounded-2xl p-3 flex flex-col items-center text-center gap-1">
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    <div className={`text-sm font-black ${stat.color}`}>{stat.value}</div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Auto Backup Toggle */}
              <div className="space-y-3 mb-5">
                <ToggleSwitch
                  checked={localSettings.autoBackupEnabled || false}
                  onChange={v => setLocalSettings({ ...localSettings, autoBackupEnabled: v })}
                  label={t('autoBackup')}
                  description={isAr ? 'حفظ نسخة احتياطية تلقائياً في Supabase عند انتهاء الوقت المحدد' : 'Auto-save backup to Supabase on schedule'}
                  icon={Archive}
                />

                {/* Backup Schedule */}
                <div>
                  <FieldLabel>{isAr ? 'جدولة النسخ الاحتياطي' : 'Backup Schedule'}</FieldLabel>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { v: 'manual', label: isAr ? 'يدوي' : 'Manual', icon: '🖐️' },
                      { v: 'daily', label: isAr ? 'يومي' : 'Daily', icon: '📅' },
                      { v: 'weekly', label: isAr ? 'أسبوعي' : 'Weekly', icon: '📆' },
                      { v: 'monthly', label: isAr ? 'شهري' : 'Monthly', icon: '🗓️' },
                    ].map(opt => (
                      <button key={opt.v} type="button"
                        onClick={() => setLocalSettings({ ...localSettings, backupSchedule: opt.v as any })}
                        className={`p-2.5 rounded-xl border-2 text-center transition ${localSettings.backupSchedule === opt.v ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-slate-800 bg-black/40 text-slate-400 hover:border-slate-700'}`}
                      >
                        <div className="text-base mb-0.5">{opt.icon}</div>
                        <div className="text-[9px] font-black">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Retention Days */}
                <div>
                  <FieldLabel>{isAr ? 'مدة الاحتفاظ بالنسخ (أيام)' : 'Backup Retention Period (days)'}</FieldLabel>
                  <div className="flex gap-2 items-center">
                    {[7, 14, 30, 60, 90].map(days => (
                      <button key={days} type="button"
                        onClick={() => setLocalSettings({ ...localSettings, backupRetentionDays: days })}
                        className={`flex-1 py-2 rounded-xl border text-[10px] font-black transition ${localSettings.backupRetentionDays === days ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-slate-800 bg-black/40 text-slate-500 hover:border-slate-700'}`}
                      >{days}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Collections to Backup */}
              <div className="mb-5">
                <FieldLabel>{isAr ? 'الفئات المشمولة في النسخة الاحتياطية' : 'Collections to Backup'}</FieldLabel>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { key: 'orders', label: '📦 ' + (isAr ? 'الطلبات' : 'Orders') },
                    { key: 'customers', label: '👥 ' + (isAr ? 'العملاء' : 'Customers') },
                    { key: 'couriers', label: '🚚 ' + (isAr ? 'المناديب' : 'Couriers') },
                    { key: 'expenses', label: '💰 ' + (isAr ? 'المصروفات' : 'Expenses') },
                    { key: 'accounts', label: '🧾 ' + (isAr ? 'الحسابات' : 'Accounts') },
                    { key: 'main_entry', label: '📝 ' + (isAr ? 'القيود المحاسبية' : 'Main Entries') },
                    { key: 'account_trans', label: '📊 ' + (isAr ? 'أسطر الحركة' : 'Account Trans') },
                    { key: 'salary_history', label: '💵 ' + (isAr ? 'الرواتب' : 'Salaries') },
                    { key: 'users', label: '👤 ' + (isAr ? 'الموظفون' : 'Staff') },
                    { key: 'roles', label: '🛡️ ' + (isAr ? 'الأدوار' : 'Roles') },
                    { key: 'sources', label: '🗺️ ' + (isAr ? 'المصادر' : 'Sources') },
                    { key: 'settings', label: '⚙️ ' + (isAr ? 'الإعدادات' : 'Settings') },
                  ].map(col => (
                    <label key={col.key} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${exportSelections[col.key] ? 'border-[#d4af37]/50 bg-[#d4af37]/10 text-white' : 'border-slate-800 bg-black/40 text-slate-400 hover:border-slate-700'}`}>
                      <input type="checkbox" checked={exportSelections[col.key]} onChange={e => setExportSelections({ ...exportSelections, [col.key]: e.target.checked })} className="rounded border-slate-700 bg-slate-900 text-yellow-600 focus:ring-0" />
                      <span className="text-xs font-bold">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Export Format */}
              <div className="mb-5">
                <FieldLabel>{isAr ? 'صيغة ملف الصادرة' : 'Export File Format'}</FieldLabel>
                <div className="flex gap-3">
                  {[
                    { value: 'json', label: 'JSON', desc: isAr ? 'كامل + استيراد' : 'Full + importable', icon: '{}' },
                    { value: 'csv', label: 'CSV / Excel', desc: isAr ? 'جداول للإكسيل' : 'Spreadsheet', icon: '📊' },
                  ].map(fmt => (
                    <button key={fmt.value} type="button" onClick={() => setExportFormat(fmt.value as SettingsExportFormat)}
                      className={`flex-1 p-3 rounded-xl border-2 text-center transition ${exportFormat === fmt.value ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-slate-800 bg-black/40 text-slate-400 hover:border-slate-700'}`}
                    >
                      <div className="font-mono font-black text-xs">{fmt.icon} {fmt.label}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">{fmt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                <button type="button" onClick={() => runBackup('manual')} disabled={backupLoading}
                  className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black py-3.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 disabled:from-slate-800 disabled:to-slate-900 disabled:cursor-not-allowed shadow"
                >
                  <Download className="w-4 h-4" />
                  {backupLoading ? (isAr ? 'جاري التصدير...' : 'Exporting...') : `${t('exportBackup')} (${exportFormat.toUpperCase()})`}
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importLoading}
                  className="bg-black/40 border border-slate-800 text-slate-300 py-3.5 rounded-xl font-black text-xs hover:border-[#d4af37]/40 hover:text-white transition flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {importLoading ? (isAr ? 'جاري الاستيراد...' : 'Importing...') : `${t('importBackup')} (JSON)`}
                </button>
              </div>

              {/* ── BACKUP HISTORY ─────────────── */}
              <div className="border-t border-slate-800/50 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBackupHistory(!showBackupHistory)}
                  className="w-full flex items-center justify-between text-xs font-black text-slate-400 hover:text-white transition py-2 group"
                >
                  <span className="flex items-center gap-2"><History className="w-4 h-4 text-[#d4af37]" />{isAr ? 'سجل النسخ الاحتياطية' : 'Backup History'}</span>
                  {showBackupHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showBackupHistory && (
                  <div className="mt-3 space-y-2 animate-fade-slide-in">
                    {backupHistoryLoading ? (
                      <div className="flex justify-center py-4"><div className="w-6 h-6 animate-spin rounded border-2 border-[#d4af37]/25 border-t-[#d4af37]"></div></div>
                    ) : backupHistory.length === 0 ? (
                      <div className="text-center py-6 text-slate-600 text-xs font-bold">
                        {isAr ? 'لا توجد نسخ احتياطية محفوظة بعد' : 'No backups saved yet'}
                      </div>
                    ) : (
                      backupHistory.map(backup => (
                        <div key={backup.id} className="flex items-center gap-3 p-3 bg-black/40 border border-slate-800/50 rounded-xl">
                          <div className={`p-1.5 rounded-lg ${backup.type === 'auto' ? 'bg-blue-500/15 text-blue-400' : 'bg-[#d4af37]/15 text-[#d4af37]'}`}>
                            {backup.type === 'auto' ? <RefreshCw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-white font-mono">{new Date(backup.savedAt).toLocaleDateString(isAr ? 'ar-YE' : 'en-US')}</span>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${backup.type === 'auto' ? 'bg-blue-500/20 text-blue-400' : 'bg-[#d4af37]/20 text-[#d4af37]'}`}>
                                {backup.type === 'auto' ? (isAr ? 'تلقائي' : 'Auto') : (isAr ? 'يدوي' : 'Manual')}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[9px] text-slate-500 font-mono">{new Date(backup.savedAt).toLocaleTimeString(isAr ? 'ar-YE' : 'en-US')}</span>
                              {backup.size && <span className="text-[9px] text-slate-600 font-mono">{formatBytes(backup.size)}</span>}
                              <span className="text-[9px] text-slate-600">{backup.createdBy}</span>
                            </div>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => setConfirmConfig({
                                isOpen: true,
                                title: isAr ? 'استعادة هذه النسخة' : 'Restore This Backup',
                                message: isAr
                                  ? `⚠️ هذا سيستبدل بياناتك الحالية ببيانات نسخة ${new Date(backup.savedAt).toLocaleDateString('ar-YE')}. متأكد؟`
                                  : `⚠️ This will overwrite current data with backup from ${new Date(backup.savedAt).toLocaleDateString()}. Are you sure?`,
                                type: 'warning',
                                onConfirm: () => restoreFromSupabase(backup.id)
                              })}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition" title={isAr ? 'استعادة' : 'Restore'}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmConfig({
                                isOpen: true,
                                title: isAr ? 'حذف هذه النسخة' : 'Delete This Backup',
                                message: isAr ? 'هل تريد حذف هذه النسخة الاحتياطية نهائياً؟' : 'Permanently delete this backup record?',
                                type: 'danger',
                                onConfirm: () => deleteBackupRecord(backup.id)
                              })}
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition" title={isAr ? 'حذف' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Cache Clear */}
              <div className="pt-4 border-t border-slate-800/50 mt-4">
                <button type="button"
                  onClick={() => setConfirmConfig({
                    isOpen: true,
                    title: isAr ? 'مسح ذاكرة التخزين المؤقت' : 'Clear Local Cache',
                    message: isAr ? 'هذا سيمسح بيانات التخزين المؤقت للمتصفح ويُعيد تحميل النظام.' : 'This will clear browser local storage and reload.',
                    type: 'danger',
                    onConfirm: onClearCache
                  })}
                  className="w-full bg-rose-500/10 text-rose-400 border border-rose-500/20 py-2.5 rounded-xl font-black text-xs hover:bg-rose-500/20 transition"
                >
                  🗑️ {isAr ? 'مسح الكاش وإعادة التحميل' : 'Clear Cache & Reload'}
                </button>
              </div>
            </SectionCard>
          )}
        </div>
  );
}
