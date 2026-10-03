import React, { useState, useEffect, useRef } from 'react';
import { asyncState, runMutation, type AsyncState } from '../../../shared/contracts/ui.contracts';
import { collection, doc, getDocs, setDoc, writeBatch, query, orderBy, deleteDoc, db, handleSupabaseError, OperationType } from '../../../data/legacy/legacy-compat.ts';
import {
  Save, Globe, Palette, Database, DollarSign, Building, X, Upload, CheckCircle,
  ShieldAlert, RefreshCw, Archive, Settings2, Shield, FileText, Image, Type,
  Package, Download, Clock, User, Bell, Plus, Trash2, Edit3, Power,
  Calendar, HardDrive, History, Lock, Unlock, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useRole } from '../../../hooks/useRole';
import { useAuthSession } from '../../../features/auth/AuthSessionProvider';
import { useSettings } from '../../../context/SettingsContext';
import type { CustomCurrency, Settings } from '../../../context/SettingsContext';
import ConfirmModal from '../../../components/ConfirmModal';
import { activityLogService } from '../../../services/activityLogService';
import { notificationService } from '../../../services/notificationService';
import { currencyService, Currency, CurPriceEntry } from '../../../services/currencyService';
import { useExchangeRates } from '../../../hooks/useExchangeRates';
import { FieldInput, FieldLabel, FieldTextarea, SectionCard, ToggleSwitch } from './tabs/settingsHelpers';
import { InterfaceSettingsTab } from './tabs/InterfaceSettingsTab';
import { GeneralSettingsTab } from './tabs/GeneralSettingsTab';
import { CurrencySettingsTab } from './tabs/CurrencySettingsTab';
import { AdminSecuritySettingsTab } from './tabs/AdminSecuritySettingsTab';
import { LogisticsSettingsTab } from './tabs/LogisticsSettingsTab';
import type { BackupRecord, LogisticsSettings, NewCurrencyFormValues, SettingsConfirmConfig, SettingsExportFormat } from '../types';
import { CbmRateNotFoundError, fetchCbmRateFromApi } from '../services/fetchCbmRateFromApi';
import { testLogisticsConnection } from '../services/testLogisticsConnection';

type SettingsTab = 'interface' | 'general' | 'currency' | 'admin' | 'logistics';
type BackupRow = Record<string, unknown>;
type BackupPayload = { version: string; timestamp: string; createdBy: string; type: 'manual' | 'auto'; collections: string[]; settings: Settings; data: Record<string, BackupRow[]> };
const settingsErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

