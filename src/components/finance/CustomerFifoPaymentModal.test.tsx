import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CustomerFifoPaymentModal from './CustomerFifoPaymentModal';

const baseProps = {
  auditedCustomerId: 'customer-1',
  customerLedgerDetails: {
    customer: { fullName: 'Customer Test' },
    currentOutstandingBalance: 2500,
  },
  handleCustomerFIFOPayment: vi.fn().mockResolvedValue(undefined),
  isAr: false,
  orders: [{ customerId: 'customer-1', amountRemaining: '2500' }],
  payAmount: '',
  payLoading: false,
  payNotes: '',
  setIsPayModalOpen: vi.fn(),
  setPayAmount: vi.fn(),
  setPayNotes: vi.fn(),
};

describe('CustomerFifoPaymentModal', () => {
  it('يعرض رصيد العميل وحقول السداد عند فتح النافذة', () => {
    const markup = renderToStaticMarkup(
      <CustomerFifoPaymentModal {...baseProps} isPayModalOpen />,
    );
    expect(markup).toContain('Apply Balance Payment FIFO');
    expect(markup).toContain('Customer Test');
    expect(markup).toContain('2,500');
  });

  it('لا يعرض النافذة عند إغلاقها', () => {
    const markup = renderToStaticMarkup(
      <CustomerFifoPaymentModal {...baseProps} isPayModalOpen={false} />,
    );
    expect(markup).toBe('');
  });
});
