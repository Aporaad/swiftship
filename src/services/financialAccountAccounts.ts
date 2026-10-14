/**
 * financialAccountAccounts.ts
 * إنشاء الحسابات المالية للكيانات وتوليد معرفاتها — API-only عبر alx_api.
 * Entity financial-account creation and identifier generation — API-only through alx_api.
 */
import { activityLogService } from './activityLogService';
import { accountingHierarchyService, hierarchyCodeRules } from './accountingHierarchyService';
import { financeApiClient, linkEntityAccount, mapAccountRow, readAllFinanceRows } from './financeApi';
import { LEGACY_ACCOUNT_PREFIXES } from './financialAccountTypes';
import type { AccountEntityType, FinancialAccount } from './financialAccountTypes';

/** الأنواع التي تُصنَّف التزاماً (دائن بطبيعته) وما عداها أصل. */
const LIABILITY_ENTITY_TYPES: AccountEntityType[] = ['courier', 'employee', 'source', 'shipping_company'];

/**
 * يولّد معرفات حساب غير مكررة: accountNumber و accountCode و code و accountId.
 * Generates strictly unique account identifiers from the live accounts table.
 */
export async function generateFinancialAccountIdentifiers(
  entityType: AccountEntityType,
  prefixOverride?: string,
): Promise<{ prefix: string; accountNumber: string; accountCode: string; code: string; accountId: string }> {
  const hierarchyLocation = await accountingHierarchyService.getEntityPostingLocation(entityType);
  const hierarchyReady = await accountingHierarchyService.hasHierarchyStructure();
  if (hierarchyReady && !hierarchyLocation) {
    throw new Error(`لا توجد مجموعة حسابات نشطة مرتبطة بنوع الكيان «${entityType}». أنشئ المجموعة أو فعّلها من شجرة الحسابات أولاً.`);
  }
  const prefix = hierarchyLocation
    ? hierarchyCodeRules.postingPrefix(hierarchyLocation.accountCode)
    : (prefixOverride || LEGACY_ACCOUNT_PREFIXES[entityType] || '5000');

  // includeInactive=true حتى تشمل المقارنة الحسابات المعطّلة فلا يُعاد استعمال كودها.
  // Disabled accounts must take part in the uniqueness scan, hence includeInactive.
  let allAccounts: any[] = [];
  try {
    allAccounts = await readAllFinanceRows('/api/v1/finance/accounts', { includeInactive: true });
  } catch (error) {
    // الفشل هنا لا يوقف الإنشاء: قيد المفتاح الأساسي في قاعدة البيانات هو الحكم النهائي.
    // A failed scan does not block creation; the accounts primary key remains the final authority.
    console.warn('[FinancialAccountService] تعذر تحميل الحسابات لفحص التفرد، سيعتمد الإنشاء على قيود قاعدة البيانات:', error);
  }

  // لا حاجة لفحص سجلات الكيانات: معرّف الحساب المالي «PREFIX-NNNN» بينما معرّفات الكيانات
  // «cust_…» أو «cour_…» أو «emp_…» أو UUID، فلا يمكن أن يتطابقا (تم التحقق من البيانات الحية).
  // Entity documents are no longer scanned: account ids are PREFIX-NNNN while entity ids are
  // cust_/cour_/emp_/UUID, so the two namespaces cannot collide (verified against live data).
  const existingIds = new Set<string>();
  const existingCodes = new Set<string>();
  const existingNumbersForPrefix = new Set<string>();

  let maxSeq = 0;

  for (const account of allAccounts) {
    const accountId = String(account.accountId ?? account.id ?? '').trim();
    if (accountId) existingIds.add(accountId);

    const accountCode = String(account.accountCode ?? '').trim();
    if (accountCode) existingCodes.add(accountCode);

    const accountNumber = String(account.accountNumber ?? '').trim();
    const accountPrefix = String(account.accountPrefix ?? account.parentCode ?? '').trim();

    if (accountPrefix === prefix || accountCode.startsWith(`${prefix}-`)) {
      if (accountNumber) existingNumbersForPrefix.add(accountNumber);

      const parts = accountCode.split('-');
      if (parts.length >= 2) {
        const sequence = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(sequence) && sequence > maxSeq) maxSeq = sequence;
      }
      if (accountNumber) {
        const sequence = parseInt(accountNumber, 10);
        if (!isNaN(sequence) && sequence > maxSeq) maxSeq = sequence;
      }
    }
  }

  let candidateSeq = hierarchyLocation
    ? await accountingHierarchyService.getNextAccountSequence({ ...hierarchyLocation, accountCode: prefix })
    : Math.max(maxSeq + 1, allAccounts.length + 1, 1);

  while (true) {
    const seqStr = String(candidateSeq).padStart(4, '0');
    const candidateCode = hierarchyCodeRules.formatPostingCode(prefix, candidateSeq);
    // الحساب المالي الورقي يُعرّف بالكود المحاسبي نفسه؛ لا تستخدم بادئة acc_.
    const candidateId = candidateCode;

    const isCodeTaken = existingCodes.has(candidateCode);
    const isIdTaken = existingIds.has(candidateId);
    const isNumTaken = existingNumbersForPrefix.has(seqStr);

    if (!isCodeTaken && !isIdTaken && !isNumTaken) {
      return {
        prefix,
        accountNumber: seqStr,
        accountCode: candidateCode,
        code: candidateCode,
        accountId: candidateId,
      };
    }
    candidateSeq++;
  }
}

