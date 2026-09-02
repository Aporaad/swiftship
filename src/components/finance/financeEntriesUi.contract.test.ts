import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (name: string) => readFileSync(resolve(process.cwd(), 'src', 'components', 'finance', name), 'utf8');

describe('عقد واجهة القيود الجديدة', () => {
  it('لا يطلب عمود accounts.entity_name غير الموجود ويستخدم أسماء الحسابات الصريحة', () => {
    const page = readFileSync(resolve(process.cwd(), 'src', 'pages', 'FinanceEntries.tsx'), 'utf8');
    expect(page).toContain("acc_name_ar || item.acc_name_en || item.id");
    expect(page).not.toContain('item.entity_name');
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

  it('يستخدم تقرير المالية دفتر account_trans مع رؤوس main_entry المرحّلة فقط', () => {
    const report = readFileSync(resolve(process.cwd(), 'src', 'components', 'FinanceReports.tsx'), 'utf8');
    expect(report).toContain("collection(db, 'account_trans')");
    expect(report).toContain("collection(db, 'main_entry')");
    expect(report).toContain("tx.entry?.postingStatus === 'posted'");
    expect(report).not.toContain("collection(db, 'account_transactions')");
  });

  it('يعرض تحصيل الطلب بعملة الدفع المحفوظة ويعتمدها عند إنشاء سند القبض', () => {
    const modal = source('../orders/PaymentModal.tsx');
    const orders = source('../../pages/Orders.tsx');
    expect(modal).toContain('selectedOrder?.paidCurrency || selectedOrder?.currency');
    expect(orders).toContain('selectedOrder.paidCurrency || selectedOrder.currency || selectedOrder.orderCurrency');
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
