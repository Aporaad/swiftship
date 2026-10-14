/**
 * financialAccountPurge.ts
 * تطهير البصمة المالية لكيان (عميل/مندوب/موظف/مستخدم) — API-only عبر alx_api.
 * Entity financial-footprint purge — API-only through alx_api (the SECURITY DEFINER rpc owns the deletion order).
 */
import { financeApiClient } from './financeApi';

export type PurgeableEntityType = 'customer' | 'courier' | 'user' | 'employee' | 'source' | 'shipping_company';

/** الواجهة تستخدم المفرد والـ API يستخدم اسم الجدول الجمع. */
const PURGE_TABLE_BY_TYPE: Record<PurgeableEntityType, string> = {
  customer: 'customers',
  courier: 'couriers',
  user: 'users',
  employee: 'employees',
  source: 'sources',
  shipping_company: 'shipping_companies',
};

/** ترجمة أكواد المنع القادمة من قاعدة البيانات إلى رسالة يفهمها المستخدم. */
const BLOCKED_REASON_AR: Array<[RegExp, string]> = [
  [/PURGE_BLOCKED_CUSTOMER_HAS_ORDERS/, 'تعذر الحذف: هذا العميل مرتبط بطلبات مسجلة. فكّ ارتباط الطلبات أو احذفها أولاً ثم أعد المحاولة.'],
  [/PURGE_BLOCKED_COURIER_HAS_OPEN_CUSTODY/, 'تعذر الحذف: على هذا المندوب عُهد غير مسدّدة. صفِّ العُهد المفتوحة أولاً ثم أعد المحاولة.'],
  [/PURGE_ENTITY_TYPE_NOT_ALLOWED/, 'نوع الكيان غير مسموح بتطهيره مالياً.'],
  [/PURGE_ENTITY_ID_REQUIRED/, 'معرّف الكيان مطلوب لتنفيذ التطهير.'],
];

const humanizePurgeError = (error: unknown): Error => {
  const message = error instanceof Error ? error.message : String(error);
  const matched = BLOCKED_REASON_AR.find(([pattern]) => pattern.test(message));
  return new Error(matched ? `${matched[1]} (${message})` : message);
};

/**
 * يحذف الحساب المالي وقيوده وكيانه عبر مسار واحد آمن ثم يعيد احتساب الأرصدة.
 * Deletes the entity's accounts, entries and the entity row through the guarded rpc, then recalculates balances.
 */
export async function purgeEntityAndFinancialFootprint(
  service: { recalculateAllBalances: () => Promise<unknown> },
  entityType: PurgeableEntityType,
  entityId: string,
): Promise<Record<string, unknown> | null> {
  const table = PURGE_TABLE_BY_TYPE[entityType];
  if (!table) throw new Error(`نوع الكيان غير مدعوم للتطهير المالي: ${String(entityType)}`);
  if (!String(entityId || '').trim()) throw new Error('معرّف الكيان مطلوب لتنفيذ التطهير.');

  try {
    const res = await financeApiClient.post<{ success: boolean; data: { result?: Record<string, unknown> } }>(
      `/api/v1/finance/entities/${table}/${encodeURIComponent(entityId)}/purge`,
      {},
    );
    await service.recalculateAllBalances();
    return res?.data?.result ?? null;
  } catch (error) {
    console.error('[purgeEntityAndFinancialFootprint] Purge failed:', error);
    throw humanizePurgeError(error);
  }
}
