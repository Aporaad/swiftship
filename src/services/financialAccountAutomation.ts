import { collection, db, doc, getDoc, getDocs, query, supabase, where } from '../lib/supabase-adapter';
import { currentSupabaseAuthGateway } from '../data/current-supabase/gateways/auth.gateway';
import type { AutomaticVoucherEntities } from './financialAccountTypes';

export async function executeAutomaticVoucher(service: any, ruleId: string, order: any, entities: AutomaticVoucherEntities): Promise<boolean> {
    try {
      const session = await currentSupabaseAuthGateway.getCurrentSession();
      const currentUser = session.status === 'authenticated' ? session.user : null;
      const isAr = entities.isAr ?? true;
      const orderIdentifier = String(order?.id || order?.orderNumber || order?.order_number || 'unknown-order');
      const automationKey = entities.automationKey || `auto-voucher:${orderIdentifier}:rule:${ruleId}`;

      const previousExecutions = await (supabase as any)
        .from('main_entry')
        .select('main_entry_id')
        .eq('automation_key', automationKey)
        .limit(1);
      if (previousExecutions.error) {
        throw new Error(`تعذر التحقق من تكرار القيد التلقائي: ${previousExecutions.error.message || previousExecutions.error}`);
      }
      if ((previousExecutions.data || []).length > 0) {
        console.info('[AutomaticVouchers] Duplicate execution prevented.', { automationKey, ruleId, orderIdentifier });
        return false;
      }
      let rule = null;

      // 1. Try to load from dedicated auto_entries table first
      try {
        const autoEntryDoc = await getDoc(doc(db, "auto_entries", ruleId));
        if (autoEntryDoc.exists()) {
          rule = { id: autoEntryDoc.id, ...autoEntryDoc.data() };
        } else {
          // Check query by id field in auto_entries
          const qAuto = query(collection(db, "auto_entries"), where("id", "==", ruleId));
          const autoSnap = await getDocs(qAuto);
          if (!autoSnap.empty) {
            const first = autoSnap.docs[0];
            rule = { id: first.id, ...first.data() };
          }
        }
      } catch (err) {
        console.warn(`[AutomaticVouchers] Error reading auto_entries for ${ruleId}:`, err);
      }

      // 2. Fallback to settings/automatic_voucher_rules for backwards compatibility
      // العوده لفيود الاعدادت في حاله لم يجد في جدول القيود التلفائيه
      /*if (!rule) {
        const ruleDoc = await getDoc(doc(db, "settings", "automatic_voucher_rules"));
        if (ruleDoc.exists()) {
          const d = ruleDoc.data();
          if (d && d.data && Array.isArray(d.data)) {
            rule = d.data.find((r) => r.id === ruleId) || null;
          }
        }
      }*/

      if (!rule) {
        const rules = await service.ensureAutomaticVoucherRules();
        rule = rules.find((r) => r.id === ruleId);
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
      const systemAccs = await service.ensureSystemAccounts("YER");

      const debitAccount = entities.debitAccountOverride?.id
        ? { id: String(entities.debitAccountOverride.id), code: String(entities.debitAccountOverride.code || '') }
        : service.resolveAutomaticVoucherAccount(rule.debitAccount, systemAccs, order, entities);
      const creditAccount = service.resolveAutomaticVoucherAccount(rule.creditAccount, systemAccs, order, entities);
      const debitId = debitAccount.id;
      const debitCode = debitAccount.code;
      const creditId = creditAccount.id;
      const creditCode = creditAccount.code;

      let description = isAr
        ? rule.descriptionTempAr || rule.nameAr
        : rule.descriptionTempEn || rule.nameEn;

      description = description
        .replace("{orderNumber}", order.orderNumber || "")
        .replace("{customerName}", entities.customer?.profileName || "")
        .replace("{courierName}", entities.courier?.profileName || "")
        .replace(
          "{commissionRate}",
          String(entities.courier?.commissionRate || 0),
        );

      const refNumber = entities.expenseNumber || order.orderNumber || "";
      const amount = entities.amountOriginal !== undefined ? entities.amountOriginal : (entities.rawAmount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        console.info('[AutomaticVouchers] Zero-value automatic voucher skipped.', { automationKey, ruleId, amount });
        return false;
      }

      let moduleAssign = "order";
      if (
        ruleId.includes("cost") ||
        ruleId.includes("fee") ||
        ruleId.includes("shipping") ||
        ruleId.includes("wage") ||
        ruleId.includes("commission")
      ) {
        moduleAssign = "expense";
      } else if (ruleId.includes("payment")) {
        moduleAssign = "payment";
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
        currency: entities.currencyOriginal || "YER",
        debitAccount: { id: debitId, code: debitCode },
        creditAccount: { id: creditId, code: creditCode },
        createdByUid: currentUser?.id || "system",
        createdByName: entities.profileName || "System Auto",
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
      } as any);
      console.log('automatic voucher fired successfully', { automationKey, amount, currency: entities.currencyOriginal || "YER", debitAccount: { id: debitId, code: debitCode }, creditAccount: { id: creditId, code: creditCode }, createdByUid: currentUser?.id || "system", createdByName: entities.profileName || "System Auto", amountSources: entities.amountSources, amountBreakdown: entities.amountBreakdown, postingStatus });
      return true;

    } catch (err) {
      console.error(
        `[AutomaticVouchers] Failed to fire automatic voucher rule: ${ruleId}`,
        err,
      );
      return false;
    }
  }
