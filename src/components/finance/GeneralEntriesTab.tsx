/**
 * GeneralEntriesTab - تبويب القيود العامة
 * يعرض قيودًا عامة متوازنة بساقين: مدين ودائن
 */
import EntryWorkspaceTab from './EntryWorkspaceTab';
type TabProps = Omit<React.ComponentProps<typeof EntryWorkspaceTab>, 'title' | 'description' | 'category' | 'permittedTypeCodes' | 'buttonLabel' | 'isVoucherMode' | 'voucherType'>;
export default function GeneralEntriesTab(props: TabProps) {
  return (
    <EntryWorkspaceTab
      {...props}
      title="القيود العامة"
      description="قيود متوازنة بساقين: مدين ودائن."
      category="General"
      buttonLabel="قيد عام جديد"
    />
  );
}
