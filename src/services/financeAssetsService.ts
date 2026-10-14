/**
 * financeAssetsService.ts
 * خدمة الأصول الثابتة: القراءة والتسجيل والحذف وسجلات الصيانة عبر alx_api فقط.
 * Fixed-asset operations (list / register / delete / maintenance logs) run through alx_api exclusively —
 * no browser-side database access and no legacy adapter.
 */
import { financeApiClient, readAllFinanceRows, type ApiEnvelope } from './financeApi';
import { financialAccountService } from './financialAccountService';

export type AssetCategory = 'Vehicles' | 'Inspection' | 'Office' | 'Computers' | 'Other';
export type AssetType = 'Fixed' | 'NonFixed';
export type AssetStatus = 'Active' | 'UnderMaintenance' | 'Retired';
export type MaintenanceType = 'Preventive' | 'Repair' | 'Overhaul';

export interface MaintenanceLog {
  logId: string;
  cost: number;
  currency: string;
  type: MaintenanceType;
  notes: string;
  doneBy: string;
  date: string;
  createdAt: number;
}

export interface FinancialAsset {
  id: string;
  assetCode: string;
  nameAr: string;
  nameEn: string;
  category: AssetCategory;
  type: AssetType;
  cost: number;
  currency: string;
  purchaseDate: string;
  assignedCourierId: string | null;
  assignedCourierName: string | null;
  status: AssetStatus;
  notes: string;
  maintenanceLogs: MaintenanceLog[];
  isActive: boolean;
  /** مرجع الحساب المالي للأصل — financial account reference created with the asset. */
  financialAccountId?: string;
  financialAccountCode?: string;
  createdAt?: number | string;
}

/** بيانات تسجيل أصل جديد من نموذج الواجهة — registration payload coming from the UI form. */
export interface AssetRegistration {
  assetCode: string;
  nameAr: string;
  nameEn: string;
  category: AssetCategory;
  type: AssetType;
  cost: number | string;
  currency: string;
  purchaseDate: string;
  assignedCourierId?: string | null;
  assignedCourierName?: string | null;
  status: AssetStatus;
  notes?: string;
}

export interface MaintenanceLogInput {
  cost: number | string;
  currency: string;
  type: MaintenanceType;
  notes?: string;
  doneBy?: string;
  date: string;
}

/** شجرة حسابات الأصول: لكل فئة بادئة وحساب أب — category → account prefix/parent in the chart of accounts. */
export const ASSET_ACCOUNTING: Record<AssetCategory, { prefix: string; parentCode: string; nameAr: string }> = {
  Vehicles: { prefix: '1210', parentCode: '1210', nameAr: 'سيارات ومعدات لوجستية' },
  Inspection: { prefix: '1220', parentCode: '1220', nameAr: 'أجهزة تفتيش ومستودعات' },
  Office: { prefix: '1230', parentCode: '1230', nameAr: 'أثاث وتجهيزات مكتبية' },
  Computers: { prefix: '1240', parentCode: '1240', nameAr: 'أجهزة حاسوب وتقنية' },
  Other: { prefix: '1250', parentCode: '1250', nameAr: 'أصول ثابتة أخرى' },
};

const ASSETS_PATH = '/api/v1/finance/assets';

/** معرّف الأصل مشتق من رمزه ليبقى متوافقًا مع الصفوف المخزّنة وحساباتها المالية. */
/** The asset id is derived from its code so stored rows and their accounts keep matching. */
export const buildAssetId = (assetCode: string): string => `asset${String(assetCode || '').trim()}`;

const toText = (value: unknown): string => (value == null ? '' : String(value));
const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** عمود maintenance_logs قد يرجع نصًا مخزّنًا قديمًا — نصّفه ونقبل السجلات الصالحة فقط. */
function toMaintenanceLogs(value: unknown): MaintenanceLog[] {
  let rows: unknown = value;
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      logId: toText(entry.logId ?? entry.log_id),
      cost: toNumber(entry.cost),
      currency: toText(entry.currency),
      type: (toText(entry.type) || 'Repair') as MaintenanceType,
      notes: toText(entry.notes),
      doneBy: toText(entry.doneBy ?? entry.done_by),
      date: toText(entry.date),
      createdAt: toNumber(entry.createdAt ?? entry.created_at),
    }));
}

