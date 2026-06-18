import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { translations, Language, TranslationKey } from '../translations';

// Custom currency definition
export interface CustomCurrency {
  id: string;          // unique key e.g. 'EUR', 'TRY'
  code: string;        // ISO code: EUR, TRY, GBP …
  name: string;        // Arabic/English name: يورو
  symbol: string;      // €, ₺, £ …
  rateToYER: number;   // How many YER per 1 unit of this currency
  flag?: string;       // emoji flag: 🇪🇺
  isActive: boolean;   // show/hide in the system
}

export interface Settings {
  // Interface Settings
  language: Language;
  theme: 'light' | 'dark';
  fontSize: 'sm' | 'md' | 'lg' | 'xl';

  // General System Settings
  systemName: string;
  systemLogo?: string; // Base64 encoded logo
  orderPrefix: string;
  orderStartNumber: number;

  // Company Identity
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyAddress?: string;
  taxId: string;
  invoiceLogo?: string; // Base64 encoded logo for invoices
  invoiceNotes?: string; // Default notes for PDF invoices

  // Currency & Exchange Rates
  currency: string;
  currencySymbol: string;
  exchangeRateUSD?: number;
  exchangeRateSAR?: number;
  autoUpdateExchangeRates?: boolean;
  exchangeRatesApiUrl?: string;
  lastExchangeRateUpdate?: string;
  lastExchangeRateUpdateTime?: string;
  lastExchangeRateUpdatedBy?: string;
  // Custom currencies list
  customCurrencies?: CustomCurrency[];

  // Management - Order Defaults
  defaultPackagingFee?: number;
  defaultBankCommissionRate?: number;
  defaultCompanyProfitRate?: number;
  defaultDeliveryFee?: number;
  defaultCourierCommissionRate?: number;

  // Default Shipping Durations
  defaultSheinDuration?: number;
  defaultAppDuration?: number;
  defaultFactoryDuration?: number;
  defaultYemenDeliveryDuration?: number;
  defaultShippingDuration?: number;

  // Factory / Manufacturer Order Defaults
  defaultProfitPerKg?: number;          // نسبة الربح للكيلو (SAR/kg) للمصنع
  defaultCbmShippingRate?: number;      // سعر شحن الـ CBM (SAR/m³) للمصنع
  cbmShippingRateApiUrl?: string;       // رابط API لتحديث سعر CBM تلقائياً
  lastCbmRateUpdate?: string;           // آخر تحديث لسعر CBM
  lastCbmRateUpdatedBy?: string;        // من حدّث سعر CBM

  // Security & Protection
  protectSensitiveOrderDelete?: boolean;

  // Backup System
  autoBackupEnabled?: boolean;
  backupSchedule?: 'daily' | 'weekly' | 'monthly' | 'manual';
  backupRetentionDays?: number;    // how many days to keep Firestore auto backups
  backupCollections?: string[];    // which collections to backup
  backupEncrypted?: boolean;       // whether to encrypt the backup
  lastBackup?: string;
  lastAutoBackupAt?: number;
  backupCount?: number;            // total backups taken so far

