/**
 * accountingHierarchyService.ts
 * خدمة شجرة الحسابات والحسابات الافتراضية — API-only عبر alx_api.
 * Accounting-hierarchy and default-account service — API-only through alx_api (no legacy Supabase access).
 */
import currencyService from './currencyService';
import { readFinanceRecord, readFinanceRows as readRows } from './financeApi';

export type LedgerEntityType =
  | 'customer'
  | 'employee'
  | 'courier'
  | 'source'
  | 'shipping_company'
  | 'asset'
  | 'system';

export type HierarchyCodeKind = 'account' | 'main' | 'sub' | 'group' | 'ledger';

export interface AccountGroupLocation {
  accSubId: string;
  groupId?: string;
  accountCode: string;
  currencyId?: number;
}

export interface DefaultAccountBinding {
  id: string;
  defaultKey: string;
  accountId: string;
  accNameAr: string;
  accNameEn: string;
  curNo?: number;
  isActive: boolean;
}

const readValue = (record: any, camel: string, snake: string) => record?.[camel] ?? record?.[snake];
const readCode = (record: any) => String(readValue(record, 'accountCode', 'account_code') || record?.code || record?.accountId || record?.nodeId || record?.id || '').trim();
/** الـ API يعيد acc_sub_id باسم subAccountId بينما تستخدم الخدمات القديمة accSubId. */
const readSubAccountId = (record: any) => record?.accSubId ?? record?.acc_sub_id ?? record?.subAccountId ?? undefined;
const onlyDigits = (value: string) => String(value || '').replace(/\D/g, '');

/**
 * يحوّل صف default_accounts إلى ربط حساب افتراضي، ويعيد null للصفوف المعطّلة أو بلا حساب.
 * Maps a default_accounts row to a binding; disabled rows and rows without an account are dropped.
 */
const toDefaultBinding = (row: any): DefaultAccountBinding | null => {
  if (!row || row.isActive === false || row.is_active === false) return null;
  const accountId = String(readValue(row, 'accountId', 'account_id') || '').trim();
  const defaultKey = String(readValue(row, 'defaultKey', 'default_key') || '').trim();
  if (!accountId || !defaultKey) return null;
  return {
    id: String(row.defaultAccountId ?? row.id ?? ''),
    defaultKey,
    accountId,
    accNameAr: String(readValue(row, 'accNameAr', 'acc_name_ar') || row.nameAr || ''),
    accNameEn: String(readValue(row, 'accNameEn', 'acc_name_en') || row.nameEn || ''),
    curNo: readValue(row, 'curNo', 'cur_no') == null ? undefined : Number(readValue(row, 'curNo', 'cur_no')),
    isActive: true,
  };
};

export const naturalBalanceDelta = (
  accountType: string | undefined,
  transactionType: 'Debit' | 'Credit',
  amount: number,
): number => {
  const normalizedAmount = Number(amount || 0);
  const debitNormal = accountType === 'Asset' || accountType === 'Expense';
  if (debitNormal) return transactionType === 'Debit' ? normalizedAmount : -normalizedAmount;
  return transactionType === 'Credit' ? normalizedAmount : -normalizedAmount;
};

