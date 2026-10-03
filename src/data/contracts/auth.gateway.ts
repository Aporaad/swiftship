import type { AuthViewModel } from '../../features/auth/types';
import type { EntityGateway } from './common.gateway';
import type { AuthLoginProfileDto, CurrentUserDto, SessionState } from '../dtos/auth.dto';

export interface AuthGateway extends EntityGateway<AuthViewModel> {
  authenticate(identifier: string, password: string): Promise<CurrentUserDto>;
  findEmailByUsername(username: string): Promise<string | null>;
  getLoginProfile(userId: string): Promise<AuthLoginProfileDto | null>;
  ensureInitialRootProfile(userId: string): Promise<AuthLoginProfileDto | null>;
  verifySystemPin(userId: string, pin: string): Promise<boolean>;
  completeSignIn(userId: string): void;
  cancelPendingSignIn(): void;
  getCurrentSession(): Promise<SessionState>;
  subscribeToSession(listener: (state: SessionState) => void): () => void;
  signOut(): Promise<void>;
}
