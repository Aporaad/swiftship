import type { AuthViewModel } from '../../features/auth/types';
import type { EntityGateway } from './common.gateway';
import type { CurrentUserDto, SessionState } from '../dtos/auth.dto';

export interface AuthGateway extends EntityGateway<AuthViewModel> {
  authenticate(identifier: string, password: string): Promise<CurrentUserDto>;
  completeSignIn(userId: string): void;
  cancelPendingSignIn(): void;
  getCurrentSession(): Promise<SessionState>;
  subscribeToSession(listener: (state: SessionState) => void): () => void;
  signOut(): Promise<void>;
}
