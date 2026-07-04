#!/usr/bin/env node
/**
 * gen:parity-matrix — the cross-platform capability support matrix (docs-refactor Phase 0, §3/§5).
 *
 * The guides used to imply the three platforms (JS · Swift · Kotlin) offer the same surface. They do
 * not — Swift is the high-water mark, Kotlin lags. This generator makes that divergence a MACHINE-
 * CHECKABLE fact: it enumerates each plane's public symbols from the port sources plus the shared
 * cross-plane conformance golden, and emits `data/parity-matrix.json` — the data behind the §3 table.
 *
 * Because the three ports have no shared reflection surface, each plane gets a LIGHTWEIGHT
 * public-symbol extractor (a scoped regex parse of its FieldHandle + force + render vocabulary):
 *   - JS      : the `FieldHandle`/`FieldOptions` interfaces + the three force-source files + the
 *               `RenderMode`/`OverlayMode`-equivalent vocab (core/types.ts, forces/*, passport.ts),
 *               reusing the same scoping the check:docs gate already trusts, plus the frozen public
 *               values from scripts/api-surface.data.mjs.
 *   - Swift   : the `public protocol FieldHandle` block + the `RenderMode`/`OverlayMode` enums +
 *               the force catalogs (swift/Sources/FundamentalCore/**).
 *   - Kotlin  : the `class FieldHandle` block + the `enum class RenderMode`/`OverlayMode` +
 *               the force catalogs (android/fundamental-core/src/main/**).
 * Shared      : the conformance golden's force list (the ports are proven equal on it at depth:0).
 *
 * A capability that is an IDIOM difference (DOM scan vs `.fieldBody()` vs `Modifier.fieldBody`) is an
 * equivalent, not a gap; a capability genuinely absent (a method missing from a port's handle) is a
 * gap. The matrix records, per capability row, the raw support set on each plane so downstream (the
 * check:docs gate, the docs support rows) can render `JS ✓ · Swift ✓ · Kotlin ✗` honestly.
 *
 *   pnpm gen:parity-matrix    # regenerate data/parity-matrix.json after a port surface change
 *   pnpm check:docs           # CI gate: regenerates the matrix and fails if the committed copy drifted
 *
 * Lives in scripts/ (plain JS, node:fs) alongside the other generators; the ports are parsed as text,
 * so nothing here compiles Swift/Kotlin — a grep/parse of the public surface is the v1 contract (§11).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const readIf = (p) => (existsSync(resolve(root, p)) ? read(p) : '');

// ── generic scoping helper ──────────────────────────────────────────────────────────────────────

/** Slice a source from the first line containing `header` to the first subsequent column-0 `}` —
 *  the same block-scoping the check:docs gate uses so we never pick up a sibling type's members. */
function blockAfter(src, header) {
  const start = src.indexOf(header);
  if (start < 0) return '';
  const rest = src.slice(start);
  const endRel = rest.search(/\n\}/);
  return endRel < 0 ? rest : rest.slice(0, endRel);
}

const sortedArr = (set) => [...set].sort();

/** Canonicalize a render/overlay mode id to kebab-case so pure idiom differences (`fieldLines` on
 *  Swift/Kotlin vs `field-lines` on JS, `none_`/`NONE` vs `none`) collapse to ONE symbol — they are
 *  equivalents, not gaps. Naming-lane spelling is not a capability divergence. */
