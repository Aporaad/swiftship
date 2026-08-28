import EntryWorkspaceTab from './EntryWorkspaceTab';
type TabProps = Omit<React.ComponentProps<typeof EntryWorkspaceTab>, 'title' | 'description' | 'category' | 'permittedTypeCodes' | 'initialModuleCode' | 'initialTypeCode'>;
export default function PaymentVouchersTab(props: TabProps) { return <EntryWorkspaceTab {...props} title="سندات الصرف" description="سندات صرف قابلة للمراجعة والاعتماد وفق صلاحية مستقلة." category="General" permittedTypeCodes={['PAYMENT_VOUCHER', 'OPERATING_EXPENSE', 'SALARY_PAYMENT']} initialModuleCode="PAYMENTS" initialTypeCode="PAYMENT_VOUCHER" />; }
