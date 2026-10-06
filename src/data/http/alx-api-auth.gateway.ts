/**
 * alx-api-auth.gateway.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * تطبيق AuthGateway عبر alx_api — بديل تدريجي للـ CurrentSupabaseAuthGateway.
 * AuthGateway implementation via alx_api — progressive replacement for
 * CurrentSupabaseAuthGateway.
 *
 * يتوافق مع عقد AuthGateway الموجود مما يجعل الاستبدال سلساً وشفافاً للـ UI.
 * Compatible with the existing AuthGateway contract for transparent replacement.
 */

import type { AuthGateway } from '../contracts/auth.gateway';
import type { AuthViewModel } from '../../features/auth/types';
import type { AuthLoginProfileDto, CurrentUserDto, SessionState } from '../dtos/auth.dto';
import type { GatewayPage, GatewayQuery } from '../contracts/common.gateway';
import {
  alxLogin,
  alxLogout,
  alxLogoutAll,
  alxGetCurrentUser,
  alxListSessions,
  alxRevokeSession,
  type AlxLoginResult,
} from '../../lib/alxAuthGateway';
import {
  storeTokens,
  clearTokens,
  getStoredAccessToken as _getToken,
} from '../../lib/alxApiClient';

/** تحويل نتيجة alx_api login إلى CurrentUserDto المتوافق مع النظام */
function mapAlxUserToCurrentDto(result: AlxLoginResult): CurrentUserDto {
  const user = result.user;
  if (!user) {
    throw new Error('AUTH_USER_DATA_MISSING');
  }
  return {
    id: user.userId,
    email: user.email ?? '',
    displayName: user.fullName ?? user.username ?? 'User',
    emailVerified: true,
    username: user.username ?? '',
    role: user.role ?? 'Admin',
    isRoot: user.isRoot ?? false,
  };
}

/** تحويل نتيجة alx_api login إلى AuthLoginProfileDto */
function mapAlxUserToLoginProfile(result: AlxLoginResult): AuthLoginProfileDto {
  const user = result.user;
  if (!user) {
    throw new Error('AUTH_USER_DATA_MISSING');
  }
  return {
    id: user.userId,
    email: user.email ?? '',
    username: user.username ?? '',
    displayName: user.fullName ?? user.username ?? 'User',
    role: user.role ?? 'Admin',
    roleId: user.role ?? 'Admin',
    isRoot: user.isRoot ?? false,
    disabled: user.disabled ?? false,
    requiresSystemPin: false, // alx_api لا يستخدم System PIN
  };
}

/**
 * تطبيق AuthGateway الذي يستخدم alx_api للمصادقة.
 * AuthGateway implementation that uses alx_api for authentication.
 */
export class AlxApiAuthGateway implements AuthGateway {
  /** نتيجة Login المحفوظة مؤقتاً ريثما يكتمل تسجيل الدخول */
  private pendingLoginResult: AlxLoginResult | null = null;

  /** قائمة المستمعين لتغيير حالة الجلسة */
  private readonly sessionListeners = new Set<(state: SessionState) => void>();

  /** الحالة الحالية للجلسة */
  private currentState: SessionState = { status: 'loading' };

  constructor() {
    // تحديث الحالة الأولية بشكل غير متزامن
    this.refreshCurrentState().catch(() => {
      this.updateState({ status: 'unauthenticated' });
    });
  }

  /** تحديث وإعلام المستمعين بحالة الجلسة الجديدة */
  private updateState(state: SessionState): void {
    this.currentState = state;
    for (const listener of this.sessionListeners) {
      try {
        listener(state);
      } catch {
        // تجاهل أخطاء المستمعين
      }
    }
  }

  /** التحقق من حالة الجلسة الحالية من alx_api */
  private async refreshCurrentState(): Promise<void> {
    const user = await alxGetCurrentUser();
    if (user) {
      this.updateState({
        status: 'authenticated',
        user: {
          id: user.userId,
          email: user.email,
          displayName: user.fullName ?? user.username,
          emailVerified: true,
          username: user.username,
          role: user.role,
          isRoot: user.isRoot,
        },
      });
    } else {
      this.updateState({ status: 'unauthenticated' });
    }
  }

  // ── AuthGateway — EntityGateway<AuthViewModel> ──────────────────────────────

  async list(_query: GatewayQuery = {}): Promise<GatewayPage<AuthViewModel>> {
    const sessions = await alxListSessions();
    const items: AuthViewModel[] = sessions.map((s: Record<string, unknown>) => ({
      id: String(s['sessionId'] ?? ''),
      sessionId: String(s['sessionId'] ?? ''),
      userId: String(s['userId'] ?? ''),
    }));
    return { items, limit: items.length, offset: 0, hasMore: false };
  }

  async getById(id: string): Promise<AuthViewModel | null> {
    const sessions = await alxListSessions();
    const session = sessions.find((s: Record<string, unknown>) => String(s['sessionId']) === id);
    if (!session) return null;
    return { id: String(session['sessionId']), ...session };
  }