const kebab = (s) => s.replace(/_+$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const kebabSet = (set) => new Set([...set].map(kebab));

// ── JS (reference) extractors ─────────────────────────────────────────────────────────────────────

const jsTypes = read('packages/core/src/engine/types.ts');
const jsPassport = read('packages/core/src/contracts/passport.ts');

function jsHandleMethods() {
  const set = new Set();
  const block = blockAfter(jsTypes, 'export interface FieldHandle');
  for (const m of block.matchAll(/\n\s{2}([a-zA-Z][\w]*)\s*[(<]/g)) set.add(m[1]);
  return set;
}

function jsOptions() {
  const set = new Set();
  const block = blockAfter(jsTypes, 'interface FieldOptions');
  for (const m of block.matchAll(/\n\s{2}([a-zA-Z][\w]*)\??:/g)) set.add(m[1]);
  return set;
}

function jsForceTokens() {
  const set = new Set();
  for (const f of [
    'packages/core/src/forces/index.ts',
    'packages/core/src/forces/natural.ts',
    'packages/core/src/forces/extended.ts',
  ]) {
    for (const m of read(f).matchAll(/token:\s*'([a-z][a-z-]+)'/g)) set.add(m[1]);
  }
  return set;
}

/** RenderMode string-union members from passport.ts (`| 'dots'`). */
function jsRenderModes() {
  const set = new Set();
  const start = jsPassport.indexOf('export type RenderMode');
  const block = jsPassport.slice(start, jsPassport.indexOf(';', start));
  for (const m of block.matchAll(/'([a-z][\w-]*)'/g)) set.add(m[1]);
  return set;
}

/** Overlay reading vocab — the `OverlayMode` string union in core/types.ts. */
function jsOverlayModes() {
  const set = new Set();
  const start = jsTypes.indexOf('export type OverlayMode');
  if (start >= 0) {
    const block = jsTypes.slice(start, jsTypes.indexOf(';', start));
    for (const m of block.matchAll(/'([a-zA-Z][\w-]*)'/g)) set.add(m[1]);
  }
  return set;
}

/** Frozen public value exports (createField, browserHost, bindData, …) from the api-surface data. */
async function jsFrozenValues() {
  const mod = await import(resolve(root, 'scripts/api-surface.data.mjs'));
  return new Set(mod.FROZEN_VALUES.map((v) => v.name));
}

// ── Swift extractors ──────────────────────────────────────────────────────────────────────────────

const swiftHandleSrc = readIf('swift/Sources/FundamentalCore/Engine/FieldHandle.swift');
const swiftForceFiles = [
  'swift/Sources/FundamentalCore/Forces/CoreForces.swift',
  'swift/Sources/FundamentalCore/Forces/NaturalForces.swift',
  'swift/Sources/FundamentalCore/Forces/ExtendedForces.swift',
];

function swiftHandleMethods() {
  const set = new Set();
  const block = blockAfter(swiftHandleSrc, 'public protocol FieldHandle');
  // `func name(` methods and `var name` computed properties on the protocol.
  for (const m of block.matchAll(/\bfunc\s+([a-zA-Z]\w*)\s*[(<]/g)) set.add(m[1]);
  for (const m of block.matchAll(/\bvar\s+([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
  return set;
}

function swiftOptions() {
  const set = new Set();
  const block = blockAfter(swiftHandleSrc, 'public struct FieldOptions');
  for (const m of block.matchAll(/\bpublic\s+var\s+([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
  return set;
}

function swiftForceTokens() {
  const set = new Set();
  for (const f of swiftForceFiles) {
    // `public let token = "attract"` — the per-force declaration in the Swift catalogs.
    for (const m of readIf(f).matchAll(/\btoken\s*=\s*"([a-z][a-z-]+)"/g)) set.add(m[1]);
  }
  return set;
}

/** Enum-case names of a Swift `enum Name: String { case a, b, c }` (single or multi-line). */
function swiftEnumCases(src, enumName) {
  const set = new Set();
  const block = blockAfter(src, `enum ${enumName}`);
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*case\s+(.+)$/);
    if (!m) continue;
    for (const raw of m[1].split(',')) {
      const name = raw.trim().replace(/\(.*$/, '').replace(/_+$/, '').trim();
      if (name && /^[a-zA-Z]/.test(name)) set.add(name);
    }
  }
  return set;
}

const swiftRenderModes = () => swiftEnumCases(swiftHandleSrc, 'RenderMode');
const swiftOverlayModes = () => swiftEnumCases(swiftHandleSrc, 'OverlayMode');

// ── Kotlin extractors ───────────────────────────────────────────────────────────────────────────

const ktHandleSrc = readIf('android/fundamental-core/src/main/kotlin/com/fundamental/core/runtime/FieldHandle.kt');
const ktForceFiles = [
  'android/fundamental-core/src/main/kotlin/com/fundamental/core/forces/CoreForces.kt',
  'android/fundamental-core/src/main/kotlin/com/fundamental/core/forces/NaturalForces.kt',
  'android/fundamental-core/src/main/kotlin/com/fundamental/core/forces/ExtendedForces.kt',
];

function kotlinHandleMethods() {
  const set = new Set();
  const block = blockAfter(ktHandleSrc, 'class FieldHandle');
  // Public functions are the default visibility in Kotlin (`fun name(`); skip `private`/`internal`.
  for (const m of block.matchAll(/\n\s*(?:@\w+\s+)*(?!private|internal)fun\s+([a-zA-Z]\w*)\s*\(/g)) set.add(m[1]);
  return set;
}

function kotlinForceTokens() {
  const set = new Set();
  // `override val token = "attract"` — the per-force declaration in the Kotlin catalogs.
  for (const f of ktForceFiles) {
    for (const m of readIf(f).matchAll(/\btoken\s*=\s*"([a-z][a-z-]+)"/g)) set.add(m[1]);
  }
  return set;
}

/** Enum-entry names of a Kotlin `enum class Name(...) { A("a"), B("b") }`. */
function kotlinEnumCases(src, enumName) {
  const set = new Set();
  const block = blockAfter(src, `enum class ${enumName}`);
  for (const m of block.matchAll(/\b([A-Z][A-Z0-9_]*)\s*\(\s*"([a-z][\w-]*)"/g)) set.add(m[2]);
  return set;
}

const kotlinRenderModes = () => kotlinEnumCases(ktHandleSrc, 'RenderMode');
const kotlinOverlayModes = () => kotlinEnumCases(ktHandleSrc, 'OverlayMode');

// ── shared conformance golden ─────────────────────────────────────────────────────────────────────

function goldenForces() {
  const g = JSON.parse(read('swift/Tests/FundamentalCoreTests/Fixtures/conformance-golden.json'));
  return new Set(g.forces ?? []);
}

// ── build the matrix ───────────────────────────────────────────────────────────────────────────

/** A capability dimension enumerated on each plane. `union` is every symbol seen on any plane; each
 *  plane lists which it supports, plus the count. A symbol present on JS but absent on Kotlin is a
 *  documented gap; the docs render the per-plane sets into a support row. */
function dimension(id, label, js, swift, kotlin) {
  const union = sortedArr(new Set([...js, ...swift, ...kotlin]));
  return {
    id,
    label,
    union,
    counts: { js: js.size, swift: swift.size, kotlin: kotlin.size },
    planes: {
      js: sortedArr(js),
      swift: sortedArr(swift),
      kotlin: sortedArr(kotlin),
    },
    // Per-symbol support triple — the honest ✓/✗ the §3 table renders.
    support: union.map((sym) => ({
      symbol: sym,
      js: js.has(sym),
      swift: swift.has(sym),
      kotlin: kotlin.has(sym),
    })),
  };
}

export async function buildParityMatrix() {
  const dims = [
    dimension('field-handle-methods', 'FieldHandle methods', jsHandleMethods(), swiftHandleMethods(), kotlinHandleMethods()),
    // Kotlin has no FieldOptions struct — it configures via FieldHandle/FieldController setters, so
    // its column is intentionally empty here (a documented idiom difference, not a missing capability).
    dimension('field-options', 'Field options (JS/Swift struct; Kotlin uses setters)', jsOptions(), swiftOptions(), new Set()),
    dimension('force-tokens', 'Force tokens', jsForceTokens(), swiftForceTokens(), kotlinForceTokens()),
    dimension('render-modes', 'Render modes', kebabSet(jsRenderModes()), kebabSet(swiftRenderModes()), kebabSet(kotlinRenderModes())),
    dimension('overlay-modes', 'Overlay readings', kebabSet(jsOverlayModes()), kebabSet(swiftOverlayModes()), kebabSet(kotlinOverlayModes())),
  ];

  const golden = goldenForces();
  const frozenValues = await jsFrozenValues();

  return {
    generated: 'scripts/gen-parity-matrix.mjs',
    note:
      'Cross-platform capability support matrix (docs-refactor §3/§5). Regenerate with `pnpm gen:parity-matrix`; ' +
      'check:docs fails if a port gains/loses a symbol without regenerating. Symbol sets are extracted by a ' +
      'lightweight per-port parse of the public FieldHandle/force/render surface — an idiom difference is an ' +
      'equivalent, a missing symbol is a gap.',
    planes: ['js', 'swift', 'kotlin'],
    conformanceGolden: {
      note: 'The shared cross-plane golden the ports reproduce at depth:0 — the proof the force math matches.',
      forces: sortedArr(golden),
      count: golden.size,
    },
    frozenPublicValues: sortedArr(frozenValues),
    dimensions: dims,
  };
}

/** The committed artifact path, exported so check:docs compares against the same file. */
export const PARITY_MATRIX_PATH = resolve(root, 'data/parity-matrix.json');

/** Serialize the matrix exactly as it is written to disk (stable 2-space JSON + trailing newline). */
export function serializeParityMatrix(matrix) {
  return JSON.stringify(matrix, null, 2) + '\n';
}

// Run as a script (`node scripts/gen-parity-matrix.mjs`) → regenerate + write. On import, do nothing.
if (import.meta.url === `file://${process.argv[1]}`) {
  const matrix = await buildParityMatrix();
  writeFileSync(PARITY_MATRIX_PATH, serializeParityMatrix(matrix));

  console.log('gen:parity-matrix — cross-platform capability support (js · swift · kotlin)\n');
  for (const d of matrix.dimensions) {
    const { js, swift, kotlin } = d.counts;
    console.log(`  ${d.label}: JS ${js} · Swift ${swift} · Kotlin ${kotlin}  (union ${d.union.length})`);
  }
  console.log(`\n  conformance golden: ${matrix.conformanceGolden.count} forces at depth:0`);
  console.log(`\nwrote ${PARITY_MATRIX_PATH.replace(root + '/', '')}`);
}
