/**
 * financialAccountAutomation.ts
 * تنفيذ القيود التلقائية المرتبطة بتغيّر حالة الطلب — API-only عبر alx_api.
 * Automatic voucher execution on order-status transitions — API-only through alx_api.
 */
import { hasEntryForAutomationKey, readFinanceRecord } from './financeApi';
import { fromApiRow, type AutoEntryRuleRow } from './autoEntryRuleMapping';
import type { AutomaticVoucherEntities } from './financialAccountTypes';

interface AutomaticVoucherRule {
  id: string;
  isActive?: boolean;
  debitAccount: unknown;
  creditAccount: unknown;
  descriptionTempAr?: string;
  descriptionTempEn?: string;
  nameAr?: string;
  nameEn?: string;
}

/** يقرأ القاعدة من جدول القيود التلقائية عبر API. */
async function loadRuleFromApi(ruleId: string): Promise<AutomaticVoucherRule | null> {
  const row = await readFinanceRecord(`/api/v1/finance/auto-entry-rules/${encodeURIComponent(ruleId)}`);
  return row ? fromApiRow(row as AutoEntryRuleRow) : null;
}

export async function executeAutomaticVoucher(service: any, ruleId: string, order: any, entities: AutomaticVoucherEntities): Promise<boolean> {
  try {
    const isAr = entities.isAr ?? true;
    const orderIdentifier = String(order?.id || order?.orderNumber || order?.order_number || 'unknown-order');
    const automationKey = entities.automationKey || `auto-voucher:${orderIdentifier}:rule:${ruleId}`;

    // منع التنفيذ المكرر: المرشح automation_key مفهرس ويُقرأ عبر مرشح مخصص في API.
    // Idempotency guard: automation_key is indexed and filtered server-side.
    if (await hasEntryForAutomationKey(automationKey)) {
      console.info('[AutomaticVouchers] Duplicate execution prevented.', { automationKey, ruleId, orderIdentifier });
      return false;
    }

    // 1. القاعدة المخزنة في جدول القيود التلقائية هي المصدر الأول.
    let rule: AutomaticVoucherRule | null = null;
    try {
      rule = await loadRuleFromApi(ruleId);
    } catch (err) {
      console.warn(`[AutomaticVouchers] Error reading auto-entry rule ${ruleId}:`, err);
    }

    // 2. عند غيابها نعود إلى قواعد الإعدادات المبذورة (نفس سلوك الجدول القديم).
    if (!rule) {
      const rules = await service.ensureAutomaticVoucherRules();
      rule = rules.find((candidate: AutomaticVoucherRule) => candidate.id === ruleId) || null;
    }

    if (!rule) {
      console.warn(
        `[AutomaticVouchers] Rule ${ruleId} not found in database or fallback. Execution skipped.`,
      );
      return false;
    }

    if (!rule.isActive) {
      console.log(
        `[AutomaticVouchers] Rule ${ruleId} is deactivated. Voucher execution bypassed.`,
      );
      return false;
    }

    // Use a consistent default currency if not specified, but prefer settings if available
    const systemAccs = await service.ensureSystemAccounts('YER');

    const debitAccount = entities.debitAccountOverride?.id
      ? { id: String(entities.debitAccountOverride.id), code: String(entities.debitAccountOverride.code || '') }
      : service.resolveAutomaticVoucherAccount(rule.debitAccount, systemAccs, order, entities);
    const creditAccount = service.resolveAutomaticVoucherAccount(rule.creditAccount, systemAccs, order, entities);
    const debitId = debitAccount.id;
    const debitCode = debitAccount.code;
    const creditId = creditAccount.id;
    const creditCode = creditAccount.code;

    let description = (isAr
      ? rule.descriptionTempAr || rule.nameAr
      : rule.descriptionTempEn || rule.nameEn) || '';

    description = description
      .replace('{orderNumber}', order.orderNumber || '')
      .replace('{customerName}', entities.customer?.profileName || '')
      .replace('{courierName}', entities.courier?.profileName || '')
      .replace(
        '{commissionRate}',
        String(entities.courier?.commissionRate || 0),
      );

    const refNumber = entities.expenseNumber || order.orderNumber || '';
    const amount = entities.amountOriginal !== undefined ? entities.amountOriginal : (entities.rawAmount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      console.info('[AutomaticVouchers] Zero-value automatic voucher skipped.', { automationKey, ruleId, amount });
      return false;
    }

    let moduleAssign = 'order';
    if (
      ruleId.includes('cost') ||
      ruleId.includes('fee') ||
      ruleId.includes('shipping') ||
      ruleId.includes('wage') ||
      ruleId.includes('commission')
    ) {
      moduleAssign = 'expense';
    } else if (ruleId.includes('payment')) {
      moduleAssign = 'payment';
    }

    // تحديد حالة الترحيل بناءً على خيار autoPost — determine posting status from autoPost (default: posted)
    // true or undefined = ترحيل فوري | false = مسودة
    const postingStatus = entities.autoPost === false ? 'draft' : 'posted';

    await service.recordTransaction({
      date: Date.now(),
      description,
      module: moduleAssign,
      refNumber,
      amount,
      currency: entities.currencyOriginal || 'YER',
      debitAccount: { id: debitId, code: debitCode },
      creditAccount: { id: creditId, code: creditCode },
      // هوية المنفّذ تُستخرج في الخادم من رمز الوصول؛ لا ترسل الواجهة معرف مستخدم.
      // The actor is derived server-side from the access token, so no client-supplied user id.
      createdByName: entities.profileName || 'System Auto',
      orderId: order.id,
      orderNumber: order.orderNumber,
      automationKey,
      autoRuleId: entities.autoRuleId || ruleId,
      statusId: Number(entities.statusId) || undefined,
      isAutomatic: true,
      amountSources: entities.amountSources,
      amountBreakdown: entities.amountBreakdown,
      // حالة الترحيل ستُستخدم في createFromLegacyVoucher — postingStatus is used inside recordJournalEntry via createFromLegacyVoucher
      postingStatus,
    });
    console.log('automatic voucher fired successfully', { automationKey, amount, currency: entities.currencyOriginal || 'YER', debitAccount: { id: debitId, code: debitCode }, creditAccount: { id: creditId, code: creditCode }, createdByName: entities.profileName || 'System Auto', amountSources: entities.amountSources, amountBreakdown: entities.amountBreakdown, postingStatus });
    return true;
  } catch (err) {
    console.error(
      `[AutomaticVouchers] Failed to fire automatic voucher rule: ${ruleId}`,
      err,
    );
    return false;
  }
}
