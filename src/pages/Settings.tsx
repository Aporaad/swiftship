import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, getDocs, setDoc, writeBatch, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Save, Globe, Palette, Database, DollarSign, Building, X, Upload, CheckCircle,
  ShieldAlert, RefreshCw, Archive, Settings2, Shield, FileText, Image, Type,
  Package, Download, Clock, User, Bell, Plus, Trash2, Edit3, Power,
  Calendar, HardDrive, History, Lock, Unlock, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import type { CustomCurrency } from '../context/SettingsContext';
import ConfirmModal from '../components/ConfirmModal';
import { activityLogService } from '../services/activityLogService';
import { notificationService } from '../services/notificationService';
import { auth } from '../lib/firebase';

type SettingsTab = 'interface' | 'general' | 'currency' | 'admin' | 'logistics';

// ─────────────────────────────────────
// REUSABLE FIELD COMPONENTS
// ─────────────────────────────────────
const FieldLabel = ({ children, locked = false }: { children: React.ReactNode; locked?: boolean }) => (
  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider">
    {children}{locked && <span className="ml-1 text-rose-400">🔒</span>}
  </label>
);

const FieldInput = ({ disabled = false, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    disabled={disabled}
    className={`w-full bg-black/50 border border-slate-800 rounded-xl p-3.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start transition ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-700'} ${props.className || ''}`}
  />
);

const FieldTextarea = ({ disabled = false, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    disabled={disabled}
    className={`w-full bg-black/50 border border-slate-800 rounded-xl p-3.5 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start transition ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-700'}`}
  />
);

const SectionCard = ({ title, icon: Icon, children, className = '', badge }: { title: string; icon: any; children: React.ReactNode; className?: string; badge?: string }) => (
  <section className={`bg-[#121215] border border-slate-850 p-6 rounded-3xl shadow-lg relative overflow-hidden group ${className}`}>
    <div className="absolute top-0 right-0 w-24 h-24 bg-[#d4af37]/3 rounded-full -mr-12 -mt-12 opacity-30 group-hover:scale-110 transition-transform duration-500"></div>
    <h2 className="text-sm font-black text-white mb-5 flex items-center gap-2 border-b border-slate-800/50 pb-4 relative z-10 uppercase tracking-wider">
      <Icon className="w-4 h-4 text-[#d4af37]" />
      {title}
      {badge && <span className="mr-auto text-[9px] font-black bg-[#d4af37]/20 text-[#d4af37] px-2 py-0.5 rounded-full">{badge}</span>}
    </h2>
    <div className="relative z-10">{children}</div>
  </section>
);

const ToggleSwitch = ({
  checked, onChange, label, description, icon: Icon, locked = false
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; icon?: any; locked?: boolean }) => (
  <div className="flex items-center p-4 bg-black/40 rounded-2xl border border-slate-800 gap-4">
    {Icon && (
      <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37] p-2.5 rounded-xl shrink-0">
        <Icon className="w-5 h-5" />
      </div>
    )}
    <div className="flex-1 text-start">
      <h4 className="text-xs font-black text-white uppercase tracking-wider">
        {label}{locked && <span className="ml-1 text-rose-400">🔒</span>}
      </h4>
      {description && <p className="text-[10px] text-slate-500 font-bold mt-0.5">{description}</p>}
    </div>
    <label className={`relative inline-flex items-center ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !locked && onChange(e.target.checked)}
        className="sr-only peer"
        disabled={locked}
      />
      <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-800 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
    </label>
  </div>
);

// ─────────────────────────────────────
// BACKUP RECORD TYPE
// ─────────────────────────────────────
interface BackupRecord {
  id: string;
  timestamp: string;
  savedAt: number;
  createdBy: string;
  type: 'auto' | 'manual';
  collections?: string[];
  size?: number;
}

// ─────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────
export default function Settings() {
  const [saving, setSaving] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('interface');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  // Backup history state
  const [backupHistory, setBackupHistory] = useState<BackupRecord[]>([]);
  const [backupHistoryLoading, setBackupHistoryLoading] = useState(false);
  const [showBackupHistory, setShowBackupHistory] = useState(false);
  const [selectedRestoreId, setSelectedRestoreId] = useState<string | null>(null);

  // Currency editor state
  const [editingCurrency, setEditingCurrency] = useState<CustomCurrency | null>(null);
  const [newCurrency, setNewCurrency] = useState<Partial<CustomCurrency>>({
    code: '', name: '', symbol: '', flag: '', rateToYER: 0, isActive: true
  });
  const [showAddCurrency, setShowAddCurrency] = useState(false);

  const { role, hasPermission, loading: roleLoading, profile } = useRole();
  const canEditInterface = role === 'Admin' || hasPermission('edit_interface_settings');
  const canEditGeneral = role === 'Admin' || hasPermission('edit_general_settings');
  const canEditCompany = role === 'Admin' || hasPermission('edit_company_info');
  const canEditRates = role === 'Admin' || hasPermission('edit_exchange_rates');
  const canEditOrderDefaults = role === 'Admin' || hasPermission('edit_order_defaults');
  const canManageBackup = role === 'Admin' || hasPermission('manage_backup');
  const canManageAdmin = role === 'Admin';

  const { settings: globalSettings, updateSettings, t } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const invoiceLogoInputRef = useRef<HTMLInputElement>(null);
  const isAr = globalSettings.language === 'ar';

  const [localSettings, setLocalSettings] = useState(globalSettings);
  const [exportSelections, setExportSelections] = useState<Record<string, boolean>>({
    orders: true, customers: true, couriers: true, sources: true, users: true, roles: true,
  });

  // Logistics API state
  const [logisticsSettings, setLogisticsSettings] = useState<{
    enabled: boolean;
    provider: string;
    apiKey: string;
    defaultDestinationCountry?: string;
  }>({
    enabled: false,
    provider: 'aftership',
    apiKey: '',
    defaultDestinationCountry: 'Yemen'
  });

  useEffect(() => {
    setLocalSettings(globalSettings);
    // Sync export selections from backup settings
    if (globalSettings.backupCollections) {
      const sel: Record<string, boolean> = { orders: false, customers: false, couriers: false, sources: false, users: false, roles: false };
      globalSettings.backupCollections.forEach(c => { if (c in sel) sel[c] = true; });
      setExportSelections(sel);
    }
  }, [globalSettings]);

  // Fetch Logistics Settings
  useEffect(() => {
    const fetchLogistics = async () => {
      try {
        const snap = await getDocs(collection(db, 'settings'));
        const apiDoc = snap.docs.find(d => d.id === 'logistics_api');
        if (apiDoc) {
          const data = apiDoc.data();
          setLogisticsSettings({
            enabled: data.enabled || false,
            provider: data.provider || 'aftership',
            apiKey: data.apiKey || '',
            defaultDestinationCountry: data.defaultDestinationCountry || 'Yemen'
          });
        }
      } catch (err) {
        console.error('Error fetching logistics settings:', err);
      }
    };
    fetchLogistics();
  }, []);

  // Load backup history from Firestore
  const loadBackupHistory = async () => {
    setBackupHistoryLoading(true);
    try {
      const snap = await getDocs(collection(db, 'backups'));
      const records: BackupRecord[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          timestamp: data.timestamp || '',
          savedAt: data.savedAt || 0,
          createdBy: data.createdBy || 'Unknown',
          type: data.type || 'manual',
          collections: data.collections || [],
          size: JSON.stringify(data.data || {}).length
        };
      }).sort((a, b) => b.savedAt - a.savedAt).slice(0, 20);
      setBackupHistory(records);
    } catch (err) {
      console.error('Failed to load backup history:', err);
    } finally {
      setBackupHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (showBackupHistory) loadBackupHistory();
  }, [showBackupHistory]);

  // ─── CONFIRM MODAL ──────────────────
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void; type: 'danger' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger' });

  if (roleLoading) {
    return (
      <div className="flex bg-[#0e0e11] text-white h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded border-2 border-[#d4af37]/25 border-t-[#d4af37]"></div>
      </div>
    );
  }

  if (!hasPermission('settings') && role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-800 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide">{t('accessDenied')}</h2>
        <p className="text-slate-500 max-w-md">
          {isAr ? 'صفحة الإعدادات مخصصة للمدراء والمسؤولين فقط.' : 'Settings page is restricted to administrators only.'}
        </p>
      </div>
    );
  }

  // ─── SAVE ─────────────────────────────
  const handleSave = async () => {
    const canEditAny = role === 'Admin' ||
      hasPermission('edit_interface_settings') ||
      hasPermission('edit_general_settings') ||
      hasPermission('edit_company_info') ||
      hasPermission('edit_exchange_rates') ||
      hasPermission('edit_order_defaults') ||
      hasPermission('manage_backup');

    if (!canEditAny) {
      alert(isAr ? 'عذراً، ليس لديك صلاحية تعديل الإعدادات.' : 'Sorry, you do not have permission to edit settings.');
      return;
    }

    setSaving(true);
    try {
      const selectedCols = Object.entries(exportSelections).filter(([, v]) => v).map(([k]) => k);
      await updateSettings({ ...localSettings, backupCollections: selectedCols });
      
      if (canManageAdmin) {
        await setDoc(doc(db, 'settings', 'logistics_api'), logisticsSettings);
      }

      const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
      activityLogService.log('save_settings', 'System Settings');
      
      notificationService.notify({
        title: isAr ? 'تحديث إعدادات النظام' : 'System Settings Updated',
        message: isAr
          ? `تم تحديث إعدادات النظام العامة والمظهر بواسطة ${updaterName}`
          : `System general & appearance settings updated by ${updaterName}`,
        type: 'info',
        category: 'system'
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings');
    } finally {
      setSaving(false);
    }
  };

  // ─── EXCHANGE RATES API ──────────────
  const fetchExchangeRates = async () => {
    const url = localSettings.exchangeRatesApiUrl || 'https://open.er-api.com/v6/latest/USD';
    setApiLoading(true);
    setApiError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(isAr ? 'فشل الاتصال بخادم أسعار الصرف' : 'Failed to connect to exchange rate server');
      const data = await res.json();
      if (data && data.rates) {
        const sarRate = data.rates.SAR || 3.75;
        const yerRate = data.rates.YER;
        let newUSD = localSettings.exchangeRateUSD || 535;
        let newSAR = localSettings.exchangeRateSAR || 140;
        if (yerRate && yerRate > 300) {
          newUSD = Math.round(yerRate);
          newSAR = parseFloat((yerRate / sarRate).toFixed(2));
        } else {
          newSAR = parseFloat((newUSD / sarRate).toFixed(2));
        }
        const now = new Date();
        const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';

        // Also update custom currencies using API rates
        const updatedCurrencies = (localSettings.customCurrencies || []).map(cur => {
          if (cur.code === 'USD' && yerRate) return { ...cur, rateToYER: Math.round(yerRate) };
          if (cur.code === 'SAR' && yerRate) return { ...cur, rateToYER: parseFloat((yerRate / (data.rates.SAR || 3.75)).toFixed(2)) };
          if (data.rates[cur.code] && yerRate) return { ...cur, rateToYER: parseFloat((yerRate / data.rates[cur.code]).toFixed(2)) };
          return cur;
        });

        setLocalSettings(prev => ({
          ...prev,
          exchangeRateUSD: newUSD,
          exchangeRateSAR: newSAR,
          lastExchangeRateUpdate: now.toLocaleDateString(isAr ? 'ar-YE' : 'en-US'),
          lastExchangeRateUpdateTime: now.toLocaleTimeString(isAr ? 'ar-YE' : 'en-US'),
          lastExchangeRateUpdatedBy: updaterName,
          customCurrencies: updatedCurrencies,
        }));
        activityLogService.log('change_exchange_rate', 'API Update', { newUSD, newSAR, updatedBy: updaterName });
        notificationService.notify({
          title: isAr ? 'تحديث أسعار الصرف' : 'Exchange Rates Updated',
          message: isAr
            ? `تم تحديث أسعار الصرف تلقائياً من الـ API بواسطة ${updaterName}. دولار: ${newUSD}، سعودي: ${newSAR}`
            : `Exchange rates updated from API by ${updaterName}. USD: ${newUSD}, SAR: ${newSAR}`,
          type: 'success',
          category: 'finance'
        });
        alert(isAr
          ? `✅ تم تحديث أسعار الصرف! USD: ${newUSD} YER | SAR: ${newSAR} YER`
          : `✅ Exchange rates updated! USD: ${newUSD} YER | SAR: ${newSAR} YER`
        );
      } else {
        throw new Error(isAr ? 'استجابة API غير صالحة' : 'Invalid API response');
      }
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setApiLoading(false);
    }
  };

  // ─── LOGO UPLOAD ────────────────────
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'systemLogo' | 'invoiceLogo') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setLocalSettings(prev => ({ ...prev, [field]: base64 }));
    };
    reader.readAsDataURL(file);
  };

  // ─── CUSTOM CURRENCY MANAGEMENT ─────
  const handleAddCurrency = () => {
    if (!newCurrency.code || !newCurrency.name || !newCurrency.symbol) {
      alert(isAr ? 'يرجى ملء جميع الحقول الإلزامية (الكود، الاسم، الرمز)' : 'Please fill all required fields (code, name, symbol)');
      return;
    }
    const existing = (localSettings.customCurrencies || []);
    if (existing.find(c => c.code === newCurrency.code?.toUpperCase())) {
      alert(isAr ? 'هذه العملة موجودة بالفعل!' : 'This currency already exists!');
      return;
    }
    const currency: CustomCurrency = {
      id: newCurrency.code!.toUpperCase(),
      code: newCurrency.code!.toUpperCase(),
      name: newCurrency.name!,
      symbol: newCurrency.symbol!,
      flag: newCurrency.flag || '🌍',
      rateToYER: newCurrency.rateToYER || 0,
      isActive: newCurrency.isActive !== false,
    };
    setLocalSettings(prev => ({
      ...prev,
      customCurrencies: [...(prev.customCurrencies || []), currency]
    }));
    
    const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
    activityLogService.log('change_exchange_rate', `Add Currency: ${currency.code}`, { rate: currency.rateToYER });
    notificationService.notify({
      title: isAr ? 'إضافة عملة جديدة' : 'New Currency Added',
      message: isAr
        ? `تم إضافة العملة ${currency.code} (${currency.name}) بسعر صرف ${currency.rateToYER} YER بواسطة ${updaterName}`
        : `Currency ${currency.code} (${currency.name}) added with rate ${currency.rateToYER} YER by ${updaterName}`,
      type: 'success',
      category: 'finance'
    });
    
    setNewCurrency({ code: '', name: '', symbol: '', flag: '', rateToYER: 0, isActive: true });
    setShowAddCurrency(false);
  };

  const handleUpdateCurrency = (id: string, updates: Partial<CustomCurrency>) => {
    setLocalSettings(prev => ({
      ...prev,
      customCurrencies: (prev.customCurrencies || []).map(c => c.id === id ? { ...c, ...updates } : c)
    }));
    
    const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
    activityLogService.log('change_exchange_rate', `Update Currency: ${id}`, updates);
    notificationService.notify({
      title: isAr ? 'تحديث العملة' : 'Currency Updated',
      message: isAr
        ? `تم تحديث بيانات العملة ${id} بواسطة ${updaterName}`
        : `Currency ${id} updated by ${updaterName}`,
      type: 'info',
      category: 'finance'
    });
  };

  const handleDeleteCurrency = (id: string) => {
    const builtIn = ['USD', 'SAR'];
    if (builtIn.includes(id)) {
      alert(isAr ? 'لا يمكن حذف العملات الأساسية (USD, SAR)' : 'Cannot delete built-in currencies (USD, SAR)');
      return;
    }
    setLocalSettings(prev => ({
      ...prev,
      customCurrencies: (prev.customCurrencies || []).filter(c => c.id !== id)
    }));
    
    const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
    activityLogService.log('change_exchange_rate', `Delete Currency: ${id}`);
    notificationService.notify({
      title: isAr ? 'حذف عملة' : 'Currency Deleted',
      message: isAr
        ? `تم حذف العملة ${id} من النظام بواسطة ${updaterName}`
        : `Currency ${id} deleted by ${updaterName}`,
      type: 'warning',
      category: 'finance'
    });
  };

  // ─── BACKUP ─────────────────────────
  const runBackup = async (type: 'manual' | 'auto' = 'manual') => {
    const selectedCols = Object.entries(exportSelections).filter(([, v]) => v).map(([k]) => k);
    if (selectedCols.length === 0) {
      alert(isAr ? 'يرجى اختيار فئة واحدة على الأقل' : 'Please select at least one collection');
      return;
    }
    setBackupLoading(true);
    try {
      const backupData: any = {
        version: '3.0',
        timestamp: new Date().toISOString(),
        createdBy: profile?.fullName || auth.currentUser?.email || 'Admin',
        type,
        collections: selectedCols,
        settings: localSettings,
        data: {}
      };
      for (const colName of selectedCols) {
        try {
          const snap = await getDocs(collection(db, colName));
          backupData.data[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
          console.error(`Error backing up ${colName}:`, err);
        }
      }

      // Save to Firestore backups collection
      const backupId = `backup_${Date.now()}`;
      await setDoc(doc(db, 'backups', backupId), {
        ...backupData,
        savedAt: Date.now(),
        size: JSON.stringify(backupData.data).length
      });

      // Download file based on format
      if (exportFormat === 'csv') {
        const csvParts: string[] = [];
        for (const [col, rows] of Object.entries(backupData.data) as [string, any[]][]) {
          if (!rows.length) continue;
          const headers = Object.keys(rows[0]).join(',');
          const csvRows = rows.map((r: any) => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
          csvParts.push(`\n=== ${col.toUpperCase()} ===\n${headers}\n${csvRows}`);
        }
        const blob = new Blob([csvParts.join('\n\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SwiftShip_Backup_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SwiftShip_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      activityLogService.log('backup_export', selectedCols.join(', '));
      
      const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
      notificationService.notify({
        title: isAr ? 'إنشاء نسخة احتياطية' : 'Backup Created',
        message: isAr
          ? `تم إنشاء نسخة احتياطية بنجاح للفئات: ${selectedCols.join(', ')} بواسطة ${updaterName}`
          : `Backup successfully created for collections: ${selectedCols.join(', ')} by ${updaterName}`,
        type: 'success',
        category: 'system'
      });

      const newCount = (localSettings.backupCount || 0) + 1;
      await updateSettings({
        lastBackup: new Date().toLocaleString(isAr ? 'ar-YE' : 'en-US'),
        lastAutoBackupAt: Date.now(),
        backupCount: newCount
      } as any);
      setLocalSettings(prev => ({ ...prev, backupCount: newCount, lastBackup: new Date().toLocaleString(isAr ? 'ar-YE' : 'en-US') }));

      alert(isAr ? `✅ تم حفظ النسخة الاحتياطية رقم ${newCount} بنجاح!` : `✅ Backup #${newCount} saved successfully!`);
      if (showBackupHistory) loadBackupHistory();
    } catch (err) {
      console.error('Backup failed:', err);
      alert(isAr ? '❌ فشل تصدير النسخة الاحتياطية' : '❌ Backup export failed.');
    } finally {
      setBackupLoading(false);
    }
  };

  // Restore from Firestore backup
  const restoreFromFirestore = async (backupId: string) => {
    setBackupLoading(true);
    try {
      const snap = await getDocs(collection(db, 'backups'));
      const backupDoc = snap.docs.find(d => d.id === backupId);
      if (!backupDoc) throw new Error('Backup not found');
      const data = backupDoc.data();

      if (data.settings) await updateSettings(data.settings);
      if (data.data) {
        for (const colName in data.data) {
          const items = data.data[colName];
          if (Array.isArray(items)) {
            const batch = writeBatch(db);
            for (const item of items) {
              const { id, ...itemData } = item;
              if (id) batch.set(doc(db, colName, id), itemData);
            }
            await batch.commit();
          }
        }
      }
      activityLogService.log('backup_import', `Restore from Firestore: ${backupId}`);
      
      const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
      await notificationService.notify({
        title: isAr ? 'استعادة النظام' : 'System Restored',
        message: isAr
          ? `تم استعادة قاعدة بيانات النظام بنجاح من النسخة الاحتياطية ${backupId} بواسطة ${updaterName}`
          : `System database successfully restored from backup ${backupId} by ${updaterName}`,
        type: 'warning',
        category: 'system'
      });

      alert(isAr ? '✅ تم استعادة البيانات بنجاح! سيتم إعادة تحميل الصفحة.' : '✅ Data restored! Reloading page.');
      window.location.reload();
    } catch (err: any) {
      alert((isAr ? '❌ فشل الاستعادة: ' : '❌ Restore failed: ') + err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  // Delete a backup from history
  const deleteBackupRecord = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'backups', id));
      setBackupHistory(prev => prev.filter(b => b.id !== id));
      
      const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
      activityLogService.log('save_settings', `Delete Backup Record: ${id}`);
      notificationService.notify({
        title: isAr ? 'حذف سجل نسخة احتياطية' : 'Backup Record Deleted',
        message: isAr
          ? `تم حذف سجل النسخة الاحتياطية ${id} بواسطة ${updaterName}`
          : `Backup record ${id} deleted by ${updaterName}`,
        type: 'info',
        category: 'system'
      });
    } catch (err) {
      console.error('Failed to delete backup:', err);
    }
  };

  // ─── IMPORT ─────────────────────────
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setImportLoading(true);
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        if (!data.data && !data.settings) throw new Error(isAr ? 'ملف النسخة الاحتياطية غير صالح' : 'Invalid backup file format');
        setConfirmConfig({
          isOpen: true,
          title: isAr ? 'استعادة النسخة الاحتياطية' : 'Restore Backup',
          message: isAr
            ? `⚠️ هذا سيستبدل بيانات النظام الحالية. الفئات: ${data.collections?.join(', ') || 'الكل'}. هل تريد المتابعة؟`
            : `⚠️ This will overwrite current data. Collections: ${data.collections?.join(', ') || 'all'}. Continue?`,
          type: 'warning',
          onConfirm: async () => {
            try {
              if (data.settings) await updateSettings(data.settings);
              if (data.data) {
                for (const colName in data.data) {
                  const items = data.data[colName];
                  if (Array.isArray(items)) {
                    const batch = writeBatch(db);
                    for (const item of items) {
                      const { id, ...itemData } = item;
                      if (id) batch.set(doc(db, colName, id), itemData);
                    }
                    await batch.commit();
                  }
                }
              }
              activityLogService.log('backup_import', 'Restore from File');
              alert(isAr ? '✅ تم استعادة البيانات بنجاح!' : '✅ Data restored successfully!');
              window.location.reload();
            } catch (err: any) {
              alert((isAr ? '❌ خطأ في الاستعادة: ' : '❌ Restore error: ') + err.message);
            }
          }
        });
      } catch (err: any) {
        alert((isAr ? '❌ خطأ في قراءة الملف: ' : '❌ File parse error: ') + err.message);
      } finally {
        setImportLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // ─── RESET COUNTER ──────────────────
  const handleResetCounter = () => {
    setConfirmConfig({
      isOpen: true,
      title: isAr ? 'إعادة ضبط العداد التسلسلي' : 'Reset Order Counter',
      message: isAr
        ? 'هل أنت متأكد من إعادة ضبط عداد الطلبات؟ سيبدأ الترقيم من جديد وفق الإعدادات الجديدة.'
        : 'Reset order counter? New orders will be numbered from the configured start number.',
      onConfirm: async () => {
        await updateSettings({ orderStartNumber: localSettings.orderStartNumber });
        
        const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
        activityLogService.log('save_settings', 'Reset Order Counter');
        
        notificationService.notify({
          title: isAr ? 'إعادة ضبط عداد الطلبات' : 'Reset Order Counter',
          message: isAr
            ? `تم إعادة ضبط عداد الطلبات ليبدأ من ${localSettings.orderStartNumber} بواسطة ${updaterName}`
            : `Order counter was reset to start from ${localSettings.orderStartNumber} by ${updaterName}`,
          type: 'warning',
          category: 'system'
        });
        
        alert(isAr ? '✅ تم إعادة ضبط العداد' : '✅ Counter reset successfully');
      }
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // ─── TABS CONFIG ────────────────────
  const tabs: { id: SettingsTab; label: string; icon: any; show?: boolean }[] = [
    { id: 'interface', label: t('tabInterface'), icon: Palette, show: true },
    { id: 'general',   label: t('tabGeneral'),   icon: Settings2, show: true },
    { id: 'currency',  label: t('tabCurrency'),  icon: DollarSign, show: true },
    { id: 'admin',     label: t('tabAdmin'),      icon: Shield, show: canManageAdmin },
    { id: 'logistics', label: isAr ? 'الربط اللوجستي' : 'Logistics API', icon: Globe, show: canManageAdmin }
  ];

  const currencies = localSettings.customCurrencies || [];

  // ─── RENDER ─────────────────────────
  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-20 text-start selection:bg-[#d4af37]/30 animate-fade-slide-in" dir={isAr ? 'rtl' : 'ltr'}>

      <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
      <input type="file" ref={logoInputRef} onChange={(e) => handleLogoUpload(e, 'systemLogo')} accept="image/*" className="hidden" />
      <input type="file" ref={invoiceLogoInputRef} onChange={(e) => handleLogoUpload(e, 'invoiceLogo')} accept="image/*" className="hidden" />

      {/* ── STICKY HEADER ─────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg sticky top-4 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white leading-none mb-0.5">{t('settings')}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {isAr ? 'تهيئة النظام والإعدادات المتقدمة' : 'System Configuration & Advanced Settings'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:from-slate-800 disabled:to-slate-900 text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition shadow-md active:scale-95 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : t('saveChanges')}
        </button>
      </div>

      {/* Save Success Banner */}
      {saveSuccess && (
        <div className="bg-emerald-950/30 text-emerald-400 p-4 rounded-2xl border border-emerald-900/40 font-extrabold flex items-center gap-3 animate-fade-slide-in">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="text-xs">{isAr ? '✅ تم حفظ الإعدادات بنجاح!' : '✅ Settings saved successfully!'}</span>
        </div>
      )}

      {/* ── TABS NAV ────────────────────────── */}
      <div className="flex gap-1.5 bg-black/40 border border-slate-800/50 rounded-2xl p-1.5 overflow-x-auto">
        {tabs.filter(t => t.show !== false).map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap flex-1 justify-center ${
                isActive
                  ? 'bg-gradient-to-r from-[#d4af37]/20 to-transparent text-white border border-[#d4af37]/30 shadow-inner'
                  : 'text-slate-500 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#d4af37]' : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════ */}
      {/* TAB 1: INTERFACE                  */}
      {/* ══════════════════════════════════ */}
      {activeTab === 'interface' && (
        <div className="space-y-5 animate-fade-slide-in">
          <SectionCard title={isAr ? 'المظهر والوضع' : 'Theme & Mode'} icon={Palette}>
            <FieldLabel>{t('theme')}</FieldLabel>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'dark', label: isAr ? 'الوضع المظلم الفاخر' : 'Luxury Dark', icon: '🌙', desc: isAr ? 'خلفية داكنة وعرض ذهبي' : 'Dark background & gold accents' },
                { value: 'light', label: isAr ? 'الوضع الفاتح' : 'Light Mode', icon: '☀️', desc: isAr ? 'خلفية بيضاء وعرض مضيء' : 'Clean white background' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  disabled={!canEditInterface}
                  onClick={() => setLocalSettings({ ...localSettings, theme: opt.value as any })}
                  className={`p-4 rounded-2xl border-2 transition-all text-start ${localSettings.theme === opt.value ? 'border-[#d4af37] bg-[#d4af37]/10 shadow-[0_0_15px_rgba(212,175,55,0.15)]' : 'border-slate-800 bg-black/40 hover:border-slate-700'} ${!canEditInterface ? 'opacity-65 cursor-not-allowed' : ''}`}
                >
                  <div className="text-2xl mb-2">{opt.icon}</div>
                  <div className={`font-black text-xs uppercase tracking-wide ${localSettings.theme === opt.value ? 'text-[#d4af37]' : 'text-slate-400'}`}>{opt.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-bold">{opt.desc}</div>
                  {localSettings.theme === opt.value && <div className="mt-2 flex items-center gap-1 text-[#d4af37] text-[9px] font-black"><CheckCircle className="w-3 h-3" /> {isAr ? 'محدد' : 'Active'}</div>}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={isAr ? 'حجم الخط' : 'Font Size'} icon={Type}>
            <FieldLabel>{isAr ? 'اختر حجم خط النظام' : 'Choose system font size'}</FieldLabel>
            <div className="grid grid-cols-4 gap-3">
              {[{ value: 'sm', label: t('fontSizeSm'), px: '13px' }, { value: 'md', label: t('fontSizeMd'), px: '14px' }, { value: 'lg', label: t('fontSizeLg'), px: '15px' }, { value: 'xl', label: t('fontSizeXl'), px: '16px' }].map(opt => (
                <button key={opt.value} type="button"
                  disabled={!canEditInterface}
                  onClick={() => setLocalSettings({ ...localSettings, fontSize: opt.value as any })}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${localSettings.fontSize === opt.value ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-slate-800 bg-black/40 text-slate-400 hover:border-slate-700'} ${!canEditInterface ? 'opacity-65 cursor-not-allowed': ''}`}
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
              <button type="button" disabled={!canEditInterface} onClick={() => setLocalSettings({ ...localSettings, language: 'ar' })}
                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${localSettings.language === 'ar' ? 'bg-[#d4af37] text-black shadow-md' : 'text-slate-400 hover:text-slate-200'} ${!canEditInterface ? 'opacity-50 cursor-not-allowed' : ''}`}
              >🇾🇪 العربية</button>
              <button type="button" disabled={!canEditInterface} onClick={() => setLocalSettings({ ...localSettings, language: 'en' })}
                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${localSettings.language === 'en' ? 'bg-[#d4af37] text-black shadow-md' : 'text-slate-400 hover:text-slate-200'} ${!canEditInterface ? 'opacity-50 cursor-not-allowed' : ''}`}
              >🇺🇸 ENGLISH</button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ══════════════════════════════════ */}
      {/* TAB 2: GENERAL SYSTEM              */}
      {/* ══════════════════════════════════ */}
      {activeTab === 'general' && (
        <div className="space-y-5 animate-fade-slide-in">
          <SectionCard title={isAr ? 'هوية النظام والعلامة التجارية' : 'System Branding & Identity'} icon={Settings2}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <FieldLabel>{t('systemName')}</FieldLabel>
                <FieldInput type="text" disabled={!canEditGeneral} value={localSettings.systemName || ''} onChange={e => setLocalSettings({ ...localSettings, systemName: e.target.value })} placeholder="SwiftShip" />
              </div>
              <div>
                <FieldLabel>{t('systemLogo')}</FieldLabel>
                <div className="flex items-center gap-3">
                  {localSettings.systemLogo ? (
                    <div className="relative group">
                      <img src={localSettings.systemLogo} alt="Logo" className="w-16 h-16 object-contain rounded-xl border border-slate-800 bg-black/50 p-2" />
                      <button disabled={!canEditGeneral} onClick={() => setLocalSettings({ ...localSettings, systemLogo: '' })} className="absolute -top-2 -right-2 w-5 h-5 bg-rose-600 rounded-full flex disabled:opacity-50 disabled:cursor-not-allowed items-center justify-center opacity-0 group-hover:opacity-100 transition"><X className="w-3 h-3 text-white" /></button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-slate-800 bg-black/50 flex items-center justify-center text-slate-600"><Image className="w-6 h-6" /></div>
                  )}
                  <button type="button" disabled={!canEditGeneral} onClick={() => logoInputRef.current?.click()} className="flex-1 bg-black/40 border border-slate-800 hover:border-[#d4af37]/40 text-slate-300 hover:text-white py-3 px-4 rounded-xl text-xs font-black transition flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"><Upload className="w-4 h-4" />{isAr ? 'رفع شعار' : 'Upload Logo'}</button>
                </div>
              </div>
              <div>
                <FieldLabel>{t('orderPrefix')}</FieldLabel>
                <FieldInput type="text" disabled={!canEditGeneral} value={localSettings.orderPrefix || 'ALX'} onChange={e => setLocalSettings({ ...localSettings, orderPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="ALX" maxLength={5} className="font-mono uppercase" dir="ltr" />
                <p className="text-[10px] text-slate-500 mt-1.5 font-bold">{isAr ? `مثال: ${localSettings.orderPrefix || 'ALX'}-2601-1001` : `Example: ${localSettings.orderPrefix || 'ALX'}-2601-1001`}</p>
              </div>
              <div>
                <FieldLabel>{t('orderStartNumber')}</FieldLabel>
                <FieldInput type="number" disabled={!canEditGeneral} value={localSettings.orderStartNumber ?? 1001} onChange={e => setLocalSettings({ ...localSettings, orderStartNumber: parseInt(e.target.value) || 1001 })} min={1} className="font-mono" dir="ltr" />
              </div>
              <div className="md:col-span-2">
                <button type="button" disabled={!canEditGeneral} onClick={handleResetCounter} className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 px-4 py-2.5 rounded-xl text-xs font-black transition disabled:opacity-50 disabled:cursor-not-allowed"><RefreshCw className="w-4 h-4" />{t('resetCounter')}</button>
              </div>
            </div>
          </SectionCard>

          {canEditCompany && (
            <SectionCard title={t('companyIdentity')} icon={Building}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <FieldLabel>{isAr ? 'اسم الشركة' : 'Company Name'}</FieldLabel>
                  <FieldInput type="text" value={localSettings.companyName} onChange={e => setLocalSettings({ ...localSettings, companyName: e.target.value })} />
                </div>
                {[
                  { key: 'companyPhone', label: isAr ? 'هاتف الشركة' : 'Phone', placeholder: '+967 700 000 000', dir: 'ltr' },
                  { key: 'companyEmail', label: isAr ? 'البريد الإلكتروني' : 'Email', placeholder: 'info@company.com', dir: 'ltr' },
                  { key: 'companyWebsite', label: isAr ? 'الموقع الإلكتروني' : 'Website', placeholder: 'www.company.com', dir: 'ltr' },
                  { key: 'taxId', label: isAr ? 'الرقم الضريبي' : 'Tax ID', placeholder: 'TAX-967-001', dir: 'ltr' },
                ].map(f => (
                  <div key={f.key}>
                    <FieldLabel>{f.label}</FieldLabel>
                    <FieldInput type="text" value={(localSettings as any)[f.key] || ''} onChange={e => setLocalSettings({ ...localSettings, [f.key]: e.target.value })} placeholder={f.placeholder} dir={f.dir as any} className="font-mono" />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <FieldLabel>{isAr ? 'عنوان الشركة' : 'Company Address'}</FieldLabel>
                  <FieldTextarea rows={2} value={localSettings.companyAddress || ''} onChange={e => setLocalSettings({ ...localSettings, companyAddress: e.target.value })} />
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ══════════════════════════════════ */}
      {/* TAB 3: CURRENCIES & RATES         */}
      {/* ══════════════════════════════════ */}
      {activeTab === 'currency' && (
        <div className="space-y-5 animate-fade-slide-in">

          {/* Main Currency */}
          <SectionCard title={isAr ? 'العملة الرئيسية للنظام' : 'Main System Currency'} icon={DollarSign}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <FieldLabel locked={!canEditRates}>{t('mainCurrency')}</FieldLabel>
                <select disabled={!canEditRates} value={localSettings.currency}
                  onChange={e => {
                    const selected = currencies.find(c => c.code === e.target.value);
                    setLocalSettings({ ...localSettings, currency: e.target.value, currencySymbol: selected?.symbol || localSettings.currencySymbol });
                  }}
                  className="w-full bg-black/50 border border-slate-800 text-white rounded-xl p-3.5 text-xs font-bold outline-none focus:border-[#d4af37]/60 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {currencies.filter(c => c.isActive).map(c => (
                    <option key={c.id} value={c.code}>{c.flag} {c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel locked={!canEditRates}>{t('currencySymbol')}</FieldLabel>
                <FieldInput type="text" disabled={!canEditRates} value={localSettings.currencySymbol} onChange={e => setLocalSettings({ ...localSettings, currencySymbol: e.target.value })} className="text-center font-mono" maxLength={5} />
              </div>
            </div>
          </SectionCard>

          {/* Exchange Rates Quick View */}
          <SectionCard title={isAr ? 'أسعار الصرف الأساسية' : 'Core Exchange Rates'} icon={RefreshCw}>
            {!canEditRates && (
              <div className="flex items-center gap-2 text-amber-400 bg-amber-950/20 border border-amber-900/30 p-3 rounded-xl mb-4 text-xs font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {isAr ? 'أسعار الصرف للعرض فقط - تعديلها مخصص للمدير أو المحاسب' : 'View-only. Admin/Accountant can edit.'}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <FieldLabel locked={!canEditRates}>{t('exchangeRateSAR')}</FieldLabel>
                <div className="relative">
                  <FieldInput type="number" step="any" disabled={!canEditRates} value={localSettings.exchangeRateSAR ?? 140} onChange={e => setLocalSettings({ ...localSettings, exchangeRateSAR: parseFloat(e.target.value) || 0 })} className="font-mono" dir="ltr" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#d4af37] bg-[#d4af37]/10 px-1.5 py-0.5 rounded">SAR→YER</span>
                </div>
              </div>
              <div>
                <FieldLabel locked={!canEditRates}>{t('exchangeRateUSD')}</FieldLabel>
                <div className="relative">
                  <FieldInput type="number" step="any" disabled={!canEditRates} value={localSettings.exchangeRateUSD ?? 535} onChange={e => setLocalSettings({ ...localSettings, exchangeRateUSD: parseFloat(e.target.value) || 0 })} className="font-mono" dir="ltr" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#d4af37] bg-[#d4af37]/10 px-1.5 py-0.5 rounded">USD→YER</span>
                </div>
              </div>
            </div>
            {(localSettings.lastExchangeRateUpdate || localSettings.lastExchangeRateUpdatedBy) && (
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { icon: Clock, label: t('lastUpdateDate'), value: localSettings.lastExchangeRateUpdate || '—' },
                  { icon: Clock, label: t('lastUpdateTime'), value: localSettings.lastExchangeRateUpdateTime || '—' },
                  { icon: User, label: t('lastUpdatedBy'), value: localSettings.lastExchangeRateUpdatedBy || '—' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-black/30 rounded-xl p-3 border border-slate-800/50 flex items-start gap-2">
                    <item.icon className="w-3.5 h-3.5 text-[#d4af37] mt-0.5 shrink-0" />
                    <div><div className="text-[9px] font-black text-slate-500 uppercase">{item.label}</div><div className="text-xs font-bold text-white font-mono mt-0.5">{item.value}</div></div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── ALL CURRENCIES LIST ─────────── */}
          <SectionCard title={isAr ? 'قائمة العملات المدعومة' : 'Supported Currencies'} icon={DollarSign} badge={`${currencies.length} ${isAr ? 'عملة' : 'currencies'}`}>
            <div className="space-y-2 mb-4">
              {currencies.map(cur => (
                <div key={cur.id} className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${cur.isActive ? 'border-slate-700 bg-black/40' : 'border-slate-800/40 bg-black/20 opacity-60'}`}>
                  <span className="text-xl shrink-0">{cur.flag || '🌍'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white font-mono">{cur.code}</span>
                      <span className="text-[9px] text-slate-500 font-bold truncate">{cur.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] font-mono text-[#d4af37]">{cur.symbol}</span>
                      {editingCurrency?.id === cur.id ? (
                        <input
                          type="number"
                          value={editingCurrency.rateToYER}
                          onChange={e => setEditingCurrency({ ...editingCurrency, rateToYER: parseFloat(e.target.value) || 0 })}
                          className="w-28 bg-black/70 border border-[#d4af37]/50 rounded-lg px-2 py-0.5 text-[10px] font-mono text-white outline-none"
                          dir="ltr"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">1 {cur.code} = {cur.rateToYER} YER</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Toggle Active */}
                    {canEditRates && (
                      <button
                        onClick={() => handleUpdateCurrency(cur.id, { isActive: !cur.isActive })}
                        className={`p-1.5 rounded-lg transition ${cur.isActive ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                        title={cur.isActive ? (isAr ? 'تعطيل' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {/* Edit Rate */}
                    {canEditRates && (
                      editingCurrency?.id === cur.id ? (
                        <button
                          onClick={() => { handleUpdateCurrency(cur.id, { rateToYER: editingCurrency.rateToYER }); setEditingCurrency(null); }}
                          className="p-1.5 rounded-lg bg-[#d4af37]/15 text-[#d4af37] hover:bg-[#d4af37]/25 transition"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => setEditingCurrency(cur)} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                    {/* Delete */}
                    {canEditRates && !['USD', 'SAR'].includes(cur.id) && (
                      <button onClick={() => handleDeleteCurrency(cur.id)} className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Currency */}
            {canEditRates && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAddCurrency(!showAddCurrency)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-slate-700 hover:border-[#d4af37]/50 text-slate-500 hover:text-[#d4af37] text-xs font-black transition"
                >
                  <Plus className="w-4 h-4" />
                  {isAr ? 'إضافة عملة جديدة' : 'Add New Currency'}
                </button>

                {showAddCurrency && (
                  <div className="mt-4 p-4 bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-2xl space-y-4 animate-fade-slide-in">
                    <h4 className="text-xs font-black text-[#d4af37] uppercase tracking-wider">{isAr ? 'بيانات العملة الجديدة' : 'New Currency Details'}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <FieldLabel>{isAr ? 'الكود *' : 'Code *'}</FieldLabel>
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
                        <FieldLabel>{isAr ? 'الاسم *' : 'Name *'}</FieldLabel>
                        <FieldInput type="text" placeholder={isAr ? 'يورو' : 'Euro'} value={newCurrency.name} onChange={e => setNewCurrency({ ...newCurrency, name: e.target.value })} />
                      </div>
                      <div>
                        <FieldLabel>{isAr ? 'الرمز *' : 'Symbol *'}</FieldLabel>
                        <FieldInput type="text" placeholder="€" maxLength={5} className="text-center font-mono" value={newCurrency.symbol} onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value })} />
                      </div>
                      <div>
                        <FieldLabel>{isAr ? 'رمز الدولة' : 'Flag Emoji'}</FieldLabel>
                        <FieldInput type="text" placeholder="🇪🇺" maxLength={4} className="text-center" value={newCurrency.flag} onChange={e => setNewCurrency({ ...newCurrency, flag: e.target.value })} />
                      </div>
                      <div>
                        <FieldLabel>{isAr ? 'سعر الصرف (مقابل YER)' : 'Rate to YER'}</FieldLabel>
                        <FieldInput type="number" step="any" placeholder="580" dir="ltr" className="font-mono" value={newCurrency.rateToYER || ''} onChange={e => setNewCurrency({ ...newCurrency, rateToYER: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer pb-1">
                          <input type="checkbox" checked={newCurrency.isActive !== false} onChange={e => setNewCurrency({ ...newCurrency, isActive: e.target.checked })} className="rounded border-slate-700 bg-slate-900 text-yellow-600 focus:ring-0" />
                          <span className="text-xs font-black text-slate-400">{isAr ? 'تفعيل فوراً' : 'Enable Now'}</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleAddCurrency} className="flex-1 bg-[#d4af37] hover:bg-yellow-600 text-black py-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" />{isAr ? 'إضافة العملة' : 'Add Currency'}
                      </button>
                      <button onClick={() => { setShowAddCurrency(false); setNewCurrency({ code: '', name: '', symbol: '', flag: '', rateToYER: 0, isActive: true }); }} className="px-4 bg-black/40 border border-slate-800 text-slate-400 rounded-xl font-black text-xs transition hover:text-white">
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
      )}

      {/* ══════════════════════════════════ */}
      {/* TAB 4: ADMIN SETTINGS             */}
      {/* ══════════════════════════════════ */}
      {activeTab === 'admin' && (
        <div className="space-y-5 animate-fade-slide-in">

          {/* Order Defaults */}
          {canEditOrderDefaults && (
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
                    <FieldLabel>{f.label}</FieldLabel>
                    <div className="relative">
                      <FieldInput type="number" step="any" value={(localSettings as any)[f.key] ?? 0} onChange={e => setLocalSettings({ ...localSettings, [f.key]: parseFloat(e.target.value) || 0 })} className="font-mono pr-12" dir="ltr" />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#d4af37] bg-[#d4af37]/10 px-1.5 py-0.5 rounded">{f.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-[#d4af37]/5 border border-[#d4af37]/15 rounded-xl text-[10px] text-slate-400 font-bold">
                💡 {isAr ? 'هذه القيم ستُملأ تلقائياً عند إنشاء أي طلب جديد.' : 'These defaults auto-fill when creating new orders.'}
              </div>
            </SectionCard>
          )}

          {/* Factory / Manufacturer Order Defaults */}
          {(role === 'Admin' || hasPermission('edit_profit_per_kg') || hasPermission('edit_cbm_shipping_rate')) && (
            <SectionCard
              title={isAr ? 'إعدادات طلبات المصنع والمورد الدولي' : 'Factory & International Supplier Defaults'}
              icon={Package}
              badge={isAr ? 'شحن بالحجم' : 'CBM Freight'}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Profit per KG */}
                <div>
                  <FieldLabel locked={!(role === 'Admin' || hasPermission('edit_profit_per_kg'))}>
                    {isAr ? 'نسبة الربح للكيلو (SAR/كجم)' : 'Profit Rate per KG (SAR/kg)'}
                  </FieldLabel>
                  <div className="relative">
                    <FieldInput
                      type="number"
                      step="any"
                      disabled={!(role === 'Admin' || hasPermission('edit_profit_per_kg'))}
                      value={localSettings.defaultProfitPerKg ?? 19}
                      onChange={e => setLocalSettings({ ...localSettings, defaultProfitPerKg: parseFloat(e.target.value) || 0 })}
                      className="font-mono pr-16"
                      dir="ltr"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-400 bg-amber-950/30 px-1.5 py-0.5 rounded">SAR/kg</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 font-bold">
                    {isAr ? 'أرباح الشركة = إجمالي الوزن (كج) × هذه النسبة' : 'Company profit = Total weight (kg) × this rate'}
                  </p>
                </div>

                {/* CBM Shipping Rate */}
                <div>
                  <FieldLabel locked={!(role === 'Admin' || hasPermission('edit_cbm_shipping_rate'))}>
                    {isAr ? 'سعر شحن الـ CBM الحالي (دولار USD/m³)' : 'Current CBM Shipping Rate (USD/m³)'}
                  </FieldLabel>
                  <div className="relative">
                    <FieldInput
                      type="number"
                      step="any"
                      disabled={!(role === 'Admin' || hasPermission('edit_cbm_shipping_rate'))}
                      value={localSettings.defaultCbmShippingRate ?? 1400}
                      onChange={e => setLocalSettings({ ...localSettings, defaultCbmShippingRate: parseFloat(e.target.value) || 0 })}
                      className="font-mono pr-20"
                      dir="ltr"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400 bg-blue-950/30 px-1.5 py-0.5 rounded">SAR/m³</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 font-bold">
                    {isAr ? 'تكلفة الشحن = إجمالي CBM × هذا السعر' : 'Shipping cost = Total CBM × this rate'}
                  </p>
                </div>

                {/* CBM Rate API URL */}
                {(role === 'Admin' || hasPermission('edit_cbm_shipping_rate')) && (
                  <div className="md:col-span-2">
                    <FieldLabel>
                      {isAr ? 'رابط API لتحديث سعر الـ CBM تلقائياً (اختياري)' : 'API URL for auto-updating CBM rate (optional)'}
                    </FieldLabel>
                    <div className="flex gap-3">
                      <FieldInput
                        type="text"
                        value={localSettings.cbmShippingRateApiUrl || ''}
                        onChange={e => setLocalSettings({ ...localSettings, cbmShippingRateApiUrl: e.target.value })}
                        placeholder="https://api.example.com/cbm-rate"
                        dir="ltr"
                        className="font-mono flex-1"
                      />
                      {localSettings.cbmShippingRateApiUrl && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await fetch(localSettings.cbmShippingRateApiUrl!);
                              if (!res.ok) throw new Error('API request failed');
                              const data = await res.json();
                              const rate = data.cbm_rate || data.rate || data.value || data.price;
                              if (rate && !isNaN(parseFloat(rate))) {
                                const newRate = parseFloat(rate);
                                const now = new Date();
                                const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
                                setLocalSettings(prev => ({
                                  ...prev,
                                  defaultCbmShippingRate: newRate,
                                  lastCbmRateUpdate: now.toLocaleString(isAr ? 'ar-YE' : 'en-US'),
                                  lastCbmRateUpdatedBy: updaterName
                                }));
                                alert(isAr ? `✅ تم تحديث سعر CBM إلى: ${newRate} USD/m³` : `✅ CBM rate updated to: ${newRate} USD/m³`);
                              } else {
                                throw new Error(isAr ? 'لم يتم إيجاد سعر CBM في الاستجابة' : 'CBM rate not found in API response');
                              }
                            } catch (err: any) {
                              alert((isAr ? '❌ خطأ في جلب سعر CBM: ' : '❌ Error fetching CBM rate: ') + err.message);
                            }
                          }}
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
                  description={isAr ? 'حفظ نسخة احتياطية تلقائياً في Firestore عند انتهاء الوقت المحدد' : 'Auto-save backup to Firestore on schedule'}
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
                    { key: 'sources', label: '🗺️ ' + (isAr ? 'المصادر' : 'Sources') },
                    { key: 'users', label: '👤 ' + (isAr ? 'الموظفون' : 'Staff') },
                    { key: 'roles', label: '🛡️ ' + (isAr ? 'الأدوار' : 'Roles') },
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
                    <button key={fmt.value} type="button" onClick={() => setExportFormat(fmt.value as any)}
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
                                onConfirm: () => restoreFromFirestore(backup.id)
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
                    onConfirm: () => { localStorage.clear(); activityLogService.log('clear_cache', 'Browser LocalStorage'); window.location.reload(); }
                  })}
                  className="w-full bg-rose-500/10 text-rose-400 border border-rose-500/20 py-2.5 rounded-xl font-black text-xs hover:bg-rose-500/20 transition"
                >
                  🗑️ {isAr ? 'مسح الكاش وإعادة التحميل' : 'Clear Cache & Reload'}
                </button>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ══════════════════════════════════ */}
      {/* TAB 5: LOGISTICS                   */}
      {/* ══════════════════════════════════ */}
      {activeTab === 'logistics' && (
        <div className="space-y-5 animate-fade-slide-in">
          {canManageAdmin ? (
            <SectionCard title={isAr ? 'الربط المباشر مع شركات الشحن (API)' : 'Logistics External API Hooks'} icon={Globe} badge={isAr ? "ميزة احترافية" : "PRO"}>
              <div className="bg-black/30 border border-[#d4af37]/20 p-4 rounded-xl mb-6">
                <p className="text-xs text-[#d4af37] font-bold leading-relaxed mb-2">
                  {isAr 
                    ? 'يتيح لك هذا القسم ربط نظام التتبع بموفري الخدمات اللوجستية الخارجيين مثل AfterShip أو 17TRACK لجلب مسارات وحالات الشحنات دولياً بشكل تلقائي.'
                    : 'Bind external third-party tracking sources like AfterShip or 17Track. Enhances the customer GPS map drastically with live resolution.'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {isAr 
                    ? 'عند تفعيل الخيار، سيقوم خادم SwiftShip بالاتصال بالـ API الخارجي تلقائياً لجلب المسارات بمجرد إدخال رقم تتبع صالح.'
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
                      onClick={async () => {
                        setApiLoading(true);
                        setApiError(null);
                        try {
                          const res = await fetch('/api/tracking/test-connection', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(logisticsSettings)
                          });
                          const json = await res.json();
                          if (res.ok && json.success) {
                            alert(`✅ ${json.message}`);
                          } else {
                            setApiError(json.error || 'Connection failed');
                          }
                        } catch (err: any) {
                          setApiError(err.message);
                        } finally {
                          setApiLoading(false);
                        }
                      }}
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
      )}

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
