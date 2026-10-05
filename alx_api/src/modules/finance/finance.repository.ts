import type { Pool } from 'pg';
import type {
  AutoEntryRuleInput,
  CreateEntryInput,
  FinanceRepository,
  PageQuery,
  ReverseEntryInput,
} from './finance.contracts';

const accountColumns = `account_id AS "accountId", account_code AS "accountCode", account_prefix AS "accountPrefix", account_number AS "accountNumber", acc_name_ar AS "accountNameAr", acc_name_en AS "accountNameEn", entity_type AS "entityType", entity_id AS "entityId", entity_name AS "entityName", type, cur_no AS "currencyNo", currency, is_active AS "isActive", balance, debit_total AS "debitTotal", credit_total AS "creditTotal", parent_code AS "parentCode", acc_sub_id AS "subAccountId", group_id AS "groupId", notes, created_at AS "createdAt", updated_at AS "updatedAt"`;
const entryColumns = `main_entry_id AS "entryId", entry_number AS "entryNumber", module_id AS "moduleId", entry_type_id AS "entryTypeId", entry_category AS "entryCategory", posting_status AS "postingStatus", description, notes, attachments, payment_method AS "paymentMethod", order_id AS "orderId", shipment_id AS "shipmentId", custody_id AS "custodyId", automation_key AS "automationKey", auto_rule_id AS "autoRuleId", is_automatic AS "isAutomatic", reverses_entry_id AS "reversesEntryId", effective_at AS "effectiveAt", posted_at AS "postedAt", voided_at AS "voidedAt", created_at AS "createdAt", updated_at AS "updatedAt", created_by_uid AS "createdByUid", posted_by_uid AS "postedByUid", voided_by_uid AS "voidedByUid"`;
const movementColumns = `at.account_trans_id AS "transactionId", at.main_entry_id AS "entryId", me.entry_number AS "entryNumber", at.line_no AS "lineNo", at.trans_type AS "transType", at.account_id AS "accountId", at.account_cur_no AS "accountCurrencyNo", at.amount, at.amount_original AS "amountOriginal", at.currency_original_no AS "currencyOriginalNo", at.currency_price_id AS "currencyPriceId", at.currency_price_seq AS "currencyPriceSeq", at.payment_method AS "paymentMethod", at.entity_type AS "entityType", at.entity_id AS "entityId", at.order_id AS "orderId", at.shipment_id AS "shipmentId", at.custody_id AS "custodyId", at.automation_key AS "automationKey", at.auto_rule_id AS "autoRuleId", at.description, at.note, at.created_at AS "createdAt"`;

function page(input: PageQuery): [number, number] {
  return [input.limit, input.offset];
}
function rpcResult(result: { rows: Array<Record<string, unknown>> }): Record<string, unknown> {
  const value = result.rows[0]?.result ?? result.rows[0];
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return { result: value };
}

