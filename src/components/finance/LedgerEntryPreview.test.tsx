import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import LedgerEntryPreview from './LedgerEntryPreview';

const selectedEntry = {
  id: 'entry-1',
  refNumber: 'JV-2026-0001',
  type: 'Debit',
  date: new Date('2026-09-30T10:30:00.000Z'),
  title: 'اختبار قيد مزدوج',
  notes: 'ملاحظة الاختبار',
  debitPartyName: 'الصندوق',
  creditPartyName: 'العميل',
  amountOriginal: 125,
  currencyOriginal: 'USD',
  amount: 31250,
  module: 'adjustment',
};

describe('LedgerEntryPreview', () => {
  it('يعرض تفاصيل القيد وقالب الطباعة عند اختيار قيد', () => {
    const markup = renderToStaticMarkup(
      <LedgerEntryPreview
        isAr={false}
        selectedLedgerEntry={selectedEntry}
        setSelectedLedgerEntry={vi.fn()}
        triggerPrint={vi.fn()}
      />,
    );

    expect(markup).toContain('Financial Journal Entry Preview');
    expect(markup).toContain('JV-2026-0001');
    expect(markup).toContain('single-voucher-print-wrapper');
    expect(markup).toContain('BALANCED JOURNAL VOUCHER');
  });

  it('يبقي غلاف الطباعة المخفي موجودًا دون إظهار النافذة عندما لا يوجد قيد محدد', () => {
    const markup = renderToStaticMarkup(
      <LedgerEntryPreview
        isAr
        selectedLedgerEntry={null}
        setSelectedLedgerEntry={vi.fn()}
        triggerPrint={vi.fn()}
      />,
    );

    expect(markup).toContain('single-voucher-print-wrapper');
    expect(markup).not.toContain('معاينة القيد المالي والترحيل الدفتري');
  });
});
