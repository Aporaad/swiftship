import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from './permissions';

describe('الصلاحيات المالية الدقيقة', () => {
  it('يسجل صلاحيات العرض والإنشاء والتعديل والحذف لكل واجهة مالية', () => {
    const ids = new Set(ALL_PERMISSIONS.map((permission) => permission.id));
    for (const subject of ['general_entries', 'compound_entries', 'temporary_entries', 'receipt_vouchers', 'payment_vouchers', 'custody_advances', 'entry_settings']) {
      for (const operation of ['view', 'create', 'edit', 'delete']) {
        expect(ids).toContain(`${operation}_${subject}`);
      }
    }
  });

  it('يفصل الاعتماد والعكس والإبطال وتسوية العهد عن صلاحيات CRUD', () => {
    const ids = new Set(ALL_PERMISSIONS.map((permission) => permission.id));
    expect(ids).toEqual(expect.objectContaining(new Set(['post_financial_entries', 'post_temporary_entries', 'reverse_financial_entries', 'void_financial_entries', 'settle_custody_advances'])));
    expect(DEFAULT_ROLE_PERMISSIONS.Admin).toContain('*');
    expect(DEFAULT_ROLE_PERMISSIONS.Accountant).toContain('post_financial_entries');
  });
});
