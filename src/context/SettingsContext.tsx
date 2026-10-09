/**
 * SettingsContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * مزود إعدادات النظام — API-only
 *
 * هذا الملف يستهلك HTTP gateway فقط (settingsCurrenciesApiGateway).
 * لا يوجد أي استدعاء مباشر لـ Supabase أو Firebase أو legacy-compat.
 *
 * المصادر:
 *  - الإعدادات العامة: GET /api/v1/settings/general
 *  - إعدادات المستخدم: GET /api/v1/settings/user
 *  - العملات: GET /api/v1/currencies
 *
 * Settings Context Provider — API-only mode
 * All reads/writes go through the HTTP gateway. No Supabase listeners.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { settingsCurrenciesApiGateway } from '../data/http/settings-currencies-api.gateway';
import type { ApiCurrencyDto } from '../data/http/settings-currencies-api.gateway';
import { translations, Language, TranslationKey } from '../translations';

// ── تعريف نوع المستخدم الحالي (يُجلب من sessionStorage)
// Current user type - fetched from sessionStorage
type AuthUser = { uid: string };

// ── تعريف العملة المخصصة المعروضة في الواجهة
// Custom currency definition for UI display
export interface CustomCurrency {
  id: string;          // مفتاح فريد مثل 'EUR', 'TRY'
  code: string;        // رمز ISO: EUR, TRY, GBP …
  name: string;        // الاسم بالعربية أو الإنجليزية
  symbol: string;      // €, ₺, £ …
  rateToYER: number;   // كم ريال يمني = 1 وحدة من هذه العملة
  flag?: string;       // رمز علم: 🇪🇺
  isActive: boolean;   // هل العملة مفعلة في النظام
}

// ── واجهة الإعدادات الشاملة
// Comprehensive settings interface
export interface Settings {
  // إعدادات الواجهة / Interface Settings
  language: Language;
  theme: 'light' | 'dark';
  fontSize: 'sm' | 'md' | 'lg' | 'xl';

  // إعدادات النظام العامة / General System Settings
  systemName: string;
  systemLogo?: string;
  orderPrefix: string;
  orderStartNumber: number;

  // هوية الشركة / Company Identity
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyAddress?: string;
  taxId: string;
  invoiceLogo?: string;
  invoiceNotes?: string;

  // العملة وأسعار الصرف / Currency & Exchange Rates
  currency: string;
  currencySymbol: string;
  exchangeRateUSD?: number;
  exchangeRateSAR?: number;
  autoUpdateExchangeRates?: boolean;
  exchangeRatesApiUrl?: string;
  lastExchangeRateUpdate?: string;
  lastExchangeRateUpdateTime?: string;
  lastExchangeRateUpdatedBy?: string;
  customCurrencies?: CustomCurrency[];

  // الإعدادات اللوجستية / Logistics Defaults
  defaultPackagingFee?: number;
  defaultBankCommissionRate?: number;
  defaultCompanyProfitRate?: number;
  defaultDeliveryFee?: number;
  defaultCourierCommissionRate?: number;
  defaultOrderCurrency?: string;
  defaultProductInsuranceFee?: number;
  defaultProductInsuranceType?: 'fixed' | 'percentage';

  // مدد الشحن الافتراضية / Default Shipping Durations
  defaultSheinDuration?: number;
  defaultAppDuration?: number;
  defaultFactoryDuration?: number;
  defaultYemenDeliveryDuration?: number;
  defaultShippingDuration?: number;

  // إعدادات المصنع / Factory Defaults
  defaultProfitPerKg?: number;
  defaultCbmShippingRate?: number;
  cbmShippingRateApiUrl?: string;
  lastCbmRateUpdate?: string;
  lastCbmRateUpdatedBy?: string;

  // الأمان / Security
  protectSensitiveOrderDelete?: boolean;
  userSessionTimeout?: number;

  // النسخ الاحتياطي / Backup System
  autoBackupEnabled?: boolean;
  backupSchedule?: 'daily' | 'weekly' | 'monthly' | 'manual';
  backupRetentionDays?: number;
  backupCollections?: string[];
  backupEncrypted?: boolean;
  lastBackup?: string;
  lastAutoBackupAt?: number;
  backupCount?: number;

  // الإشعارات / Notifications
  autoNotification?: boolean;

  // لوحة التحكم (خاصة بالمستخدم) / Dashboard Settings (User Specific)
  dashboardGridColumns?: number;
  visibleMetrics?: string[];
}

// ── نوع سياق الإعدادات / Settings context type
interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  loading: boolean;
  t: (key: TranslationKey) => string;
}

// ── الإعدادات الافتراضية للنظام / Default system settings
const defaultSettings: Settings = {
  language: 'ar',
  theme: 'dark',
  fontSize: 'md',
  systemName: 'ALX',
  systemLogo: '',
  orderPrefix: 'ALX',
  orderStartNumber: 1001,
  companyName: 'الكس-تراك',
  companyPhone: '',
  companyEmail: '',
  companyWebsite: '',
  companyAddress: '',
  taxId: '',
  invoiceLogo: '',
  invoiceNotes: '',
  currency: 'YER',
  currencySymbol: 'ر.ي',
  exchangeRateUSD: 535,
  exchangeRateSAR: 140,
  autoUpdateExchangeRates: false,
  exchangeRatesApiUrl: '',
  lastExchangeRateUpdate: '',
  lastExchangeRateUpdateTime: '',
  lastExchangeRateUpdatedBy: '',
  customCurrencies: [
    { id: 'YER', code: 'YER', name: 'ريال يمني', symbol: 'ر.ي', flag: '🇾🇪', rateToYER: 1, isActive: true },
    { id: 'USD', code: 'USD', name: 'دولار أمريكي', symbol: '$', flag: '🇺🇸', rateToYER: 535, isActive: true },
    { id: 'SAR', code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', flag: '🇸🇦', rateToYER: 140, isActive: true },
  ],
  defaultPackagingFee: 0,
  defaultBankCommissionRate: 3,
  defaultCompanyProfitRate: 12,
  defaultDeliveryFee: 4000,
  defaultCourierCommissionRate: 30,
  defaultOrderCurrency: 'SAR',
  defaultProductInsuranceFee: 0,
  defaultProductInsuranceType: 'fixed',
  defaultSheinDuration: 12,
  defaultAppDuration: 10,
  defaultFactoryDuration: 20,
  defaultYemenDeliveryDuration: 5,
  defaultShippingDuration: 15,
  defaultProfitPerKg: 19,
  defaultCbmShippingRate: 1400,
  cbmShippingRateApiUrl: '',
  lastCbmRateUpdate: '',
  lastCbmRateUpdatedBy: '',
  protectSensitiveOrderDelete: true,
  userSessionTimeout: 0,
  autoBackupEnabled: false,
  backupSchedule: 'daily',
  backupRetentionDays: 30,
  backupCollections: ['orders', 'customers', 'couriers', 'sources', 'users', 'roles'],
  backupEncrypted: false,
  backupCount: 0,
};

// ── مفاتيح الإعدادات الخاصة بالمستخدم / User-specific setting keys
const USER_SPECIFIC_KEYS: (keyof Settings)[] = [
  'language',
  'theme',
  'fontSize',
  'dashboardGridColumns',
  'visibleMetrics',
];

// ── خريطة حجم الخط / Font size mapping
const FONT_SIZE_MAP: Record<string, string> = {
  sm: '13px',
  md: '14px',
  lg: '15px',
  xl: '16px',
};

// ── تحويل DTO العملة من API إلى CustomCurrency / Map API currency DTO to CustomCurrency
function mapApiCurrencyToCustomCurrency(c: ApiCurrencyDto): CustomCurrency {
  return {
    id: c.code,
    code: c.code,
    name: c.mainNameAr || c.mainNameEn || c.code,
    symbol: c.symbol || c.code,
    rateToYER: c.currentPrice ?? (c.isDefault ? 1 : 0),
    flag: c.flag ?? undefined,
    isActive: c.isActive,
  };
}

// ── استخراج معرف المستخدم الحالي من sessionStorage / Extract current user ID from sessionStorage
function getCurrentUserId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    // محاولة جلب userId من رمز الوصول المخزن
    // Try to get userId from stored access token
    const token = sessionStorage.getItem('alx_access_token') || sessionStorage.getItem('alx_api_access_token');
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return (payload?.sub as string) || (payload?.userId as string) || null;
  } catch {
    return null;
  }
}

// ── إنشاء سياق الإعدادات / Create settings context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ── فترة إعادة التحميل الدوري بالمللي ثانية (5 دقائق)
// Polling interval for settings refresh (5 minutes)
const SETTINGS_POLL_INTERVAL_MS = 5 * 60 * 1000;

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [globalSettings, setGlobalSettings] = useState<Settings>(defaultSettings);
  const [userSettings, setUserSettings] = useState<Partial<Settings>>({});
  const [loading, setLoading] = useState(true);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // دمج الإعدادات العامة مع إعدادات المستخدم / Merge global + user settings
  const settings: Settings = { ...globalSettings, ...userSettings };

  // دالة الترجمة / Translation function
  const t = useCallback((key: TranslationKey): string => {
    return translations[settings.language]?.[key] || key;
  }, [settings.language]);

  /**
   * جلب الإعدادات العامة من API
   * Fetch general settings from API
   */
  const fetchGlobalSettings = useCallback(async () => {
    try {
      const dto = await settingsCurrenciesApiGateway.getSettings('general');
      if (dto?.settings) {
        setGlobalSettings(prev => ({ ...prev, ...dto.settings }));
      }
    } catch (err) {
      console.warn('[SettingsContext] fetchGlobalSettings failed, keeping current settings:', err);
    }
  }, []);

  /**
   * جلب العملات وأسعار الصرف من API
   * Fetch currencies and exchange rates from API
   */
  const fetchCurrencies = useCallback(async () => {
    try {
      const currencies = await settingsCurrenciesApiGateway.listCurrencies(false);
      if (currencies && currencies.length > 0) {
        const mapped: CustomCurrency[] = currencies.map(mapApiCurrencyToCustomCurrency);

        // استخراج أسعار الصرف للعملات الرئيسية
        // Extract exchange rates for main currencies
        const usdCurrency = currencies.find(c => c.code === 'USD');
        const sarCurrency = currencies.find(c => c.code === 'SAR');

        setGlobalSettings(prev => ({
          ...prev,
          customCurrencies: mapped,
          exchangeRateUSD: usdCurrency?.currentPrice ?? prev.exchangeRateUSD,
          exchangeRateSAR: sarCurrency?.currentPrice ?? prev.exchangeRateSAR,
        }));
      }
    } catch (err) {
      console.warn('[SettingsContext] fetchCurrencies failed, keeping current currencies:', err);
    }
  }, []);

  /**
   * جلب إعدادات المستخدم الحالي من API
   * Fetch current user settings from API
   */
  const fetchUserSettings = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    try {
      const dto = await settingsCurrenciesApiGateway.getUserSettings();
      if (dto?.settings) {
        setUserSettings(dto.settings as Partial<Settings>);
      }
    } catch (err) {
      console.warn('[SettingsContext] fetchUserSettings failed:', err);
    }
  }, []);

  /**
   * التحميل الأولي عند بدء التطبيق
   * Initial load on app start
   */
  useEffect(() => {
    const timeout = setTimeout(() => {
      // انتهاء المهلة: استخدام الإعدادات الافتراضية
      // Timeout: use default settings
      console.warn('[SettingsContext] Settings fetch timed out — using defaults');
      setLoading(false);
    }, 6000);

    Promise.allSettled([
      fetchGlobalSettings(),
      fetchCurrencies(),
      fetchUserSettings(),
    ]).finally(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * إعادة تحميل دورية للإعدادات والعملات (بدلاً من Supabase realtime)
   * Periodic refresh for settings and currencies (replacing Supabase realtime)
   */
  useEffect(() => {
    if (loading) return;
    pollingTimerRef.current = setInterval(() => {
      void fetchGlobalSettings();
      void fetchCurrencies();
    }, SETTINGS_POLL_INTERVAL_MS);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [loading, fetchGlobalSettings, fetchCurrencies]);

  /**
   * تأثيرات تغيير الإعدادات (اتجاه الصفحة، الثيم، حجم الخط، عنوان الصفحة)
   * Side effects when settings change (RTL/LTR, theme, font size, page title)
   */
  useEffect(() => {
    // اتجاه الصفحة واللغة / Page direction and language
    if (settings.language === 'ar') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    }

    // الثيم / Theme
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light-mode');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light-mode');
    }

    // حجم الخط / Font size
    const size = FONT_SIZE_MAP[settings.fontSize || 'md'] || '14px';
    document.documentElement.style.setProperty('--system-font-size', size);
    document.documentElement.style.fontSize = size;

    // عنوان الصفحة / Page title
    document.title = settings.systemName || settings.companyName || 'SwiftShip';
  }, [settings.language, settings.theme, settings.fontSize, settings.systemName, settings.companyName]);

  /**
   * تحديث الإعدادات وإرسالها إلى API
   * Update settings and send to API
   */
  const updateSettings = useCallback(async (newSettings: Partial<Settings>): Promise<void> => {
    const userUpdates: Record<string, unknown> = {};
    const globalUpdates: Partial<Settings> = {};

    // فصل الإعدادات الخاصة بالمستخدم عن الإعدادات العامة
    // Separate user-specific settings from global settings
    Object.entries(newSettings).forEach(([key, value]) => {
      const k = key as keyof Settings;
      if (USER_SPECIFIC_KEYS.includes(k)) {
        userUpdates[k] = value;
      } else {
        Object.assign(globalUpdates, { [k]: value });
      }
    });

    // حفظ الإعدادات العامة / Save global settings
    if (Object.keys(globalUpdates).length > 0) {
      try {
        await settingsCurrenciesApiGateway.updateSettings('general', globalUpdates as import('../data/dtos/settings.dto').SystemSettingsData);
        setGlobalSettings(prev => ({ ...prev, ...globalUpdates }));
      } catch (err) {
        console.error('[SettingsContext] updateSettings (general) failed:', err);
        throw err;
      }
    }

    // حفظ إعدادات المستخدم / Save user settings
    if (Object.keys(userUpdates).length > 0) {
      const userId = getCurrentUserId();
      if (userId) {
        try {
          await settingsCurrenciesApiGateway.updateUserSettings(
            userUpdates as Parameters<typeof settingsCurrenciesApiGateway.updateUserSettings>[0]
          );
          setUserSettings(prev => ({ ...prev, ...userUpdates } as Partial<Settings>));
        } catch (err) {
          console.warn('[SettingsContext] updateUserSettings failed — saving to local state only:', err);
          // الحفظ المحلي كاحتياط / Local state fallback
          setUserSettings(prev => ({ ...prev, ...userUpdates } as Partial<Settings>));
        }
      } else {
        // المستخدم غير مسجل — الحفظ في الحالة المحلية فقط (صفحة تسجيل الدخول)
        // User not logged in — local state only (login screen language)
        setUserSettings(prev => ({ ...prev, ...userUpdates } as Partial<Settings>));
      }
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * hook للوصول إلى إعدادات النظام / Hook to access system settings
 */
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}