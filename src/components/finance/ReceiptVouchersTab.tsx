/**
 * ReceiptVouchersTab - تبويب سندات القبض (نقدي / بنكي / متعدد)
 *
 * يوفر 3 أزرار لإنشاء سندات القبض بحسب النوع:
 * 1) سند قبض نقدي جديد
 * 2) سند قبض بنكي جديد
 * 3) سند قبض متعدد جديد
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
      description="إدارة واستعراض سندات القبض النقدية والبنكية والمتعددة المعالجة محسبياً بشكل آمن."
      category="General"
      permittedTypeCodes={['RECEIPT_VOUCHER', 'RECEIPT_CASH', 'RECEIPT_BANK', 'RECEIPT_MULTI', 'ORDER_PAYMENT']}
      initialModuleCode="RECEIPTS"
      initialTypeCode="RECEIPT_CASH"
      isVoucherMode={true}
      voucherType="receipt"
    />
  );
}
