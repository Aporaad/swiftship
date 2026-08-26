import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const setDoc = vi.fn();
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const from = vi.fn(() => ({ update }));
  return { setDoc, update, from };
});

vi.mock('../lib/supabase', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  setDoc: mocks.setDoc,
  doc: vi.fn((_: unknown, id: string) => ({ path: 'auto_entries', id })),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  db: {},
  supabase: { from: mocks.from },
}));

vi.mock('./financialAccountService', () => ({
  financialAccountService: {
    getExchangeRates: vi.fn(),
    convertToTargetCurrency: vi.fn(),
    triggerAutomaticVoucher: vi.fn(),
  },
}));

import { autoEntryService } from './autoEntryService';

describe('autoEntryService.saveAutoEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockReturnValue({ eq: vi.fn(async () => ({ error: null })) });
  });

  it('clears a previously stored currency and saves no currency key for the order-default option', async () => {
    await autoEntryService.saveAutoEntry({
      id: 'rule-default-currency',
      statusId: 2,
      nameAr: 'قيد اختبار',
      nameEn: 'Test rule',
      isActive: true,
      amountSource: 'order_total',
      amountSources: ['order_total'],
      debitAccount: { id: 'customer_linked', code: '1130', name: 'Customer', type: 'dynamic' },
      creditAccount: { id: 'sys_profit_account', code: '4000', name: 'Profit', type: 'system' },
      descriptionTempAr: 'اختبار',
      descriptionTempEn: 'Test',
      currency: undefined,
    });

    expect(mocks.from).toHaveBeenCalledWith('auto_entries');
    expect(mocks.update).toHaveBeenCalledWith({ currency: null });
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
    const [, payload] = mocks.setDoc.mock.calls[0];
    expect(payload).not.toHaveProperty('currency');
    expect(payload).toMatchObject({ id: 'rule-default-currency', amountSources: ['order_total'] });
  });
});
