import { describe, expect, it } from 'vitest';

const integrationEnabled = process.env.RUN_SUPABASE_INTEGRATION_TESTS === '1';
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

describe.skipIf(!integrationEnabled)('Supabase staging integration', () => {
  it('provides matching client and server settings', () => {
    expect(supabaseUrl, 'Set SUPABASE_URL to the isolated staging project URL').toMatch(
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/,
    );
    expect(supabaseAnonKey, 'Set a staging anon/publishable key').toMatch(/^(sb_publishable_|eyJ)/);
    expect(process.env.VITE_SUPABASE_URL).toBe(supabaseUrl);
    expect(process.env.VITE_SUPABASE_ANON_KEY).toBe(supabaseAnonKey);
  });

  it('accepts the configured key at the staging Auth settings endpoint', async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase integration requires SUPABASE_URL and SUPABASE_ANON_KEY for staging.');
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    });

    expect(response.status).toBe(200);
  }, 15_000);
});
