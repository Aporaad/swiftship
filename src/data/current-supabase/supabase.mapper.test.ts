import { describe, expect, it } from 'vitest';
import { DataGatewayError, mapRow, mapSupabaseError } from './supabase.mapper';

describe('supabase mapper', () => {
  it('maps a valid row through an explicit mapper', () => {
    expect(mapRow({ user_id: 'u1', secret: 'hidden' }, (row) => ({ id: String(row.user_id) }))).toEqual({ id: 'u1' });
  });

  it('rejects an invalid raw row', () => {
    expect(() => mapRow(null, (row) => row)).toThrow(DataGatewayError);
  });

  it('normalizes Supabase failures', () => {
    const error = mapSupabaseError({ code: 'PGRST116', message: 'not found' });
    expect(error).toMatchObject({ code: 'PGRST116', message: 'not found' });
  });
});
