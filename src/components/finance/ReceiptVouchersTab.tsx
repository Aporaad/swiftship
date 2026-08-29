/**
 * ReceiptVouchersTab - تبويب سندات القبض
 *
 * - يعمل في وضع السند المبسط (isVoucherMode)
 * - الصندوق/البنك = مدين (يُحدَّد من تفاصيل الدفع)
 * - الطرف الآخر = دائن (يختاره المستخدم)
 * - لا يظهر خيار "آجل" في طريقة الدفع
 */
import EntryWorkspaceTab from './EntryWorkspaceTab';
type TabProps = Omit<
  React.ComponentProps<typeof EntryWorkspaceTab>,
  'title' | 'description' | 'category' | 'permittedTypeCodes' | 'initialModuleCode' | 'initialTypeCode' | 'buttonLabel' | 'isVoucherMode' | 'voucherType'
>;
export default function ReceiptVouchersTab(props: TabProps) {
  return (
    <EntryWorkspaceTab
      {...props}
      title="سندات القبض"
      description="سندات قبض: الصندوق/البنك مدين تلقائياً، والطرف الآخر دائن."
      category="General"
      permittedTypeCodes={['RECEIPT_VOUCHER', 'ORDER_PAYMENT']}
      initialModuleCode="RECEIPTS"
      initialTypeCode="RECEIPT_VOUCHER"
      buttonLabel="سند قبض جديد"
      isVoucherMode={true}
      voucherType="receipt"
    />
  );
}
