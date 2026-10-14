/**
 * financeApi.ts
 * بوابة HTTP مشتركة لخدمات المالية — عميل واحد وفكّ غلاف موحّد وخرائط صفوف.
 * Shared finance HTTP gateway: one ApiClient instance, one envelope unwrap, and the account-row mapper
 * used by every finance service so the legacy shape is produced in exactly one place (DRY).
 */
import { appApiClient, type ApiEnvelope } from '../data/http/app-api-client';
import type { GatewayQuery } from '../data/contracts/common.gateway';
import type { AccountEntityType, FinancialAccount } from './financialAccountTypes';

/** عميل المالية هو عميل التطبيق المشترك نفسه — لا إعداد اتصال مكرر. */
export const financeApiClient = appApiClient;

export type { ApiEnvelope };

/** معاملات قراءة المالية الموسعة (تشمل مرشحات لا تعرفها GatewayQuery العامة). */
export interface FinanceQuery extends GatewayQuery {
  includeInactive?: boolean;
  automationKey?: string;
  entityId?: string;
  employeeId?: string;
  moduleId?: string;
  oldAccountId?: string;
  [key: string]: string | number | boolean | undefined;
}

/** بعض المسارات تُعيد مصفوفة في data وأخرى كائناً فيه items — موحّد للقراءتين. */
export const asRows = (payload: unknown): any[] =>
  Array.isArray(payload)
    ? (payload as any[])
    : Array.isArray((payload as any)?.items)
      ? (payload as any).items
      : [];

export const isNotFoundError = (error: unknown): boolean =>
  (error as { code?: string })?.code === 'ENTITY_NOT_FOUND';

/** يقرأ صفحة واحدة ويفكّ غلاف الاستجابة. */
export async function readFinancePage(path: string, query?: FinanceQuery): Promise<{ rows: any[]; total: number }> {
  const res = await financeApiClient.get<ApiEnvelope<unknown>>(path, query);
  return { rows: asRows(res?.data), total: Number(res?.meta?.total ?? asRows(res?.data).length) };
}

export async function readFinanceRows(path: string, query?: FinanceQuery): Promise<any[]> {
  return (await readFinancePage(path, query)).rows;
}

const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_MAX_ROWS = 20_000;

/** يقرأ كل الصفحات المتاحة حتى الحد الأقصى حمايةً من الحلقات غير المنتهية. */
export async function readAllFinanceRows(
  path: string,
  query: FinanceQuery = {},
  pageSize = DEFAULT_PAGE_SIZE,
  maxRows = DEFAULT_MAX_ROWS,
): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const page = await readFinancePage(path, { ...query, limit: pageSize, offset });
    rows.push(...page.rows);
    if (page.rows.length < pageSize || rows.length >= page.total) break;
  }
  return rows;
}

/** يقرأ سجلاً واحداً ويعيد null عندما يكون غير موجود بدل رمي خطأ. */
export async function readFinanceRecord(path: string): Promise<any | null> {
  try {
    const res = await financeApiClient.get<ApiEnvelope<any>>(path);
    return res?.data ?? null;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

/**
 * يحوّل صف الحساب القادم من alx_api إلى الشكل الذي تعرفه واجهات النظام.
 * Maps an accounts row (accountId/accountNameAr/subAccountId/currencyNo) to the legacy FinancialAccount shape.
 */
export function mapAccountRow(row: any): FinancialAccount | null {
  const accountId = String(row?.accountId ?? row?.id ?? '').trim();
  if (!accountId) return null;
  return {
    ...row,
    id: accountId,
    accountCode: String(row.accountCode ?? ''),
    accountPrefix: String(row.accountPrefix ?? ''),
    accountNumber: String(row.accountNumber ?? ''),
    entityType: row.entityType,
    entityId: String(row.entityId ?? ''),
    entityName: String(row.entityName ?? row.accountNameAr ?? row.accountNameEn ?? ''),
    currency: String(row.currency ?? ''),
    curNo: row.curNo ?? row.currencyNo ?? undefined,
    balance: Number(row.balance ?? 0),
    debitTotal: Number(row.debitTotal ?? 0),
    creditTotal: Number(row.creditTotal ?? 0),
    isActive: row.isActive !== false,
    type: row.type,
    parentCode: row.parentCode ?? undefined,
    accSubId: row.accSubId ?? row.subAccountId ?? undefined,
    groupId: row.groupId ?? undefined,
    accountSeq: row.accountSeq == null ? undefined : Number(row.accountSeq),
    accNameAr: row.accNameAr ?? row.accountNameAr ?? undefined,
    accNameEn: row.accNameEn ?? row.accountNameEn ?? undefined,
    limitedBalance: row.limitedBalance == null ? undefined : Number(row.limitedBalance),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as FinancialAccount;
}

/** مسارات تعديل الكيانات التي تحمل مرجع حسابها المالي. */
const ENTITY_API_PATH: Partial<Record<AccountEntityType, string>> = {
  customer: '/api/v1/customers',
  courier: '/api/v1/operations/couriers',
  employee: '/api/v1/operations/employees',
  source: '/api/v1/operations/sources',
  shipping_company: '/api/v1/operations/shipping-companies',
};

/**
 * يربط الحساب المالي بسجل الكيان. الفشل هنا تحذير فقط: الحساب أُنشئ ولا يجوز التراجع عنه بصمت.
 * Links the account to the entity record; a failure is reported but never hides the created account.
 */
export async function linkEntityAccount(
  entityType: AccountEntityType,
  entityId: string,
  fields: { accountId?: string; accountCode?: string; monthlySalary?: number },
): Promise<boolean> {
  const basePath = ENTITY_API_PATH[entityType];
  if (!basePath || !entityId) return false;
  const payload: Record<string, unknown> = {};
  if (fields.accountId !== undefined) payload.accountId = fields.accountId;
  if (fields.monthlySalary !== undefined) payload.monthlySalary = fields.monthlySalary;
  if (Object.keys(payload).length === 0) return false;
  try {
    await financeApiClient.patch(`${basePath}/${encodeURIComponent(entityId)}`, payload);
    return true;
  } catch (error) {
    console.warn(`[financeApi] تعذر ربط الحساب المالي بسجل ${entityType}:`, error);
    return false;
  }
}

/** التحقق من وجود قيد بمفتاح أتمتة معين — يمنع تكرار القيود التلقائية. */
export async function hasEntryForAutomationKey(automationKey: string): Promise<boolean> {
  const key = String(automationKey || '').trim();
  if (!key) return false;
  const { rows, total } = await readFinancePage('/api/v1/finance/entries', { automationKey: key, limit: 1 });
  return total > 0 || rows.some((row) => String(row?.automationKey ?? '') === key);
}

/** يعيد احتساب الأرصدة عبر الدالة الآمنة؛ بدون معرفات = كل الحسابات. */
export async function recalculateAccountBalances(
  accountIds?: string[],
): Promise<{ success: boolean; recalculatedCount: number }> {
  const res = await financeApiClient.post<ApiEnvelope<{ result?: { success?: boolean; recalculatedCount?: number } }>>(
    '/api/v1/finance/accounts/recalculate',
    accountIds && accountIds.length > 0 ? { accountIds } : {},
  );
  const result = res?.data?.result ?? {};
  return {
    success: result.success !== false,
    recalculatedCount: Number(result.recalculatedCount ?? accountIds?.length ?? 0),
  };
}
