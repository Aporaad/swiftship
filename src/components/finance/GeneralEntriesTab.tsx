import EntryWorkspaceTab from './EntryWorkspaceTab';
type TabProps = Omit<React.ComponentProps<typeof EntryWorkspaceTab>, 'title' | 'description' | 'category' | 'permittedTypeCodes'>;
export default function GeneralEntriesTab(props: TabProps) { return <EntryWorkspaceTab {...props} title="القيود العامة" description="قيود متوازنه ." category="General" />; }
