/**
 * PaymentVouchersTab - تبويب سندات الصرف
 *
 * - يعمل في وضع السند المبسط (isVoucherMode)
 * - الصندوق/البنك = دائن (يُحدَّد من تفاصيل الدفع)
 * - الطرف الآخر = مدين (يختاره المستخدم)
 * - لا يظهر خيار "آجل" في طريقة الدفع
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
      description="سندات صرف: الصندوق/البنك دائن تلقائياً، والطرف الآخر مدين."
      category="General"
      permittedTypeCodes={['PAYMENT_VOUCHER', 'OPERATING_EXPENSE', 'SALARY_PAYMENT']}
      initialModuleCode="PAYMENTS"
      initialTypeCode="PAYMENT_VOUCHER"
      buttonLabel="سند صرف جديد"
      isVoucherMode={true}
      voucherType="payment"
    />
  );
}
