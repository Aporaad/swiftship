import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('order party wiring', () => {
  it('defines a conditional staff/customer relationship with specific FK columns and a linked financial account', () => {
    const migration = projectFile('supabase/migrations/202608260230_add_order_party_employee_courier.sql');
    const reconciliation = projectFile('supabase/migrations/202608260245_reconcile_order_party_staff_accounts.sql');
    expect(migration).toContain('order_party_type');
    expect(migration).toContain('employee_id');
    expect(migration).toContain('courier_id');
    expect(migration).toContain('REFERENCES public.employees(id)');
    expect(migration).toContain('REFERENCES public.couriers(id)');
    expect(migration).toContain('REFERENCES public.accounts(id)');
    expect(migration).toContain('validate_order_party');
    expect(reconciliation).toContain('FOREIGN KEY (employee_id) REFERENCES public.employees(id)');
    expect(reconciliation).toContain('ensure_entity_financial_account');
    expect(reconciliation).toContain('link_employee_financial_account');
    expect(reconciliation).toContain('link_courier_financial_account');
  });

  it('uses the shared list picker in both order forms and keeps account resolution party-aware', () => {
    const createModal = projectFile('src/components/orders/CreateOrderModal.tsx');
    const editModal = projectFile('src/components/orders/EditOrderModal.tsx');
    const picker = projectFile('src/components/orders/OrderPartyPicker.tsx');
    const financialService = projectFile('src/services/financialAccountService.ts');
    const partyService = projectFile('src/services/orderPartyService.ts');
    expect(createModal).toContain('OrderPartyPicker');
    expect(editModal).toContain('OrderPartyPicker');
    expect(picker).toContain('الطلب لموظف/مندوب');
    expect(picker).toContain('الاختيار من القائمة');
    expect(picker).toContain('role="dialog"');
    expect(picker).toContain('aria-modal="true"');
    expect(picker).toContain('createPortal');
    expect(picker).toContain('document.body');
    expect(picker).toContain('z-[999999]');
    expect(createModal).toContain('!formData.customerId && !isStaffOrder');
    expect(partyService).toContain("staffOnly ? party.type === 'customer' : party.type !== 'customer'");
    expect(financialService).toContain('entities.orderParty || entities.customer');
    expect(createModal).toContain('orderCurrency, currency: orderCurrency, exchangeRate: 1');
    expect(editModal).toContain('currency: loadedOrderCurrency');
  });
});