function mapAssetRow(row: any): FinancialAsset | null {
  const id = toText(row?.assetId ?? row?.id).trim();
  if (!id) return null;
  return {
    id,
    assetCode: toText(row.assetCode ?? row.asset_code),
    nameAr: toText(row.nameAr ?? row.name_ar),
    nameEn: toText(row.nameEn ?? row.name_en),
    category: (toText(row.category) || 'Other') as AssetCategory,
    type: (toText(row.type) || 'Fixed') as AssetType,
    cost: toNumber(row.cost),
    currency: toText(row.currency),
    purchaseDate: toText(row.purchaseDate ?? row.purchase_date),
    assignedCourierId: row.assignedCourierId ?? row.assigned_courier_id ?? null,
    assignedCourierName: row.assignedCourierName ?? row.assigned_courier_name ?? null,
    status: (toText(row.status) || 'Active') as AssetStatus,
    notes: toText(row.notes),
    maintenanceLogs: toMaintenanceLogs(row.maintenanceLogs ?? row.maintenance_logs),
    isActive: row.isActive !== false && row.is_active !== false,
    financialAccountId: toText(row.accountId ?? row.account_id) || undefined,
    financialAccountCode: toText(row.accountCode ?? row.account_code) || undefined,
    createdAt: row.createdAt ?? row.created_at,
  };
}

/** يبني سجل صيانة بمعرّف فريد — unique log id keeps maintenance rows distinguishable in reports/PDF. */
export function createMaintenanceLog(input: MaintenanceLogInput): MaintenanceLog {
  return {
    logId: `MNT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    cost: toNumber(input.cost),
    currency: input.currency,
    type: input.type,
    notes: input.notes ?? '',
    doneBy: input.doneBy ?? '',
    date: input.date,
    createdAt: Date.now(),
  };
}

function unwrapAsset(payload: unknown): FinancialAsset {
  const asset = mapAssetRow(payload);
  if (!asset) throw new Error('استجابة غير صالحة من خدمة الأصول.');
  return asset;
}

export const financeAssetsService = {
  /** كل الأصول النشطة والمتوقفة — الصفوف مرتبة من الخادم كما هي. */
  async list(): Promise<FinancialAsset[]> {
    const rows = await readAllFinanceRows(ASSETS_PATH);
    return rows
      .map(mapAssetRow)
      .filter((asset): asset is FinancialAsset => asset !== null);
  },

  /**
   * تسجيل أصل: يُنشأ حسابه المالي أولًا ثم يُكتب صف الأصل حاملًا مرجع الحساب.
   * Registering an asset creates its financial account first, then stores the row referencing it.
   */
  async register(registration: AssetRegistration): Promise<FinancialAsset> {
    const assetCode = registration.assetCode.trim();
    if (!assetCode) throw new Error('رمز الأصل مطلوب.');
    if (!registration.nameAr.trim() || !registration.nameEn.trim()) throw new Error('اسم الأصل مطلوب بالعربية والإنجليزية.');
    const cost = toNumber(registration.cost);
    if (cost <= 0) throw new Error('تكلفة الأصل يجب أن تكون أكبر من صفر.');

    const assetId = buildAssetId(assetCode);
    const accounting = ASSET_ACCOUNTING[registration.category] ?? ASSET_ACCOUNTING.Other;
    const account = await financialAccountService.createAccountForEntity(
      'asset',
      assetId,
      `${assetCode} — ${registration.nameAr}`,
      registration.currency,
      undefined,
      {
        accountPrefix: accounting.prefix,
        parentCode: accounting.parentCode,
        accountType: 'Asset',
        notes: `حساب أصل ثابت: ${accounting.nameAr}`,
        updateEntity: false,
      },
    );

    const response = await financeApiClient.post<ApiEnvelope<any>>(ASSETS_PATH, {
      assetId,
      assetCode,
      nameAr: registration.nameAr.trim(),
      nameEn: registration.nameEn.trim(),
      category: registration.category,
      type: registration.type,
      cost,
      currency: registration.currency,
      purchaseDate: registration.purchaseDate,
      assignedCourierId: registration.assignedCourierId || null,
      assignedCourierName: registration.assignedCourierName || null,
      status: registration.status,
      notes: registration.notes || null,
      accountId: account.id,
      accountCode: account.accountCode || null,
      isActive: true,
      maintenanceLogs: [],
    });
    return unwrapAsset(response?.data);
  },

  /** حذف أصل وسجلات صيانته — deletes the asset row together with its maintenance history. */
  async remove(assetId: string): Promise<void> {
    const id = String(assetId || '').trim();
    if (!id) throw new Error('معرّف الأصل مطلوب.');
    await financeApiClient.delete<ApiEnvelope<{ deleted: boolean }>>(`${ASSETS_PATH}/${encodeURIComponent(id)}`);
  },

  /**
   * إضافة سجل صيانة: قراءة-تعديل-كتابة على القائمة الحالية حتى لا تُمسح سجلات سابقة.
   * Appends to the asset's current logs (read-modify-write) so no prior entry is lost.
   */
  async appendMaintenanceLog(asset: FinancialAsset, log: MaintenanceLog): Promise<FinancialAsset> {
    const response = await financeApiClient.patch<ApiEnvelope<any>>(
      `${ASSETS_PATH}/${encodeURIComponent(asset.id)}`,
      { maintenanceLogs: [...(asset.maintenanceLogs ?? []), log] },
    );
    return unwrapAsset(response?.data);
  },
};