/** قواعد أكواد شجرة الحسابات. تظل مستقلة لتختبر وتستخدم في الواجهة والخدمة بالمنطق نفسه. */
export const hierarchyCodeRules = {
  nextRootCode(records: any[]): string {
    const used = new Set((records || []).map(readCode).filter((code) => /^\d$/.test(code)));
    let next = 1;
    while (used.has(String(next))) next += 1;
    if (next > 9) throw new Error('لا يمكن إنشاء حساب رئيسي جديد: نطاق أكواد الجذر المكوّن من رقم واحد ممتلئ.');
    return String(next);
  },

  nextChildCode(parentCode: string, records: any[]): string {
    const normalizedParent = onlyDigits(parentCode);
    if (!normalizedParent || normalizedParent.length >= 4) {
      throw new Error('رمز الأب غير صالح لإنشاء عقدة فرعية.');
    }
    const childNumbers = (records || [])
      .map(readCode)
      .filter((code) => code.startsWith(normalizedParent) && /^\d+$/.test(code))
      .map((code) => code.slice(normalizedParent.length))
      .filter((suffix) => /^\d$/.test(suffix))
      .map(Number);
    const next = Math.max(0, ...childNumbers) + 1;
    if (next > 9) throw new Error(`لا يمكن إنشاء عقدة أخرى تحت ${normalizedParent}: نطاق التسلسل ممتلئ.`);
    return `${normalizedParent}${next}`;
  },

  postingPrefix(accSubCode: string, groupCode?: string): string {
    const selected = onlyDigits(groupCode || accSubCode);
    if (!selected || selected.length > 4) {
      throw new Error('يجب اختيار حساب جزئي صالح، ومجموعة اختيارية ذات كود صالح، قبل إنشاء حساب مالي.');
    }
    return selected.padEnd(4, '0');
  },

  nextPostingSequence(prefix: string, records: any[]): number {
    const normalizedPrefix = onlyDigits(prefix);
    if (normalizedPrefix.length !== 4) throw new Error('بادئة الحساب المالي يجب أن تتكون من أربعة أرقام.');
    return (records || []).reduce((maximum, record) => {
      const explicitSequence = Number(readValue(record, 'accountSeq', 'account_seq') || 0);
      const codeMatch = readCode(record).match(new RegExp(`^${normalizedPrefix}-(\\d{1,4})$`));
      const codeSequence = codeMatch ? Number(codeMatch[1]) : 0;
      return Math.max(maximum, Number.isInteger(explicitSequence) ? explicitSequence : 0, codeSequence);
    }, 0) + 1;
  },

  formatPostingCode(prefix: string, sequence: number): string {
    const normalizedPrefix = onlyDigits(prefix);
    const normalizedSequence = Number(sequence);
    if (normalizedPrefix.length !== 4 || !Number.isInteger(normalizedSequence) || normalizedSequence < 1 || normalizedSequence > 9999) {
      throw new Error('كود الحساب المالي أو تسلسله غير صالح.');
    }
    return `${normalizedPrefix}-${String(normalizedSequence).padStart(4, '0')}`;
  },

  validateCode(kind: HierarchyCodeKind, code: string, parents: { accountCode?: string; mainCode?: string; subCode?: string; groupCode?: string }): string | null {
    const normalized = String(code || '').trim();
    if (kind === 'account') return /^\d$/.test(normalized) ? null : 'كود الحساب الرئيسي يجب أن يكون رقمًا واحدًا.';
    if (kind === 'main') return normalized === `${onlyDigits(parents.accountCode || '')}${normalized.slice(-1)}` && /^\d{2}$/.test(normalized) ? null : 'كود الحساب الفرعي يجب أن يتبع كود الحساب الرئيسي مباشرة.';
    if (kind === 'sub') return normalized === `${onlyDigits(parents.mainCode || '')}${normalized.slice(-1)}` && /^\d{3}$/.test(normalized) ? null : 'كود الحساب الجزئي يجب أن يتبع كود الحساب الفرعي مباشرة.';
    if (kind === 'group') return normalized === `${onlyDigits(parents.subCode || '')}${normalized.slice(-1)}` && /^\d{4}$/.test(normalized) ? null : 'كود المجموعة يجب أن يتبع كود الحساب الجزئي مباشرة.';

    const prefix = this.postingPrefix(parents.subCode || '', parents.groupCode);
    return new RegExp(`^${prefix}-\\d{4}$`).test(normalized)
      ? null
      : `كود الحساب المالي يجب أن يطابق ${prefix}-0001.`;
  },
};

class AccountingHierarchyService {
  /** يبقى الحساب القديم قابلاً للقيد فقط إلى أن تصنّف الحسابات في الترحيل التالي. */
  isPostingAccount(account: any): boolean {
    return Boolean(account?.id || account?.accountId)
      && account?.isActive !== false
      && account?.is_active !== false
      && account?.isHierarchyNode !== true;
  }

  filterPostingAccounts(accounts: any[], requireClassified = false): any[] {
    return (accounts || []).filter((account) => {
      if (!this.isPostingAccount(account)) return false;
      return !requireClassified || Boolean(readSubAccountId(account));
    });
  }

  /** وجود هيكل للشجرة = جذر واحد على الأقل وحساب جزئي واحد على الأقل. */
  async hasHierarchyStructure(): Promise<boolean> {
    const [rootRows, subRows] = await Promise.all([
      readRows('/api/v1/finance/hierarchy/account', { limit: 1 }),
      readRows('/api/v1/finance/hierarchy/acc-sub', { limit: 1 }),
    ]);
    return rootRows.length > 0 && subRows.length > 0;
  }

