import React from 'react';
import { Globe, RefreshCw, Shield, ShieldAlert, AlertTriangle } from 'lucide-react';
import type { LogisticsSettings } from '../../types';
import { SectionCard, FieldLabel, FieldInput, ToggleSwitch } from './settingsHelpers';

interface LogisticsSettingsTabProps {
  isAr: boolean;
  canManageAdmin: boolean;
  logisticsSettings: LogisticsSettings;
  setLogisticsSettings: React.Dispatch<React.SetStateAction<LogisticsSettings>>;
  apiLoading: boolean;
  apiError: string | null;
  onTestConnection: () => void | Promise<void>;
}

export function LogisticsSettingsTab({
  isAr,
  canManageAdmin,
  logisticsSettings,
  setLogisticsSettings,
  apiLoading,
  apiError,
  onTestConnection,
}: LogisticsSettingsTabProps) {
  return (
        <div className="space-y-5 animate-fade-slide-in">
          {canManageAdmin ? (
            <SectionCard title={isAr ? 'الربط المباشر مع شركات الشحن (API)' : 'Logistics External API Hooks'} icon={Globe}>
              <div className="bg-black/30 border border-[#d4af37]/20 p-4 rounded-xl mb-6">
                <p className="text-[10px] text-slate-400 font-medium">
                  {isAr
                    ? 'عند تفعيل الخيار، سيقوم خادم alx بالاتصال بالـ API الخارجي تلقائياً لجلب المسارات بمجرد إدخال رقم تتبع صالح.'
                    : 'Once enabled, our internal server orchestrator automatically maps global checkpoints when queried.'}
                </p>
              </div>

              <div className="mb-6">
                <ToggleSwitch
                  checked={logisticsSettings.enabled}
                  onChange={(v) => setLogisticsSettings({ ...logisticsSettings, enabled: v })}
                  label={isAr ? 'تفعيل الربط التلقائي للمسارات' : 'Enable Automated Live Sync (Global Networks)'}
                  description={isAr ? 'سيطلب النظام الحالات من الموفر المعين بشكل مباشر' : 'Queries integrated API endpoints seamlessly.'}
                />
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <FieldLabel>{isAr ? 'مزود الخدمة (API)' : 'External Provider'}</FieldLabel>
                    <select
                      value={logisticsSettings.provider}
                      onChange={(e) => setLogisticsSettings({ ...logisticsSettings, provider: e.target.value })}
                      className="w-full bg-black/50 border border-slate-800 rounded-xl p-3.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none"
                    >
                      <option value="aftership">AfterShip API (باقة مجانية متاحة)</option>
                      <option value="17track">17TRACK API (إصدار تجريبي)</option>
                      <option value="trackingmore">TrackingMore (باقة مجانية متاحة)</option>
                      <option value="parcelsapp">ParcelsApp.com (باقة عالمية)</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel>{isAr ? 'مفتاح الربط (API Key)' : 'Access Key / Token'}</FieldLabel>
                    <FieldInput
                      type="password"
                      value={logisticsSettings.apiKey}
                      onChange={(e) => setLogisticsSettings({ ...logisticsSettings, apiKey: e.target.value })}
                      placeholder="asat_XXXXXXXXXXXXXXXXXXXXXXXX"
                    />
                  </div>
                  {logisticsSettings.provider === 'parcelsapp' && (
                    <div className="md:col-span-2">
                      <FieldLabel>{isAr ? 'بلد الوجهة الافتراضي (ParcelsApp)' : 'Default Destination Country (ParcelsApp)'}</FieldLabel>
                      <FieldInput
                        type="text"
                        value={logisticsSettings.defaultDestinationCountry}
                        onChange={(e) => setLogisticsSettings({ ...logisticsSettings, defaultDestinationCountry: e.target.value })}
                        placeholder="Yemen"
                      />
                      <p className="text-[10px] text-slate-500 mt-1.5 font-bold">
                        {isAr ? 'يتطلب ParcelsApp v3 تحديد بلد الوجهة لضمان دقة النتائج.' : 'ParcelsApp v3 requires a destination country for accurate tracking resolution.'}
                      </p>
                    </div>
                  )}
                  <div className="md:col-span-2 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={apiLoading || !logisticsSettings.apiKey}
                      onClick={onTestConnection}
                      className="bg-black/40 border border-slate-800 hover:border-[#d4af37]/40 text-slate-300 hover:text-white py-2.5 px-6 rounded-xl text-[10px] font-black tracking-widest uppercase transition flex items-center gap-2 justify-center disabled:opacity-50"
                    >
                      {apiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      {isAr ? 'اختبار الاتصال بالخادم' : 'Test API Connection'}
                    </button>
                    {apiError && (
                      <div className="flex items-center gap-2 text-rose-500 text-[10px] font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{apiError}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : (
            <div className="flex bg-rose-500/10 text-rose-400 p-6 rounded-2xl border border-rose-500/20 font-extrabold flex-col items-center justify-center gap-4 py-16">
              <ShieldAlert className="w-12 h-12" />
              <h3 className="text-xl">{isAr ? 'وصول مرفوض' : 'Access Denied'}</h3>
              <p className="text-xs text-center">{isAr ? 'هذا القسم يتطلب صلاحية أعلى للوصول.' : 'Elevated clearance required for API configurations.'}</p>
            </div>
          )}
        </div>
  );
}
