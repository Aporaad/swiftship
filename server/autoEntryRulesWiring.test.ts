import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const managementTab = readFileSync(path.join(projectRoot, 'src/components/OrderStatusManagementTab.tsx'), 'utf8');
const amountSourceList = readFileSync(path.join(projectRoot, 'src/components/AutoEntryAmountSourceList.tsx'), 'utf8');

describe('auto entry rules UI wiring', () => {
  it('renders every amount source from the shared catalog as a multi-select control', () => {
    expect(managementTab).toContain('AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS');
    expect(managementTab).toContain('<AutoEntryAmountSourceList');
    expect(managementTab).toContain('amountSources');
    expect(managementTab).toContain('يجمع النظام المصادر المختارة');
    expect(amountSourceList).toContain('AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS.map(option =>');
    expect(amountSourceList).toContain('type="checkbox"');
  });

  it('exposes currency and zero-value controls beside the amount sources', () => {
    expect(managementTab).toContain('currency: entryFormData.currency');
    expect(managementTab).toContain('skipWhenZero');
    expect(managementTab).toContain('تجاوز القيد إذا كان مجموع المصادر صفراً');
  });
});