  async getDefaultCurrencyId(): Promise<number | undefined> {
    const currency = await currencyService.getDefaultCurrency();
    return currency?.cur_id === undefined || currency?.cur_id === null ? undefined : Number(currency.cur_id);
  }

  async getCurrencyIdByCode(currencyCode?: string): Promise<number | undefined> {
    const normalizedCode = String(currencyCode || '').trim().toUpperCase();
    if (!normalizedCode) return this.getDefaultCurrencyId();
    const currencies = await currencyService.getAllCurrencies(false);
    const currency = currencies.find((entry) => String(entry.code || '').toUpperCase() === normalizedCode);
    return currency?.cur_id === undefined ? undefined : Number(currency.cur_id);
  }

  /** يحدد المجموعة التي تُنشأ تحتها حسابات الكيان (entity_type) مع كودها والعملية المرتبطة بها. */
  async getEntityPostingLocation(entityType: LedgerEntityType): Promise<AccountGroupLocation | null> {
    const rows = await readRows('/api/v1/finance/hierarchy/acc-sub-group', { limit: 1000 });
    const group = rows.find((entry: any) => readValue(entry, 'entityType', 'entity_type') === entityType
      && entry.isActive !== false
      && readValue(entry, 'allowsDirectAccounts', 'allows_direct_accounts') !== false);
    if (!group) return null;

    const accountCode = readCode(group);
    const accSubId = String(readValue(group, 'accSubId', 'acc_sub_id') || '').trim();
    if (!accountCode || !accSubId) return null;
    const curNo = readValue(group, 'curNo', 'cur_no');
    const groupId = String(group.nodeId ?? group.accSubGroupId ?? group.id ?? '').trim();
    return { accSubId, groupId: groupId || undefined, accountCode, currencyId: curNo == null ? undefined : Number(curNo) };
  }

  async getNextAccountSequence(location: AccountGroupLocation): Promise<number> {
    const rows = await readRows('/api/v1/finance/accounts', { limit: 1000 });
    const siblings = rows.filter((account: any) => {
      const sameGroup = location.groupId && readValue(account, 'groupId', 'group_id') === location.groupId;
      const sameSub = !location.groupId && readSubAccountId(account) === location.accSubId;
      return Boolean(sameGroup || sameSub);
    });
    return hierarchyCodeRules.nextPostingSequence(location.accountCode, siblings);
  }

  /** قائمة الحسابات الافتراضية كاملة (المرتبطة بحساب فعلي فقط) — every default-account binding that points at a real account. */
  async listDefaultAccounts(): Promise<DefaultAccountBinding[]> {
    const rows = await readRows('/api/v1/finance/default-accounts', { limit: 1000, offset: 0 });
    return rows
      .map((row: any) => toDefaultBinding(row))
      .filter((binding: DefaultAccountBinding | null): binding is DefaultAccountBinding => binding !== null);
  }

  async getDefaultAccount(defaultKey: string): Promise<DefaultAccountBinding | null> {
    const rows = await readRows('/api/v1/finance/default-accounts', { limit: 1000, search: defaultKey });
    const binding = rows
      .map((row: any) => toDefaultBinding(row))
      .find((entry: DefaultAccountBinding | null): entry is DefaultAccountBinding => entry?.defaultKey === defaultKey);
    return binding ?? null;
  }

  async resolveDefaultPostingAccount(defaultKey: string): Promise<any | null> {
    const binding = await this.getDefaultAccount(defaultKey);
    if (!binding) return null;
    const account = await readFinanceRecord(`/api/v1/finance/accounts/${encodeURIComponent(binding.accountId)}`);
    if (!account) return null;
    const resolved = { ...account, id: account.accountId ?? binding.accountId };
    return this.isPostingAccount(resolved) ? resolved : null;
  }

  validateNaturalBalanceLimit(account: any, delta: number): void {
    const limit = Number(readValue(account, 'limitedBalance', 'limited_balance') || 0);
    if (!Number.isFinite(limit) || limit <= 0) return;
    const current = Number(readValue(account, 'balance', 'balance') || 0);
    const next = current + Number(delta || 0);
    if (next > limit) {
      throw new Error(`Account ${readCode(account)} exceeds its configured natural balance limit.`);
    }
  }
}

export const accountingHierarchyService = new AccountingHierarchyService();
