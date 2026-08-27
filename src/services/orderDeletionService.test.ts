import { describe, expect, it } from 'vitest';
import { normalizeOrderIds } from './orderDeletionService';

describe('orderDeletionService', () => {
  it('removes empty and repeated order identifiers before a bulk deletion request', () => {
    expect(normalizeOrderIds([' ord-1 ', '', 'ord-2', 'ord-1', '   '])).toEqual(['ord-1', 'ord-2']);
  });
});
