import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sourceRoot = resolve(process.cwd(), 'src');
const allowedBoundary = resolve(sourceRoot, 'data/legacy/legacy-compat.ts');
const boundaryTest = resolve(sourceRoot, 'data/contracts/legacy-boundary.test.ts');

function collectSourceFiles(directory: string): string[] {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe('legacy adapter boundary', () => {
  it('keeps direct lib/supabase imports inside the single compatibility boundary', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((file) => file !== allowedBoundary)
      .filter((file) => /(?:from|export \*)\s+['\"][^'\"]*lib\/supabase(?:-adapter)?['\"]/.test(readFileSync(file, 'utf8')));

    expect(violations).toEqual([]);
  });

  it('removes imports of the deleted legacy-adapter shim', () => {
    const legacyReferences = collectSourceFiles(sourceRoot)
      .filter((file) => file !== allowedBoundary && file !== boundaryTest)
      .filter((file) => /legacy-adapter/.test(readFileSync(file, 'utf8')));

    expect(legacyReferences).toEqual([]);
  });
});
