/**
 * Contract-level coverage guard (RC-6 / #323) — every public option and metric is exercised by a test.
 *
 * This is a *meta*-test: it parses the public option surface (`FieldOptions`) and the public metric
 * surface out of `core/types.ts`, then scans the whole `packages/*` test corpus and fails if any
 * public name has no test referencing it. It can't prove a test is *good*, but it makes it impossible
 * to add a public option/metric and ship it with zero coverage — the exact gap RC-6 closes.
 *
 * When you add a public option/metric, add a test that names it (or, for a pure internal seam, add it
 * to EXEMPT below with the reason). See docs/canonical/lifecycle-contract.md for the lifecycle side.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const packagesDir = join(here, '..', '..'); // packages/core/src → packages/

/** every *.test.ts source under packages/* (excluding this guard), concatenated. */
function testCorpus(): string {
  let corpus = '';
  for (const pkg of readdirSync(packagesDir)) {
    const srcDir = join(packagesDir, pkg, 'src');
    let entries: string[];
    try {
      entries = readdirSync(srcDir);
    } catch {
      continue; // package has no src/
    }
    for (const f of entries) {
      if (!f.endsWith('.test.ts') || f === 'contract-coverage.test.ts') continue;
      corpus += readFileSync(join(srcDir, f), 'utf8') + '\n';
    }
  }
  return corpus;
}

/** the keys declared inside an `export interface <name> { … }` block in core/types.ts. */
function interfaceKeys(name: string): string[] {
  const src = readFileSync(join(here, 'core', 'types.ts'), 'utf8');
  const start = src.indexOf(`export interface ${name}`);
  assert.notEqual(start, -1, `interface ${name} not found in core/types.ts`);
  const open = src.indexOf('{', start);
  // walk to the matching brace so nested `{ … }` option types don't end the block early.
  let depth = 0;
  let end = open;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const body = src.slice(open + 1, end);
  const keys = new Set<string>();
  for (const m of body.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\??:/gm)) keys.add(m[1]);
  return [...keys];
}

// pure injection seams: exercised through behavior, not by literal name. Documented, not silently skipped.
const EXEMPT = new Set([
  'rng', // injected RNG — exercised via deterministic-output tests, not by literal name
  'now', // injected clock — same
  'feedbackSink', // platform feedback seam — exercised by the elements platform-runtime tests
  'overlayCanvas', // the canvas element the surface owns — exercised via overlay tests by behavior
  'overlayCanvasProvider', // lazy overlay-canvas factory (#676) — exercised in core/option-seams.test.ts
  'overlayBackend', // custom RenderBackend injection seam — exercised via the overlay-mode tests
]);

test('every public FieldOptions key is referenced by a test (RC-6 contract coverage)', () => {
  const corpus = testCorpus();
  const missing = interfaceKeys('FieldOptions')
    .filter((k) => !EXEMPT.has(k))
    .filter((k) => !corpus.includes(k));
  assert.deepEqual(
    missing,
    [],
    `these public FieldOptions have no test referencing them: ${missing.join(', ')}\n` +
      `Add a test that names each, or add it to EXEMPT (with a reason) if it's a pure internal seam.`,
  );
});

test('the public metric surface is referenced by a test (RC-6 contract coverage)', () => {
  const corpus = testCorpus();
  // the documented readable output of a field handle (the "metric" lane). `sample`/`fieldAt` live on
  // the internal FieldEnv/Field2D accessors, not the public handle — particleCount() is the handle metric.
  const metrics = ['particleCount'];
  const missing = metrics.filter((m) => !corpus.includes(m));
  assert.deepEqual(missing, [], `these public metrics have no test referencing them: ${missing.join(', ')}`);
});
