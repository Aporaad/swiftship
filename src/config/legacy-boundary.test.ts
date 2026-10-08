import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

type BoundaryCategory = 'legacyCompatImport' | 'supabaseRuntimeReference' | 'legacyListener';
type Baseline = Record<BoundaryCategory, string[]>;

const sourceRoot = resolve(process.cwd(), 'src');
const baselinePath = resolve(sourceRoot, 'config/legacy-boundary.baseline.json');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as Baseline;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function categoryMatches(category: BoundaryCategory, source: string): boolean {
  if (category === 'legacyCompatImport') return source.includes('data/legacy/legacy-compat');
  if (category === 'supabaseRuntimeReference') {
    return ['@supabase/supabase-js', 'supabase.from', 'supabase.channel', 'postgres_changes', 'createClient(']
      .some((pattern) => source.includes(pattern));
  }
  return ['onSnapshot(', 'onAuthStateChanged('].some((pattern) => source.includes(pattern));
}

function relative(file: string): string {
  return file.slice(process.cwd().length + 1).replaceAll('\\', '/');
}

describe('Phase 0 — legacy/API-only boundary', () => {
  it('does not allow new legacy or Supabase runtime references beyond the baseline', () => {
    const files = collectSourceFiles(sourceRoot);
    for (const category of ['legacyCompatImport', 'supabaseRuntimeReference', 'legacyListener'] as const) {
      const violations = files
        .filter((file) => categoryMatches(category, readFileSync(file, 'utf8')))
        .map(relative);
      const unexpected = violations.filter((file) => !baseline[category].includes(file));
      expect(unexpected, `New ${category} references detected`).toEqual([]);
    }
  });

  it('keeps the baseline manifest internally valid', () => {
    for (const category of ['legacyCompatImport', 'supabaseRuntimeReference', 'legacyListener'] as const) {
      for (const file of baseline[category]) {
        expect(statSync(resolve(process.cwd(), file)).isFile(), `Missing baseline file: ${file}`).toBe(true);
      }
    }
  });
});
