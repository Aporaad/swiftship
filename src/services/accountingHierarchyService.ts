import { collection, db, doc, getDoc, getDocs } from '../lib/supabase-firebase-adapter';

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
const readCode = (record: any) => String(readValue(record, 'accountCode', 'account_code') || record?.code || record?.id || '').trim();
const onlyDigits = (value: string) => String(value || '').replace(/\D/g, '');

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
    return Boolean(account?.id)
      && account?.isActive !== false
      && account?.is_active !== false
      && account?.isHierarchyNode !== true;
  }

  filterPostingAccounts(accounts: any[], requireClassified = false): any[] {
    return (accounts || []).filter((account) => {
      if (!this.isPostingAccount(account)) return false;
      return !requireClassified || Boolean(readValue(account, 'accSubId', 'acc_sub_id'));
    });
  }

  async hasHierarchyStructure(): Promise<boolean> {
    const [rootSnapshot, subSnapshot] = await Promise.all([
      getDocs(collection(db, 'account')),
      getDocs(collection(db, 'acc_sub')),
    ]);
    return !rootSnapshot.empty && !subSnapshot.empty;
  }

  async getDefaultCurrencyId(): Promise<number | undefined> {
    const snap = await getDocs(collection(db, 'currency'));
    const currency = snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .find((entry: any) => entry.isDefault === true || entry.is_default === true);
    return currency?.cur_id === undefined ? undefined : Number(currency.cur_id);
  }

  async getCurrencyIdByCode(currencyCode?: string): Promise<number | undefined> {
    const normalizedCode = String(currencyCode || '').trim().toUpperCase();
    if (!normalizedCode) return this.getDefaultCurrencyId();
    const snap = await getDocs(collection(db, 'currency'));
    const currency = snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .find((entry: any) => String(entry.code || '').toUpperCase() === normalizedCode);
    return currency?.cur_id === undefined ? undefined : Number(currency.cur_id);
  }

  async getEntityPostingLocation(entityType: LedgerEntityType): Promise<AccountGroupLocation | null> {
    const snap = await getDocs(collection(db, 'acc_sub_group'));
    const group = snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .find((entry: any) => readValue(entry, 'entityType', 'entity_type') === entityType
        && entry.isActive !== false
        && entry.is_active !== false
        && readValue(entry, 'allowsDirectAccounts', 'allows_direct_accounts') !== false);
    if (!group) return null;

    const accountCode = readCode(group);
    const accSubId = String(readValue(group, 'accSubId', 'acc_sub_id') || '').trim();
    if (!accountCode || !accSubId) return null;
    const curNo = readValue(group, 'curNo', 'cur_no');
    return { accSubId, groupId: group.id, accountCode, currencyId: curNo == null ? undefined : Number(curNo) };
  }

  async getNextAccountSequence(location: AccountGroupLocation): Promise<number> {
    const snap = await getDocs(collection(db, 'accounts'));
    const siblings = snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .filter((account: any) => {
        const sameGroup = location.groupId && readValue(account, 'groupId', 'group_id') === location.groupId;
        const sameSub = !location.groupId && readValue(account, 'accSubId', 'acc_sub_id') === location.accSubId;
        return Boolean(sameGroup || sameSub);
      });
    return hierarchyCodeRules.nextPostingSequence(location.accountCode, siblings);
  }

  async getDefaultAccount(defaultKey: string): Promise<DefaultAccountBinding | null> {
    const snap = await getDocs(collection(db, 'default_accounts'));
    const binding = snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .find((entry: any) => String(readValue(entry, 'defaultKey', 'default_key') || '') === defaultKey);
    if (!binding || binding.isActive === false || binding.is_active === false) return null;
    const accountId = String(readValue(binding, 'accountId', 'account_id') || '').trim();
    if (!accountId) return null;
    return {
      id: String(binding.id),
      defaultKey,
      accountId,
      accNameAr: String(readValue(binding, 'accNameAr', 'acc_name_ar') || binding.nameAr || ''),
      accNameEn: String(readValue(binding, 'accNameEn', 'acc_name_en') || binding.nameEn || ''),
      curNo: readValue(binding, 'curNo', 'cur_no') == null ? undefined : Number(readValue(binding, 'curNo', 'cur_no')),
      isActive: true,
    };
  }

  async resolveDefaultPostingAccount(defaultKey: string): Promise<any | null> {
    const binding = await this.getDefaultAccount(defaultKey);
    if (!binding) return null;
    const account = await getDoc(doc(db, 'accounts', binding.accountId));
    if (!account.exists()) return null;
    const resolved = { id: account.id, ...account.data() };
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
