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
import { alxApiAuthGateway } from '../../data/http/alx-api-auth.gateway';
import { startSilentSessionRenewal, stopSilentSessionRenewal } from '../../data/http/session-keepalive';
import { SESSION_TERMINATED_EVENT, emitSessionStatus } from '../../data/http/session-events';
import { stopAllPollingChannels } from '../../data/http/polling-channel';
import { ALX_API_URL } from '../../lib/alxApiClient';

const isAlxApiConfigured = Boolean(
  (typeof window !== 'undefined' && (import.meta as any).env?.VITE_ALX_API_URL) ||
    (typeof process !== 'undefined' && process.env['ALX_API_URL']),
);

const defaultGateway = isAlxApiConfigured ? alxApiAuthGateway : currentSupabaseAuthGateway;

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
  gateway = defaultGateway,
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

  const isAlxApiSession = state.status === 'authenticated' && gateway === alxApiAuthGateway;
  useEffect(() => {
    if (!isAlxApiSession) {
      stopSilentSessionRenewal();
      return;
    }
    startSilentSessionRenewal(ALX_API_URL);
    return () => stopSilentSessionRenewal();
  }, [isAlxApiSession]);

  // بثّ حالة الجلسة لبقية المزوّدات (الإعدادات/العملات) دون ربط السياقات ببعضها.
  // Broadcast session status so other providers (settings/currencies) can react without being coupled to auth.
  useEffect(() => {
    emitSessionStatus(state.status);
  }, [state.status]);

  // إنهاء قاطع من طبقة البيانات: تنخفض الحالة إلى expired فيصير user=null، فيوقف التجديد ويحوَّل المسار إلى /login بلا تحديث للصفحة.
  // A decisive termination from the data layer: state drops to expired so user becomes null, which halts renewal and reroutes to /login without a page refresh.
  // يوقف الجلب الدوري أولًا حتى لا تُرسل الشاشات طلبات فاشلة بعد انتهاء الجلسة.
  // Polling stops first so open screens cannot fire doomed requests after the session ended.
  useEffect(() => {
    const onTerminated = () => {
      stopAllPollingChannels();
      setState({ status: 'expired' });
    };
    window.addEventListener(SESSION_TERMINATED_EVENT, onTerminated);
    return () => window.removeEventListener(SESSION_TERMINATED_EVENT, onTerminated);
  }, []);

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
