import type { RoleViewModel } from '../../features/roles/types';
import type { EntityGateway } from './common.gateway';

export interface RolesGateway extends EntityGateway<RoleViewModel> {
  save(role: RoleViewModel): Promise<RoleViewModel>;
}
