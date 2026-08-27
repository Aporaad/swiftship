import { hierarchyCodeRules } from './accountingHierarchyService';

export type AccountingImportLevel = 'account' | 'main' | 'sub' | 'group' | 'ledger';

export interface ImportKnownNode {
  id: string;
  level: AccountingImportLevel;
  parentId?: string | null;
  accountType?: string;
  accSubId?: string;
}

export interface ImportedTreeRow {
  level: AccountingImportLevel;
  id: string;
  accountCode: string;
  accNameAr: string;
  accNameEn: string;
  parentId: string | null;
  currency: string;
  curNo: number;
  isActive: boolean;
  accountType?: string;
  entityType?: string;
  entityId?: string;
  limitedBalance?: number;
  accountSeq?: number;
  accSubId?: string;
  groupId?: string | null;
}

export interface TreeImportValidation {
  rows: ImportedTreeRow[];
  errors: string[];
  warnings: string[];
}

const LEVELS: AccountingImportLevel[] = ['account', 'main', 'sub', 'group', 'ledger'];
const LEVEL_ALIASES: Record<string, AccountingImportLevel> = {
  account: 'account', root: 'account', 'حساب رئيسي': 'account',
  main: 'main', 'حساب فرعي': 'main',
  sub: 'sub', detail: 'sub', 'حساب جزئي': 'sub',
  group: 'group', 'مجموعة': 'group', 'مجموعة حسابات': 'group',
  ledger: 'ledger', accounts: 'ledger', 'حساب مالي': 'ledger',
};
const ACCOUNT_TYPES = new Set(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']);
const ENTITY_TYPES = new Set(['customer', 'employee', 'courier', 'source', 'shipping_company', 'asset', 'system']);

const text = (value: unknown) => String(value ?? '').trim();
const readField = (row: Record<string, unknown>, names: string[]) => {
  const keys = Object.keys(row);
  const key = keys.find((candidate) => names.includes(candidate.trim().toLowerCase()));
  return key ? row[key] : undefined;
};
const parseBoolean = (value: unknown) => !['false', '0', 'no', 'غير نشط'].includes(text(value).toLowerCase());
const parseNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

export function createKnownTreeNodes(input: { roots: any[]; mains: any[]; subs: any[]; groups: any[]; accounts: any[] }): ImportKnownNode[] {
  const { roots, mains, subs, groups, accounts } = input;
  const read = (record: any, camel: string, snake: string) => record?.[camel] ?? record?.[snake];
  return [
    ...roots.map((node) => ({ id: String(node.id), level: 'account' as const, parentId: null, accountType: String(read(node, 'accountType', 'account_type') || '') })),
    ...mains.map((node) => ({ id: String(node.id), level: 'main' as const, parentId: String(read(node, 'accountId', 'account_id') || '') })),
    ...subs.map((node) => ({ id: String(node.id), level: 'sub' as const, parentId: String(read(node, 'accMainId', 'acc_main_id') || '') })),
    ...groups.map((node) => ({ id: String(node.id), level: 'group' as const, parentId: String(read(node, 'accSubId', 'acc_sub_id') || ''), accSubId: String(read(node, 'accSubId', 'acc_sub_id') || '') })),
    ...accounts.map((node) => ({ id: String(node.id), level: 'ledger' as const, parentId: String(read(node, 'groupId', 'group_id') || read(node, 'accSubId', 'acc_sub_id') || ''), accountType: String(node.type || node.accountType || ''), accSubId: String(read(node, 'accSubId', 'acc_sub_id') || '') })),
  ];
}

export function validateAccountingTreeImport(rawRows: Record<string, unknown>[], context: {
  currencies: Array<{ code?: string; cur_id?: number; curNo?: number; isActive?: boolean; is_active?: boolean }>;
  existingNodes: ImportKnownNode[];
}): TreeImportValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const currencyIds = new Map(context.currencies
    .filter((currency) => currency.isActive !== false && currency.is_active !== false)
    .map((currency) => [text(currency.code).toUpperCase(), Number(currency.cur_id ?? currency.curNo)]));
  const existing = new Map(context.existingNodes.map((node) => [node.id, node]));
  const importedIds = new Set<string>();
  const rows: ImportedTreeRow[] = [];

  rawRows.forEach((source, index) => {
    const rowNumber = index + 2;
    const rawLevel = text(readField(source, ['level', 'المستوى'])).toLowerCase();
    const level = LEVEL_ALIASES[rawLevel];
    const id = text(readField(source, ['id', 'المعرف']));
    const accountCode = text(readField(source, ['accountcode', 'account_code', 'code', 'الكود']));
    const accNameAr = text(readField(source, ['accnamear', 'acc_name_ar', 'namear', 'name_ar', 'الاسم العربي']));
    const accNameEn = text(readField(source, ['accnameen', 'acc_name_en', 'nameen', 'name_en', 'الاسم الانجليزي']));
    const parentId = text(readField(source, ['parentid', 'parent_id', 'parentcode', 'parent_code', 'معرف الاب'])) || null;
    const currency = text(readField(source, ['currency', 'العملة'])).toUpperCase();
    const accountType = text(readField(source, ['accounttype', 'account_type', 'type', 'نوع الحساب']));
    const entityType = text(readField(source, ['entitytype', 'entity_type', 'نوع الكيان'])) || undefined;
    const entityId = text(readField(source, ['entityid', 'entity_id', 'معرف الكيان'])) || undefined;
    const limitedBalance = parseNumber(readField(source, ['limitedbalance', 'limited_balance', 'سقف الرصيد']));

    if (!level) errors.push(`صف ${rowNumber}: مستوى الحساب غير معروف.`);
    if (!id || !accountCode || !accNameAr) errors.push(`صف ${rowNumber}: المعرّف والكود والاسم العربي حقول إلزامية.`);
    if (id && existing.has(id)) errors.push(`صف ${rowNumber}: المعرّف ${id} موجود بالفعل ولن يُستورد فوق سجل قائم.`);
    if (id && importedIds.has(id)) errors.push(`صف ${rowNumber}: المعرّف ${id} مكرر داخل الملف.`);
    if (id) importedIds.add(id);
    if (currency && !currencyIds.has(currency)) errors.push(`صف ${rowNumber}: العملة ${currency} غير نشطة أو غير موجودة في جدول العملات.`);
    if (!currency) errors.push(`صف ${rowNumber}: يجب تحديد رمز عملة موجودة في النظام.`);
    if (limitedBalance !== undefined && limitedBalance < 0) errors.push(`صف ${rowNumber}: سقف الرصيد يجب أن يكون صفرًا أو قيمة موجبة.`);
    if (level === 'account' && !ACCOUNT_TYPES.has(accountType)) errors.push(`صف ${rowNumber}: الحساب الرئيسي يتطلب نوعًا محاسبيًا صحيحًا.`);
    if (entityType && !ENTITY_TYPES.has(entityType)) errors.push(`صف ${rowNumber}: نوع الكيان ${entityType} غير مدعوم.`);
    if (!level || !id || !accountCode || !accNameAr || !currency) return;

    if (id !== accountCode) errors.push(`صف ${rowNumber}: يجب أن يتطابق المعرّف مع الكود المحاسبي.`);
    if (level === 'account' && !/^\d$/.test(accountCode)) errors.push(`صف ${rowNumber}: كود الحساب الرئيسي يجب أن يكون رقمًا واحدًا.`);
    if (level === 'main' && !/^\d{2}$/.test(accountCode)) errors.push(`صف ${rowNumber}: كود الحساب الفرعي يجب أن يكون رقمين.`);
    if (level === 'sub' && !/^\d{3}$/.test(accountCode)) errors.push(`صف ${rowNumber}: كود الحساب الجزئي يجب أن يكون ثلاثة أرقام.`);
    if (level === 'group' && !/^\d{4}$/.test(accountCode)) errors.push(`صف ${rowNumber}: كود المجموعة يجب أن يكون أربعة أرقام.`);
    if (level === 'ledger' && !/^\d{4}-\d{4}$/.test(accountCode)) errors.push(`صف ${rowNumber}: كود الحساب المالي يجب أن يطابق NNNN-NNNN.`);
    if (level === 'account' && parentId) errors.push(`صف ${rowNumber}: الحساب الرئيسي لا يقبل أبًا.`);
    if (level !== 'account' && !parentId) errors.push(`صف ${rowNumber}: يجب تحديد معرّف الحساب الأب.`);
    if (level === 'ledger' && Object.keys(source).some((key) => ['balance', 'رصيد', 'systembalance', 'nativebalance'].includes(key.trim().toLowerCase()))) {
      warnings.push(`صف ${rowNumber}: تم تجاهل أي رصيد في الملف؛ الأرصدة لا تُستورد حفاظًا على سلامة القيود المالية.`);
    }

    rows.push({
      level, id, accountCode, accNameAr, accNameEn, parentId, currency,
      curNo: currencyIds.get(currency) || 0, isActive: parseBoolean(readField(source, ['isactive', 'is_active', 'نشط'])),
      accountType: accountType || undefined, entityType, entityId,
      limitedBalance: limitedBalance === undefined ? 0 : limitedBalance,
      accountSeq: level === 'ledger' ? Number(accountCode.split('-')[1]) : undefined,
    });
  });

  const allNodes = new Map<string, ImportKnownNode>([...context.existingNodes.map((node) => [node.id, node] as const)]);
  rows.forEach((row) => allNodes.set(row.id, {
    id: row.id,
    level: row.level,
    parentId: row.parentId,
    accountType: row.accountType,
    accSubId: row.level === 'group' ? row.parentId || undefined : undefined,
  }));
  const expectedParent: Record<Exclude<AccountingImportLevel, 'account'>, AccountingImportLevel[]> = {
    main: ['account'], sub: ['main'], group: ['sub'], ledger: ['sub', 'group'],
  };
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (row.level === 'account') return;
    const parent = row.parentId ? allNodes.get(row.parentId) : undefined;
    if (!parent) {
      errors.push(`صف ${rowNumber}: الحساب الأب ${row.parentId || 'غير المحدد'} غير موجود في الملف أو في الشجرة.`);
      return;
    }
    if (!expectedParent[row.level].includes(parent.level)) errors.push(`صف ${rowNumber}: مستوى الأب لا يتوافق مع مستوى ${row.level}.`);
    if (row.level === 'main' && !row.accountCode.startsWith(parent.id)) errors.push(`صف ${rowNumber}: كود الحساب الفرعي لا يتبع كود الأب.`);
    if (row.level === 'sub' && !row.accountCode.startsWith(parent.id)) errors.push(`صف ${rowNumber}: كود الحساب الجزئي لا يتبع كود الأب.`);
    if (row.level === 'group' && !row.accountCode.startsWith(parent.id)) errors.push(`صف ${rowNumber}: كود المجموعة لا يتبع كود الأب.`);
    if (row.level === 'ledger') {
      const requiredPrefix = parent.level === 'group' ? parent.id : hierarchyCodeRules.postingPrefix(parent.id);
      if (!row.accountCode.startsWith(`${requiredPrefix}-`)) errors.push(`صف ${rowNumber}: كود الحساب المالي لا يتبع المسار الأب المحدد.`);
    }
  });

  return { rows: rows.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.accountCode.localeCompare(b.accountCode)), errors, warnings };
}

