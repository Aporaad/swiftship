import { describe, expect, it } from 'vitest';
import { SELECT_FIELDS } from './select-fields';

describe('explicit read projections', () => {
  it('defines projections for every system surface migrated in this batch', () => {
    expect(Object.keys(SELECT_FIELDS)).toEqual([
      'currency',
      'currencyRate',
      'jobRequest',
      'portalUser',
      'product',
      'orderItem',
      'returnedProduct',
      'user',
    ]);
  });

  it('never uses a wildcard in application-owned projections', () => {
    for (const projection of Object.values(SELECT_FIELDS)) {
      expect(projection).not.toContain('*');
      expect(projection.split(',').every((field) => /^[a-z][a-z0-9_]*$/.test(field))).toBe(true);
    }
  });
});
