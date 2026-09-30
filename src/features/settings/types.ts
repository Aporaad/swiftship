export type { SettingsViewModel } from '../../data/dtos/settings.dto';

export interface BackupRecord {
  id: string;
  timestamp: string;
  savedAt: number;
  createdBy: string;
  type: 'auto' | 'manual';
  collections?: string[];
  size?: number;
}

export interface SettingsConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type: 'danger' | 'warning' | 'info';
}

export interface NewCurrencyFormValues {
  code: string;
  main_nameAR: string;
  sup_nameAR: string;
  main_nameEn: string;
  sup_nameEn: string;
  symbol: string;
  flag: string;
  initialRate: number;
  isActive: boolean;
}

export type SettingsExportFormat = 'json' | 'csv';

export interface LogisticsSettings {
  enabled: boolean;
  provider: string;
  apiKey: string;
  defaultDestinationCountry?: string;
}
