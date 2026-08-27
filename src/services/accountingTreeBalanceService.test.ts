import { describe, expect, it } from 'vitest';
import { calculateAccountingTreeBalances, convertUsingDatabaseRate } from './accountingTreeBalanceService';
import { validateAccountingTreeImport } from './accountingTreeFileService';

const currencies = [
  { cur_id: 1, code: 'YER', isDefault: true, currentPrice: 1 },
  { cur_id: 2, code: 'USD', isDefault: false, currentPrice: 500 },
];

describe('أرصدة شجرة الحسابات المحوّلة', () => {
  it('يجمع أرصدة الأبناء بعد تحويلها إلى عملة الأب وإلى عملة النظام', () => {
    const result = calculateAccountingTreeBalances({
      roots: [{ id: '1', accountType: 'Asset', curNo: 1 }],
      mains: [{ id: '11', accountId: '1', curNo: 1 }],
      subs: [{ id: '113', accMainId: '11', curNo: 1 }],
      groups: [{ id: '1132', accSubId: '113', curNo: 1 }],
      accounts: [
        { id: '1132-0001', accountCode: '1132-0001', accSubId: '113', groupId: '1132', curNo: 2, currency: 'USD', balance: 10 },
        { id: '1132-0002', accountCode: '1132-0002', accSubId: '113', groupId: '1132', curNo: 1, currency: 'YER', balance: 50 },
      ],
      currencies,
      liveBalances: { byId: {}, byCode: {} },
    });

    expect(result.ledgerBalances['1132-0001'].systemBalance).toBe(5000);
    expect(result.groupBalances['1132'].nativeBalance).toBe(5050);
    expect(result.subBalances['113'].systemBalance).toBe(5050);
    expect(result.rootBalances['1'].systemBalance).toBe(5050);
    expect(result.totals.assets).toBe(5050);
  });

  it('يرفض إظهار قيمة محولة عندما لا يتوافر سعر صرف مسجل', () => {
    expect(convertUsingDatabaseRate(10, 'EUR', 'YER', currencies, 'YER')).toBeNull();
  });
});

describe('استيراد شجرة الحسابات', () => {
  it('يرفض التكرار ويتجاهل الأرصدة المستوردة حتى لا تنشئ قيودًا أو أرصدة افتتاحية', () => {
    const validation = validateAccountingTreeImport([
      { level: 'ledger', id: '1132-0099', accountCode: '1132-0099', accNameAr: 'عميل مستورد', parentId: '1132', currency: 'YER', balance: 99999 },
      { level: 'ledger', id: '1132-0099', accountCode: '1132-0099', accNameAr: 'تكرار', parentId: '1132', currency: 'YER' },
    ], {
      currencies,
      existingNodes: [{ id: '1132', level: 'group', parentId: '113', accSubId: '113' }],
    });

    expect(validation.errors.some((error) => error.includes('مكرر'))).toBe(true);
    expect(validation.warnings.some((warning) => warning.includes('تم تجاهل أي رصيد'))).toBe(true);
  });
});
