import EntryWorkspaceTab from './EntryWorkspaceTab';
type TabProps = Omit<React.ComponentProps<typeof EntryWorkspaceTab>, 'title' | 'description' | 'category' | 'permittedTypeCodes'>;
export default function TemporaryEntriesTab(props: TabProps) { return <EntryWorkspaceTab {...props} title="القيود المؤقتة" description="مسودات متوازنة لا تدخل في الأرصدة حتى يمنح المستخدم المخول اعتمادها." category="Temp" />; }
