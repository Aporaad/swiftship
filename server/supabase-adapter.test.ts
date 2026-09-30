import { describe, expect, it } from 'vitest';
import { resolveSupabaseConfig } from '../src/lib/supabase-config';

describe('Supabase configuration resolution', () => {
  it('prefers process Vite variables over server aliases and build-time values', () => {
    const config = resolveSupabaseConfig(
      {
        VITE_SUPABASE_URL: 'https://client.example.test',
        SUPABASE_URL: 'https://server.example.test',
        VITE_SUPABASE_ANON_KEY: 'client-key',
        SUPABASE_ANON_KEY: 'server-key',
      },
      {
        VITE_SUPABASE_URL: 'https://build.example.test',
        VITE_SUPABASE_ANON_KEY: 'build-key',
      },
    );

    expect(config).toEqual({
      url: 'https://client.example.test',
      anonKey: 'client-key',
    });
  });

  it('falls back through server aliases to Vite-injected values and then empty strings', () => {
    expect(
      resolveSupabaseConfig(
        { SUPABASE_URL: 'https://server.example.test', SUPABASE_ANON_KEY: 'server-key' },
        { VITE_SUPABASE_URL: 'https://build.example.test', VITE_SUPABASE_ANON_KEY: 'build-key' },
      ),
    ).toEqual({ url: 'https://server.example.test', anonKey: 'server-key' });

    expect(
      resolveSupabaseConfig({}, { VITE_SUPABASE_URL: 'https://build.example.test', VITE_SUPABASE_ANON_KEY: 'build-key' }),
    ).toEqual({ url: 'https://build.example.test', anonKey: 'build-key' });

    expect(resolveSupabaseConfig()).toEqual({ url: '', anonKey: '' });
  });
});
