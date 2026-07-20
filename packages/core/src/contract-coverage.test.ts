/**
 * Contract-level coverage guard (RC-6 / #323) — every public option, metric, and documented body
 * ATTRIBUTE is exercised by a test.
 *
 * This is a *meta*-test. It covers the three legs of the RC-6 predicate ("every documented attribute,
 * metric, and option has a test"):
 *   - options — the public `FieldOptions` surface, parsed from `core/types.ts`.
 *   - metrics — the readable handle output (`particleCount`).
 *   - attributes — the documented body data-attributes, derived from `apps/site/src/lib/docs-api.ts`
 *     `ATTRS[]` (the SAME source of truth `check:docs` treats as authoritative, so the two can't drift).
 * For each, it scans the packages test corpus and fails if a public name has no test referencing it.
 * It can't prove a test is *good*, but it makes it impossible to add a public option/metric/attribute
 * and ship it with zero coverage — the exact gap RC-6 closes.
 *
 * SCAN SCOPE differs by leg on purpose. The option/metric legs use the historical NON-recursive scan
 * (only the top-level test files directly in each package src) — see the docs/engineering-practices.md caveat that a new
 * option needs a top-level reference. The attribute leg uses a RECURSIVE scan, because body-attribute
 * coverage legitimately lives in sub-directory tests (`src/core`, `src/forces`) and forcing redundant
 * top-level references purely to satisfy the scan scope would be noise, not coverage.
 *
 * When you add a public option/metric, add a test that names it (or, for a pure internal seam, add it
 * to EXEMPT below with the reason). When you add a documented body attribute, add a test that references
 * it in its data-attribute form anywhere in the package test corpus (or EXEMPT_ATTRS it with a reason).
 * See docs/canonical/lifecycle-contract.md for the lifecycle side.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, type Dirent } from 'node:fs';
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

/** every *.test.ts under packages/* RECURSIVELY (excluding this guard), concatenated. Used by the
 *  attribute leg — body-attribute coverage lives in sub-directory tests (src/core/, src/forces/), so
 *  a recursive scan reflects real coverage instead of the option/metric legs' top-level-only scope. */
function testCorpusRecursive(): string {
  let corpus = '';
  const walk = (dir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // directory doesn't exist
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.test.ts') && e.name !== 'contract-coverage.test.ts')
        corpus += readFileSync(p, 'utf8') + '\n';
    }
  };
  for (const pkg of readdirSync(packagesDir)) walk(join(packagesDir, pkg, 'src'));
  return corpus;
}

/** The documented body `data-*` attribute suffixes, derived from `apps/site/src/lib/docs-api.ts`
 *  `ATTRS[]` — the SAME extraction `scripts/check-docs.mjs` (`docBodyAttrs`) treats as the authoritative
 *  documented surface, so the guard and the docs gate can never disagree about what's documented.
 *  Combined rows like `data-fmin / data-fmax` split on ` / ` before the `data-` prefix is stripped. */
function documentedBodyAttrs(): string[] {
  const docsApi = readFileSync(join(packagesDir, '..', 'apps', 'site', 'src', 'lib', 'docs-api.ts'), 'utf8');
  const start = docsApi.indexOf('export const ATTRS');
  assert.notEqual(start, -1, 'export const ATTRS not found in apps/site/src/lib/docs-api.ts');
  const block = docsApi.slice(start, docsApi.indexOf('\n];', start));
  // Pure string parse of each `name: <quoted value>` row (no quote chars in a regex — that trips
  // Node's lightweight TS type-stripping). For every `name:`, read the quote char that opens the
  // value and slice to the next matching quote; then split combined rows on the / separator.
  const suffixes = new Set<string>();
  const marker = 'name:';
  for (let i = block.indexOf(marker); i !== -1; i = block.indexOf(marker, i + 1)) {
    let j = i + marker.length;
    while (j < block.length && (block[j] === ' ' || block[j] === '\t')) j++;
    const quote = block[j];
    if (quote !== "'" && quote !== '"') continue;
    const end = block.indexOf(quote, j + 1);
    if (end === -1) continue;
    const value = block.slice(j + 1, end);
    for (const part of value.split('/')) {
      const clean = part.trim().replace(/^data-/, '');
      if (clean) suffixes.add(clean);
    }
  }
  return [...suffixes];
}

/** the keys declared inside an `export interface <name> { … }` block in core/types.ts. */
function interfaceKeys(name: string): string[] {
  const src = readFileSync(join(here, 'engine', 'types.ts'), 'utf8');
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

// documented body attributes with no meaningful unit-level test (none today — every documented
// attribute flows through parseBodyParams / the scanner and is unit-testable). Add here ONLY with a
// one-line reason, mirroring EXEMPT above; do NOT add an attribute here just to make the guard pass.
const EXEMPT_ATTRS = new Set<string>([]);

test('every documented body attribute is referenced by a test (RC-6 contract coverage)', () => {
  const corpus = testCorpusRecursive();
  // A documented attribute is "covered" when a test names it in its attribute form `data-<attr>`
  // (the low-false-positive signal — the bare suffix would match unrelated words like "cap"/"max").
  const missing = documentedBodyAttrs()
    .filter((a) => !EXEMPT_ATTRS.has(a))
    .filter((a) => !corpus.includes(`data-${a}`))
    .sort();
  assert.deepEqual(
    missing,
    [],
    `these documented body attributes have no test referencing them as data-<attr>: ${missing.join(', ')}\n` +
      `Add a test that references each (e.g. parseBodyParams(attrs({ '<attr>': … })) with a data-<attr> ` +
      `mention), or add it to EXEMPT_ATTRS (with a reason) if it is genuinely untestable at the unit level.`,
  );
});
