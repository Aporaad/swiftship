import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (name: string) => readFileSync(resolve(process.cwd(), 'src', 'components', 'finance', name), 'utf8');

describe('عقد واجهة القيود الجديدة', () => {
  it('لا يطلب عمود accounts.entity_name غير الموجود ويستخدم أسماء الحسابات الصريحة', () => {
    const page = readFileSync(resolve(process.cwd(), 'src', 'features', 'financeEntries', 'pages', 'FinanceEntriesPage.tsx'), 'utf8');
    // عقد alx_api: أعمدة الحسابات تُعاد بصيغة camelCase (accountNameAr/accountNameEn) مع دعم snake_case للأغلفة القديمة
    expect(page).toContain('readString(item.accountNameAr ?? item.acc_name_ar) || readString(item.accountNameEn ?? item.acc_name_en) || stringValue(item.accountId ?? item.account_id)');
    const nameArLine = page.split('\n').find((line) => line.includes('nameAr:')) ?? '';
    expect(nameArLine).not.toContain('entity_name');
  });

  it('يفتح تعديلًا للمسودة فقط ويمرر بيانات السطور إلى نموذج الاستبدال الذري', () => {
    const workspace = source('EntryWorkspaceTab.tsx');
    expect(workspace).toContain('const [editingEntry, setEditingEntry]');
    expect(workspace).toContain('const openEdit = (entry: FinanceEntryRow)');
    expect(workspace).toContain(".filter((l) => l.entryId === entry.id)");
    expect(workspace).toContain('editingEntry={editingEntry || undefined}');
    expect(workspace).toContain("entry.postingStatus === 'draft' && canEdit");
    expect(workspace).toContain('onClick={() => openEdit(entry)}');
  });

  it('يعرض سندات القبض والصرف وفق الرموز المزروعة وفئاتهما الافتراضية', () => {
    const receipt = source('ReceiptVouchersTab.tsx');
    const payment = source('PaymentVouchersTab.tsx');
    expect(receipt).toContain("'RECEIPT_VOUCHER'");
    expect(receipt).toContain('initialModuleCode="RECEIPTS"');
    expect(payment).toContain("'PAYMENT_VOUCHER'");
    expect(payment).toContain("'OPERATING_EXPENSE'");
    expect(payment).toContain('initialModuleCode="PAYMENTS"');
  });

  it('يفوض إعدادات القيود إلى خدمة الإجراء المحمي ويدعم حالة التفعيل', () => {
    const settings = source('EntrySettingsTab.tsx');
    expect(settings).toContain("financialEntrySettingsService.manage");
    expect(settings).not.toContain(".from('entry_module')");
    expect(settings).not.toContain(".from('entry_type')");
    expect(settings).toContain('معطّل ومحفوظ للتاريخ');
  });

  it('يربط العهدة بكيان المستلم الفعلي وحسابه المرتبط ولا يستخدم معرف الحساب كمعرف للكيان', () => {
    const custody = source('CustodyAdvancesTab.tsx');
    expect(custody).toContain('recipientEntityId');
    expect(custody).toContain('selectedRecipientAccount?.entityId');
    expect(custody).toContain('recipientId: recipientEntityId');
    expect(custody).toContain('entityId: recipientEntityId');
    expect(custody).not.toContain('recipientId: recipient.id');
  });

  it('يقرأ تقرير المالية من مسارات alx_api (الحركات المرحّلة ورؤوس القيود) ولا يلمس المجموعات القديمة', () => {
    const report = readFileSync(resolve(process.cwd(), 'src', 'components', 'FinanceReports.tsx'), 'utf8');
    // مسارات alx_api هي المصدر الوحيد: الحركات تُصفّى إلى المرحّل فقط داخل الخادم.
    expect(report).toContain("'/api/v1/finance/account-movements'");
    expect(report).toContain("'/api/v1/finance/entries'");
    expect(report).toContain('readFinancePage');
    expect(report).not.toContain('legacy-compat');
    expect(report).not.toContain("collection(db, 'account_trans')");
    expect(report).not.toContain("collection(db, 'account_transactions')");
    expect(report).not.toContain("collection(db, 'main_entry')");
    expect(report).not.toContain('onSnapshot(');
  });

  it('يتحقق من رمز PIN خادميًا في نوافذ الحذف ولا يقبل رموزًا ثابتة في الواجهة', () => {
    const root = resolve(process.cwd(), 'src');
    const pinModal = readFileSync(resolve(root, 'components', 'ConfirmDeletePinModal.tsx'), 'utf8');
    const entryActions = readFileSync(
      resolve(root, 'components', 'financeAccounting', 'financeAccountingMainEntryActions.ts'),
      'utf8',
    );
    const ordersPage = readFileSync(resolve(root, 'features', 'orders', 'pages', 'OrdersPage.tsx'), 'utf8');
    const pinService = readFileSync(resolve(root, 'services', 'securityPinService.ts'), 'utf8');

    for (const file of [pinModal, entryActions, ordersPage]) {
      expect(file).toContain('verifyCurrentUserPin');
      expect(file).not.toContain("'1234'");
      expect(file).not.toContain("'0000'");
      expect(file).not.toContain("'000000'");
      expect(file).not.toMatch(/systemPin\s*(===|==|!==)/);
    }
    expect(pinModal).not.toContain('legacy-compat');
    expect(pinService).toContain('not-configured');
  });

  it('يعرض تحصيل الطلب بعملة الدفع المحفوظة ويعتمدها عند إنشاء سند القبض', () => {
    const modal = source('../orders/PaymentModal.tsx');
    const orders = readFileSync(resolve(process.cwd(), 'src', 'features', 'orders', 'services', 'collectOrderPaymentHandler.ts'), 'utf8');
    expect(modal).toContain('selectedOrder?.paidCurrency || selectedOrder?.currency');
    expect(orders).toMatch(/selectedOrder\.paidCurrency\s*\|\|\s*selectedOrder\.currency\s*\|\|\s*selectedOrder\.orderCurrency/);
  });

  it('يعرض تفاصيل طريقة الدفع ومراجع البنك والاستحقاق ويمنع المختلط خارج القيد المركب', () => {
    const form = source('EntryForm.tsx');
    expect(form).toContain('تفاصيل طريقة الدفع');
    expect(form).toContain('مرجع الحوالة / العملية');
    expect(form).toContain('تاريخ الاستحقاق');
    expect(form).toContain("paymentMethod === 'mixed' && category !== 'Compound'");
    expect(form).toContain("acc.accSubId === '111'");
    expect(form).toContain("acc.accSubId === '112'");
  });
});
