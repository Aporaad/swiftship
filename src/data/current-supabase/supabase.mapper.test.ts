import { describe, expect, it } from 'vitest';
import { DataGatewayError, mapRow, mapSupabaseError } from './supabase.mapper';

describe('supabase mapper', () => {
  it('maps a valid row through an explicit mapper', () => {
    expect(mapRow({ user_id: 'u1', secret: 'hidden' }, (row) => ({ id: String(row.user_id) }))).toEqual({ id: 'u1' });
  });

  it('rejects an invalid raw row', () => {
    expect(() => mapRow(null, (row) => row)).toThrow(DataGatewayError);
  });

  it('normalizes Supabase failures without exposing raw database messages', () => {
    const error = mapSupabaseError({ code: 'PGRST116', message: 'private database detail' });
    expect(error).toMatchObject({ code: 'PGRST116', message: 'Data gateway request failed.', details: [] });
    expect(error.toEnvelope()).toEqual({
      success: false,
      error: { code: 'PGRST116', message: 'Data gateway request failed.', details: [] },
    });
    expect(error.causeValue).toMatchObject({ message: 'private database detail' });
  });

  it('normalizes malformed upstream errors safely', () => {
    expect(mapSupabaseError(null).toEnvelope()).toEqual({
      success: false,
      error: { code: 'DATA_GATEWAY_ERROR', message: 'Data gateway request failed.', details: [] },
    });
  });
});
