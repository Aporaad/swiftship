import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ManualJournalAdjustmentModal from './ManualJournalAdjustmentModal';

const baseProps = {
  activeCurrencies: [],
  adjustData: { type: 'Debit', amount: '', currency: 'YER', title: '', recipientName: '', notes: '' },
  adjustLoading: false,
  adjustSalaryMonth: '2026-09',
  financialAccounts: [],
  handleAddAdjustment: vi.fn().mockResolvedValue(undefined),
  isAr: false,
  isSalaryPayment: false,
  isSourceDropdownOpen: false,
  isTargetDropdownOpen: false,
  postingFinancialAccounts: [],
  setAdjustData: vi.fn(),
  setAdjustSalaryMonth: vi.fn(),
  setIsAdjustmentModalOpen: vi.fn(),
  setIsSalaryPayment: vi.fn(),
  setIsSourceDropdownOpen: vi.fn(),
  setIsTargetDropdownOpen: vi.fn(),
  setSourceAccountId: vi.fn(),
  setSourceSearchQuery: vi.fn(),
  setTargetAccountId: vi.fn(),
  setTargetSearchQuery: vi.fn(),
  setTargetType: vi.fn(),
  settings: { systemName: 'Swiftship' },
  sourceAccountId: '',
  sourceSearchQuery: '',
  targetAccountId: '',
  targetSearchQuery: '',
  targetType: 'general',
};

describe('ManualJournalAdjustmentModal', () => {
  it('يعرض نموذج القيد وحقول اختيار الحسابات دون الاعتماد على قاعدة البيانات', () => {
    const markup = renderToStaticMarkup(
      <ManualJournalAdjustmentModal {...baseProps} activeCurrencies={[]} isAdjustmentModalOpen />,
    );
    expect(markup).toContain('Add Ledger Journal Adjustment Voucher');
    expect(markup).toContain('Source Account');
    expect(markup).toContain('Target Account');
  });

  it('لا يرسم النافذة عندما تكون مغلقة', () => {
    const markup = renderToStaticMarkup(
      <ManualJournalAdjustmentModal {...baseProps} isAdjustmentModalOpen={false} />,
    );
    expect(markup).toBe('');
  });
});
