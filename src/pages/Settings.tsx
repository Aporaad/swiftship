import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Save, Globe, Palette, Database, DollarSign, Building, X, Upload, CheckCircle, ShieldAlert, Crown, Cpu, Archive } from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import ConfirmModal from '../components/ConfirmModal';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { role, hasPermission, loading: roleLoading } = useRole();
  const { settings: globalSettings, updateSettings, t } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAr = globalSettings.language === 'ar';

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });

  const [localSettings, setLocalSettings] = useState(globalSettings);

  useEffect(() => {
    setLocalSettings(globalSettings);
  }, [globalSettings]);

  if (roleLoading) {
    return (
      <div className="flex bg-[#0e0e11] text-white h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded border-2 border-[#d4af37]/25 border-t-[#d4af37]"></div>
      </div>
    );
  }

  if (!hasPermission('settings') && role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-850 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide text-center">{t('accessDenied')}</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">{isAr ? 'صفحة الإعدادات والتحكم بالنظام مخصصة للمطورين والمدراء الاستراتيجيين فقط.' : 'This critical systems console is restricted to administrators and system architects.'}</p>
      </div>
    );
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      await updateSettings(localSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings');
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const collections = ['customers', 'couriers', 'sources', 'orders', 'users', 'roles'];
      const backupData: any = {
        version: "2.0",
        timestamp: new Date().toISOString(),
        settings: localSettings,
        data: {}
      };

      for (const colName of collections) {
        try {
          const snap = await getDocs(collection(db, colName));
          backupData.data[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
          console.error(`Error backing up ${colName}:`, err);
        }
      }
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LogiTrack_Full_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      updateSettings({ lastBackup: new Date().toLocaleString(globalSettings.language === 'ar' ? 'ar-YE' : 'en-US') } as any);
      alert(globalSettings.language === 'ar' ? "تم تصدير النسخة الاحتياطية الاستراتيجية الكاملة بنجاح والتوقيع الرقمي عليها!" : "Strategy database backup executed and signed successfully!");
    } catch (error) {
      console.error('Backup failed:', error);
      alert(globalSettings.language === 'ar' ? "فشل تصدير الكتل" : "Backup block indexing failed.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setImportLoading(true);
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        if (!data.settings && !data.data) {
          throw new Error(globalSettings.language === 'ar' ? "ملف النسخة غير صالح أو التم كسر التوقيع الرقمي له." : "Signature broken in backup file.");
        }

        setConfirmConfig({
          isOpen: true,
          title: globalSettings.language === 'ar' ? 'دمج وقرصنة قاعدة نسخة سابقة' : 'Rebase Previous Database Ledger',
          message: globalSettings.language === 'ar' ? "مستحسن التأكيد: هذا سيقوم بمحو واستبدال التهيئة وإعادة قرصنة فهارس السحابة. هل تريد الحث؟" : "Warning: This action overwrites current ledger configurations and injects backup nodes. Confirm execution?",
          type: 'warning',
          onConfirm: async () => {
            try {
              if (data.settings) {
                await updateSettings(data.settings);
              }

              if (data.data) {
                for (const colName in data.data) {
                  const items = data.data[colName];
                  if (Array.isArray(items)) {
                    const batch = writeBatch(db);
                    for (const item of items) {
                      const { id, ...itemData } = item;
                      if (id) {
                        batch.set(doc(db, colName, id), itemData);
                      }
                    }
                    await batch.commit();
                  }
                }
              }

              alert(globalSettings.language === 'ar' ? "تم استيراد الكتل وإعادة دمج السحابة!" : "Blocks rebased and successfully indexed!");
              window.location.reload(); 
            } catch (err) {
              console.error('Import error:', err);
              alert((globalSettings.language === 'ar' ? "خطأ في دمج قاعدة البيانات: " : "Ledger rebase error: ") + (err as Error).message);
            }
          }
        });

      } catch (err) {
        console.error('Import error:', err);
        alert((globalSettings.language === 'ar' ? "خطأ في قراءة ملف التوقيع: " : "Signature parse error: ") + (err as Error).message);
      } finally {
        setImportLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 text-start selection:bg-[#d4af37]/30">
      
      {/* Hidden input file tag */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileImport} 
        accept=".json" 
        className="hidden" 
      />

      {/* Header Panel */}
      <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg sticky top-4 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            <Database className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none mb-1">{t('settings')}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isAr ? 'تهيئة النواة المركزية للشركة ودمج الفواتير المالية والنسخ المعزز' : 'Core Configuration & Strategic Ledgers'}</p>
          </div>
        </div>
        <button 
          onClick={() => handleSave()} 
          disabled={loading}
          className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:from-slate-800 disabled:to-slate-900 text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition shadow-md transform active:scale-95"
        >
          <Save className="w-4 h-4"/>
          {loading ? (isAr ? 'جاري السحب والتأمين...' : 'Saving ledger...') : t('saveChanges')}
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-950/20 text-emerald-400 p-4 rounded-2xl border border-emerald-950/50 font-extrabold flex items-center gap-3 animate-bounce">
          <div className="w-8 h-8 rounded-full bg-emerald-600/30 text-[#d4af37] border border-[#d4af37]/30 flex items-center justify-center shrink-0">✓</div>
          <span className="text-xs">{isAr ? 'تم تأكيد البارايميترات الجوية وحفظ جميع إعدادات الشركة بنجاح!' : 'Central network settings successfully broadcasted!'}</span>
        </div>
      )}

      {/* Two Columns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
        
        {/* Left wider grid */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Company Identity section */}
          <section className="bg-[#121215] border border-slate-850 p-8 rounded-3xl shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full -mr-16 -mt-16 opacity-40 group-hover:scale-110 transition-transform"></div>
            <h2 className="text-base font-black text-white mb-6 flex items-center gap-2 border-b border-slate-850 pb-4 relative z-10 uppercase tracking-wider">
              <Building className="w-5 h-5 text-[#d4af37]" />
              {t('companyIdentity')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">{isAr ? 'اسم الشركة ومؤسستك اللوجيستية الكبرى' : 'Global Enterprise Title Name'}</label>
                <input 
                  type="text" 
                  value={localSettings.companyName}
                  onChange={(e) => setLocalSettings({...localSettings, companyName: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  placeholder={isAr ? "الشركة اللوجستية الراقية" : "Luxury Logistics Enterprise Inc"}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">{isAr ? 'الهاتف الموصول' : 'Corporate Phone'}</label>
                <input 
                  type="text" 
                  value={localSettings.companyPhone}
                  onChange={(e) => setLocalSettings({...localSettings, companyPhone: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start font-mono" dir="ltr"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">{isAr ? 'البريد المؤسسي' : 'Secure Email ID'}</label>
                <input 
                  type="email" 
                  value={localSettings.companyEmail}
                  onChange={(e) => setLocalSettings({...localSettings, companyEmail: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start font-mono" dir="ltr"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">{isAr ? 'النطاق والموقع الإلكتروني للشركة' : 'Web Domain'}</label>
                <input 
                  type="text" 
                  value={localSettings.companyWebsite}
                  onChange={(e) => setLocalSettings({...localSettings, companyWebsite: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start font-mono" dir="ltr"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">{isAr ? 'الرقم الضريبي وتوثيق الغرفة التجارية' : 'Commercial Tax Validation ID'}</label>
                <input 
                  type="text" 
                  value={localSettings.taxId}
                  onChange={(e) => setLocalSettings({...localSettings, taxId: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start font-mono" dir="ltr"
                  placeholder="TAX-967-889"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">{isAr ? 'سكني وسكرتارية المقر الرئيسي للشركة' : 'Detailed Headquarters Address'}</label>
                <textarea 
                  rows={2}
                  value={localSettings.companyAddress}
                  onChange={(e) => setLocalSettings({...localSettings, companyAddress: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  placeholder={isAr ? "اليمن - صنعاء - شارع الستين" : "Sana'a - Yemen"}
                />
              </div>
            </div>
          </section>

          {/* Finance settings */}
          <section className="bg-[#121215] border border-slate-850 p-8 rounded-3xl shadow-lg">
            <h2 className="text-base font-black text-white mb-6 flex items-center gap-2 border-b border-slate-850 pb-4 uppercase tracking-wider">
              <DollarSign className="w-5 h-5 text-[#d4af37]" />
              {t('financeSettings')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">{isAr ? 'عملة التقييم والتدقيق المالي' : 'Trading Vault Base Currency'}</label>
                <select 
                  value={localSettings.currency} 
                  onChange={(e) => setLocalSettings({...localSettings, currency: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3.5 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer"
                >
                  <option value="SAR">{isAr ? '🇸🇦 ريال سعودي (SAR)' : 'SAR'}</option>
                  <option value="USD">{isAr ? '🇺🇸 دولار أمريكي (USD)' : 'USD'}</option>
                  <option value="YER">{isAr ? '🇾🇪 ريال يمني (YER)' : 'Value YER'}</option>
                  <option value="AED">{isAr ? '🇦🇪 درهم إماراتي (AED)' : 'AED'}</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">{isAr ? 'الرمز المحاسبي المطبوع' : 'Accounting Sign Symbol'}</label>
                <input 
                  type="text" 
                  value={localSettings.currencySymbol}
                  onChange={(e) => setLocalSettings({...localSettings, currencySymbol: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3.5 text-xs text-center font-bold text-white focus:border-[#d4af37]/60 outline-none"
                />
              </div>
              <div className="md:col-span-2 flex items-center p-4 bg-black/40 rounded-2xl border border-slate-850 gap-4">
                <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37] p-2.5 rounded-xl"><DollarSign className="w-5 h-5"/></div>
                <div className="flex-1 text-start">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">{isAr ? 'الإشعارات وسحابات التحصيل التلقائية' : 'Discharge Autonomous Slips'}</h4>
                  <p className="text-[10px] text-slate-500 font-bold">{isAr ? 'إرسال بنود إشعار تلقائي للزبون عند استلام العهدة أو تصفية الحساب ماليًا' : 'Instruct webhook integration to broadcast payment receipts immediately'}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={localSettings.autoNotification} onChange={(e) => setLocalSettings({...localSettings, autoNotification: e.target.checked})} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-850 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-850 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                </label>
              </div>
            </div>
          </section>
        </div>

        {/* Right side widgets */}
        <div className="space-y-6">
          
          {/* Interface options */}
          <section className="bg-[#121215] border border-slate-850 p-6 rounded-3xl text-start">
            <h2 className="text-sm font-black text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#d4af37]" />
              {t('interfaceLanguage')}
            </h2>
            <div className="space-y-5">
              <div>
                <span className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">{isAr ? 'لغة الواجهة الرئيسية لشبكات لوجيستك' : 'Core GUI Language'}</span>
                <div className="flex p-1 bg-black/40 border border-slate-850 rounded-2xl">
                  <button 
                    type="button"
                    onClick={() => setLocalSettings({...localSettings, language: 'ar'})}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${localSettings.language === 'ar' ? 'bg-[#d4af37] text-black shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                  >العربية</button>
                  <button 
                    type="button"
                    onClick={() => setLocalSettings({...localSettings, language: 'en'})}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${localSettings.language === 'en' ? 'bg-[#d4af37] text-black shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                  >ENGLISH</button>
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">{t('theme')}</span>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    onClick={() => setLocalSettings({...localSettings, theme: 'light'})}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${localSettings.theme === 'light' ? 'border-[#d4af37] bg-[#d4af37]/10 text-white' : 'border-slate-850 bg-black/40 text-slate-500'}`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white border border-slate-300"></div>
                    <span className="text-[10px] font-extrabold">{isAr ? 'قواعد فاتحة' : 'Light Mode'}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setLocalSettings({...localSettings, theme: 'dark'})}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${localSettings.theme === 'dark' ? 'border-[#d4af37] bg-[#d4af37]/10 text-white' : 'border-slate-850 bg-black/40 text-slate-500'}`}
                  >
                    <div className="w-4 h-4 rounded-full bg-black border border-[#d4af37]"></div>
                    <span className="text-[10px] font-extrabold">{isAr ? 'الوضع المظلم الفاخر' : 'Luxury Dark'}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Backup & ledger integration tools */}
          <section className="bg-[#121215] border border-slate-850 p-6 rounded-3xl text-start relative overflow-hidden text-white">
            <h2 className="text-sm font-black mb-6 flex items-center gap-2 text-white uppercase tracking-wider">
              <Database className="w-5 h-5 text-[#d4af37]" />
              {t('backupTools')}
            </h2>
            <div className="space-y-6">
              <div className="bg-black/30 p-4 rounded-2xl border border-slate-850">
                <h3 className="font-black text-xs text-[#d4af37] uppercase tracking-wider mb-1">{isAr ? 'النسخ والتدوين المحمي سحابياً' : 'Database Custody Vault'}</h3>
                <p className="text-[9px] text-slate-500 font-bold mb-4">{isAr ? 'سحب ملف كامل لتوقيع حساب المعاملات المالي' : 'Full block compilation and local storage file save'}</p>
                
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    type="button"
                    onClick={handleBackup}
                    disabled={backupLoading}
                    className="w-full bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 disabled:from-slate-800 disabled:to-slate-900 shadow"
                  >
                    {backupLoading ? (isAr ? 'جاري السحب والتأمين...' : 'Mining blocks...') : (
                      <>{t('exportBackup')} <Save className="w-3.5 h-3.5" /></>
                    )}
                  </button>
                  <button 
                    type="button"
                    onClick={handleImportClick}
                    disabled={importLoading}
                    className="w-full bg-black/40 border border-slate-850 text-slate-300 py-2.5 rounded-xl font-black text-xs hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {importLoading ? (isAr ? 'جاري الرفع والدمج...' : 'Injecting nodes...') : t('importBackup')}
                  </button>
                </div>
              </div>
              
              <div className="p-4 bg-rose-950/10 rounded-2xl border border-rose-950/40">
                <h3 className="text-rose-400 font-black text-[9px] mb-2 uppercase tracking-widest text-center">{isAr ? 'صلاحيات النواة المعالجة (خطر)' : 'Host System Cache Clear'}</h3>
                <button 
                  type="button"
                  onClick={() => {
                    setConfirmConfig({
                      isOpen: true,
                      title: isAr ? 'محو ذاكرة الكاش للشبكة' : 'Truncate State Cache',
                      message: isAr ? 'هذا سيؤدي لإعادة تشغيل خوارزميات الولوج وفك الكوكيز المحلية. هل تريد الإستمرار؟' : 'Discard compiled state matrices? Cookies will expire and logout requested.',
                      type: 'danger',
                      onConfirm: () => {
                        localStorage.clear();
                        window.location.reload();
                      }
                    });
                  }}
                  className="w-full bg-rose-500/10 text-rose-500 py-2 rounded-xl font-black text-[9px] hover:bg-rose-500 hover:text-white transition-all border border-rose-500/30"
                >
                  {isAr ? 'مسح الكاش وفرمتة المتصفح' : 'Clear Host LocalState'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
      />
    </div>
  );
}
