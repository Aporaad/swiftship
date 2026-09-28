import type { SourcesGateway } from '../../contracts/sources.gateway';
import type { SourcesViewModel } from '../../../features/sources/types';
import { createTableGateway } from '../tableGateway';

export const currentSupabaseSourcesGateway: SourcesGateway = createTableGateway<SourcesViewModel>('sources', 'source_id', (row) => ({ id: String(row.source_id ?? '') }));