/**
 * ينشئ حساباً مالياً لكيان (عميل/مندوب/موظف/مصدر/شركة شحن) أو يحدّث اسمه عند وجود حساب.
 * Creates the entity's financial account, or refreshes its name/currency when one already exists.
 */
export async function createFinancialEntityAccount(
  service: {
    getAccountByEntityId: (entityId: string, entityType?: AccountEntityType) => Promise<FinancialAccount | null>;
    getNextAccountIdentifiers: (
      entityType: AccountEntityType,
      prefixOverride?: string,
    ) => Promise<{ prefix: string; accountNumber: string; accountCode: string; code: string; accountId: string }>;
  },
  entityType: AccountEntityType,
  entityId: string,
  entityName: string,
  currency: string,
  monthlySalary?: number,
  options?: {
    accountPrefix?: string;
    accountType?: FinancialAccount['type'];
    parentCode?: string;
    notes?: string;
    updateEntity?: boolean;
  },
): Promise<FinancialAccount> {
  try {
    // 1. منع إنشاء حساب مكرر للكيان نفسه — one account per entity.
    const existing = await service.getAccountByEntityId(entityId, entityType);
    if (existing?.id) {
      const existingUpdate = {
        entityName,
        currency: currency || existing.currency,
        type: options?.accountType || existing.type,
      };
      const updated = await financeApiClient.patch<{ success: boolean; data: unknown }>(
        `/api/v1/finance/accounts/${encodeURIComponent(existing.id)}`,
        existingUpdate,
      );
      if (entityType !== 'system' && options?.updateEntity !== false) {
        await linkEntityAccount(entityType, entityId, { accountId: existing.id });
      }
      return mapAccountRow(updated?.data) ?? { ...existing, ...existingUpdate };
    }

    // 2. توليد معرفات فريدة — generate guaranteed unique account identifiers.
    const hierarchyLocation = await accountingHierarchyService.getEntityPostingLocation(entityType);
    if (!hierarchyLocation && await accountingHierarchyService.hasHierarchyStructure()) {
      throw new Error(`لا يمكن إنشاء حساب «${entityName}»: لا توجد مجموعة نشطة لنوع الكيان «${entityType}» في شجرة الحسابات.`);
    }
    const hierarchyPrefix = hierarchyLocation?.accountCode;
    const { prefix, accountNumber, accountCode, accountId } =
      await service.getNextAccountIdentifiers(entityType, options?.accountPrefix || hierarchyPrefix);

    let currencyId: number | undefined;
    try {
      currencyId = await accountingHierarchyService.getCurrencyIdByCode(currency);
    } catch (currencyError) {
      console.warn('[FinancialAccountService] Currency reference lookup deferred:', currencyError);
    }
    // تستخدم عملة عقدة الشجرة فقط عندما لا يحدد الحساب المالي عملة صريحة.
    currencyId ??= hierarchyLocation?.currencyId;

    // الحقول مطابقة لمخطط الحسابات الصارم في alx_api؛ الخادم يضيف created_at/updated_at.
    // Payload matches the strict alx_api account schema; audit timestamps are set server-side.
    const accountPayload = {
      accountId,
      accountCode,
      accountPrefix: prefix,
      accountNumber,
      entityType,
      entityId,
      entityName,
      currency,
      balance: 0,
      isActive: true,
      notes: options?.notes || '',
      type: options?.accountType || (LIABILITY_ENTITY_TYPES.includes(entityType) ? 'Liability' : 'Asset'),
      accSubId: hierarchyLocation?.accSubId,
      groupId: hierarchyLocation?.groupId,
      accountSeq: Number(accountNumber),
      accNameAr: entityName,
      accNameEn: entityName,
      limitedBalance: 0,
      curNo: currencyId,
    };

    const created = await financeApiClient.post<{ success: boolean; data: unknown }>('/api/v1/finance/accounts', accountPayload);
    const account = mapAccountRow(created?.data ?? accountPayload);
    if (!account) {
      throw new Error(`تعذر إنشاء الحساب المالي «${accountCode}»: استجابة غير صالحة من خدمة الحسابات.`);
    }

    // 3. ربط مرجع الحساب بسجل الكيان — link the account reference back onto the entity record.
    if (entityType !== 'system' && options?.updateEntity !== false) {
      await linkEntityAccount(entityType, entityId, { accountId, monthlySalary });
    }

    activityLogService.log('create_financial_account' as any, entityName, {
      accountCode,
      entityType,
      entityId,
    });

    return account;
  } catch (error) {
    console.error('[FinancialAccountService] Error creating account:', error);
    throw error;
  }
}
