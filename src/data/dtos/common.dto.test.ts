import { describe, expect, it } from 'vitest';
import { asIsoUtc, makeObjectSchema } from './common.dto';

describe('permanent DTO helpers', () => {
  it('normalizes timestamps to ISO UTC', () => {
    expect(asIsoUtc('2026-09-28T07:00:00+03:00')).toBe('2026-09-28T04:00:00.000Z');
  });

  it('rejects invalid timestamps', () => {
    expect(() => asIsoUtc('not-a-date')).toThrow();
  });

  it('validates required input keys', () => {
    const schema = makeObjectSchema<{ name: string }>(['name']);
    expect(schema.safeParse({ name: 'valid' }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });
});
