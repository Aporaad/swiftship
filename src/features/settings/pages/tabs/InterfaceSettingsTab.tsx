import React from 'react';
import { Palette, Globe, CheckCircle, Type } from 'lucide-react';
import { SectionCard, FieldLabel } from './settingsHelpers';

export function InterfaceSettingsTab({
  isAr,
  settings,
  setSettings,
  canEditInterface,
  t
}: any) {
  return (
    <div className="space-y-5 animate-fade-slide-in">
      <SectionCard title={isAr ? 'المظهر والوضع' : 'Theme & Mode'} icon={Palette}>
        <FieldLabel>{t ? t('theme') : (isAr ? 'النسق والواجهة' : 'Theme')}</FieldLabel>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'dark', label: isAr ? 'الوضع المظلم الفاخر' : 'Luxury Dark', icon: '🌙', desc: isAr ? 'خلفية داكنة وعرض ذهبي' : 'Dark background & gold accents' },
            { value: 'light', label: isAr ? 'الوضع الفاتح' : 'Light Mode', icon: '☀️', desc: isAr ? 'خلفية بيضاء وعرض مضيء' : 'Clean white background' },
          ].map(opt => (
            <button key={opt.value} type="button"
              disabled={!canEditInterface}
              onClick={() => setSettings({ ...settings, theme: opt.value as any })}
              className={`p-4 rounded-2xl border-2 transition-all text-start ${settings?.theme === opt.value ? 'border-[#d4af37] bg-[#d4af37]/10 shadow-[0_0_15px_rgba(212,175,55,0.15)]' : 'border-slate-800 bg-black/40 hover:border-slate-700'} ${!canEditInterface ? 'opacity-65 cursor-not-allowed' : ''}`}
            >
              <div className="text-2xl mb-2">{opt.icon}</div>
              <div className={`font-black text-xs uppercase tracking-wide ${settings?.theme === opt.value ? 'text-[#d4af37]' : 'text-slate-400'}`}>{opt.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-bold">{opt.desc}</div>
              {settings?.theme === opt.value && <div className="mt-2 flex items-center gap-1 text-[#d4af37] text-[9px] font-black"><CheckCircle className="w-3 h-3" /> {isAr ? 'محدد' : 'Active'}</div>}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={isAr ? 'حجم الخط' : 'Font Size'} icon={Type}>
        <FieldLabel>{isAr ? 'اختر حجم خط النظام' : 'Choose system font size'}</FieldLabel>
        <div className="grid grid-cols-4 gap-3">
          {[{ value: 'sm', label: isAr ? 'صغير' : 'Small', px: '13px' }, { value: 'md', label: isAr ? 'متوسط' : 'Medium', px: '14px' }, { value: 'lg', label: isAr ? 'كبير' : 'Large', px: '15px' }, { value: 'xl', label: isAr ? 'ضخم' : 'Extra Large', px: '16px' }].map(opt => (
            <button key={opt.value} type="button"
              disabled={!canEditInterface}
              onClick={() => setSettings({ ...settings, fontSize: opt.value as any })}
              className={`p-3 rounded-xl border-2 transition-all text-center ${settings?.fontSize === opt.value ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-slate-800 bg-black/40 text-slate-400 hover:border-slate-700'} ${!canEditInterface ? 'opacity-65 cursor-not-allowed' : ''}`}
            >
              <div className="font-black text-xs mb-1">{opt.label}</div>
              <div className="text-[10px] text-slate-500 font-mono">{opt.px}</div>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={isAr ? 'لغة النظام' : 'System Language'} icon={Globe}>
        <FieldLabel>{isAr ? 'لغة الواجهة الرئيسية' : 'Main Interface Language'}</FieldLabel>
        <div className="flex p-1 bg-black/40 border border-slate-800 rounded-2xl">
          <button type="button" disabled={!canEditInterface} onClick={() => setSettings({ ...settings, language: 'ar' })}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${settings?.language === 'ar' ? 'bg-[#d4af37] text-black shadow-md' : 'text-slate-400 hover:text-slate-200'} ${!canEditInterface ? 'opacity-50 cursor-not-allowed' : ''}`}
          >🇾🇪 العربية</button>
          <button type="button" disabled={!canEditInterface} onClick={() => setSettings({ ...settings, language: 'en' })}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${settings?.language === 'en' ? 'bg-[#d4af37] text-black shadow-md' : 'text-slate-400 hover:text-slate-200'} ${!canEditInterface ? 'opacity-50 cursor-not-allowed' : ''}`}
          >🇺🇸 ENGLISH</button>
        </div>
      </SectionCard>
    </div>
  );
}
