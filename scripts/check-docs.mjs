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
 * Set DOCS_GATE_ENFORCE=1 (CI) to exit non-zero on any gap.
 *
 * Surfaces checked:
 *   1. FieldHandle methods   (engine: core/types.ts          · docs: HANDLE[])
 *   2. createField options   (engine: core/types.ts          · docs: OPTIONS[])
 *   3. feedback CSS vars     (engine: feedback-sink.ts       · docs: WRITEBACK[])
 *   4. force tokens          (engine: forces/{index,natural,extended}.ts · docs: atoms.json forces)
 *   5. body attrs            (engine: core/scanner.ts        · docs: ATTRS[])
 *   6. field-root attrs      (engine: elements/custom-elements.json     · docs: FIELD_ROOT_ATTRS[])
 *
 * It also asserts the cross-platform PARITY MATRIX (data/parity-matrix.json, §5) is current: it
 * regenerates the JS·Swift·Kotlin support matrix in-memory (via gen-parity-matrix.mjs) and fails if
 * the committed artifact drifted — so a port gaining/losing a symbol must update the matrix.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  buildParityMatrix,
  serializeParityMatrix,
  PARITY_MATRIX_PATH,
} from './gen-parity-matrix.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

const typesSrc = read('packages/core/src/core/types.ts');
const feedbackSrc = read('packages/core/src/core/feedback-sink.ts');
const scannerSrc = read('packages/core/src/core/scanner.ts');
const docsApi = read('apps/site/src/lib/docs-api.ts');
const atomsSrc = (() => { const d = JSON.parse(read('apps/site/src/data/atoms.json')); return Array.isArray(d) ? d : d.atoms ?? []; })();
const cem = JSON.parse(read('packages/elements/custom-elements.json'));

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

/** All force token ids registered in the three force-source files (36 total). */
function engineForceTokens() {
  const set = new Set();
  for (const f of ['packages/core/src/forces/index.ts', 'packages/core/src/forces/natural.ts', 'packages/core/src/forces/extended.ts']) {
    for (const m of read(f).matchAll(/token:\s*'([a-z][a-z-]+)'/g)) set.add(m[1]);
  }
  return set;
}

/** Body attribute suffixes (after `data-`) that the scanner recognizes. Extracted from the three
 *  parser paths in scanner.ts: parseBodyParams (a.get/has/num calls), authoredAttrs (getAttribute),
 *  BODY_SELECTOR bracket notation, and el.dataset.color. */
function engineBodyAttrs() {
  const set = new Set();
  // a.get('X') or a.has('X') — the BodyAttrs accessor contract used in parseBodyParams
  for (const m of scannerSrc.matchAll(/a\.(?:get|has)\('([\w-]+)'\)/g)) set.add(m[1]);
  // num('X', defaultVal) — the shorthand float-parse helper in parseBodyParams
  for (const m of scannerSrc.matchAll(/num\('([\w-]+)',/g)) set.add(m[1]);
  // el.getAttribute('data-X') — direct DOM reads in authoredAttrs
  for (const m of scannerSrc.matchAll(/getAttribute\('data-([\w-]+)'\)/g)) set.add(m[1]);
  // [data-X] selectors in BODY_SELECTOR
  for (const m of scannerSrc.matchAll(/\[data-([\w-]+)\]/g)) set.add(m[1]);
  // el.dataset.color in makeBody (property accessor, not getAttribute)
  if (scannerSrc.includes('dataset.color')) set.add('color');
  return set;
}

/** Observed attributes on a CEM-declared custom element. */
function cemAttrs(tagName) {
  const set = new Set();
  for (const mod of cem.modules ?? []) {
    for (const decl of mod.declarations ?? []) {
      if (decl.tagName === tagName) {
        for (const attr of decl.attributes ?? []) if (attr.name) set.add(attr.name);
      }
    }
  }
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

/** Force token ids documented in atoms.json (kind === 'force', data.token present). */
function docForceTokens() {
  return new Set(atomsSrc.filter((a) => a.kind === 'force' && a.data?.token).map((a) => a.data.token));
}

/** Body attr suffixes (after `data-`) documented in the ATTRS table.
 *  Handles combined entries like `data-fmin / data-fmax` by splitting on ' / '
 *  BEFORE stripping the `data-` prefix, so each part is cleaned independently. */
function docBodyAttrs() {
  const rawNames = docRowNames('ATTRS', 'name');
  const set = new Set();
  for (const raw of rawNames) {
    for (const part of raw.split(/\s*\/\s*/)) {
      const clean = part.trim().replace(/^data-/, '');
      if (clean) set.add(clean);
    }
  }
  return set;
}

/** Element attr names documented in a `{ name: 'x', … }` table for the given const. */
function docElementAttrs(constName) {
  return docRowNames(constName, 'name');
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
  },
  {
    name: 'feedback CSS variables',
    truth: engineFeedbackVars(),
    docs: docRowNames('WRITEBACK', 'name'),
  },
  {
    name: 'force tokens',
    truth: engineForceTokens(),
    docs: docForceTokens(),
  },
  {
    name: 'body attrs (data-*)',
    truth: engineBodyAttrs(),
    docs: docBodyAttrs(),
  },
  {
    name: '<field-root> attrs',
    truth: cemAttrs('field-root'),
    docs: docElementAttrs('FIELD_ROOT_ATTRS'),
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

// ── parity matrix freshness (§5) ─────────────────────────────────────────────────────────────────
// Regenerate the JS·Swift·Kotlin support matrix in-memory and compare against the committed artifact.
// A port that gains or loses a public symbol (FieldHandle method, force, render/overlay mode, option)
// shifts the matrix — if data/parity-matrix.json wasn't regenerated to match, this fails: the docs'
// per-platform support rows would silently drift from the ports otherwise.
let matrixStale = false;
try {
  const fresh = serializeParityMatrix(await buildParityMatrix());
  const committed = existsSync(PARITY_MATRIX_PATH) ? readFileSync(PARITY_MATRIX_PATH, 'utf8') : '';
  if (fresh !== committed) {
    matrixStale = true;
    console.log(
      committed
        ? '\n✗ parity matrix: data/parity-matrix.json is STALE — a port surface changed. Run `pnpm gen:parity-matrix`.'
        : '\n✗ parity matrix: data/parity-matrix.json is MISSING. Run `pnpm gen:parity-matrix`.',
    );
    gaps.push({ surface: 'parity matrix (data/parity-matrix.json)', missing: ['regenerate with pnpm gen:parity-matrix'] });
  } else {
    console.log('\n✓ parity matrix: data/parity-matrix.json is current with the JS/Swift/Kotlin surfaces.');
  }
} catch (err) {
  matrixStale = true;
  console.log(`\n✗ parity matrix: failed to build (${err.message}).`);
  gaps.push({ surface: 'parity matrix (build error)', missing: [err.message] });
}

if (gaps.length === 0) {
  console.log('No documentation gaps in the checked surfaces. ✓');
  process.exit(0);
}

if (process.env.DOCS_GATE_ENFORCE === '1') {
  console.log('\nDOCS_GATE_ENFORCE=1 → failing on the gaps above.');
  process.exit(1);
}
console.log('\n(advisory: set DOCS_GATE_ENFORCE=1 to fail CI on these gaps)');
process.exit(0);
