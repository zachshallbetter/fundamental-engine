#!/usr/bin/env node
/**
 * check:docs — the documentation coverage gate (Phase 0 of the docs refactor).
 *
 * The reason docs rot is that nothing fails when they drift from the engine. This gate makes
 * "no mysteries" structural: it enumerates the engine's public surface from the SOURCES OF TRUTH
 * and asserts each item has a doc entry in apps/site/src/lib/docs-api.ts (the data behind the
 * /docs/api/* pages). A new FieldHandle method, option, or feedback variable that ships without a
 * doc entry FAILS this check — so the documentation cannot silently fall behind.
 *
 * It is designed to ship RED: on first run it reports the current gaps (a burndown metric for the
 * refactor). Set DOCS_GATE_ENFORCE=1 (CI, once green) to exit non-zero on any gap.
 *
 * This is a deliberately small, robust first version covering the three highest-value, most
 * drift-prone, hand-maintained surfaces:
 *   1. FieldHandle methods   (engine: core/types.ts  ·  docs: HANDLE[])
 *   2. createField options   (engine: core/types.ts  ·  docs: OPTIONS[])
 *   3. feedback CSS variables(engine: feedback-sink.ts · docs: WRITEBACK[])
 * Forces / data-* attributes / element members / parity matrix are TODO surfaces (see the plan,
 * docs/design/docs-refactor-plan.md §4) — each is a new `surface()` entry below.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

const typesSrc = read('packages/core/src/core/types.ts');
const feedbackSrc = read('packages/core/src/core/feedback-sink.ts');
const docsApi = read('apps/site/src/lib/docs-api.ts');

// ── source-of-truth extractors ────────────────────────────────────────────────────────────────

/** The body of `export interface FieldHandle { … }` — scoped so we don't pick up other interfaces'
 *  methods (ScalarGrid, BodyHandle, Force, …). Closes at the first column-0 `}`. */
function fieldHandleBlock() {
  const start = typesSrc.indexOf('export interface FieldHandle');
  if (start < 0) throw new Error('check:docs: could not find `export interface FieldHandle` in core/types.ts');
  const rest = typesSrc.slice(start);
  const endRel = rest.search(/\n\}/);
  return rest.slice(0, endRel);
}

/** Member names declared in the FieldHandle interface: `name(` methods + `name<` generics. Excludes
 *  comments and the `readonly version` property (tracked separately as a property, not a method). */
function engineHandleMethods() {
  const set = new Set();
  for (const m of fieldHandleBlock().matchAll(/\n\s{2}([a-zA-Z][\w]*)\s*[(<]/g)) set.add(m[1]);
  return set;
}

/** The body of `export interface FieldOptions { … }` → its field names (`name?:` / `name:`). */
function engineOptions() {
  const start = typesSrc.indexOf('interface FieldOptions');
  if (start < 0) throw new Error('check:docs: could not find FieldOptions in core/types.ts');
  const rest = typesSrc.slice(start);
  const block = rest.slice(0, rest.search(/\n\}/));
  const set = new Set();
  for (const m of block.matchAll(/\n\s{2}([a-zA-Z][\w]*)\??:/g)) set.add(m[1]);
  return set;
}

/** CSS custom properties the feedback sink writes (`setProperty('--x', …)`). */
function engineFeedbackVars() {
  const set = new Set();
  for (const m of feedbackSrc.matchAll(/setProperty\('(--[\w-]+)'/g)) set.add(m[1]);
  return set;
}

// ── docs extractors (apps/site/src/lib/docs-api.ts) ─────────────────────────────────────────────

/** Names in a `{ name: 'x', … }` row array, scoped to `export const NAME: …[] = [ … ]`. */
function docRowNames(constName, key) {
  const start = docsApi.indexOf(`export const ${constName}`);
  if (start < 0) return new Set();
  const rest = docsApi.slice(start);
  const block = rest.slice(0, rest.indexOf('\n];'));
  const set = new Set();
  const re = new RegExp(`${key}:\\s*['"]([^'"(]+)`, 'g');
  for (const m of block.matchAll(re)) set.add(m[1].trim());
  return set;
}

// ── the surfaces ────────────────────────────────────────────────────────────────────────────────

const surfaces = [
  {
    name: 'FieldHandle methods',
    truth: engineHandleMethods(),
    docs: docRowNames('HANDLE', 'sig'), // sig: 'name(args)' → name
  },
  {
    name: 'createField options',
    truth: engineOptions(),
    docs: docRowNames('OPTIONS', 'name'),
    // `host`, `rng`, `now`, `overlayBackend`, `feedbackSink` are advanced/internal — still want docs,
    // but they're acceptable as known-low-priority; surfaced, not excluded.
  },
  {
    name: 'feedback CSS variables',
    truth: engineFeedbackVars(),
    docs: docRowNames('WRITEBACK', 'name'),
  },
];

// ── run ───────────────────────────────────────────────────────────────────────────────────────

let totalTruth = 0;
let totalCovered = 0;
const gaps = [];

console.log('check:docs — documentation coverage of the engine public surface\n');
for (const s of surfaces) {
  const missing = [...s.truth].filter((x) => !s.docs.has(x)).sort();
  const covered = s.truth.size - missing.length;
  totalTruth += s.truth.size;
  totalCovered += covered;
  const pct = s.truth.size ? Math.round((covered / s.truth.size) * 100) : 100;
  const mark = missing.length === 0 ? '✓' : '✗';
  console.log(`${mark} ${s.name}: ${covered}/${s.truth.size} documented (${pct}%)`);
  if (missing.length) {
    console.log(`    undocumented: ${missing.join(', ')}`);
    gaps.push({ surface: s.name, missing });
  }
}

const totalPct = totalTruth ? Math.round((totalCovered / totalTruth) * 100) : 100;
console.log(`\n${totalCovered}/${totalTruth} of the checked surface is documented (${totalPct}%).`);

if (gaps.length === 0) {
  console.log('No documentation gaps in the checked surfaces. ✓');
  process.exit(0);
}

if (process.env.DOCS_GATE_ENFORCE === '1') {
  console.log('\nDOCS_GATE_ENFORCE=1 → failing on the gaps above.');
  process.exit(1);
}
console.log('\n(advisory: set DOCS_GATE_ENFORCE=1 to fail CI on these gaps — see docs/design/docs-refactor-plan.md)');
process.exit(0);
