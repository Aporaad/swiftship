import type { AccountingGateway } from '../../contracts/accounting.gateway';
import type { AccountingViewModel } from '../../../features/accounting/types';
import { createTableGateway } from '../tableGateway';

export const currentSupabaseAccountingGateway: AccountingGateway = createTableGateway<AccountingViewModel>('accounts', 'account_id', (row) => ({ id: String(row.account_id ?? '') }));
