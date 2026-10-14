/**
 * accountingHierarchyAdmin.ts
 * إدارة شجرة الحسابات والحسابات الافتراضية والاستيراد — API-only عبر alx_api.
 * Chart-of-accounts tree administration (nodes, default bindings, tree import) — API-only through alx_api.
 *
 * تفصل هذه الوحدة عمليات الدليل اليدوية عن accountingHierarchyService التي تختص بالمراجع المستخدمة
 * أثناء ترحيل القيود؛ الوحدتان تشاركان نفس المسارات عبر بوابة financeApi دون تكرار منطق الاتصال.
 * Kept apart from accountingHierarchyService (posting-time lookups): both reuse the shared finance gateway.
 */
import {
  buildImportedTreePayload,
  type ImportKnownNode,
  type ImportedTreeRow,
} from './accountingTreeFileService';
import { financeApiClient, readAllFinanceRows, type ApiEnvelope } from './financeApi';
import { createFinancialAccount, type FinancialAccountInput } from './financialAccountAdmin';

/** مستويات الشجرة التي تديرها الواجهة — the four tree levels an accountant edits by hand. */
export type HierarchyLevel = 'account' | 'main' | 'sub' | 'group';

/** أسماء المستويات كما تقبلها الخلفية في المسار وفي الاستيراد — backend level names. */
const API_LEVEL: Record<HierarchyLevel, 'account' | 'accMain' | 'accSub' | 'accSubGroup'> = {
  account: 'account',
  main: 'accMain',
  sub: 'accSub',
  group: 'accSubGroup',
};

/** أجزاء المسار العامة (kebab-case) — public path segments. */
const PATH_LEVEL: Record<HierarchyLevel, string> = {
  account: 'account',
  main: 'acc-main',
  sub: 'acc-sub',
  group: 'acc-sub-group',
};

const HIERARCHY_PATH = '/api/v1/finance/hierarchy';
const DEFAULT_ACCOUNTS_PATH = '/api/v1/finance/default-accounts';

/** عقدة شجرة بعد التطبيع — a tree node with `id` filled from the API's `nodeId`. */
export interface HierarchyNode {
  id: string;
  accountCode?: string;
  accNameAr?: string;
  accNameEn?: string;
  accountType?: string;
  accountId?: string;
  accMainId?: string;
  accSubId?: string;
  entityType?: string;
  allowsDirectAccounts?: boolean;
  curNo?: number | null;
  isActive?: boolean;
  balance?: number;
  [key: string]: unknown;
}

/** الحقول التي يقبلها مخطط الشجرة الصارم — mirrors the strict hierarchyNodeSchema. */
export interface HierarchyNodeInput {
  accountCode?: string | null;
  accNameAr?: string | null;
  accNameEn?: string | null;
  curNo?: number | null;
  isActive?: boolean;
  accountType?: string | null;
  accountId?: string | null;
  accMainId?: string | null;
  accSubId?: string | null;
  allowsDirectAccounts?: boolean;
  entityType?: string | null;
}

/** ربط حساب افتراضي كما تعرضه الإدارة (يشمل المعطّلة) — a default binding row, inactive ones included. */
export interface DefaultAccountRecord {
  id: string;
  defaultKey?: string;
  accountId?: string;
  accNameAr?: string;
  accNameEn?: string;
  curNo?: number | null;
  isActive?: boolean;
  [key: string]: unknown;
}

/** حقول الحساب الافتراضي المقبولة خادميًا — mirrors the strict defaultAccountSchema. */
export interface DefaultAccountInput {
  defaultKey?: string | null;
  accountId?: string | null;
  accNameAr?: string | null;
  accNameEn?: string | null;
  curNo?: number | null;
  isActive?: boolean;
}

/**
 * يبني عقدة الشجرة بمعرّف صريح بدل معرّف المستند القديم — keeps the legacy id scheme (the code) as the node id.
 */
function toNode(row: any): HierarchyNode | null {
  const id = String(row?.nodeId ?? row?.id ?? '').trim();
  if (!id) return null;
  return { ...row, id } as HierarchyNode;
}

