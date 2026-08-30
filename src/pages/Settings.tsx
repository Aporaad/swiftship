import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, getDocs, setDoc, writeBatch, query, orderBy, deleteDoc, db, handleSupabaseError, OperationType } from '../lib/supabase-firebase-adapter';
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
import { currencyService, Currency, CurPriceEntry } from '../services/currencyService';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { auth } from '../lib/supabase-firebase-adapter';

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

  // DB Currencies & Exchange Rates state from cur_price / currency tables
  const { currencies: dbCurrencies, activeCurrencies, rates: dbRates } = useExchangeRates();
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyCurrency, setHistoryCurrency] = useState<Currency | null>(null);
  const [historyEntries, setHistoryEntries] = useState<CurPriceEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Edit DB Currency Modal State
  const [editingDbCurrency, setEditingDbCurrency] = useState<Currency | null>(null);
  const [editDbCurrencyForm, setEditDbCurrencyForm] = useState<Partial<Currency & { newPrice?: number }>>({});
  const [editDbCurrencyModalOpen, setEditDbCurrencyModalOpen] = useState(false);

  // New DB Currency Form State
  const [newCurrency, setNewCurrency] = useState<{
    code: string;
    main_nameAR: string;
    sup_nameAR: string;
    main_nameEn: string;
    sup_nameEn: string;
    symbol: string;
    flag: string;
    initialRate: number;
    isActive: boolean;
  }>({
    code: '',
    main_nameAR: '',
    sup_nameAR: '',
    main_nameEn: '',
    sup_nameEn: '',
    symbol: '',
    flag: '',
    initialRate: 0,
    isActive: true,
  });
  const [showAddCurrency, setShowAddCurrency] = useState(false);

  const { role, hasPermission, loading: roleLoading, profile } = useRole();
  const canEditInterface = role === 'Admin' || hasPermission('edit_interface_settings');
  const canEditGeneral = role === 'Admin' || hasPermission('edit_general_settings');
  const canEditCompany = role === 'Admin' || hasPermission('edit_company_info');
  const canEditRates = role === 'Admin' || hasPermission('edit_exchange_rates');
  // view_order_defaults: can VIEW the section (read-only). edit_order_defaults: can EDIT fields.
  const canViewOrderDefaults = role === 'Admin' || hasPermission('view_order_defaults') || hasPermission('edit_order_defaults');
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
    expenses: true, accounts: true, main_entry: true, salary_history: true,
    activity_logs: true, account_trans: true, backups: false,
    settings: true, report_accounts: true, expense_categories: true, automatic_voucher_rules: true
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
    if (globalSettings.backupCollections && Array.isArray(globalSettings.backupCollections)) {
      const sel: Record<string, boolean> = {
        orders: false, customers: false, couriers: false, sources: false, users: false, roles: false,
        expenses: false, accounts: false, main_entry: false, salary_history: false,
        activity_logs: false, account_trans: false, backups: false,
        settings: false, report_accounts: false, expense_categories: false, automatic_voucher_rules: false
      };
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

  // Load backup history from Supabase
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
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'danger' });

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
      handleSupabaseError(error, OperationType.UPDATE, 'settings');
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

  // ─── CURRENCY & EXCHANGE RATE DATABASE MANAGEMENT ─────

  const handleViewHistory = async (currency: Currency) => {
    setHistoryLoading(true);
    setHistoryCurrency(currency);
    setHistoryModalOpen(true);
    try {
      const entries = await currencyService.getRateHistory(currency.cur_id);
      setHistoryEntries(entries);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAddCurrency = async () => {
    if (!newCurrency.code || !newCurrency.main_nameAR || !newCurrency.symbol) {
      alert(isAr ? 'يرجى ملء جميع الحقول الإلزامية (الكود، الاسم الرئيسي بالعربي، الرمز)' : 'Please fill all required fields (code, main_nameAR, symbol)');
      return;
    }
    const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
    const res = await currencyService.addCurrency(
      {
        code: newCurrency.code.toUpperCase(),
        main_nameAR: newCurrency.main_nameAR,
        sup_nameAR: newCurrency.sup_nameAR || '',
        main_nameEn: newCurrency.main_nameEn || newCurrency.code.toUpperCase(),
        sup_nameEn: newCurrency.sup_nameEn || '',
        symbol: newCurrency.symbol,
        flag: newCurrency.flag || '🌍',
        isActive: newCurrency.isActive !== false,
        initialRate: newCurrency.initialRate || 1,
      },
      updaterName
    );

    if (!res.success) {
      alert(isAr ? `فشل إدراج العملة: ${res.error}` : `Failed to add currency: ${res.error}`);
      return;
    }

    activityLogService.log('change_exchange_rate', `Add Currency: ${newCurrency.code}`, { rate: newCurrency.initialRate });
    notificationService.notify({
      title: isAr ? 'إضافة عملة جديدة' : 'New Currency Added',
      message: isAr
        ? `تم إضافة العملة ${newCurrency.code} (${newCurrency.main_nameAR}) بسعر صرف ${newCurrency.initialRate} YER بنجاح`
        : `Currency ${newCurrency.code} added with rate ${newCurrency.initialRate} YER successfully`,
      type: 'success',
      category: 'finance'
    });

    setNewCurrency({
      code: '',
      main_nameAR: '',
      sup_nameAR: '',
      main_nameEn: '',
      sup_nameEn: '',
      symbol: '',
      flag: '',
      initialRate: 0,
      isActive: true,
    });
    setShowAddCurrency(false);
  };

  const handleOpenEditDbCurrencyModal = (cur: Currency) => {
    setEditingDbCurrency(cur);
    setEditDbCurrencyForm({
      code: cur.code,
      main_nameAR: cur.main_nameAR,
      sup_nameAR: cur.sup_nameAR || '',
      main_nameEn: cur.main_nameEn || '',
      sup_nameEn: cur.sup_nameEn || '',
      symbol: cur.symbol || '',
      flag: cur.flag || '',
      isActive: cur.isActive,
      newPrice: cur.currentPrice || 0,
    });
    setEditDbCurrencyModalOpen(true);
  };

  const handleSaveEditDbCurrency = async () => {
    if (!editingDbCurrency) return;
    const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';

    // 1. Update currency metadata
    const updateRes = await currencyService.updateCurrency(editingDbCurrency.cur_id, {
      code: editDbCurrencyForm.code?.toUpperCase(),
      main_nameAR: editDbCurrencyForm.main_nameAR,
      sup_nameAR: editDbCurrencyForm.sup_nameAR,
      main_nameEn: editDbCurrencyForm.main_nameEn,
      sup_nameEn: editDbCurrencyForm.sup_nameEn,
      symbol: editDbCurrencyForm.symbol,
      flag: editDbCurrencyForm.flag,
      isActive: editDbCurrencyForm.isActive,
    });

    if (!updateRes.success) {
      alert(isAr ? `فشل حفظ التعديلات: ${updateRes.error}` : `Update failed: ${updateRes.error}`);
      return;
    }

    // 2. Update rate if modified
    if (editDbCurrencyForm.newPrice && editDbCurrencyForm.newPrice !== editingDbCurrency.currentPrice && editingDbCurrency.code !== 'YER') {
      await currencyService.addExchangeRatePrice(editingDbCurrency.cur_id, editDbCurrencyForm.newPrice, updaterName);
    }

    activityLogService.log('change_exchange_rate', `Edit Currency ${editingDbCurrency.code}`, editDbCurrencyForm);
    notificationService.notify({
      title: isAr ? 'تعديل بيانات العملة' : 'Currency Metadata Updated',
      message: isAr
        ? `تم تحديث بيانات العملة ${editingDbCurrency.code} بواسطة ${updaterName}`
        : `Currency ${editingDbCurrency.code} metadata updated by ${updaterName}`,
      type: 'info',
      category: 'finance'
    });

    setEditDbCurrencyModalOpen(false);
    setEditingDbCurrency(null);
  };

  const handleUpdateExchangeRatePrice = async (curId: number, code: string, newRate: number) => {
    if (!newRate || newRate <= 0) return;
    const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
    const res = await currencyService.addExchangeRatePrice(curId, newRate, updaterName);

    if (!res.success) {
      alert(isAr ? `فشل تحديث سعر الصرف: ${res.error}` : `Failed to update rate: ${res.error}`);
      return;
    }

    activityLogService.log('change_exchange_rate', `Update Rate ${code}`, { newRate, seq: res.newSeq, updatedBy: updaterName });
    notificationService.notify({
      title: isAr ? 'تحديث سعر الصرف' : 'Exchange Rate Updated',
      message: isAr
        ? `تم تحديث سعر صرف ${code} إلى ${newRate} (تسلسل #${res.newSeq}) بواسطة ${updaterName}`
        : `Rate for ${code} updated to ${newRate} (seq #${res.newSeq}) by ${updaterName}`,
      type: 'info',
      category: 'finance'
    });
  };

  const handleToggleCurrencyActive = async (curId: number, code: string, currentActive: boolean) => {
    const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
    const res = await currencyService.toggleActive(curId, !currentActive);
    if (!res.success) {
      alert(isAr ? `فشل تغيير حالة التفعيل: ${res.error}` : `Failed to toggle active: ${res.error}`);
      return;
    }

    activityLogService.log('change_exchange_rate', `Toggle Active ${code}`, { active: !currentActive, updatedBy: updaterName });
    notificationService.notify({
      title: isAr ? 'تغيير حالة العملة' : 'Currency Status Changed',
      message: isAr
        ? `تم ${!currentActive ? 'تفعيل' : 'تعطيل'} العملة ${code} بواسطة ${updaterName}`
        : `Currency ${code} was ${!currentActive ? 'enabled' : 'disabled'} by ${updaterName}`,
      type: 'warning',
      category: 'finance'
    });
  };

  const handleDeleteCurrency = async (curId: number, code: string) => {
    if (['USD', 'SAR', 'YER'].includes(code.toUpperCase())) {
      alert(isAr ? 'لا يمكن حذف العملات الأساسية (YER, USD, SAR)' : 'Cannot delete built-in currencies (YER, USD, SAR)');
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: isAr ? 'حذف العملة' : 'Delete Currency',
      message: isAr
        ? `هل أنت متأكد من حذف العملة ${code} وسجل أسعار الصرف الخاص بها نهائياً من قاعدة البيانات؟`
        : `Are you sure you want to permanently delete currency ${code} and its rate history?`,
      type: 'danger',
      onConfirm: async () => {
        const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
        const res = await currencyService.deleteCurrency(curId);
        if (!res.success) {
          alert(isAr ? `تعذر الحذف: ${res.error}` : `Delete failed: ${res.error}`);
          return;
        }
        activityLogService.log('change_exchange_rate', `Delete Currency: ${code}`);
        notificationService.notify({
          title: isAr ? 'حذف عملة' : 'Currency Deleted',
          message: isAr
            ? `تم حذف العملة ${code} وسجلها التاريخي بواسطة ${updaterName}`
            : `Currency ${code} and its history deleted by ${updaterName}`,
          type: 'warning',
          category: 'finance'
        });
      }
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

      // Save to Supabase backups table
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
        // Add UTF-8 BOM for Excel Arabic support
        const csvContent = '\uFEFF' + csvParts.join('\n\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alx_Backup_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alx_Backup_${new Date().toISOString().split('T')[0]}.json`;
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

  // Restore from Supabase backup
  const restoreFromSupabase = async (backupId: string) => {
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
      activityLogService.log('backup_import', `Restore from Supabase: ${backupId}`);

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
      type: 'warning',
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
    { id: 'general', label: t('tabGeneral'), icon: Settings2, show: true },
    { id: 'currency', label: t('tabCurrency'), icon: DollarSign, show: true },
    { id: 'admin', label: t('tabAdmin'), icon: Shield, show: canManageAdmin || canManageBackup || canViewOrderDefaults },
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap flex-1 justify-center ${isActive
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
                  className={`p-3 rounded-xl border-2 transition-all text-center ${localSettings.fontSize === opt.value ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-slate-800 bg-black/40 text-slate-400 hover:border-slate-700'} ${!canEditInterface ? 'opacity-65 cursor-not-allowed' : ''}`}
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
                <FieldInput type="text" disabled={!canEditGeneral} value={localSettings.systemName || ''} onChange={e => setLocalSettings({ ...localSettings, systemName: e.target.value })} placeholder="alx" />
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
                        onClick={() => handleToggleCurrencyActive(cur.cur_id, cur.code, cur.isActive)}
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
      )}

      {/* ══════════════════════════════════ */}
      {/* TAB 4: ADMIN SETTINGS             */}
      {/* ══════════════════════════════════ */}
      {activeTab === 'admin' && (
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
                  <select
                    disabled={!canEditOrderDefaults}
                    value={localSettings.defaultOrderCurrency || 'SAR'}
                    onChange={e => canEditOrderDefaults && setLocalSettings({ ...localSettings, defaultOrderCurrency: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-[#d4af37] disabled:opacity-65 cursor-pointer font-mono"
                  >
                    {(activeCurrencies && activeCurrencies.length > 0 ? activeCurrencies : dbCurrencies).map(c => (
                      <option key={c.cur_id || c.code} value={c.code}>
                        {c.code} - {c.main_nameAR || c.main_nameEn || c.code} ({c.symbol || c.code})
                      </option>
                    ))}
                  </select>
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
                    { key: 'journal_entries', label: '📝 ' + (isAr ? 'القيود' : 'Journal') },
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

      {/* ── RATE HISTORY MODAL (seq audit trail log) ── */}
      {historyModalOpen && historyCurrency && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-slide-in">
          <div className="bg-[#121215] border border-[#d4af37]/30 rounded-3xl p-6 max-w-xl w-full space-y-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{historyCurrency.flag || '🌍'}</span>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span>{isAr ? `سجل أسعار الصرف التاريخي (${historyCurrency.code})` : `Rate History - ${historyCurrency.code}`}</span>
                    <span className="text-xs text-[#d4af37] font-mono font-bold">({historyCurrency.main_nameAR})</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {isAr ? `المعرف cur_id = ${historyCurrency.cur_id} • السلسلة التاريخية المتصاعدة seq` : `cur_id = ${historyCurrency.cur_id} • Ascending sequence audit trail`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setHistoryModalOpen(false); setHistoryCurrency(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 border border-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {historyLoading ? (
                <div className="py-12 text-center text-xs font-mono text-[#d4af37] animate-pulse">
                  {isAr ? 'جاري تحميل السجل التاريخي...' : 'Loading history log...'}
                </div>
              ) : historyEntries.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-slate-500">
                  {isAr ? 'لا يوجد سجل أسعار صرف مسجل لهذه العملة.' : 'No rate history logged yet.'}
                </div>
              ) : (
                historyEntries.map((entry, idx) => {
                  const isLatest = idx === historyEntries.length - 1;
                  return (
                    <div
                      key={entry.id || entry.seq}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${isLatest
                          ? 'bg-[#d4af37]/10 border-[#d4af37]/40 shadow-[0_0_15px_rgba(212,175,55,0.05)]'
                          : 'bg-black/40 border-slate-850 hover:border-slate-800'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-black ${isLatest ? 'bg-[#d4af37] text-black' : 'bg-slate-900 text-slate-400 border border-slate-800'
                          }`}>
                          seq #{entry.seq}
                        </span>
                        <div>
                          <div className="text-xs font-black text-white font-mono dir-ltr">
                            1 {historyCurrency.code} = <span className="text-[#d4af37] font-bold">{entry.price}</span> YER
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {isAr ? `تاريخ التعديل: ${new Date(entry.day_date || entry.createdAt).toLocaleString('ar-YE')}` : `Date: ${new Date(entry.day_date || entry.createdAt).toLocaleString()}`}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono text-[10px] text-slate-400 shrink-0">
                        <span className="block font-bold text-slate-300">{isAr ? `بواسطة: ${entry.updateBy || 'غير محدد'}` : `By: ${entry.updateBy || 'N/A'}`}</span>
                        {isLatest && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {isAr ? 'السعر الحالي' : 'Active Rate'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => { setHistoryModalOpen(false); setHistoryCurrency(null); }}
                className="px-6 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-black transition cursor-pointer"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT CURRENCY MODAL ── */}
      {editDbCurrencyModalOpen && editingDbCurrency && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-slide-in">
          <div className="bg-[#121215] border border-[#d4af37]/30 rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-white">
                <Edit3 className="w-5 h-5 text-[#d4af37]" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {isAr
                    ? `تعديل كافة بيانات العملة - ${editingDbCurrency.main_nameAR} (${editingDbCurrency.code})`
                    : `Edit Currency Specifications - ${editingDbCurrency.code}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setEditDbCurrencyModalOpen(false); setEditingDbCurrency(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>{isAr ? 'كود العملة (code) *' : 'Code *'}</FieldLabel>
                <FieldInput
                  type="text"
                  maxLength={5}
                  disabled={['USD', 'SAR', 'YER'].includes(editingDbCurrency.code.toUpperCase())}
                  value={editDbCurrencyForm.code || ''}
                  onChange={e => setEditDbCurrencyForm({ ...editDbCurrencyForm, code: e.target.value.toUpperCase() })}
                  className="font-mono uppercase"
                  dir="ltr"
                />
              </div>
              <div>
                <FieldLabel>{isAr ? 'الاسم الرئيسي بالعربي (main_nameAR) *' : 'Main Name AR *'}</FieldLabel>
                <FieldInput
                  type="text"
                  value={editDbCurrencyForm.main_nameAR || ''}
                  onChange={e => setEditDbCurrencyForm({ ...editDbCurrencyForm, main_nameAR: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel>{isAr ? 'اسم الفئة الفرعية بالعربي (sup_nameAR)' : 'Sub Name AR'}</FieldLabel>
                <FieldInput
                  type="text"
                  value={editDbCurrencyForm.sup_nameAR || ''}
                  onChange={e => setEditDbCurrencyForm({ ...editDbCurrencyForm, sup_nameAR: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel>{isAr ? 'الاسم الرئيسي بالإنجليزي (main_nameEn)' : 'Main Name EN'}</FieldLabel>
                <FieldInput
                  type="text"
                  value={editDbCurrencyForm.main_nameEn || ''}
                  onChange={e => setEditDbCurrencyForm({ ...editDbCurrencyForm, main_nameEn: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div>
                <FieldLabel>{isAr ? 'اسم الفئة الفرعية بالإنجليزي (sup_nameEn)' : 'Sub Name EN'}</FieldLabel>
                <FieldInput
                  type="text"
                  value={editDbCurrencyForm.sup_nameEn || ''}
                  onChange={e => setEditDbCurrencyForm({ ...editDbCurrencyForm, sup_nameEn: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div>
                <FieldLabel>{isAr ? 'الرمز (symbol) *' : 'Symbol *'}</FieldLabel>
                <FieldInput
                  type="text"
                  maxLength={6}
                  value={editDbCurrencyForm.symbol || ''}
                  onChange={e => setEditDbCurrencyForm({ ...editDbCurrencyForm, symbol: e.target.value })}
                  className="text-center font-mono"
                />
              </div>
              <div>
                <FieldLabel>{isAr ? 'رمز علم الدولة (flag)' : 'Flag Emoji'}</FieldLabel>
                <FieldInput
                  type="text"
                  maxLength={4}
                  value={editDbCurrencyForm.flag || ''}
                  onChange={e => setEditDbCurrencyForm({ ...editDbCurrencyForm, flag: e.target.value })}
                  className="text-center"
                />
              </div>
              {editingDbCurrency.code !== 'YER' && (
                <div>
                  <FieldLabel>{isAr ? 'تحديث سعر الصرف (سيعمل تسلسل جديد seq+1)' : 'Update Exchange Rate (seq+1)'}</FieldLabel>
                  <FieldInput
                    type="number"
                    step="any"
                    value={editDbCurrencyForm.newPrice || ''}
                    onChange={e => setEditDbCurrencyForm({ ...editDbCurrencyForm, newPrice: parseFloat(e.target.value) || 0 })}
                    className="font-mono"
                    dir="ltr"
                  />
                </div>
              )}
              <div className="md:col-span-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editDbCurrencyForm.isActive !== false}
                    onChange={e => setEditDbCurrencyForm({ ...editDbCurrencyForm, isActive: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-yellow-600 focus:ring-0"
                  />
                  <span className="text-xs font-black text-slate-300">
                    {isAr ? 'حالة التفعيل (isActive) - السماح بأنشطة القيود والمعاملات المالية' : 'Active Status (isActive)'}
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setEditDbCurrencyModalOpen(false); setEditingDbCurrency(null); }}
                className="px-5 py-2.5 bg-black/40 border border-slate-800 text-slate-400 rounded-xl text-xs font-bold transition hover:text-white"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveEditDbCurrency}
                className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl text-xs transition shadow-md flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isAr ? 'حفظ التعديلات' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}