/**
 * Transitional compatibility surface for callers being migrated to feature gateways.
 * Keep legacy-shaped reads and writes behind this single current data-layer boundary;
 * do not add new dependencies here. New code must consume a typed feature gateway.
 */
export * from '../../lib/supabase-adapter';
