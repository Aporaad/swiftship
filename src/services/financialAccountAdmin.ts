/**
 * financialAccountAdmin.ts
 * إدارة دليل الحسابات يدويًا: إنشاء وتعديل وحذف وقراءة حركات الحساب — عبر alx_api فقط.
 * Manual chart-of-accounts administration (create / update / guarded delete / movements) over alx_api.
 *
 * لماذا وحدة مستقلة؟ لأن financialAccountAccounts تختص بحسابات الكيانات المولّدة تلقائيًا،
 * بينما هذه الوحدة تخدم الحسابات التي ينشئها المحاسب يدويًا من دليل الحسابات.
 * Kept apart from financialAccountAccounts (auto-generated entity accounts): this module serves the
 * accounts an accountant creates by hand in the chart of accounts.
 */
import { financeApiClient, mapAccountRow, readAllFinanceRows, type ApiEnvelope } from './financeApi';
import type { FinancialAccount } from './financialAccountTypes';

const ACCOUNTS_PATH = '/api/v1/finance/accounts';

/** الحقول التي يقبلها API عند إنشاء/تعديل حساب — mirrors the strict financialAccountSchema. */
export interface FinancialAccountInput {
  accountCode?: string | null;
  accountNumber?: string | null;
  accountPrefix?: string | null;
  /** موقع الحساب في الشجرة — parent detail account and optional subgroup. */
  accSubId?: string | null;
  groupId?: string | null;
  accountSeq?: number | null;
  limitedBalance?: number | null;
  curNo?: number | null;
  accNameAr?: string | null;
  accNameEn?: string | null;
  entityName?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  type?: string | null;
  currency?: string | null;
  balance?: number | null;
  isActive?: boolean | null;
  notes?: string | null;
}

/**
 * نتيجة الحذف: الحساب المرتبط بحركات لا يُحذف أبدًا بل يُعطَّل.
 * Deletion outcome — an account referenced by ledger lines is never deleted, only deactivated.
 */
export type AccountDeletionResult =
  | { status: 'deleted'; accountId: string }
  | { status: 'in_use'; accountId: string; message: string }
  | { status: 'not_found'; accountId: string; message: string };

/** حركة حساب كما يعيدها API (مرحّلة فقط). */
export interface AccountMovement {
  transactionId?: string;
  entryId?: string;
  entryNumber?: string;
  /** تصنيف القيد كما يعيده الخادم — entry category exposed as `module`. */
  module?: string;
  transType?: string;
  amount?: number;
  amountOriginal?: number;
  currencyOriginalNo?: number;
  description?: string;
  note?: string;
  entityType?: string;
  entityId?: string;
  orderId?: string;
  createdAt?: string | number;
  [key: string]: unknown;
}

/** يستخرج رقم الحساب من آخر مقطع في الرمز — the legacy code split, but safe for codes without a dash. */
export function accountNumberFromCode(accountCode: string): string {
  const code = String(accountCode || '').trim();
  const segments = code.split('-');
  return segments.length > 1 ? segments[segments.length - 1].trim() : code;
}

function readErrorCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

function unwrapAccount(payload: unknown, fallbackMessage: string): FinancialAccount {
  const account = mapAccountRow(payload);
  if (!account) throw new Error(fallbackMessage);
  return account;
}

/** إنشاء حساب يدوي بمعرّف صريح — creates an account with an explicit id (the legacy `acc_<code>` scheme). */
export async function createFinancialAccount(
  accountId: string,
  input: FinancialAccountInput,
): Promise<FinancialAccount> {
  const id = String(accountId || '').trim();
  if (!id) throw new Error('معرّف الحساب مطلوب.');
  const response = await financeApiClient.post<ApiEnvelope<unknown>>(ACCOUNTS_PATH, { ...input, accountId: id });
  return unwrapAccount(response?.data, 'استجابة غير صالحة من خدمة الحسابات.');
}

/** تعديل حقول حساب قائم — PATCH replaces only the provided fields. */
export async function updateFinancialAccount(
  accountId: string,
  input: FinancialAccountInput,
): Promise<FinancialAccount> {
  const id = String(accountId || '').trim();
  if (!id) throw new Error('معرّف الحساب مطلوب.');
  const response = await financeApiClient.patch<ApiEnvelope<unknown>>(
    `${ACCOUNTS_PATH}/${encodeURIComponent(id)}`,
    input,
  );
  return unwrapAccount(response?.data, 'استجابة غير صالحة من خدمة الحسابات.');
}

/**
 * حذف حساب بلا حركات. الحساب المستخدم يُعاد كـ in_use بدل رمي خطأ حتى تشرح الواجهة السبب.
 * Deletes an unused account; an in-use one returns `in_use` so the UI can explain instead of failing blindly.
 */
export async function deleteFinancialAccount(accountId: string): Promise<AccountDeletionResult> {
  const id = String(accountId || '').trim();
  if (!id) throw new Error('معرّف الحساب مطلوب.');
  try {
    await financeApiClient.delete<ApiEnvelope<{ accountId?: string; deleted?: boolean }>>(
      `${ACCOUNTS_PATH}/${encodeURIComponent(id)}`,
    );
    return { status: 'deleted', accountId: id };
  } catch (error) {
    const code = readErrorCode(error);
    const message = (error as { message?: string } | null)?.message ?? '';
    if (code === 'FINANCE_ACCOUNT_IN_USE') return { status: 'in_use', accountId: id, message };
    if (code === 'ENTITY_NOT_FOUND') return { status: 'not_found', accountId: id, message };
    throw error;
  }
}

/** حركات الحساب المرحّلة فقط — posted movements only, exactly as the API filters them. */
export async function listAccountMovements(accountId: string): Promise<AccountMovement[]> {
  const id = String(accountId || '').trim();
  if (!id) return [];
  const rows = await readAllFinanceRows(`${ACCOUNTS_PATH}/${encodeURIComponent(id)}/movements`);
  return rows as AccountMovement[];
}

/** تعطيل حساب مستخدم بدل حذفه — the sanctioned alternative when ledger history exists. */
export async function deactivateFinancialAccount(accountId: string): Promise<FinancialAccount> {
  return updateFinancialAccount(accountId, { isActive: false });
}