  // Notifications
  autoNotification?: boolean;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  loading: boolean;
  t: (key: TranslationKey) => string;
}

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
  currency: 'SAR',
  currencySymbol: 'ر.س',
  exchangeRateUSD: 535,
  exchangeRateSAR: 140,
  autoUpdateExchangeRates: false,
  exchangeRatesApiUrl: 'https://open.er-api.com/v6/latest/USD',
  lastExchangeRateUpdate: '',
  lastExchangeRateUpdateTime: '',
  lastExchangeRateUpdatedBy: '',
  customCurrencies: [
    { id: 'USD', code: 'USD', name: 'دولار أمريكي', symbol: '$', flag: '🇺🇸', rateToYER: 535, isActive: true },
    { id: 'SAR', code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', flag: '🇸🇦', rateToYER: 140, isActive: true },
    { id: 'EUR', code: 'EUR', name: 'يورو', symbol: '€', flag: '🇪🇺', rateToYER: 580, isActive: true },
    { id: 'AED', code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', flag: '🇦🇪', rateToYER: 145, isActive: true },
    { id: 'TRY', code: 'TRY', name: 'ليرة تركية', symbol: '₺', flag: '🇹🇷', rateToYER: 16, isActive: false },
    { id: 'GBP', code: 'GBP', name: 'جنيه إسترليني', symbol: '£', flag: '🇬🇧', rateToYER: 680, isActive: false },
  ],
  defaultPackagingFee: 0,
  defaultBankCommissionRate: 3,
  defaultCompanyProfitRate: 12,
  defaultDeliveryFee: 4000,
  defaultCourierCommissionRate: 30,
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
  autoBackupEnabled: false,
  backupSchedule: 'daily',
  backupRetentionDays: 30,
  backupCollections: ['orders', 'customers', 'couriers', 'sources', 'users', 'roles'],
  backupEncrypted: false,
  backupCount: 0,
};


const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const FONT_SIZE_MAP: Record<string, string> = {
  sm: '13px',
  md: '14px',
  lg: '15px',
  xl: '16px',
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const t = (key: TranslationKey): string => {
    return translations[settings.language]?.[key] || key;
  };

  // Synchronize document direction, language, theme, and font-size whenever settings change
  useEffect(() => {
    if (settings.language === 'ar') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    }

    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light-mode');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light-mode');
    }

    // Apply font size
    const size = FONT_SIZE_MAP[settings.fontSize || 'md'] || '14px';
    document.documentElement.style.setProperty('--system-font-size', size);
    document.documentElement.style.fontSize = size;

    // Apply document title
    document.title = settings.systemName || settings.companyName || 'SwiftShip';
  }, [settings.language, settings.theme, settings.fontSize, settings.systemName, settings.companyName]);

  useEffect(() => {
    // Timeout to prevent infinite loading if Firestore is offline
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Settings fetch timed out - using defaults');
        setLoading(false);
      }
    }, 5000);

    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Settings;
        setSettings(prev => ({ ...prev, ...data }));
      }
      setLoading(false);
      clearTimeout(timeout);
    }, (error) => {
      console.warn('Settings fetch warning (likely missing permissions):', error);
      setLoading(false);
      clearTimeout(timeout);
    });

    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    await setDoc(doc(db, 'settings', 'general'), updated);
    // Optimistic update
    setSettings(updated);
  };

  // Auto-update exchange rates on startup if enabled
  useEffect(() => {
    if (loading) return;
    if (settings.autoUpdateExchangeRates && settings.exchangeRatesApiUrl) {
      const fetchRatesOnStartup = async () => {
        try {
          const res = await fetch(settings.exchangeRatesApiUrl!);
          if (res.ok) {
            const data = await res.json();
            if (data && data.rates) {
              const sarRate = data.rates.SAR || 3.75;
              const yerRate = data.rates.YER;

              let newUSD = settings.exchangeRateUSD || 535;
              let newSAR = settings.exchangeRateSAR || 140;

              if (yerRate && yerRate > 300) {
                newUSD = Math.round(yerRate);
                newSAR = parseFloat((yerRate / sarRate).toFixed(2));
              } else {
                newSAR = parseFloat((newUSD / sarRate).toFixed(2));
              }

              if (newUSD !== settings.exchangeRateUSD || newSAR !== settings.exchangeRateSAR) {
                const now = new Date();
                await setDoc(doc(db, 'settings', 'general'), {
                  ...settings,
                  exchangeRateUSD: newUSD,
                  exchangeRateSAR: newSAR,
                  lastExchangeRateUpdate: now.toLocaleDateString('ar-YE'),
                  lastExchangeRateUpdateTime: now.toLocaleTimeString('ar-YE'),
                });
              }
            }
          }
        } catch (err) {
          console.warn('Failed to auto-update exchange rates on startup:', err);
        }
      };
      fetchRatesOnStartup();
    }
  }, [loading, settings.autoUpdateExchangeRates, settings.exchangeRatesApiUrl]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}