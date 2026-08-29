/**
 * CompoundEntriesTab - تبويب القيود المركبة
 * يعرض قيودًا بأسطر متعددة متوازنة
 */
import EntryWorkspaceTab from './EntryWorkspaceTab';
type TabProps = Omit<React.ComponentProps<typeof EntryWorkspaceTab>, 'title' | 'description' | 'category' | 'permittedTypeCodes' | 'buttonLabel' | 'isVoucherMode' | 'voucherType'>;
export default function CompoundEntriesTab(props: TabProps) {
  return (
    <EntryWorkspaceTab
      {...props}
      title="القيود المركبة"
      description="أسطر متعددة متوازنة، ويظل التوازن محسوبًا من المبلغ الأصلي بعملة الرأس."
      category="Compound"
      buttonLabel="قيد مركب جديد"
    />
  );
}
