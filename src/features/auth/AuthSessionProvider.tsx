import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthLoginProfileDto, CurrentUserDto, SessionState } from '../../data/dtos/auth.dto';
import type { AuthGateway } from '../../data/contracts/auth.gateway';
import { currentSupabaseAuthGateway } from '../../data/current-supabase/gateways/auth.gateway';

export interface AuthSessionContextValue {
  state: SessionState;
  user: CurrentUserDto | null;
  /** Temporary shape adapter for legacy UI; null unless the gateway reports an authenticated session. */
  legacyAuth: { currentUser: (CurrentUserDto & { uid: string }) | null };
  authenticate(identifier: string, password: string): Promise<CurrentUserDto>;
  findEmailByUsername(username: string): Promise<string | null>;
  getLoginProfile(userId: string): Promise<AuthLoginProfileDto | null>;
  ensureInitialRootProfile(userId: string): Promise<AuthLoginProfileDto | null>;
  verifySystemPin(userId: string, pin: string): Promise<boolean>;
  completeSignIn(userId: string): void;
  cancelPendingSignIn(): void;
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

interface AuthSessionProviderProps {
  children: ReactNode;
  gateway?: AuthGateway;
}

export function AuthSessionProvider({
  children,
  gateway = currentSupabaseAuthGateway,
}: AuthSessionProviderProps) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    let receivedSessionEvent = false;
    const unsubscribe = gateway.subscribeToSession((nextState) => {
      receivedSessionEvent = true;
      if (active) setState(nextState);
    });

    void gateway.getCurrentSession().then(
      (currentState) => {
        if (active && !receivedSessionEvent) setState(currentState);
      },
      () => {
        if (active && !receivedSessionEvent) setState({ status: 'expired' });
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [gateway]);

  const authenticate = useCallback(
    (identifier: string, password: string) => gateway.authenticate(identifier, password),
    [gateway],
  );

  const findEmailByUsername = useCallback(
    (username: string) => gateway.findEmailByUsername(username),
    [gateway],
  );

  const getLoginProfile = useCallback(
    (userId: string) => gateway.getLoginProfile(userId),
    [gateway],
  );

  const ensureInitialRootProfile = useCallback(
    (userId: string) => gateway.ensureInitialRootProfile(userId),
    [gateway],
  );

  const verifySystemPin = useCallback(
    (userId: string, pin: string) => gateway.verifySystemPin(userId, pin),
    [gateway],
  );

  const completeSignIn = useCallback(
    (userId: string) => gateway.completeSignIn(userId),
    [gateway],
  );

  const cancelPendingSignIn = useCallback(
    () => gateway.cancelPendingSignIn(),
    [gateway],
  );

  const refresh = useCallback(async () => {
    try {
      setState(await gateway.getCurrentSession());
    } catch (error) {
      setState({ status: 'expired' });
      throw error;
    }
  }, [gateway]);

  const signOut = useCallback(async () => {
    await gateway.signOut();
    setState({ status: 'unauthenticated' });
  }, [gateway]);

  const user = state.status === 'authenticated' ? state.user : null;
  const legacyAuth = useMemo(
    () => ({ currentUser: user ? { ...user, uid: user.id } : null }),
    [user],
  );
  const value = useMemo(
    () => ({ state, user, legacyAuth, authenticate, findEmailByUsername, getLoginProfile, ensureInitialRootProfile, verifySystemPin, completeSignIn, cancelPendingSignIn, refresh, signOut }),
    [state, user, legacyAuth, authenticate, findEmailByUsername, getLoginProfile, ensureInitialRootProfile, verifySystemPin, completeSignIn, cancelPendingSignIn, refresh, signOut],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error('useAuthSession must be used within AuthSessionProvider.');
  }
  return context;
}
