import type { AuthViewModel } from '../../features/auth/types';
import type { EntityGateway } from './common.gateway';

export interface AuthGateway extends EntityGateway<AuthViewModel> {
  getCurrentSession(): Promise<AuthViewModel | null>;
  signOut(): Promise<void>;
}
