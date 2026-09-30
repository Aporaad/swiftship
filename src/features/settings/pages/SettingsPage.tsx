import { InterfaceSettingsTab } from './tabs/InterfaceSettingsTab';
import { GeneralSettingsTab } from './tabs/GeneralSettingsTab';
import { CurrencySettingsTab } from './tabs/CurrencySettingsTab';
import { AdminSecuritySettingsTab } from './tabs/AdminSecuritySettingsTab';
import { LogisticsSettingsTab } from './tabs/LogisticsSettingsTab';
import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, getDocs, setDoc, writeBatch, query, orderBy, deleteDoc, db, handleSupabaseError, OperationType } from '../../../lib/supabase-adapter';
import {
  Save, Globe, Palette, Database, DollarSign, Building, X, Upload, CheckCircle,
  ShieldAlert, RefreshCw, Archive, Settings2, Shield, FileText, Image, Type,
  Package, Download, Clock, User, Bell, Plus, Trash2, Edit3, Power,
  Calendar, HardDrive, History, Lock, Unlock, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useRole } from '../../../hooks/useRole';
import { useAuthSession } from '../../../features/auth/AuthSessionProvider';
import { useSettings } from '../../../context/SettingsContext';
import type { CustomCurrency } from '../../../context/SettingsContext';
import ConfirmModal from '../../../components/ConfirmModal';
import { activityLogService } from '../../../services/activityLogService';
import { notificationService } from '../../../services/notificationService';
import { currencyService, Currency, CurPriceEntry } from '../../../services/currencyService';
import { useExchangeRates } from '../../../hooks/useExchangeRates';

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
export default function SettingsPage() {
  const { legacyAuth: auth } = useAuthSession();
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
        <InterfaceSettingsTab
          isAr={isAr}
          settings={localSettings}
          setSettings={setLocalSettings}
          canEditInterface={canEditInterface}
          t={t}
        />
      )}

      {activeTab === 'general' && (
        <GeneralSettingsTab
          isAr={isAr}
          settings={localSettings}
          setSettings={setLocalSettings}
          canEditGeneral={canEditGeneral}
          canEditCompany={canEditCompany}
          logoInputRef={logoInputRef}
          handleLogoUpload={handleLogoUpload}
          handleResetCounter={handleResetCounter}
          t={t}
        />
      )}

      {activeTab === 'currency' && (
        <CurrencySettingsTab
          isAr={isAr}
          settings={localSettings}
          setSettings={setLocalSettings}
          canEditRates={canEditRates}
          dbCurrencies={dbCurrencies}
          handleUpdateExchangeRatePrice={handleUpdateExchangeRatePrice}
          handleViewHistory={handleViewHistory}
          handleOpenEditDbCurrencyModal={handleOpenEditDbCurrencyModal}
          handleToggleCurrencyActive={handleToggleCurrencyActive}
          handleDeleteCurrency={handleDeleteCurrency}
          showAddCurrency={showAddCurrency}
          setShowAddCurrency={setShowAddCurrency}
          newCurrency={newCurrency}
          setNewCurrency={setNewCurrency}
          t={t}
        />
      )}

      {activeTab === 'admin' && (
        <AdminSecuritySettingsTab
          isAr={isAr}
          settings={localSettings}
          setSettings={setLocalSettings}
          role={role}
          hasPermission={hasPermission}
          backupLoading={backupLoading}
          handleCreateBackup={() => runBackup('manual')}
          handleImportDatabaseJSON={() => fileInputRef.current?.click()}
        />
      )}

      {activeTab === 'logistics' && (
        <LogisticsSettingsTab
          isAr={isAr}
          settings={localSettings}
          setSettings={setLocalSettings}
          logisticsSettings={logisticsSettings}
          setLogisticsSettings={setLogisticsSettings}
        />
      )}
    </div>
  );
}
