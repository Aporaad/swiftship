import { describe, expect, it } from 'vitest';

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

describe('Supabase environment configuration', () => {
  it('provides matching client and server settings', () => {
    expect(supabaseUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
    expect(supabaseAnonKey).toMatch(/^(sb_publishable_|eyJ)/);
    expect(process.env.VITE_SUPABASE_URL).toBe(process.env.SUPABASE_URL);
    expect(process.env.VITE_SUPABASE_ANON_KEY).toBe(process.env.SUPABASE_ANON_KEY);
  });

  it('accepts the configured API key at the Supabase Auth settings endpoint', async () => {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey! },
    });

    expect(response.status).toBe(200);
  }, 15_000);
});
