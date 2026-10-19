/**
 * currencyService.test.ts
 * يختبر تثبيت مرجع سعر الصرف: آخر تسلسل مسجل لا أوله، وإدراج تسلسل جديد عند تجاوز المستخدم له.
 * Covers the rate reference a leg is stamped with: the latest sequence (never the first),
 * and a newly appended sequence when the operator's price differs from it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { gatewayMock } = vi.hoisted(() => ({
  gatewayMock: {
    getCurrencyRates: vi.fn(),
    addCurrencyRate: vi.fn(),
  },
}));

vi.mock('../data/http/settings-currencies-api.gateway', () => ({
  settingsCurrenciesApiGateway: gatewayMock,
}));

import currencyService from './currencyService';

const rate = (rateId: number, sequence: number, price: number) => ({
  rateId,
  currencyId: 3,
  price,
  dayDate: `2026-10-0${sequence}T00:00:00.000Z`,
  sequence,
  updatedBy: 'tester',
  createdAt: `2026-10-0${sequence}T00:00:00.000Z`,
});

// القائمة تصل من API مرتبة من الأحدث إلى الأقدم — newest first, exactly as the repository orders it.
const descendingHistory = [rate(9, 3, 535), rate(6, 2, 534), rate(3, 1, 535)];

describe('currencyService.resolvePriceReference', () => {
  beforeEach(() => {
    gatewayMock.getCurrencyRates.mockReset();
    gatewayMock.addCurrencyRate.mockReset();
  });

  it('يثبّت آخر تسلسل ولا يثبت أول تسلسل في القائمة', async () => {
    gatewayMock.getCurrencyRates.mockResolvedValue(descendingHistory);

    const resolved = await currencyService.resolvePriceReference(3);

    expect(resolved).toEqual({ price: 535, reference: { id: 9, seq: 3 } });
    expect(gatewayMock.addCurrencyRate).not.toHaveBeenCalled();
  });

  it('يدرج تسلسلًا جديدًا عندما يخالف السعر المكتوب آخر سعر موثق ثم يثبت مرجعه', async () => {
    gatewayMock.getCurrencyRates
      .mockResolvedValueOnce(descendingHistory)
      .mockResolvedValueOnce([rate(11, 4, 540), ...descendingHistory]);
    gatewayMock.addCurrencyRate.mockResolvedValue(rate(11, 4, 540));

    const resolved = await currencyService.resolvePriceReference(3, 540);

    expect(gatewayMock.addCurrencyRate).toHaveBeenCalledWith(3, 540);
    expect(resolved).toEqual({ price: 540, reference: { id: 11, seq: 4 } });
  });

  it('لا يدرج شيئًا عندما يطابق السعر المكتوب آخر تسلسل', async () => {
    gatewayMock.getCurrencyRates.mockResolvedValue(descendingHistory);

    const resolved = await currencyService.resolvePriceReference(3, 535);

    expect(gatewayMock.addCurrencyRate).not.toHaveBeenCalled();
    expect(resolved.reference).toEqual({ id: 9, seq: 3 });
  });

  it('يرفض السعر غير الموثق بدل الإبقاء على مرجع قديم', async () => {
    gatewayMock.getCurrencyRates.mockResolvedValue([]);

    await expect(currencyService.resolvePriceReference(3)).rejects.toThrow('EXCHANGE_RATE_NOT_DOCUMENTED');
  });

  it('ينشر خطأ الإدراج بدل تثبيت ساق على تسلسل خاطئ', async () => {
    gatewayMock.getCurrencyRates.mockResolvedValue(descendingHistory);
    gatewayMock.addCurrencyRate.mockRejectedValue(new Error('CURRENCY_RATE_FORBIDDEN'));

    await expect(currencyService.resolvePriceReference(3, 600)).rejects.toThrow('CURRENCY_RATE_FORBIDDEN');
  });
});
