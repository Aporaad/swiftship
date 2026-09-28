import type { FinanceEntryViewModel } from '../../features/financeEntries/types';
import type { EntityGateway } from './common.gateway';

export interface FinanceEntriesGateway extends EntityGateway<FinanceEntryViewModel> {
  post(entryId: string, actorId: string): Promise<FinanceEntryViewModel>;
  reverse(entryId: string, actorId: string): Promise<FinanceEntryViewModel>;
}
