/**
 * F1.3 — architectural guards. The generic world kernel must not import the field runtime, reference
 * field-specific types, expose `any`, or leave an untyped escape hatch. Only the adapter
 * (`adapters/field-runtime.ts`) may know the field — the one-way bridge. Plus capability-consistency
 * checks so the field contract cannot over-claim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { worldFromCompiledPattern, fieldRuntimeDynamics } from './adapters/field-runtime.ts';
import { validateDynamicsContract } from './dynamics.ts';
import type { FieldRecipe } from '../recipes/schema.ts';
import type { CompiledPattern } from '../recipes/compile.ts';

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
  /:\s*any\b/, // no `any` type
  /<any[>,]/, // no `any` generic argument
  /\bFunction\b/, // no untyped Function escape hatch
];

test('F1.3 no-escape-hatch: the world kernel imports nothing field-specific, exposes no any/Function', () => {
  for (const file of KERNEL_FILES) {
    const src = stripComments(readFileSync(join(here, file), 'utf8'));
    for (const pattern of FORBIDDEN) {
      assert.ok(!pattern.test(src), `${file} must not match ${pattern} — kernel must stay generic & typed`);
    }
  }
});

test('F1.3 the World declaration retains no execution-substrate/contract instance', () => {
  const src = stripComments(readFileSync(join(here, 'world.ts'), 'utf8'));
  assert.ok(!/\bDynamicsContract\b/.test(src), 'World must not hold a DynamicsContract instance (the kernel binds it)');
});

test('F1.3 the adapter is the one-way bridge (it MAY import the field)', () => {
  const adapter = readFileSync(join(here, 'adapters', 'field-runtime.ts'), 'utf8');
  assert.ok(/engine\/field/.test(adapter), 'the adapter is expected to import the field runtime');
});

test('F1.3 capability consistency: the field contract does not over-claim', () => {
  const compiled: CompiledPattern = {
    id: 'p', recipe: { id: 'p' } as unknown as FieldRecipe,
    bodies: [{ attributes: { 'data-body': 'attract' }, tokens: ['attract'] }],
    relationships: [], feedback: [], diagnostics: [], metrics: [], conditions: [],
    render: { underlay: null, overlay: [], heatmap: false, unapplied: [] },
    reducedMotion: { reducedMotion: 'none', meaningWithoutMotion: '', staticOutputs: [] },
  };
  const { world } = worldFromCompiledPattern(compiled);
  const c = fieldRuntimeDynamics(world);
  assert.deepEqual(validateDynamicsContract(c), [], 'field contract is self-consistent');
  // snapshot exists, but replay/restore are NOT implied by it
  assert.equal(c.capabilities.snapshot, true);
  assert.equal(c.capabilities.replay, false);
  assert.equal(c.capabilities.restore, false);
  // opaque-native cannot inspect internal state or declare a transition law
  assert.equal(c.capabilities.inspectInternalState, false);
  assert.equal(c.capabilities.declareTransitionLaw, false);
});