function toDefaultRecord(row: any): DefaultAccountRecord | null {
  const id = String(row?.defaultAccountId ?? row?.id ?? '').trim();
  if (!id) return null;
  return { ...row, id } as DefaultAccountRecord;
}

/** يحذف المفاتيح التي لا تعرفها المخططات الصارمة قبل الإرسال — strict schemas reject unknown keys. */
function compact(input: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

/** يقرأ مستوى شجرة كاملًا (كل الصفحات) — reads one tree level, following pagination. */
export async function listHierarchyNodes(level: HierarchyLevel): Promise<HierarchyNode[]> {
  const rows = await readAllFinanceRows(`${HIERARCHY_PATH}/${PATH_LEVEL[level]}`);
  return rows.map(toNode).filter((node): node is HierarchyNode => node !== null);
}

/** إنشاء عقدة بمعرّف صريح — creates a node with an explicit id. */
export async function createHierarchyNode(level: HierarchyLevel, nodeId: string, input: HierarchyNodeInput): Promise<void> {
  const id = String(nodeId || '').trim();
  if (!id) throw new Error('معرّف العقدة مطلوب.');
  await financeApiClient.post<ApiEnvelope<unknown>>(
    `${HIERARCHY_PATH}/${PATH_LEVEL[level]}`,
    compact({ ...input, nodeId: id }),
  );
}

/** تعديل عقدة قائمة — PATCH replaces only the provided fields. */
export async function updateHierarchyNode(
  level: HierarchyLevel,
  nodeId: string,
  input: HierarchyNodeInput,
): Promise<void> {
  const id = String(nodeId || '').trim();
  if (!id) throw new Error('معرّف العقدة مطلوب.');
  await financeApiClient.patch<ApiEnvelope<unknown>>(
    `${HIERARCHY_PATH}/${PATH_LEVEL[level]}/${encodeURIComponent(id)}`,
    compact(input),
  );
}

/** حذف عقدة — the server rejects nothing here, so the UI must warn about dependants first. */
export async function deleteHierarchyNode(level: HierarchyLevel, nodeId: string): Promise<void> {
  const id = String(nodeId || '').trim();
  if (!id) throw new Error('معرّف العقدة مطلوب.');
  await financeApiClient.delete<ApiEnvelope<unknown>>(
    `${HIERARCHY_PATH}/${PATH_LEVEL[level]}/${encodeURIComponent(id)}`,
  );
}

/** كل الحسابات الافتراضية (نشطة ومعطّلة) لأن الإدارة تعرض الحالة. */
export async function listDefaultAccountRecords(): Promise<DefaultAccountRecord[]> {
  const rows = await readAllFinanceRows(DEFAULT_ACCOUNTS_PATH);
  return rows.map(toDefaultRecord).filter((row): row is DefaultAccountRecord => row !== null);
}

export async function createDefaultAccount(defaultAccountId: string, input: DefaultAccountInput): Promise<void> {
  const id = String(defaultAccountId || '').trim();
  if (!id) throw new Error('مفتاح الحساب الافتراضي مطلوب.');
  await financeApiClient.post<ApiEnvelope<unknown>>(
    DEFAULT_ACCOUNTS_PATH,
    compact({ ...input, defaultAccountId: id }),
  );
}

export async function updateDefaultAccount(defaultAccountId: string, input: DefaultAccountInput): Promise<void> {
  const id = String(defaultAccountId || '').trim();
  if (!id) throw new Error('مفتاح الحساب الافتراضي مطلوب.');
  await financeApiClient.patch<ApiEnvelope<unknown>>(
    `${DEFAULT_ACCOUNTS_PATH}/${encodeURIComponent(id)}`,
    compact(input),
  );
}

export async function deleteDefaultAccount(defaultAccountId: string): Promise<void> {
  const id = String(defaultAccountId || '').trim();
  if (!id) throw new Error('مفتاح الحساب الافتراضي مطلوب.');
  await financeApiClient.delete<ApiEnvelope<unknown>>(`${DEFAULT_ACCOUNTS_PATH}/${encodeURIComponent(id)}`);
}

/** نتيجة الاستيراد: عدد العقد التي أنشأها الخادم والعدد الذي أنشأته الواجهة من الحسابات المالية. */
export interface TreeImportResult {
  nodes: number;
  accounts: number;
}

const HIERARCHY_IMPORT_LEVELS: HierarchyLevel[] = ['account', 'main', 'sub', 'group'];

/**
 * صفوف الحساب المالي تختلف عن عقد الشجرة: تُكتب في `accounts` عبر مخطط الحساب،
 * بينما تستعمل عقد الشجرة اسمي `accNameAr` و`curNo` لنفس المفهومين.
 * Posting accounts are stored in `accounts` under a different schema, which names the same concepts
 * `entityName` and `currency` (the code carries the currency, and the balance is derived server-side).
 */
function toFinancialAccountInput(payload: Record<string, unknown>): FinancialAccountInput {
  const text = (value: unknown) => (value === null || value === undefined ? null : String(value));
  const number = (value: unknown) => {
    const parsed = Number(value);
    return value === null || value === undefined || !Number.isFinite(parsed) ? null : parsed;
  };
  return {
    accountCode: text(payload.accountCode),
    accountPrefix: text(payload.accountPrefix),
    accountNumber: text(payload.accountNumber),
    accSubId: text(payload.accSubId),
    groupId: text(payload.groupId),
    accountSeq: number(payload.accountSeq),
    limitedBalance: number(payload.limitedBalance),
    curNo: number(payload.curNo),
    accNameAr: text(payload.accNameAr),
    accNameEn: text(payload.accNameEn),
    entityName: text(payload.accNameAr),
    entityType: text(payload.entityType),
    entityId: text(payload.entityId),
    type: text(payload.type),
    currency: text(payload.currency),
    isActive: payload.isActive !== false,
  };
}

/**
 * يستورد الشجرة: صفوف المستويات الأربعة في معاملة واحدة على الخادم، ثم الحسابات المالية واحدة تلو الأخرى.
 * Imports the tree: the four hierarchy levels go in one server-side transaction, then posting accounts
 * are created individually because the accounts surface has no bulk endpoint.
 */
export async function importAccountingTree(
  rows: ImportedTreeRow[],
  knownNodes: Map<string, ImportKnownNode>,
): Promise<TreeImportResult> {
  const hierarchyRows = rows
    .filter((row) => HIERARCHY_IMPORT_LEVELS.includes(row.level as HierarchyLevel))
    // ترتيب المستويات يمنع كسر المرجع قبل إنشاء الأب — parents first, so FK references exist.
    .sort((left, right) => HIERARCHY_IMPORT_LEVELS.indexOf(left.level as HierarchyLevel)
      - HIERARCHY_IMPORT_LEVELS.indexOf(right.level as HierarchyLevel));

  // خريطة حيّة: صفوف الملف تُضاف إليها كي تشير الصفوف اللاحقة إلى آبٍ مستورد في نفس الملف.
  // Live node map: file rows are registered as we go so later rows resolve parents imported by this same file.
  const nodeIndex = new Map(knownNodes);
  const importRows = hierarchyRows.map((row) => {
    const level = row.level as HierarchyLevel;
    const payload = buildImportedTreePayload(row, nodeIndex);
    nodeIndex.set(row.id, {
      id: row.id,
      level,
      parentId: row.parentId,
      accountType: row.accountType,
      accSubId: level === 'group' ? row.parentId || undefined : undefined,
    });
    return { level: API_LEVEL[level], nodeId: row.id, payload };
  });

  let nodes = 0;
  if (importRows.length > 0) {
    const response = await financeApiClient.post<ApiEnvelope<{ imported?: number }>>(
      `${HIERARCHY_PATH}/import`,
      { rows: importRows },
    );
    nodes = Number(response?.data?.imported ?? importRows.length);
  }

  const ledgerRows = rows.filter((row) => row.level === 'ledger');
  let accounts = 0;
  for (const row of ledgerRows) {
    await createFinancialAccount(row.id, toFinancialAccountInput(buildImportedTreePayload(row, nodeIndex)));
    accounts += 1;
  }
  return { nodes, accounts };
}
