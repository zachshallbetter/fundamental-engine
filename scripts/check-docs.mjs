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
 *   7. render modes          (engine: FieldHandle.setRender  · docs: RENDER_MODES[])
 *   8. overlay readings      (engine: core/types.ts OverlayMode         · docs: OVERLAY_MODES[])
 *   9. field-cell attrs      (engine: elements/custom-elements.json     · docs: FIELD_CELL_ATTRS[])
 *  10. FieldHandle props     (engine: core/types.ts FieldHandle         · docs: HANDLE[])
 *  11. field events          (engine: core/engine/events.ts            · docs: EVENTS[])
 *  12. agent capabilities    (engine: core/types.ts AgentCapability    · docs: AGENT_CAPABILITIES[])
 *  13. snapshot profiles     (engine: core/types.ts SnapshotProfile    · docs: SNAPSHOT_PROFILES[])
 *  14. policy budgets        (engine: core/types.ts FieldBudgets       · docs: BUDGETS[])
 *  15. BodyHandle members    (engine: core/types.ts BodyHandle         · docs: BODY_HANDLE[])
 *
 * Surfaces 7-9 were added by docs-refactor Phase 2 (#997): the declarative authoring vocabulary was
 * the half of the surface the gate did not yet hold. The render/overlay tables in docs-api.ts were
 * hand-kept and ungated (the render table was missing `none`, the overlay table `off`), and the
 * SECOND custom element, `<field-cell>`, was documented nowhere on the site at all.
 *
 * Surfaces 10-15 were added by docs-refactor Phase 3 (#998) — the IMPERATIVE half. Surface 1 only
 * ever held the handle's CALLABLE members, so the four `readonly` properties (`version`,
 * `guarantees`, `policy`, `projections`) could change unchecked; and the event / capability /
 * profile / budget / body-handle vocabularies were ungated small closed sets, which is exactly how
 * the FieldHandle page came to document `absorb` and `release` long after the bus was renamed to
 * `captured` / `released` (#1020). Each is now enumerated from its source of truth.
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

const typesSrc = read('packages/core/src/engine/types.ts');
const feedbackSrc = read('packages/core/src/engine/feedback-sink.ts');
const scannerSrc = read('packages/core/src/engine/scanner.ts');
const eventsSrc = read('packages/core/src/engine/events.ts');
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

/** NON-callable members of the FieldHandle interface — `readonly name: T` / `name: T`. Surface 1
 *  above matches only `name(` / `name<`, so these four were never gated. */
function engineHandleProperties() {
  const set = new Set();
  for (const m of fieldHandleBlock().matchAll(/\n\s{2}(?:readonly\s+)?([a-zA-Z][\w]*)\s*:/g)) set.add(m[1]);
  return set;
}

/** Members of an arbitrary `export interface Name { … }` in core/types.ts — `name:` and `name(`. */
function engineInterfaceMembers(name) {
  const start = typesSrc.indexOf(`export interface ${name}`);
  if (start < 0) throw new Error(`check:docs: could not find \`export interface ${name}\` in core/types.ts`);
  const rest = typesSrc.slice(start);
  const block = rest.slice(0, rest.search(/\n\}/));
  const set = new Set();
  for (const m of block.matchAll(/\n\s{2}(?:readonly\s+)?([a-zA-Z][\w]*)\??\s*[(:]/g)) set.add(m[1]);
  return set;
}

/** Members of a `export type Name = 'a' | 'b'` string union in core/types.ts. */
function engineStringUnion(name) {
  const start = typesSrc.indexOf(`export type ${name}`);
  if (start < 0) throw new Error(`check:docs: could not find \`export type ${name}\` in core/types.ts`);
  const set = new Set();
  for (const m of typesSrc.slice(start, typesSrc.indexOf(';', start)).matchAll(/'([\w:-]+)'/g)) set.add(m[1]);
  return set;
}

/** Discrete event ids — the keys of `FieldEventMap` in core/engine/events.ts. */
function engineFieldEvents() {
  const start = eventsSrc.indexOf('export interface FieldEventMap');
  if (start < 0) throw new Error('check:docs: could not find FieldEventMap in core/engine/events.ts');
  const rest = eventsSrc.slice(start);
  const block = rest.slice(0, rest.search(/\n\}/));
  const set = new Set();
  for (const m of block.matchAll(/\n\s{2}([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
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

/** Element-consumer attributes — collected by the engine with `querySelectorAll('[data-X]')` on the
 *  host root in field.ts, and by `hasAttribute` on the body element. The body scanner never sees
 *  them, so extracting from scanner.ts alone reported 100% while six attributes were undocumented
 *  and one was documented only for a different surface (#1170). */
function engineElementAttrs() {
  const set = new Set();
  const fieldSrc = read('packages/core/src/engine/field.ts');
  for (const m of fieldSrc.matchAll(/querySelectorAll\('\[data-([\w-]+)\]'\)/g)) set.add(m[1]);
  // NOT hasAttribute: `data-dock` and `data-warp` are read that way on the BODY element, so they are
  // body attributes and live in ATTRS. This surface is the host-root sweep — elements that react to
  // the field rather than push it. Mixing the two would demand each be documented in both places.
  // `data-body` is the scanner's own surface, already covered by engineBodyAttrs().
  set.delete('body');
  return set;
}

/** The underlay render vocabulary `FieldHandle.setRender(mode:)` accepts — the same union
 *  `FieldOptions.render` and `<field-root render>` take. Scoped to the signature's `): void;` so a
 *  later string union in types.ts cannot leak in. */
function engineRenderModes() {
  const set = new Set();
  const at = typesSrc.indexOf('  setRender(');
  if (at < 0) throw new Error('check:docs: could not find FieldHandle.setRender in core/types.ts');
  const block = typesSrc.slice(at, typesSrc.indexOf('): void;', at));
  for (const m of block.matchAll(/'([a-z][\w-]*)'/g)) set.add(m[1]);
  return set;
}

/** The overlay READING vocabulary — the `OverlayMode` string union in core/types.ts. */
function engineOverlayModes() {
  const set = new Set();
  const start = typesSrc.indexOf('export type OverlayMode');
  if (start < 0) throw new Error('check:docs: could not find OverlayMode in core/types.ts');
  const block = typesSrc.slice(start, typesSrc.indexOf(';', start));
  for (const m of block.matchAll(/'([a-zA-Z][\w-]*)'/g)) set.add(m[1]);
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

/**
 * The `data-field-*` attributes the DOM PLATFORM LAYER reads from markup (#1190).
 *
 * Three files, not one — the same widening `engineElementAttrs` needed for `field.ts`. A gate that
 * reads a single file and calls it the surface is how these six stayed invisible while every one of
 * them was live: `metrics.ts` reads two, `lint.ts` two, `visual-bindings.ts` two.
 *
 * READS only. `bind-data.ts` also WRITES several of these names when a recipe generates them, and an
 * extractor that collected writes would demand documentation for engine output — the opposite of a
 * contract. Matching on `getAttribute` / `querySelectorAll` / `hasAttribute` keeps it to what an
 * author can set and the engine will honour.
 */
function enginePlatformAttrs() {
  const set = new Set();
  for (const f of ['metrics.ts', 'lint.ts', 'visual-bindings.ts']) {
    const src = read(`packages/dom/src/${f}`);
    for (const m of src.matchAll(/(?:getAttribute|hasAttribute)\('(data-field-[\w-]+)'\)/g)) set.add(m[1]);
    for (const m of src.matchAll(/querySelectorAll\('\[(data-field-[\w-]+)\]'\)/g)) set.add(m[1]);
    for (const m of src.matchAll(/\[(data-field-[\w-]+)\]/g)) set.add(m[1]);
  }
  return set;
}

// ── docs extractors (apps/site/src/lib/docs-api.ts) ─────────────────────────────────────────────

/** Names in a `{ name: 'x', … }` row array, scoped to `export const NAME: …[] = [ … ]`. */
function docRowNames(constName, key) {
  const start = docsApi.indexOf(`export const ${constName}`);
  if (start < 0) return new Set();
  const rest = docsApi.slice(start);
  let block = rest.slice(0, rest.indexOf('\n];'));
  // Strip comments before scanning. A commented-out row still carries `name: '…'`, so without this a
  // surface can be "documented" by a row nobody renders — the #1178 defect, in a second gate. Line
  // comments only: `desc` strings legitimately contain `/*`-free prose, and block comments here are
  // the JSDoc above the const, already excluded by slicing from `export const`.
  block = block.replace(/^\s*\/\/.*$/gm, '');
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

/** Every member name a HANDLE row documents. A `sig` is prose-ish — `setPolicy(policy) / policy / opt
 *  policy`, `version (property)` — because one row legitimately covers a setter, its read-back
 *  property and its option key. Split on ` / `, drop an `opt ` prefix, cut at the arg list, and keep
 *  what is left if it is an identifier, so all three names in that row count as documented. */
function docHandleNames() {
  const start = docsApi.indexOf('export const HANDLE');
  const block = docsApi.slice(start, docsApi.indexOf('\n];', start));
  const set = new Set();
  // the WHOLE quoted sig, not the `docRowNames` prefix (which stops at the first `(` and would drop
  // the alternates after it).
  for (const m of block.matchAll(/\bsig:\s*'([^']*)'/g)) {
    const raw = m[1];
    for (const part of raw.split(/\s*\/\s*/)) {
      const clean = part.trim().replace(/^opt\s+/, '').split('(')[0].trim();
      if (/^[A-Za-z]\w*$/.test(clean)) set.add(clean);
    }
  }
  return set;
}

/** Element attr names documented in a `{ name: 'x', … }` table for the given const. */
/** ELEMENT_ATTRS rows, with the `data-` prefix stripped so they compare against what the engine
 *  reads (`querySelectorAll('[data-move]')` yields `move`). Mirrors docBodyAttrs. */
function docElementConsumerAttrs() {
  const set = new Set();
  for (const raw of docRowNames('ELEMENT_ATTRS', 'name')) {
    const clean = raw.trim().replace(/^data-/, '');
    if (clean) set.add(clean);
  }
  return set;
}

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
    name: 'element-consumer attrs (data-*)',
    truth: engineElementAttrs(),
    docs: docElementConsumerAttrs(),
  },
  {
    name: 'platform attrs (packages/dom)',
    truth: enginePlatformAttrs(),
    docs: docElementAttrs('PLATFORM_ATTRS'),
  },
  {
    name: '<field-root> attrs',
    truth: cemAttrs('field-root'),
    docs: docElementAttrs('FIELD_ROOT_ATTRS'),
  },
  // the declarative authoring vocabulary (Phase 2, #997)
  {
    name: 'render modes (setRender / render)',
    truth: engineRenderModes(),
    docs: docRowNames('RENDER_MODES', 'name'),
  },
  {
    name: 'overlay readings (setOverlay / overlay)',
    truth: engineOverlayModes(),
    docs: docRowNames('OVERLAY_MODES', 'name'),
  },
  {
    name: '<field-cell> attrs',
    truth: cemAttrs('field-cell'),
    docs: docElementAttrs('FIELD_CELL_ATTRS'),
  },
  // the imperative / observable vocabulary (Phase 3, #998)
  {
    name: 'FieldHandle properties',
    truth: engineHandleProperties(),
    docs: docHandleNames(),
  },
  {
    name: 'field events (on)',
    truth: engineFieldEvents(),
    docs: docRowNames('EVENTS', 'name'),
  },
  {
    name: 'agent capabilities (forAgent)',
    truth: engineStringUnion('AgentCapability'),
    docs: docRowNames('AGENT_CAPABILITIES', 'name'),
  },
  {
    name: 'snapshot profiles',
    truth: engineStringUnion('SnapshotProfile'),
    docs: docRowNames('SNAPSHOT_PROFILES', 'name'),
  },
  {
    name: 'policy budgets',
    truth: engineInterfaceMembers('FieldBudgets'),
    docs: docRowNames('BUDGETS', 'name'),
  },
  {
    name: 'BodyHandle members',
    truth: engineInterfaceMembers('BodyHandle'),
    docs: docRowNames('BODY_HANDLE', 'name'),
  },
];

// A gate that can quietly shrink is not a gate (#1187).
//
// Two surfaces once collapsed into ONE object during a merge — duplicate keys in the same literal,
// where JavaScript silently keeps the last. The element-consumer surface vanished, every check still
// passed, and the run reported sixteen surfaces where it should have reported seventeen. Nothing in
// the output said so; you had to count.
//
// This floor makes that failure loud. Raise it when you add a surface — that is the point: adding one
// is deliberate, losing one never is.
const EXPECTED_SURFACES = 17;
if (surfaces.length < EXPECTED_SURFACES) {
  console.error(
    `check:docs: only ${surfaces.length} surfaces are registered, expected at least ${EXPECTED_SURFACES}.\n` +
      'A surface was dropped — check for two entries merged into one object literal (duplicate keys, ' +
      'last one wins) rather than two separate `{ … }` entries.',
  );
  process.exit(1);
}
const dupes = surfaces.map((s) => s.name).filter((n, i, a) => a.indexOf(n) !== i);
if (dupes.length) {
  console.error(`check:docs: duplicate surface name(s): ${[...new Set(dupes)].join(', ')}`);
  process.exit(1);
}

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
