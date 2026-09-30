import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SalaryVoucherModal from './SalaryVoucherModal';

const voucher = {
  voucherCode: 'SAL-2026-09-001',
  employeeName: 'Employee Test',
  accountCode: '2130-0001',
  paidAt: '2026-09-30T10:30:00.000Z',
  salaryMonth: '2026-09',
  amount: 750,
  currency: 'USD',
  notes: 'September salary',
};

describe('SalaryVoucherModal', () => {
  it('يعرض بيانات السند واسم الشركة في نسخة الطباعة', () => {
    const markup = renderToStaticMarkup(
      <SalaryVoucherModal
        isAr={false}
        settings={{ systemName: 'Swiftship' }}
        selectedSalaryVoucher={voucher}
        setSelectedSalaryVoucher={vi.fn()}
      />,
    );

    expect(markup).toContain('Official Salary Slip Voucher');
    expect(markup).toContain('Swiftship');
    expect(markup).toContain('SAL-2026-09-001');
    expect(markup).toContain('September salary');
  });

  it('لا يعرض نافذة عندما لا يوجد سند محدد', () => {
    const markup = renderToStaticMarkup(
      <SalaryVoucherModal
        isAr
        settings={{}}
        selectedSalaryVoucher={null}
        setSelectedSalaryVoucher={vi.fn()}
      />,
    );

    expect(markup).not.toContain('سند صرف راتب شهري رسمي');
  });
});
