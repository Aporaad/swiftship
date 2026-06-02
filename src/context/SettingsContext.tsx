import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { translations, Language, TranslationKey } from '../translations';

interface Settings {
  language: Language;
  theme: 'light' | 'dark';
  currency: string;
  currencySymbol: string;
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyAddress?: string;
  taxId: string;
  lastBackup?: string;
  autoNotification?: boolean;
  exchangeRateUSD?: number;
  exchangeRateSAR?: number;
  autoUpdateExchangeRates?: boolean;
  exchangeRatesApiUrl?: string;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  loading: boolean;
  t: (key: TranslationKey) => string;
}

const defaultSettings: Settings = {
  language: 'ar',
  theme: 'light',
  currency: 'USD',
  currencySymbol: '$',
  companyName: 'لوجي-تراك',
  companyPhone: '',
  companyEmail: '',
  companyWebsite: '',
  companyAddress: '',
  taxId: '',
  exchangeRateUSD: 535,
  exchangeRateSAR: 140,
  autoUpdateExchangeRates: false,
  exchangeRatesApiUrl: 'https://open.er-api.com/v6/latest/USD',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const t = (key: TranslationKey): string => {
    return translations[settings.language][key] || key;
  };

  // Synchronize document direction, language, and theme whenever settings are updated
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
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.language, settings.theme]);

  useEffect(() => {
    // Timeout to prevent infinite loading if Firestore is offline
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("Settings fetch timed out - using defaults");
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
      console.warn("Settings fetch warning (likely missing permissions):", error);
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
  };

  useEffect(() => {
    if (loading) return;
    if (settings.autoUpdateExchangeRates && settings.exchangeRatesApiUrl) {
      const fetchRatesOnStartup = async () => {
        try {
          const res = await fetch(settings.exchangeRatesApiUrl);
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

              // Update in Firestore silently if changed
              if (newUSD !== settings.exchangeRateUSD || newSAR !== settings.exchangeRateSAR) {
                console.log(`Auto-updating exchange rates to Firestore: USD=${newUSD}, SAR=${newSAR}`);
                // Use updated directly to avoid closure stale state
                await setDoc(doc(db, 'settings', 'general'), {
                  ...settings,
                  exchangeRateUSD: newUSD,
                  exchangeRateSAR: newSAR
                });
              }
            }
          }
        } catch (err) {
          console.warn("Failed to auto-update exchange rates on startup:", err);
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
