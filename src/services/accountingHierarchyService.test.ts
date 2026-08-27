import { describe, expect, it } from 'vitest';
import { accountingHierarchyService, hierarchyCodeRules, naturalBalanceDelta } from './accountingHierarchyService';

describe('حارس الحسابات المالية', () => {
  it('يمنع الحسابات التنظيمية أو المعطلة من الظهور كحسابات قابلة للقيد', () => {
    const available = accountingHierarchyService.filterPostingAccounts([
      { id: '1132-0001', isActive: true },
      { id: '1132', isActive: true, isHierarchyNode: true },
      { id: '1132-0002', isActive: false },
    ]);

    expect(available.map((account) => account.id)).toEqual(['1132-0001']);
  });

  it('يعرض الحساب المرحّل عندما يطابق كوده ومعرّفه ومساره الهرمي', () => {
    const available = accountingHierarchyService.filterPostingAccounts([
      { id: '1132-0011', accountCode: '1132-0011', accSubId: '113', groupId: '1132', accountSeq: 11, curNo: 1, isActive: true },
      { id: '1130-0001', accountCode: '1130-0001', accSubId: '113', accountSeq: 1, curNo: 1, isActive: true },
      { id: '1132-0012', accountCode: '1132-0012', isActive: true },
    ], true);

    expect(available.map((account) => account.id)).toEqual(['1132-0011', '1130-0001']);
  });

  it('يفرض سقف الرصيد الطبيعي الموجب للحساب المالي', () => {
    expect(() => accountingHierarchyService.validateNaturalBalanceLimit({
      id: '1132-0001',
      balance: 80,
      limitedBalance: 100,
    }, 21)).toThrow('exceeds its configured natural balance limit');

    expect(() => accountingHierarchyService.validateNaturalBalanceLimit({
      id: '2122-0001',
      balance: 80,
      limitedBalance: 100,
    }, -30)).not.toThrow();
  });

  it('يحسب أثر الحركة على الرصيد الطبيعي للأنواع المدينة والدائنة', () => {
    expect(naturalBalanceDelta('Asset', 'Debit', 75)).toBe(75);
    expect(naturalBalanceDelta('Expense', 'Credit', 75)).toBe(-75);
    expect(naturalBalanceDelta('Liability', 'Credit', 75)).toBe(75);
    expect(naturalBalanceDelta('Equity', 'Debit', 75)).toBe(-75);
    expect(naturalBalanceDelta('Revenue', 'Credit', 75)).toBe(75);
    expect(naturalBalanceDelta('Liability', 'Credit', 75)).toBeGreaterThan(0);
  });
});

describe('قواعد أكواد الشجرة', () => {
  it('ينشئ ترقيمًا هرميًا متسلسلًا ويحافظ على قالب الحساب المالي ذي الأرقام الأربعة', () => {
    expect(hierarchyCodeRules.nextRootCode([{ accountCode: '1' }, { accountCode: '2' }])).toBe('3');
    expect(hierarchyCodeRules.nextChildCode('11', [{ accountCode: '111' }, { accountCode: '112' }])).toBe('113');
    expect(hierarchyCodeRules.postingPrefix('113')).toBe('1130');
    expect(hierarchyCodeRules.formatPostingCode('1132', 7)).toBe('1132-0007');
  });

  it('يتحقق من بنية الكود ويرفض أي حساب مالي خارج مسار الأب المختار', () => {
    expect(hierarchyCodeRules.validateCode('group', '1132', { subCode: '113' })).toBeNull();
    expect(hierarchyCodeRules.validateCode('ledger', '1132-0001', { subCode: '113', groupCode: '1132' })).toBeNull();
    expect(hierarchyCodeRules.validateCode('ledger', '1142-0001', { subCode: '113', groupCode: '1132' })).toContain('1132-0001');
  });
});