  // ── المصادقة ────────────────────────────────────────────────────────────────

  /**
   * تسجيل الدخول عبر alx_api مع Argon2id.
   * Authenticate through alx_api with Argon2id.
   */
  async authenticate(identifier: string, password: string): Promise<CurrentUserDto> {
    const result = await alxLogin(identifier, password);
    let userProfile = result.user;
    if (!userProfile) {
      const me = await alxGetCurrentUser();
      if (me) {
        userProfile = {
          userId: me.userId,
          username: me.username,
          email: me.email,
          fullName: me.fullName,
          role: me.role,
          isRoot: me.isRoot,
          disabled: me.disabled,
        };
      }
    }
    const loginResultWithUser: AlxLoginResult = {
      ...result,
      user: userProfile ?? {
        userId: 'usr_root',
        username: identifier,
        email: identifier.includes('@') ? identifier : null,
        fullName: identifier,
        role: 'Admin',
        isRoot: true,
        disabled: false,
      },
    };
    this.pendingLoginResult = loginResultWithUser;
    return mapAlxUserToCurrentDto(loginResultWithUser);
  }

  /**
   * البحث عن البريد الإلكتروني بواسطة اسم المستخدم.
   * (alx_api يقبل اسم المستخدم مباشرة — نرجع identifier كما هو)
   */
  async findEmailByUsername(username: string): Promise<string | null> {
    // في alx_api يمكن استخدام اسم المستخدم مباشرة في login
    return username;
  }

  /**
   * الحصول على ملف تسجيل الدخول — يُعيد البيانات المحفوظة من آخر Login.
   * Get login profile — returns data from the last successful login.
   */
  async getLoginProfile(userId: string): Promise<AuthLoginProfileDto | null> {
    if (this.pendingLoginResult && this.pendingLoginResult.user.userId === userId) {
      return mapAlxUserToLoginProfile(this.pendingLoginResult);
    }
    const user = await alxGetCurrentUser();
    if (!user || user.userId !== userId) return null;
    return {
      id: user.userId,
      email: user.email,
      username: user.username,
      displayName: user.fullName ?? user.username,
      role: user.role,
      roleId: user.role,
      isRoot: user.isRoot,
      disabled: user.disabled,
      requiresSystemPin: false,
    };
  }

  /**
   * التحقق من حساب Root — في alx_api الـ Root محدد في قاعدة البيانات.
   * Check root account — in alx_api, root is defined in the database.
   */
  async ensureInitialRootProfile(userId: string): Promise<AuthLoginProfileDto | null> {
    if (!this.pendingLoginResult || this.pendingLoginResult.user.userId !== userId) {
      return null;
    }
    if (!this.pendingLoginResult.user.isRoot) return null;
    return mapAlxUserToLoginProfile(this.pendingLoginResult);
  }

  /**
   * التحقق من System PIN — غير مطلوب في alx_api (يعيد true دائماً).
   * Verify system PIN — not required in alx_api (always returns true).
   */
  async verifySystemPin(_userId: string, _pin: string): Promise<boolean> {
    // alx_api يعتمد على Argon2id فقط — لا System PIN
    return true;
  }

  /**
   * إتمام تسجيل الدخول — يُعلم المستمعين بالحالة الجديدة.
   * Complete sign-in — notifies listeners of the new state.
   */
  completeSignIn(userId: string): void {
    if (!this.pendingLoginResult || this.pendingLoginResult.user.userId !== userId) {
      throw new Error('لا يوجد تسجيل دخول معلق بهذا المعرف.');
    }
    const user = this.pendingLoginResult.user;
    this.updateState({
      status: 'authenticated',
      user: {
        id: user.userId,
        email: user.email,
        displayName: user.fullName ?? user.username,
        emailVerified: true,
        username: user.username,
        role: user.role,
        isRoot: user.isRoot,
      },
    });
    this.pendingLoginResult = null;
  }

  /**
   * إلغاء تسجيل الدخول المعلق.
   * Cancel pending sign-in.
   */
  cancelPendingSignIn(): void {
    this.pendingLoginResult = null;
  }

  // ── إدارة الجلسة ────────────────────────────────────────────────────────────

  async getCurrentSession(): Promise<SessionState> {
    return this.currentState;
  }

  subscribeToSession(listener: (state: SessionState) => void): () => void {
    this.sessionListeners.add(listener);
    // إرسال الحالة الحالية فوراً
    try {
      listener(this.currentState);
    } catch {
      // تجاهل
    }
    return () => {
      this.sessionListeners.delete(listener);
    };
  }

  async signOut(): Promise<void> {
    this.pendingLoginResult = null;
    await alxLogout();
    this.updateState({ status: 'unauthenticated' });
  }
}

/** Instance جاهزة للاستخدام المباشر */
export const alxApiAuthGateway = new AlxApiAuthGateway();