// ─────────────────────────────────────
// BACKUP RECORD TYPE
// ─────────────────────────────────────
// ─────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────
export default function SettingsPage() {
  const { legacyAuth: auth } = useAuthSession();
  const [saveState, setSaveState] = useState<AsyncState<void>>(asyncState.idle());
  const [operationState, setOperationState] = useState<AsyncState<void>>(asyncState.idle());
  const saving = saveState.status === 'submitting';
  const backupLoading = operationState.status === 'submitting';
  const importLoading = operationState.status === 'submitting';
  const apiLoading = operationState.status === 'submitting';
  const setBackupLoading = (value: boolean) => setOperationState(value ? asyncState.submitting() : asyncState.idle());
  const setImportLoading = setBackupLoading;
  const setApiLoading = setBackupLoading;
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('interface');
  const [exportFormat, setExportFormat] = useState<SettingsExportFormat>('json');

  // Backup history state
  const [backupHistory, setBackupHistory] = useState<BackupRecord[]>([]);
  const backupHistoryLoading = operationState.status === 'loading';
  const setBackupHistoryLoading = (value: boolean) => setOperationState(value ? asyncState.loading() : asyncState.idle());
  const [showBackupHistory, setShowBackupHistory] = useState(false);
  const [selectedRestoreId, setSelectedRestoreId] = useState<string | null>(null);

  // DB Currencies & Exchange Rates state from cur_price / currency tables
  const { currencies: dbCurrencies, activeCurrencies, rates: dbRates } = useExchangeRates();
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyCurrency, setHistoryCurrency] = useState<Currency | null>(null);
  const [historyEntries, setHistoryEntries] = useState<CurPriceEntry[]>([]);
  const historyLoading = operationState.status === 'loading';
  const setHistoryLoading = (value: boolean) => setOperationState(value ? asyncState.loading() : asyncState.idle());

  // Edit DB Currency Modal State
  const [editingDbCurrency, setEditingDbCurrency] = useState<Currency | null>(null);
  const [editDbCurrencyForm, setEditDbCurrencyForm] = useState<Partial<Currency & { newPrice?: number }>>({});
  const [editDbCurrencyModalOpen, setEditDbCurrencyModalOpen] = useState(false);

  // New DB Currency Form State
  const [newCurrency, setNewCurrency] = useState<NewCurrencyFormValues>({
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
  const [logisticsSettings, setLogisticsSettings] = useState<LogisticsSettings>({
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
  const [confirmConfig, setConfirmConfig] = useState<SettingsConfirmConfig>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'danger' });

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

    const result = await runMutation(async () => {
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
    }, setSaveState);
    if (result.status === 'error') {
      handleSupabaseError(result.error, OperationType.UPDATE, 'settings');
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
    } catch (err: unknown) {
      setApiError(settingsErrorMessage(err));
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
      const backupData: BackupPayload = {
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
        for (const [col, rows] of Object.entries(backupData.data)) {
          if (!rows.length) continue;
          const headers = Object.keys(rows[0]).join(',');
          const csvRows = rows.map((r) => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
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
      });
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
    } catch (err: unknown) {
      alert((isAr ? '❌ فشل الاستعادة: ' : '❌ Restore failed: ') + settingsErrorMessage(err));
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
            } catch (err: unknown) {
              alert((isAr ? '❌ خطأ في الاستعادة: ' : '❌ Restore error: ') + settingsErrorMessage(err));
            }
          }
        });
      } catch (err: unknown) {
        alert((isAr ? '❌ خطأ في قراءة الملف: ' : '❌ File parse error: ') + settingsErrorMessage(err));
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

  const handleFetchCbmRate = async () => {
    const apiUrl = localSettings.cbmShippingRateApiUrl;
    if (!apiUrl) return;

    try {
      const newRate = await fetchCbmRateFromApi(apiUrl);
      const now = new Date();
      const updaterName = profile?.fullName || auth.currentUser?.email || 'Unknown';
      setLocalSettings(previous => ({
        ...previous,
        defaultCbmShippingRate: newRate,
        lastCbmRateUpdate: now.toLocaleString(isAr ? 'ar-YE' : 'en-US'),
        lastCbmRateUpdatedBy: updaterName,
      }));
      alert(isAr ? `✅ تم تحديث سعر CBM إلى: ${newRate} USD/m³` : `✅ CBM rate updated to: ${newRate} USD/m³`);
    } catch (error) {
      const message = error instanceof CbmRateNotFoundError
        ? (isAr ? 'لم يتم إيجاد سعر CBM في الاستجابة' : 'CBM rate not found in API response')
        : error instanceof Error ? error.message : String(error);
      alert((isAr ? '❌ خطأ في جلب سعر CBM: ' : '❌ Error fetching CBM rate: ') + message);
    }
  };

  const handleClearCache = () => {
    localStorage.clear();
    activityLogService.log('clear_cache', 'Browser LocalStorage');
    window.location.reload();
  };

  const handleTestLogisticsConnection = async () => {
    setApiLoading(true);
    setApiError(null);
    try {
      const result = await testLogisticsConnection(logisticsSettings);
      if (result.success) {
        alert(`✅ ${result.message}`);
      } else {
        setApiError(result.error || 'Connection failed');
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : String(error));
    } finally {
      setApiLoading(false);
    }
  };

  // ─── TABS CONFIG ────────────────────
  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }>; show?: boolean }[] = [
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

            {/* ══════════════════════════════════ */}
      {/* TAB 2: GENERAL SYSTEM              */}
      {/* ══════════════════════════════════ */}
      {activeTab === 'general' && (
        <GeneralSettingsTab
          isAr={isAr}
          settings={localSettings}
          setSettings={setLocalSettings}
          canEditGeneral={canEditGeneral}
          canEditCompany={canEditCompany}
          logoInputRef={logoInputRef}
          handleResetCounter={handleResetCounter}
          t={t}
        />
      )}

            {/* ══════════════════════════════════ */}
      {/* ══════════════════════════════════ */}
      {/* TAB 3: CURRENCIES & RATES         */}
      {/* ══════════════════════════════════ */}
      {activeTab === 'currency' && (
        <CurrencySettingsTab
          isAr={isAr}
          localSettings={localSettings}
          setLocalSettings={setLocalSettings}
          t={t}
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
          handleAddCurrency={handleAddCurrency}
          fetchExchangeRates={fetchExchangeRates}
          apiLoading={apiLoading}
          apiError={apiError}
        />
      )}

      {/* ══════════════════════════════════ */}
      {/* TAB 4: ADMIN SETTINGS             */}
      {/* ══════════════════════════════════ */}
      {activeTab === 'admin' && (
        <AdminSecuritySettingsTab
          isAr={isAr}
          localSettings={localSettings}
          setLocalSettings={setLocalSettings}
          t={t}
          canViewOrderDefaults={canViewOrderDefaults}
          canEditOrderDefaults={canEditOrderDefaults}
          canManageBackup={canManageBackup}
          activeCurrencies={activeCurrencies}
          dbCurrencies={dbCurrencies}
          invoiceLogoInputRef={invoiceLogoInputRef}
          exportSelections={exportSelections}
          setExportSelections={setExportSelections}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          backupLoading={backupLoading}
          importLoading={importLoading}
          fileInputRef={fileInputRef}
          runBackup={runBackup}
          showBackupHistory={showBackupHistory}
          setShowBackupHistory={setShowBackupHistory}
          backupHistoryLoading={backupHistoryLoading}
          backupHistory={backupHistory}
          formatBytes={formatBytes}
          setConfirmConfig={setConfirmConfig}
          restoreFromSupabase={restoreFromSupabase}
          deleteBackupRecord={deleteBackupRecord}
          onFetchCbmRate={handleFetchCbmRate}
          onClearCache={handleClearCache}
        />
      )}

      {/* ══════════════════════════════════ */}
      {/* TAB 5: LOGISTICS                   */}
      {/* ══════════════════════════════════ */}
      {activeTab === 'logistics' && (
        <LogisticsSettingsTab
          isAr={isAr}
          canManageAdmin={canManageAdmin}
          logisticsSettings={logisticsSettings}
          setLogisticsSettings={setLogisticsSettings}
          apiLoading={apiLoading}
          apiError={apiError}
          onTestConnection={handleTestLogisticsConnection}
        />
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
                            {isAr ? `تاريخ التعديل: ${new Date(entry.day_date || entry.createdAt || '').toLocaleString('ar-YE')}` : `Date: ${new Date(entry.day_date || entry.createdAt || '').toLocaleString()}`}
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
