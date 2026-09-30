export type SupabaseEnvironment = Record<string, string | undefined>;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** Resolve runtime and Vite-injected Supabase values without reading process globals. */
export function resolveSupabaseConfig(
  processEnv: SupabaseEnvironment = {},
  viteEnv: SupabaseEnvironment = {},
): SupabaseConfig {
  return {
    url:
      processEnv.VITE_SUPABASE_URL ||
      processEnv.SUPABASE_URL ||
      viteEnv.VITE_SUPABASE_URL ||
      '',
    anonKey:
      processEnv.VITE_SUPABASE_ANON_KEY ||
      processEnv.SUPABASE_ANON_KEY ||
      viteEnv.VITE_SUPABASE_ANON_KEY ||
      '',
  };
}
