import { collection, db, doc, getDocs, setDoc, updateDoc } from '../data/legacy/legacy-compat.ts';
import { activityLogService } from './activityLogService';
import { accountingHierarchyService, hierarchyCodeRules } from './accountingHierarchyService';
import { LEGACY_ACCOUNT_PREFIXES } from './financialAccountTypes';
import type { AccountEntityType, FinancialAccount } from './financialAccountTypes';

export async function generateFinancialAccountIdentifiers(service: any, entityType: AccountEntityType, prefixOverride?: string): Promise<{ prefix: string; accountNumber: string; accountCode: string; code: string; accountId: string }> {
    const hierarchyLocation = await accountingHierarchyService.getEntityPostingLocation(entityType);
    const hierarchyReady = await accountingHierarchyService.hasHierarchyStructure();
    if (hierarchyReady && !hierarchyLocation) {
      throw new Error(`لا توجد مجموعة حسابات نشطة مرتبطة بنوع الكيان «${entityType}». أنشئ المجموعة أو فعّلها من شجرة الحسابات أولاً.`);
    }
    const prefix = hierarchyLocation
      ? hierarchyCodeRules.postingPrefix(hierarchyLocation.accountCode)
      : (prefixOverride || LEGACY_ACCOUNT_PREFIXES[entityType] || "5000");

    let allAccounts: any[] = [];
    let entityDocs: any[] = [];
    try {
      const snap = await getDocs(collection(db, "accounts"));
      allAccounts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const entityCollectionName = service.getEntityCollection(entityType);
      if (entityCollectionName) {
        const entitySnap = await getDocs(collection(db, entityCollectionName));
        entityDocs = entitySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn("[FinancialAccountService] Error fetching existing accounts/entities for uniqueness check:", e);
    }

    const existingIds = new Set<string>();
    const existingCodes = new Set<string>();
    const existingNumbersForPrefix = new Set<string>();

    let maxSeq = 0;

    for (const acc of allAccounts) {
      if (acc.id) existingIds.add(String(acc.id));

      const accCode = String(acc.accountCode || acc.code || '').trim();
      if (accCode) existingCodes.add(accCode);

      const rawCode = String(acc.code || '').trim();
      if (rawCode) existingCodes.add(rawCode);

      const accNum = String(acc.accountNumber || '').trim();
      const accPrefix = String(acc.accountPrefix || acc.parentCode || '').trim();

      if (accPrefix === prefix || accCode.startsWith(`${prefix}-`)) {
        if (accNum) existingNumbersForPrefix.add(accNum);

        const parts = accCode.split("-");
        if (parts.length >= 2) {
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
        if (accNum) {
          const num = parseInt(accNum, 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }

    for (const ent of entityDocs) {
      if (ent.id) existingIds.add(String(ent.id));
    }

    let candidateSeq = hierarchyLocation
      ? await accountingHierarchyService.getNextAccountSequence({ ...hierarchyLocation, accountCode: prefix })
      : Math.max(maxSeq + 1, allAccounts.length + 1, 1);

    while (true) {
      const seqStr = String(candidateSeq).padStart(4, "0");
      const candidateCode = hierarchyCodeRules.formatPostingCode(prefix, candidateSeq);
      // الحساب المالي الورقي يُعرّف بالكود المحاسبي نفسه؛ لا تستخدم بادئة acc_.
      const candidateId = candidateCode;
      const candidateCustId = `cust_${candidateCode}`;
      const candidateEmpId = `emp_${candidateCode}`;
      const candidateCourId = `cour_${candidateCode}`;

      const isCodeTaken = existingCodes.has(candidateCode);
      const isIdTaken = existingIds.has(candidateId) || existingIds.has(candidateCustId) || existingIds.has(candidateEmpId) || existingIds.has(candidateCourId);
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

export async function createFinancialEntityAccount(service: any, entityType: AccountEntityType, entityId: string, entityName: string, currency: string, monthlySalary?: number, options?: {
      accountPrefix?: string;
      accountType?: FinancialAccount["type"];
      parentCode?: string;
      notes?: string;
      updateEntity?: boolean;
    }): Promise<FinancialAccount> {
    try {
      // 1. Prevent duplicate account creation for the same entityId
      const existing = await service.getAccountByEntityId(entityId, entityType);
      if (existing && existing.id) {
        const now = Date.now();
        const existingUpdate = {
          entityName,
          currency: currency || existing.currency,
          type: options?.accountType || existing.type,
          updatedAt: now,
        };
        await updateDoc(doc(db, "accounts", existing.id), existingUpdate);
        if (entityType !== "system" && options?.updateEntity !== false) {
          await updateDoc(doc(db, service.getEntityCollection(entityType), entityId), {
            accountId: existing.id,
            updatedAt: now,
          });
        }
        return { ...existing, ...existingUpdate };
      }

      // 2. Generate guaranteed unique account identifiers
      const hierarchyLocation = await accountingHierarchyService.getEntityPostingLocation(entityType);
      if (!hierarchyLocation && await accountingHierarchyService.hasHierarchyStructure()) {
        throw new Error(`لا يمكن إنشاء حساب «${entityName}»: لا توجد مجموعة نشطة لنوع الكيان «${entityType}» في شجرة الحسابات.`);
      }
      const hierarchyPrefix = hierarchyLocation?.accountCode;
      const { prefix, accountNumber, accountCode, code, accountId } =
        await service.getNextAccountIdentifiers(entityType, options?.accountPrefix || hierarchyPrefix);
      let currencyId: number | undefined;
      try {
        currencyId = await accountingHierarchyService.getCurrencyIdByCode(currency);
      } catch (currencyError) {
        console.warn('[FinancialAccountService] Currency reference lookup deferred:', currencyError);
      }
      // تستخدم عملة عقدة الشجرة فقط عندما لا يحدد الحساب المالي عملة صريحة.
      currencyId ??= hierarchyLocation?.currencyId;

      const now = Date.now();
      const accountData: FinancialAccount = {
        id: accountId,
        accountCode,
        code,
        accountPrefix: prefix,
        accountNumber,
        entityType,
        entityId,
        entityName,
        currency,
        balance: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        notes: options?.notes || "",
        type:
          options?.accountType ||
          (([
            "courier",
            "employee",
            "source",
            "shipping_company",
          ] as AccountEntityType[]).includes(entityType)
            ? "Liability"
            : "Asset"),
        accSubId: hierarchyLocation?.accSubId,
        groupId: hierarchyLocation?.groupId,
        accountSeq: Number(accountNumber),
        accNameAr: entityName,
        accNameEn: entityName,
        limitedBalance: 0,
        lastRecalculatedAt: new Date(now).toISOString(),
        curNo: currencyId,
      } as any;

      // Save document with explicit unique ID
      await setDoc(doc(db, "accounts", accountId), accountData);

      // Update the entity's document with the account code reference
      if (entityType !== "system" && options?.updateEntity !== false) {
        try {
          const entityCollection = service.getEntityCollection(entityType);
          const entityUpdateData: any = {
            accountId: accountId,
            updatedAt: now,
          };
          if (monthlySalary !== undefined) {
            entityUpdateData.monthlySalary = monthlySalary;
          }
          await updateDoc(
            doc(db, entityCollection, entityId),
            entityUpdateData,
          );
        } catch (e) {
          console.warn("Could not update entity doc with account_id", e);
        }
      }

      activityLogService.log("create_financial_account" as any, entityName, {
        accountCode,
        entityType,
        entityId,
      });

      return { id: accountId, ...accountData };
    } catch (error) {
      console.error("[FinancialAccountService] Error creating account:", error);
      throw error;
    }
  }
