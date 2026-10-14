/**
 * expenseCategoriesService.ts
 * فئات المصروفات المخزّنة في مستند الإعدادات expense_categories — القراءة والكتابة عبر alx_api فقط.
 * Expense categories live in the `expense_categories` settings document; every read and write goes
 * through alx_api (no direct database access from the browser).
 */
import { appApiClient, type ApiEnvelope } from '../data/http/app-api-client';

export interface ExpenseCategory {
  id: string;
  labelAr: string;
  labelEn: string;
  icon?: string;
  /** الحساب المرتبط من دليل الحسابات — قد يحمل entityId لحساب نظامي قديم. */
  accountId?: string;
  accountCode?: string;
  /** الفئات النظامية لا يجوز حذفها — system categories are protected from deletion. */
  isSystem?: boolean;
}

const SETTINGS_PATH = '/api/v1/settings/expense_categories';

/** الفئات الأساسية التي تُعرض عند غياب أي تخزين على الخادم. */
export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'wages', labelAr: 'أجور التوصيل', labelEn: 'Delivery Wages', icon: '🚚', isSystem: true, accountId: 'sys_delivery_cost', accountCode: '5000-2788' },
  { id: 'marketing', labelAr: 'تسويق وإعلانات', labelEn: 'Marketing', icon: '📈' },
  { id: 'office', labelAr: 'مستلزمات مكتبية', labelEn: 'Office Supplies', icon: '📎' },
  { id: 'maintenance', labelAr: 'صيانة وإصلاح', labelEn: 'Maintenance', icon: '🔧' },
  { id: 'fuel', labelAr: 'وقود ومحروقات', labelEn: 'Fuel', icon: '⛽' },
  { id: 'rent', labelAr: 'إيجارات', labelEn: 'Rent', icon: '🏢' },
  { id: 'salary', labelAr: 'رواتب موظفين', labelEn: 'Salaries', icon: '👨‍💼', isSystem: true },
  { id: 'custody', labelAr: 'عهدة مناديب', labelEn: 'Custody / Receivables', icon: '💳', isSystem: true },
  { id: 'factory', labelAr: 'دفعات المصانع', labelEn: 'Factory Payouts', icon: '🏭', isSystem: true },
  { id: 'other', labelAr: 'أخرى', labelEn: 'Other', icon: '📄', isSystem: true },
];

interface SettingsRecord {
  settingId?: string;
  category?: string;
  settings?: { data?: unknown };
}

/** المستند القديم يخزن المصفوفة داخل settings.data — نقبل الصفوف الصالحة فقط. */
function asCategoryList(value: unknown): ExpenseCategory[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is ExpenseCategory =>
      Boolean(entry) && typeof entry === 'object' && typeof (entry as ExpenseCategory).id === 'string',
  );
}

async function readStored(): Promise<ExpenseCategory[]> {
  try {
    const response = await appApiClient.get<ApiEnvelope<SettingsRecord>>(SETTINGS_PATH);
    return asCategoryList(response?.data?.settings?.data);
  } catch (error) {
    if ((error as { code?: string } | null)?.code === 'SETTINGS_NOT_FOUND') return [];
    throw error;
  }
}

async function writeStored(categories: ExpenseCategory[]): Promise<ExpenseCategory[]> {
  await appApiClient.patch<ApiEnvelope<SettingsRecord>>(SETTINGS_PATH, { settings: { data: categories } });
  return categories;
}

export const expenseCategoriesService = {
  /**
   * يعيد القائمة الفعّالة: المخزّن على الخادم، أو الافتراضية عندما لا يوجد مستند بعد.
   * Returns the effective list — stored categories, or the defaults when nothing is stored yet.
   */
  async list(): Promise<ExpenseCategory[]> {
    const stored = await readStored();
    return stored.length > 0 ? stored : DEFAULT_EXPENSE_CATEGORIES;
  },

  /**
   * إضافة فئة بعد قراءة حالة الخادم أولًا حتى لا تُمسح إضافات متزامنة.
   * Read-modify-write against the server state so concurrent additions are never clobbered.
   */
  async add(category: ExpenseCategory): Promise<ExpenseCategory[]> {
    const id = category.id.trim();
    if (!id) throw new Error('معرّف الفئة مطلوب.');
    const current = await this.list();
    if (current.some((entry) => entry.id === id)) throw new Error(`الفئة «${id}» موجودة مسبقًا.`);
    return writeStored([...current, { ...category, id, isSystem: false }]);
  },

  async update(id: string, patch: Partial<Omit<ExpenseCategory, 'id'>>): Promise<ExpenseCategory[]> {
    const current = await this.list();
    if (!current.some((entry) => entry.id === id)) throw new Error(`الفئة «${id}» غير موجودة.`);
    return writeStored(current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  },

  /** حذف فئة غير نظامية — النظامية مرفوضة لأن القيود التلقائية تعتمد عليها. */
  async remove(id: string): Promise<ExpenseCategory[]> {
    const current = await this.list();
    const target = current.find((entry) => entry.id === id);
    if (!target) throw new Error(`الفئة «${id}» غير موجودة.`);
    if (target.isSystem) throw new Error('لا يمكن حذف فئة نظامية.');
    return writeStored(current.filter((entry) => entry.id !== id));
  },
};
