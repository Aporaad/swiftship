import React from 'react';
import { Settings as SettingsIcon, Upload, Image as ImageIcon, RefreshCw, Building } from 'lucide-react';
import { SectionCard, FieldLabel, FieldInput, FieldTextarea } from './settingsHelpers';

export function GeneralSettingsTab({
  isAr,
  settings,
  setSettings,
  canEditGeneral,
  canEditCompany,
  logoInputRef,
  handleLogoUpload,
  handleResetCounter,
  t
}: any) {
  return (
    <div className="space-y-5 animate-fade-slide-in">
      <SectionCard title={isAr ? 'هوية النظام والعلامة التجارية' : 'System Branding & Identity'} icon={SettingsIcon}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <FieldLabel>{t ? t('systemName') : (isAr ? 'اسم النظام' : 'System Name')}</FieldLabel>
            <FieldInput type="text" disabled={!canEditGeneral} value={settings?.systemName || ''} onChange={(e: any) => setSettings({ ...settings, systemName: e.target.value })} placeholder="alx" />
          </div>
          <div>
            <FieldLabel>{t ? t('systemLogo') : (isAr ? 'شعار النظام' : 'System Logo')}</FieldLabel>
            <div className="flex items-center gap-3">
              {settings?.systemLogo ? (
                <div className="relative group">
                  <img src={settings.systemLogo} alt="Logo" className="w-16 h-16 object-contain rounded-xl border border-slate-800 bg-black/50 p-2" />
                  <button disabled={!canEditGeneral} onClick={() => setSettings({ ...settings, systemLogo: '' })} className="absolute -top-2 -right-2 w-5 h-5 bg-rose-600 rounded-full flex disabled:opacity-50 disabled:cursor-not-allowed items-center justify-center opacity-0 group-hover:opacity-100 transition">✕</button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl border border-slate-800 bg-black/50 flex items-center justify-center text-slate-600"><ImageIcon className="w-6 h-6" /></div>
              )}
              <button type="button" disabled={!canEditGeneral} onClick={() => logoInputRef?.current?.click()} className="flex-1 bg-black/40 border border-slate-800 hover:border-[#d4af37]/40 text-slate-300 hover:text-white py-3 px-4 rounded-xl text-xs font-black transition flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"><Upload className="w-4 h-4" />{isAr ? 'رفع شعار' : 'Upload Logo'}</button>
            </div>
          </div>
          <div>
            <FieldLabel>{t ? t('orderPrefix') : (isAr ? 'بادئة الطلبات' : 'Order Prefix')}</FieldLabel>
            <FieldInput type="text" disabled={!canEditGeneral} value={settings?.orderPrefix || 'ALX'} onChange={(e: any) => setSettings({ ...settings, orderPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="ALX" maxLength={5} className="font-mono uppercase" dir="ltr" />
            <p className="text-[10px] text-slate-500 mt-1.5 font-bold">{isAr ? `مثال: ${settings?.orderPrefix || 'ALX'}-2601-1001` : `Example: ${settings?.orderPrefix || 'ALX'}-2601-1001`}</p>
          </div>
          <div>
            <FieldLabel>{t ? t('orderStartNumber') : (isAr ? 'بداية عداد الطلبات' : 'Start Number')}</FieldLabel>
            <FieldInput type="number" disabled={!canEditGeneral} value={settings?.orderStartNumber ?? 1001} onChange={(e: any) => setSettings({ ...settings, orderStartNumber: parseInt(e.target.value) || 1001 })} min={1} className="font-mono" dir="ltr" />
          </div>
          <div className="md:col-span-2">
            <button type="button" disabled={!canEditGeneral} onClick={handleResetCounter} className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 px-4 py-2.5 rounded-xl text-xs font-black transition disabled:opacity-50 disabled:cursor-not-allowed"><RefreshCw className="w-4 h-4" />{isAr ? 'إعادة ضبط عداد الطلبات' : 'Reset Counter'}</button>
          </div>
        </div>
      </SectionCard>

      {canEditCompany && (
        <SectionCard title={isAr ? 'هوية الشركة' : 'Company Identity'} icon={Building}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <FieldLabel>{isAr ? 'اسم الشركة' : 'Company Name'}</FieldLabel>
              <FieldInput type="text" value={settings?.companyName || ''} onChange={(e: any) => setSettings({ ...settings, companyName: e.target.value })} />
            </div>
            {[
              { key: 'companyPhone', label: isAr ? 'هاتف الشركة' : 'Phone', placeholder: '+967 700 000 000', dir: 'ltr' },
              { key: 'companyEmail', label: isAr ? 'البريد الإلكتروني' : 'Email', placeholder: 'info@company.com', dir: 'ltr' },
              { key: 'companyWebsite', label: isAr ? 'الموقع الإلكتروني' : 'Website', placeholder: 'www.company.com', dir: 'ltr' },
              { key: 'taxId', label: isAr ? 'الرقم الضريبي' : 'Tax ID', placeholder: 'TAX-967-001', dir: 'ltr' },
            ].map(f => (
              <div key={f.key}>
                <FieldLabel>{f.label}</FieldLabel>
                <FieldInput type="text" value={(settings as any)?.[f.key] || ''} onChange={(e: any) => setSettings({ ...settings, [f.key]: e.target.value })} placeholder={f.placeholder} dir={f.dir as any} className="font-mono" />
              </div>
            ))}
            <div className="md:col-span-2">
              <FieldLabel>{isAr ? 'عنوان الشركة' : 'Company Address'}</FieldLabel>
              <FieldTextarea rows={2} value={settings?.companyAddress || ''} onChange={(e: any) => setSettings({ ...settings, companyAddress: e.target.value })} />
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
