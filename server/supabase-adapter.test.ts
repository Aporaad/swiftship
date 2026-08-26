import { describe, expect, it } from 'vitest';
import { supabase } from '../src/lib/supabase-firebase-adapter';

describe('Supabase adapter runtime configuration', () => {
  it('initializes the original application adapter with the injected project URL', () => {
    const client = supabase as unknown as { supabaseUrl?: string; supabaseKey?: string };
    expect(client.supabaseUrl).toBe(process.env.SUPABASE_URL);
    expect(client.supabaseUrl).not.toContain('placeholder-project.supabase.co');
    expect(client.supabaseKey).toBe(process.env.SUPABASE_ANON_KEY);
    expect(client.supabaseKey).not.toBe('placeholder-key');
  });
});
