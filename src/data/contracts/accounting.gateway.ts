import type { AccountingViewModel } from '../../features/accounting/types';
import type { EntityGateway } from './common.gateway';

export interface AccountingGateway extends EntityGateway<AccountingViewModel> {}
