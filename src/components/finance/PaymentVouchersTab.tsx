/**
 * PaymentVouchersTab - تبويب سندات الصرف (نقدي / بنكي / متعدد)
 *
 * يوفر 3 أزرار لإنشاء سندات الصرف بحسب النوع:
 * 1) سند صرف نقدي جديد
 * 2) سند صرف بنكي جديد
 * 3) سند صرف متعدد جديد
 */

import EntryWorkspaceTab from './EntryWorkspaceTab';

type TabProps = Omit<
  React.ComponentProps<typeof EntryWorkspaceTab>,
  'title' | 'description' | 'category' | 'permittedTypeCodes' | 'initialModuleCode' | 'initialTypeCode' | 'buttonLabel' | 'isVoucherMode' | 'voucherType'
>;

export default function PaymentVouchersTab(props: TabProps) {
  return (
    <EntryWorkspaceTab
      {...props}
      title="سندات الصرف"
      description="إدارة واستعراض سندات الصرف النقدية والبنكية والمتعددة المعالجة محاسبياً."
      category="General"
      permittedTypeCodes={['PAYMENT_VOUCHER', 'PAYMENT_CASH', 'PAYMENT_BANK', 'PAYMENT_MULTI', 'OPERATING_EXPENSE', 'SALARY_PAYMENT']}
      initialModuleCode="PAYMENTS"
      initialTypeCode="PAYMENT_CASH"
      isVoucherMode={true}
      voucherType="payment"
    />
  );
}
