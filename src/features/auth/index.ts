export type { AuthViewModel } from './types';
export type { AuthFeatureApi } from './api';
export { AuthSessionProvider, useAuthSession } from './AuthSessionProvider';
export type { AuthSessionContextValue } from './AuthSessionProvider';

// ── توحيد الصلاحيات — Phase 6 / Permission Unification ──────────
export { usePermission } from './hooks/usePermission';
export type { UsePermissionResult } from './hooks/usePermission';
export { PermissionGate } from './components/PermissionGate';
