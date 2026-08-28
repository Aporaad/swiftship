import EntryWorkspaceTab from './EntryWorkspaceTab';
type TabProps = Omit<React.ComponentProps<typeof EntryWorkspaceTab>, 'title' | 'description' | 'category' | 'permittedTypeCodes' | 'initialModuleCode' | 'initialTypeCode'>;
export default function ReceiptVouchersTab(props: TabProps) { return <EntryWorkspaceTab {...props} title="سندات القبض" description="سندات قبض مرتبطة بطريقة الدفع والحساب المالي الورقي." category="General" permittedTypeCodes={['RECEIPT_VOUCHER', 'ORDER_PAYMENT']} initialModuleCode="RECEIPTS" initialTypeCode="RECEIPT_VOUCHER" />; }
