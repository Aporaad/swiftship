import { describe, expect, it } from 'vitest';
import { PERM } from '../shared/permissions';
import { ALL_PERMISSIONS } from './permissions';

describe('permission catalog contract', () => {
  it('contains every unified permission exactly once', () => {
    const catalogKeys = ALL_PERMISSIONS.map(({ id }) => id).sort();
    const unifiedKeys = [...new Set(Object.values(PERM))].sort();

    expect(new Set(catalogKeys).size).toBe(catalogKeys.length);
    expect(catalogKeys).toEqual(unifiedKeys);
  });
});