export function createFinanceRepository(pool: Pool): FinanceRepository {
  return {
    async listAccounts(input) {
      const [limit, offset] = page(input);
      const search = input.search ? `%${input.search}%` : null;
      const count = await pool.query<{ total: string }>(
        'SELECT count(*)::text AS total FROM public.accounts WHERE ($1::text IS NULL OR account_code ILIKE $1 OR acc_name_ar ILIKE $1 OR acc_name_en ILIKE $1) AND is_active IS TRUE',
        [search],
      );
      const rows = await pool.query(
        `SELECT ${accountColumns} FROM public.accounts WHERE ($1::text IS NULL OR account_code ILIKE $1 OR acc_name_ar ILIKE $1 OR acc_name_en ILIKE $1) AND is_active IS TRUE ORDER BY account_code NULLS LAST, account_id LIMIT $2 OFFSET $3`,
        [search, limit, offset],
      );
      return { items: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
    },
    async getAccount(accountId) {
      const result = await pool.query(`SELECT ${accountColumns} FROM public.accounts WHERE account_id = $1 LIMIT 1`, [
        accountId,
      ]);
      return result.rows[0] ?? null;
    },
    async listAccountMovements(accountId, input) {
      const [limit, offset] = page(input);
      const count = await pool.query<{ total: string }>(
        'SELECT count(*)::text AS total FROM public.account_trans WHERE account_id = $1',
        [accountId],
      );
      const rows = await pool.query(
        `SELECT ${movementColumns} FROM public.account_trans at JOIN public.main_entry me ON me.main_entry_id = at.main_entry_id WHERE at.account_id = $1 AND me.posting_status = 'posted' ORDER BY at.created_at DESC, at.line_no DESC LIMIT $2 OFFSET $3`,
        [accountId, limit, offset],
      );
      return { items: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
    },
    async listEntryModules() {
      const result = await pool.query(
        'SELECT entry_module_id AS "moduleId", code, name_ar AS "nameAr", name_en AS "nameEn", note, is_active AS "isActive" FROM public.entry_module WHERE is_active IS TRUE ORDER BY code, entry_module_id',
      );
      return result.rows;
    },
    async listEntryTypes(moduleId) {
      const result = await pool.query(
        'SELECT entry_type_id AS "entryTypeId", code, module_id AS "moduleId", name_ar AS "nameAr", name_en AS "nameEn", note, is_active AS "isActive" FROM public.entry_type WHERE is_active IS TRUE AND ($1::text IS NULL OR module_id = $1) ORDER BY code, entry_type_id',
        [moduleId ?? null],
      );
      return result.rows;
    },
    async listEntries(input) {
      const [limit, offset] = page(input);
      const search = input.search ? `%${input.search}%` : null;
      const count = await pool.query<{ total: string }>(
        'SELECT count(*)::text AS total FROM public.main_entry WHERE ($1::text IS NULL OR entry_number ILIKE $1 OR description ILIKE $1)',
        [search],
      );
      const rows = await pool.query(
        `SELECT ${entryColumns} FROM public.main_entry WHERE ($1::text IS NULL OR entry_number ILIKE $1 OR description ILIKE $1) ORDER BY effective_at DESC, main_entry_id DESC LIMIT $2 OFFSET $3`,
        [search, limit, offset],
      );
      return { items: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
    },
    async getEntry(entryId) {
      const entry = await pool.query(`SELECT ${entryColumns} FROM public.main_entry WHERE main_entry_id = $1 LIMIT 1`, [
        entryId,
      ]);
      if (!entry.rows[0]) return null;
      const lines = await pool.query(
        `SELECT account_trans_id AS "transactionId", main_entry_id AS "entryId", line_no AS "lineNo", trans_type AS "transType", account_id AS "accountId", account_cur_no AS "accountCurrencyNo", amount, amount_original AS "amountOriginal", currency_original_no AS "currencyOriginalNo", currency_price_id AS "currencyPriceId", currency_price_seq AS "currencyPriceSeq", payment_method AS "paymentMethod", entity_type AS "entityType", entity_id AS "entityId", order_id AS "orderId", shipment_id AS "shipmentId", custody_id AS "custodyId", auto_rule_id AS "autoRuleId", automation_key AS "automationKey", description, note, created_at AS "createdAt" FROM public.account_trans WHERE main_entry_id = $1 ORDER BY line_no`,
        [entryId],
      );
      const payments = await pool.query(
        `SELECT entry_payment_detail_id AS "paymentDetailId", allocation_no AS "allocationNo", payment_method AS "paymentMethod", account_id AS "accountId", amount_original AS "amountOriginal", currency_original_no AS "currencyOriginalNo", bank_reference AS "bankReference", due_at AS "dueAt", note FROM public.entry_payment_details WHERE main_entry_id = $1 ORDER BY allocation_no`,
        [entryId],
      );
      return { ...entry.rows[0], lines: lines.rows, paymentDetails: payments.rows };
    },
    async createEntry(input: CreateEntryInput) {
      const firstLine = input.lines[0];
      if (!firstLine) throw new Error('FINANCIAL_ENTRY_LINES_REQUIRED');
      const payload = {
        entryNumber: input.entryNumber,
        moduleId: input.moduleId,
        entryTypeId: input.entryTypeId,
        entryCategory: input.entryCategory,
        postingStatus: input.postingStatus,
        amountOriginal: String(firstLine.amountOriginal),
        currencyOriginalNo: String(firstLine.currencyOriginalNo),
        currencyPriceId: input.lines[0]?.currencyPriceId ? String(input.lines[0].currencyPriceId) : '',
        currencyPriceSeq: input.lines[0]?.currencyPriceSeq ? String(input.lines[0].currencyPriceSeq) : '',
        description: input.description,
        notes: input.notes ?? '',
        attachments: input.attachments ?? [],
        paymentMethod: input.paymentMethod ?? '',
        orderId: input.orderId ?? '',
        shipmentId: input.shipmentId ?? '',
        custodyId: input.custodyId ?? '',
        automationKey: input.automationKey ?? '',
        autoRuleId: input.autoRuleId ?? '',
        isAutomatic: input.isAutomatic ?? false,
        effectiveAt: input.effectiveAt ?? '',
        createdByUid: input.createdByUid,
        lines: input.lines.map((line) => ({
          ...line,
          amount: String(line.amount),
          amountOriginal: String(line.amountOriginal),
          accountCurNo: String(line.accountCurNo),
          currencyOriginalNo: String(line.currencyOriginalNo),
        })),
      };
      const result = await pool.query('SELECT public.create_financial_entry_v2($1::jsonb) AS result', [
        JSON.stringify(payload),
      ]);
      return rpcResult(result);
    },
    async postEntry(entryId) {
      const result = await pool.query('SELECT public.post_financial_entry($1, NULL) AS result', [entryId]);
      return rpcResult(result);
    },
    async reverseEntry(input: ReverseEntryInput) {
      const payload = {
        description: input.description,
        effectiveAt: input.effectiveAt ?? '',
        createdByUid: input.createdByUid,
        entryNumber: `REV-${input.entryId}-${Date.now()}`,
      };
      const result = await pool.query('SELECT public.reverse_financial_entry($1, $2::jsonb) AS result', [
        input.entryId,
        JSON.stringify(payload),
      ]);
      return rpcResult(result);
    },
    async voidDraft(entryId) {
      const result = await pool.query('SELECT public.void_financial_entry_draft($1, NULL) AS result', [entryId]);
      return rpcResult(result);
    },
    async listAutoEntryRules(input) {
      const [limit, offset] = page(input);
      const count = await pool.query<{ total: string }>(
        'SELECT count(*)::text AS total FROM public.auto_entries WHERE is_active IS TRUE',
        [],
      );
      const rows = await pool.query(
        'SELECT auto_entry_id AS "autoEntryId", status_id AS "statusId", status_name_ar AS "statusNameAr", name_ar AS "nameAr", name_en AS "nameEn", is_active AS "isActive", amount_source AS "amountSource", amount_sources AS "amountSources", amount_strategy AS "amountStrategy", currency, cur_no AS "currencyNo", skip_when_zero AS "skipWhenZero", auto_post AS "autoPost", debit_account AS "debitAccount", credit_account AS "creditAccount", description_temp_ar AS "descriptionTemplateAr", description_temp_en AS "descriptionTemplateEn" FROM public.auto_entries WHERE is_active IS TRUE ORDER BY auto_entry_id LIMIT $1 OFFSET $2',
        [limit, offset],
      );
      return { items: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
    },
    async getAutoEntryRule(ruleId) {
      const result = await pool.query(
        'SELECT auto_entry_id AS "autoEntryId", status_id AS "statusId", status_name_ar AS "statusNameAr", name_ar AS "nameAr", name_en AS "nameEn", is_active AS "isActive", amount_source AS "amountSource", amount_sources AS "amountSources", amount_strategy AS "amountStrategy", currency, cur_no AS "currencyNo", skip_when_zero AS "skipWhenZero", auto_post AS "autoPost", debit_account AS "debitAccount", credit_account AS "creditAccount", description_temp_ar AS "descriptionTemplateAr", description_temp_en AS "descriptionTemplateEn" FROM public.auto_entries WHERE auto_entry_id = $1 LIMIT 1',
        [ruleId],
      );
      return result.rows[0] ?? null;
    },
    async createAutoEntryRule(input: AutoEntryRuleInput) {
      const ruleId = input.autoEntryId ?? `auto_${Date.now()}`;
      const result = await pool.query(
        `INSERT INTO public.auto_entries (auto_entry_id, status_id, status_name_ar, name_ar, name_en, is_active, amount_source, amount_sources, amount_strategy, currency, cur_no, skip_when_zero, auto_post, debit_account, credit_account, description_temp_ar, description_temp_en, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
         RETURNING auto_entry_id AS "autoEntryId", status_id AS "statusId", status_name_ar AS "statusNameAr", name_ar AS "nameAr", name_en AS "nameEn", is_active AS "isActive", amount_source AS "amountSource", amount_sources AS "amountSources", amount_strategy AS "amountStrategy", currency, cur_no AS "currencyNo", skip_when_zero AS "skipWhenZero", auto_post AS "autoPost", debit_account AS "debitAccount", credit_account AS "creditAccount", description_temp_ar AS "descriptionTemplateAr", description_temp_en AS "descriptionTemplateEn"`,
        [
          ruleId,
          input.statusId ?? null,
          input.statusNameAr ?? null,
          input.nameAr,
          input.nameEn,
          input.isActive,
          input.amountSource,
          JSON.stringify(input.amountSources),
          input.amountStrategy,
          input.currency ?? null,
          input.currencyNo ?? null,
          input.skipWhenZero,
          input.autoPost,
          input.debitAccount,
          input.creditAccount,
          input.descriptionTemplateAr,
          input.descriptionTemplateEn,
        ],
      );
      return result.rows[0] as Record<string, unknown>;
    },
    async updateAutoEntryRule(input) {
      const result = await pool.query(
        `UPDATE public.auto_entries SET status_id = $1, status_name_ar = $2, name_ar = $3, name_en = $4, is_active = $5, amount_source = $6, amount_sources = $7::jsonb, amount_strategy = $8, currency = $9, cur_no = $10, skip_when_zero = $11, auto_post = $12, debit_account = $13, credit_account = $14, description_temp_ar = $15, description_temp_en = $16, updated_at = NOW() WHERE auto_entry_id = $17 RETURNING auto_entry_id AS "autoEntryId", status_id AS "statusId", status_name_ar AS "statusNameAr", name_ar AS "nameAr", name_en AS "nameEn", is_active AS "isActive", amount_source AS "amountSource", amount_sources AS "amountSources", amount_strategy AS "amountStrategy", currency, cur_no AS "currencyNo", skip_when_zero AS "skipWhenZero", auto_post AS "autoPost", debit_account AS "debitAccount", credit_account AS "creditAccount", description_temp_ar AS "descriptionTemplateAr", description_temp_en AS "descriptionTemplateEn"`,
        [
          input.statusId ?? null,
          input.statusNameAr ?? null,
          input.nameAr,
          input.nameEn,
          input.isActive,
          input.amountSource,
          JSON.stringify(input.amountSources),
          input.amountStrategy,
          input.currency ?? null,
          input.currencyNo ?? null,
          input.skipWhenZero,
          input.autoPost,
          input.debitAccount,
          input.creditAccount,
          input.descriptionTemplateAr,
          input.descriptionTemplateEn,
          input.autoEntryId,
        ],
      );
      return result.rows[0] ?? null;
    },
    async deleteAutoEntryRule(ruleId) {
      const result = await pool.query('DELETE FROM public.auto_entries WHERE auto_entry_id = $1', [ruleId]);
      return (result.rowCount ?? 0) > 0;
    },
    async listCustodyAdvances(input) {
      const [limit, offset] = page(input);
      const count = await pool.query<{ total: string }>(
        'SELECT count(*)::text AS total FROM public.custody_advances',
        [],
      );
      const rows = await pool.query(
        'SELECT custody_advance_id AS "custodyAdvanceId", custody_number AS "custodyNumber", recipient_type AS "recipientType", recipient_id AS "recipientId", recipient_name AS "recipientName", recipient_account_id AS "recipientAccountId", amount_original AS "amountOriginal", currency_original_no AS "currencyOriginalNo", amount_settled AS "amountSettled", amount_outstanding AS "amountOutstanding", status, issued_entry_id AS "issuedEntryId", settlement_entry_id AS "settlementEntryId", issued_at AS "issuedAt", settled_at AS "settledAt", note FROM public.custody_advances ORDER BY issued_at DESC LIMIT $1 OFFSET $2',
        [limit, offset],
      );
      return { items: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
    },
  };
}