export function buildImportedTreePayload(row: ImportedTreeRow, allNodes: Map<string, ImportKnownNode>): Record<string, unknown> {
  const parent = row.parentId ? allNodes.get(row.parentId) : undefined;
  const base = { accountCode: row.accountCode, accNameAr: row.accNameAr, accNameEn: row.accNameEn, curNo: row.curNo, isActive: row.isActive };
  if (row.level === 'account') return { ...base, accountType: row.accountType };
  if (row.level === 'main') return { ...base, accountId: row.parentId };
  if (row.level === 'sub') return { ...base, accMainId: row.parentId, allowsDirectAccounts: true };
  if (row.level === 'group') return { ...base, accSubId: row.parentId, entityType: row.entityType || null, allowsDirectAccounts: true };

  const groupId = parent?.level === 'group' ? parent.id : null;
  const accSubId = parent?.level === 'group' ? parent.accSubId : parent?.id;
  let cursor = parent;
  const seen = new Set<string>();
  while (cursor?.parentId && cursor.level !== 'account' && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    cursor = allNodes.get(cursor.parentId);
  }
  return {
    ...base,
    accSubId,
    groupId,
    entityType: row.entityType || null,
    entityId: row.entityId || null,
    accountSeq: row.accountSeq,
    accountPrefix: row.accountCode.split('-')[0],
    accountNumber: row.accountCode.split('-')[1],
    limitedBalance: Math.max(0, Number(row.limitedBalance || 0)),
    type: cursor?.accountType || row.accountType || 'Asset',
    entityName: row.accNameAr,
    currency: row.currency,
  };
}
