import type { AccountingGateway } from '../../contracts/accounting.gateway';
import type { AccountingViewModel } from '../../../features/accounting/types';
import { createTableGateway } from '../tableGateway';

export const currentSupabaseAccountingGateway: AccountingGateway = createTableGateway<AccountingViewModel>('accounts', 'account_id', ['account_id'], (row) => ({ accountId: String(row.account_id ?? '') }));
