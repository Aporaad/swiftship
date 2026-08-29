/**
 * TemporaryEntriesTab - تبويب القيود المؤقتة
 * مسودات متوازنة لا تدخل في الأرصدة حتى يمنح المستخدم المخول اعتمادها
 */
import EntryWorkspaceTab from './EntryWorkspaceTab';
type TabProps = Omit<React.ComponentProps<typeof EntryWorkspaceTab>, 'title' | 'description' | 'category' | 'permittedTypeCodes' | 'buttonLabel' | 'isVoucherMode' | 'voucherType'>;
export default function TemporaryEntriesTab(props: TabProps) {
  return (
    <EntryWorkspaceTab
      {...props}
      title="القيود المؤقتة"
      description="مسودات متوازنة لا تدخل في الأرصدة حتى يمنح المستخدم المخول اعتمادها."
      category="Temp"
      buttonLabel="قيد مؤقت جديد"
    />
  );
}
