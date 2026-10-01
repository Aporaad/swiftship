/**
 * @file reports.types.ts
 * @description Types, interfaces, and constants for the Reports feature
 * الأنواع والثوابت الخاصة بصفحة التقارير
 */

import {
  TrendingUp, FileText, Package, ShoppingCart, Truck,
  Users, UserCheck, Layers
} from 'lucide-react';
import type { ReportAccount } from '../report-row-types';

// ─── Filter Interface ───────────────────────────────────────────────────────
export interface ReportFilter {
  startDate: string;
  endDate: string;
  type: string;
  accountId?: string;
  categoryId?: string;
  entityId?: string;
}

// ─── Print Template Settings Interface ─────────────────────────────────────
export interface PrintTemplateSettings {
  headerTitleAr: string;
  headerTitleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  footerTextAr: string;
  footerTextEn: string;
  logoUrl: string;
  showLogo: boolean;
  paperSize: 'A4' | 'A4_Landscape' | '80mm' | '58mm';
  margins: 'none' | 'minimal' | 'default';
  fontSize: 'xs' | 'sm' | 'md' | 'lg';
  showBarcode: boolean;
  showSignatures: boolean;
  showDateTime: boolean;
  showTaxId: boolean;
  taxNumber: string;
  primaryColor: string;
  fontFamily?: 'Cairo' | 'Inter' | 'JetBrains Mono' | 'Segoe UI';
  signature1Ar?: string;
  signature1En?: string;
  signature2Ar?: string;
  signature2En?: string;
  signature3Ar?: string;
  signature3En?: string;
  tableStyle?: 'solid' | 'dashed' | 'minimal';
}

// ─── Default Print Settings ─────────────────────────────────────────────────
export const DEFAULT_PRINT_SETTINGS: PrintTemplateSettings = {
  headerTitleAr: 'سويفت شيب للخدمات اللوجستية ش.م.م',
  headerTitleEn: 'alx Logistics L.L.C',
  subtitleAr: 'الشحن السريع • النقل البري • التجميع الذكي',
  subtitleEn: 'Express Cargo & Procurement Services',
  footerTextAr: 'يسرنا خدمتكم دائماً. يرجى مراجعة محتويات السند والتوقيع فور الاستلام.',
  footerTextEn: 'Pleasure serving you. Please verify item details and sign upon reception.',
  logoUrl: '',
  showLogo: true,
  paperSize: 'A4',
  margins: 'default',
  fontSize: 'sm',
  showBarcode: true,
  showSignatures: true,
  showDateTime: true,
  showTaxId: true,
  taxNumber: 'TR-10049539-X03',
  primaryColor: '#d4af37',
  fontFamily: 'Cairo',
  signature1Ar: 'توقيع المستلم والعميل',
  signature1En: 'Recipient Signature',
  signature2Ar: 'اعتماد المحاسب المسؤول والتدقيق',
  signature2En: 'Auditor Acknowledgment',
  signature3Ar: 'المدير العام والختم',
  signature3En: 'General Director Stamp',
  tableStyle: 'solid'
};

// ─── Chart Colors ───────────────────────────────────────────────────────────
export const REPORT_COLORS = ['#d4af37', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#f59e0b'];

// ─── Report Types Definition ────────────────────────────────────────────────
export const REPORT_TYPES = [
  { id: 'financial_overview', labelAr: 'التحليل المالي والأرباح العام', labelEn: 'Financial Overview & Profits', icon: TrendingUp },
  { id: 'expenses', labelAr: 'تقرير المصروفات التفصيلي', labelEn: 'Detailed Expenses', icon: FileText },
  { id: 'packaging', labelAr: 'تقرير رسوم التغليف وتكاليف شحن محلي', labelEn: 'Packaging & Other Costs', icon: Package },
  { id: 'orders_cost', labelAr: 'تقرير تكاليف الطلبات والشحنات', labelEn: 'Orders Cost Analysis', icon: ShoppingCart },
  { id: 'shipping_companies', labelAr: 'تقرير شركات الشحن والعمولات', labelEn: 'Shipping Companies Report', icon: Truck },
  { id: 'customers', labelAr: 'تقرير كشف العملاء والذمم والمديونيات', labelEn: 'Customers Ledger & Balances', icon: Users },
  { id: 'couriers', labelAr: 'تقرير المناديب والتحصيلات والعهدة المعلقة', labelEn: 'Couriers Registry & Custodies', icon: Truck },
  { id: 'users', labelAr: 'تقرير حسابات المستخدمين والرواتب', labelEn: 'Users & Staff Salaries', icon: UserCheck },
  { id: 'account_ledger', labelAr: 'تقرير تفصيلي لأي حساب (شجرة الحسابات)', labelEn: 'Detailed Account Ledger', icon: Layers },
];

// ─── MultiAccountSelector Props ─────────────────────────────────────────────
export interface MultiAccountSelectorProps {
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  labelAr: string;
  labelEn: string;
  accounts: ReportAccount[];
  isAr: boolean;
  onSave?: () => void;
}
