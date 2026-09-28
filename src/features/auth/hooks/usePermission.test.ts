/**
 * اختبارات usePermission Hook
 * Tests for usePermission — verifies unified permission checking logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERM } from '../../../shared/permissions';

// ── محاكاة useRole / Mock useRole ──────────────────────────────
const mockHasPermission = vi.fn<(permission: string) => boolean>();


vi.mock('../../../hooks/useRole', () => ({
  useRole: () => ({
    hasPermission: mockHasPermission,
    loading: false,
    role: 'Employee',
    permissions: [],
    profile: null,
    sessionId: 'test-sess',
    signOut: vi.fn(),
  }),
}));

// محاكاة useMemo / Mock useMemo to return the value directly
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useMemo: (fn: () => unknown) => fn(),
  };
});

import { usePermission } from './usePermission';

describe('usePermission', () => {
  beforeEach(() => {
    mockHasPermission.mockReset();
  });

  // ── can() ──────────────────────────────────────────────────────
  describe('can()', () => {
    it('يعيد true عندما يملك المستخدم الصلاحية / returns true when user has the permission', () => {
      mockHasPermission.mockReturnValue(true);
      const { can } = usePermission();
      expect(can(PERM.EDIT_ORDERS)).toBe(true);
      expect(mockHasPermission).toHaveBeenCalledWith(PERM.EDIT_ORDERS);
    });

    it('يعيد false عندما لا يملك المستخدم الصلاحية / returns false when permission is missing', () => {
      mockHasPermission.mockReturnValue(false);
      const { can } = usePermission();
      expect(can(PERM.DELETE_ORDERS)).toBe(false);
    });

    it('يعيد true عند wildcard (*) — يشمل Admin / returns true for wildcard Admin', () => {
      // hasPermission يُعيد true إذا كانت الصلاحيات تحتوي '*'
      // hasPermission returns true if permissions include '*'
      mockHasPermission.mockReturnValue(true);
      const { can } = usePermission();
      expect(can(PERM.DELETE_PAID_ORDERS)).toBe(true);
    });
  });

  // ── canAll() ───────────────────────────────────────────────────
  describe('canAll()', () => {
    it('يعيد true فقط إذا توفرت جميع الصلاحيات / returns true only if ALL permissions present', () => {
      const allowedPermissions = new Set<string>([PERM.EDIT_ORDERS, PERM.VIEW_ORDERS]);
      mockHasPermission.mockImplementation((p) => allowedPermissions.has(p));
      const { canAll } = usePermission();
      expect(canAll(PERM.EDIT_ORDERS, PERM.VIEW_ORDERS)).toBe(true);
      expect(canAll(PERM.EDIT_ORDERS, PERM.DELETE_ORDERS)).toBe(false);
    });

    it('يعيد false إذا غابت صلاحية واحدة / returns false if one permission missing', () => {
      mockHasPermission.mockImplementation((p) => p === PERM.EDIT_ORDERS);
      const { canAll } = usePermission();
      expect(canAll(PERM.EDIT_ORDERS, PERM.DELETE_ORDERS)).toBe(false);
    });
  });

  // ── canAny() ───────────────────────────────────────────────────
  describe('canAny()', () => {
    it('يعيد true إذا توفرت أي صلاحية / returns true if ANY permission present', () => {
      mockHasPermission.mockImplementation((p) => p === PERM.EDIT_ORDERS);
      const { canAny } = usePermission();
      expect(canAny(PERM.DELETE_ORDERS, PERM.EDIT_ORDERS)).toBe(true);
    });

    it('يعيد false إذا لم تتوفر أي صلاحية / returns false if NO permission present', () => {
      mockHasPermission.mockReturnValue(false);
      const { canAny } = usePermission();
      expect(canAny(PERM.DELETE_ORDERS, PERM.EDIT_ORDERS)).toBe(false);
    });
  });

  // ── loading ────────────────────────────────────────────────────
  describe('loading', () => {
    it('يعكس حالة التحميل من useRole / reflects loading state from useRole', () => {
      const { loading } = usePermission();
      expect(loading).toBe(false);
    });
  });
});
