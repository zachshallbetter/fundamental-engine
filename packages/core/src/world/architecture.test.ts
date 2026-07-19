/**
 * F1.1c — the no-escape-hatch architectural guard.
 * The generic world kernel must NOT import the field runtime or reference field-specific types.
 * Only the adapter (`adapters/field-runtime.ts`) may know the field — the one-way bridge.
 * This test fails if that boundary is ever crossed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** Strip comments so the guard checks code coupling, not prose that explains the finding. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const KERNEL_FILES = ['world.ts', 'dynamics.ts', 'kernel.ts', 'envelope.ts'];

const FORBIDDEN: RegExp[] = [
  /from ['"][^'"]*engine\/field/, // the field runtime implementation
  /from ['"][^'"]*\/forces\//, // force implementations
  /from ['"][^'"]*\/recipes\//, // pattern/recipe compiler
  /\bFieldPattern\b/,
  /\bCompiledPattern\b/,
  /\bFieldRuntime\b/,
  /\bFieldHandle\b/,
  /\bFieldSnapshot\b/,
];

test('F1.1c no-escape-hatch: the world kernel imports nothing field-specific', () => {
  for (const file of KERNEL_FILES) {
    const src = stripComments(readFileSync(join(here, file), 'utf8'));
    for (const pattern of FORBIDDEN) {
      assert.ok(!pattern.test(src), `${file} must not match ${pattern} — the kernel must not know the field`);
    }
  }
});

test('F1.1c the adapter is the one-way bridge (it MAY import the field)', () => {
  const adapter = readFileSync(join(here, 'adapters', 'field-runtime.ts'), 'utf8');
  assert.ok(/engine\/field/.test(adapter), 'the adapter is expected to import the field runtime');
});
